// GitHub App authentication.
//
// Two-stage auth flow:
//   1. App JWT — RS256-signed token proving we are the GitHub App.
//      Used to call /app/* endpoints (e.g., create installation tokens).
//      Max 10-minute lifetime per GitHub spec.
//   2. Installation Access Token — short-lived (1 hour) token scoped to a
//      single installation. Used for all repo-scoped API calls.
//
// Tokens are cached in Redis (when available) keyed by installation_id,
// with a 60s safety buffer before GitHub's stated expiry. Falls back to a
// per-process Map if Redis is unavailable — acceptable because the cost of
// a cache miss is one extra round-trip to GitHub, not a correctness issue.

import { createSign, createPrivateKey } from 'crypto';
import { redis } from '@/lib/redis';

const TOKEN_CACHE_BUFFER_MS = 60_000;
const APP_JWT_TTL_SECONDS = 9 * 60; // 9 minutes — GitHub allows 10, leave a margin

interface InstallationTokenResponse {
  token: string;
  expires_at: string; // ISO 8601
  permissions: Record<string, string>;
  repository_selection: 'all' | 'selected';
}

interface CachedToken {
  token: string;
  expiresAtMs: number;
}

const localTokenCache = new Map<number, CachedToken>();

function getAppId(): string {
  const appId = process.env.GITHUB_APP_ID;
  if (!appId) throw new Error('GITHUB_APP_ID is not set');
  return appId;
}

function getPrivateKey(): string {
  const key = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!key) throw new Error('GITHUB_APP_PRIVATE_KEY is not set');
  // Railway/Vercel-style env vars sometimes wrap the PEM with literal \n.
  return key.includes('\\n') ? key.replace(/\\n/g, '\n') : key;
}

function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}

/**
 * Build a short-lived JWT for the GitHub App itself.
 * Use this to call /app/* endpoints — NOT for repo-scoped calls.
 */
export function buildAppJwt(): string {
  const now = Math.floor(Date.now() / 1000);
  const header = base64urlEncode(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const payload = base64urlEncode(
    JSON.stringify({
      // GitHub recommends iat = now - 60 to tolerate clock skew on their side.
      iat: now - 60,
      exp: now + APP_JWT_TTL_SECONDS,
      iss: getAppId(),
    }),
  );
  const signingInput = `${header}.${payload}`;

  const signer = createSign('RSA-SHA256');
  signer.update(signingInput);
  signer.end();
  const signature = signer.sign(createPrivateKey(getPrivateKey()));
  return `${signingInput}.${base64urlEncode(signature)}`;
}

async function readCachedToken(installationId: number): Promise<string | null> {
  const local = localTokenCache.get(installationId);
  if (local && local.expiresAtMs - Date.now() > TOKEN_CACHE_BUFFER_MS) return local.token;

  if (redis) {
    try {
      const raw = await redis.get<string>(`gh:install:${installationId}`);
      if (raw) {
        const parsed = JSON.parse(raw) as CachedToken;
        if (parsed.expiresAtMs - Date.now() > TOKEN_CACHE_BUFFER_MS) {
          localTokenCache.set(installationId, parsed);
          return parsed.token;
        }
      }
    } catch {
      // fall through to fresh fetch
    }
  }
  return null;
}

async function writeCachedToken(installationId: number, cached: CachedToken) {
  localTokenCache.set(installationId, cached);
  if (redis) {
    const ttlSec = Math.max(60, Math.floor((cached.expiresAtMs - Date.now()) / 1000));
    try {
      await redis.set(`gh:install:${installationId}`, JSON.stringify(cached), { ex: ttlSec });
    } catch {
      // best-effort
    }
  }
}

/**
 * Exchange the App JWT for an installation access token, with caching.
 * The returned token is good for ~1 hour and is scoped to a single installation.
 */
export async function getInstallationToken(installationId: number): Promise<string> {
  const cached = await readCachedToken(installationId);
  if (cached) return cached;

  const jwt = buildAppJwt();
  const res = await fetch(
    `https://api.github.com/app/installations/${installationId}/access_tokens`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${jwt}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'Claudit/1.0',
      },
      signal: AbortSignal.timeout(10_000),
    },
  );
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`GitHub installation token exchange failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as InstallationTokenResponse;
  const cachedEntry: CachedToken = {
    token: data.token,
    expiresAtMs: new Date(data.expires_at).getTime(),
  };
  await writeCachedToken(installationId, cachedEntry);
  return data.token;
}

/**
 * Verify a GitHub webhook delivery's HMAC-SHA256 signature.
 * GitHub sends `X-Hub-Signature-256: sha256=<hex>` computed over the raw body
 * using the webhook secret. Constant-time compare to prevent timing attacks.
 */
export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const [scheme, provided] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !provided) return false;

  // Lazy import — avoids paying for createHmac on every request.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac, timingSafeEqual } = require('crypto') as typeof import('crypto');
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  if (expected.length !== provided.length) return false;
  try {
    return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
  } catch {
    return false;
  }
}
