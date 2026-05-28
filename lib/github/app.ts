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

/**
 * Normalise a PEM string pulled from an env var.
 *
 * Real-world failure modes we've hit on Railway / Vercel:
 *   - The value is wrapped in literal `"`…`"` because the dashboard editor
 *     auto-quoted a paste with newlines.
 *   - Newlines were stripped on paste so the entire key is one line.
 *   - Newlines were escaped to literal `\n` (so the runtime sees `…\\nMI…`).
 *   - CRLF line endings instead of LF.
 *   - Trailing whitespace / blank lines.
 *
 * Strategy: strip quotes, decode `\n`, normalise CRLF→LF, then if the PEM
 * is still one line (no internal newlines but has BEGIN/END), rebuild it by
 * inserting newlines after the header, every 64 base64 chars, and before
 * the footer — which is what GitHub's downloaded .pem actually looks like.
 */
function normalizePem(raw: string): string {
  let s = raw.trim();
  // Strip a single layer of wrapping quotes (single or double).
  if ((s.startsWith('"') && s.endsWith('"')) || (s.startsWith("'") && s.endsWith("'"))) {
    s = s.slice(1, -1).trim();
  }
  // Literal backslash-n → actual newline.
  if (s.includes('\\n')) s = s.replace(/\\n/g, '\n');
  // Windows-style line endings.
  s = s.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  // Single-line PEM repair. Detect by: has BEGIN/END markers but no newlines
  // between them, OR has a single header line followed by base64 without breaks.
  const m = s.match(/^(-----BEGIN [A-Z0-9 ]+-----)([\s\S]+?)(-----END [A-Z0-9 ]+-----)\s*$/);
  if (m) {
    const header = m[1];
    const footer = m[3];
    // Strip ALL whitespace from the body, then re-wrap at 64 chars.
    const body = m[2].replace(/\s+/g, '');
    if (body.length > 0) {
      const wrapped = body.match(/.{1,64}/g)?.join('\n') ?? body;
      s = `${header}\n${wrapped}\n${footer}\n`;
    }
  }

  return s;
}

function getPrivateKey(): string {
  const key = process.env.GITHUB_APP_PRIVATE_KEY;
  if (!key) throw new Error('GITHUB_APP_PRIVATE_KEY is not set');
  const normalized = normalizePem(key);

  // Sanity-check before handing to crypto — fail fast with a useful reason.
  if (!normalized.includes('-----BEGIN') || !normalized.includes('-----END')) {
    throw new Error('GITHUB_APP_PRIVATE_KEY missing BEGIN/END markers — paste the full .pem contents');
  }
  return normalized;
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

  const pem = getPrivateKey();
  let keyObject;
  try {
    keyObject = createPrivateKey(pem);
  } catch (err) {
    // Reconstruct a useful diagnostic — the bare OpenSSL message
    // (`error:1E08010C:DECODER routines::unsupported`) is opaque on its own.
    const lines = pem.split('\n');
    const firstLine = lines[0] ?? '';
    throw new Error(
      `createPrivateKey failed: ${err instanceof Error ? err.message : String(err)} ` +
      `(pem starts with "${firstLine.slice(0, 40)}", ${lines.length} lines, ${pem.length} chars)`,
    );
  }
  const signature = signer.sign(keyObject);
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
// sha256 hex digest is exactly 64 lowercase-or-uppercase hex chars. Validating
// the header against this regex BEFORE decoding fixes a timing-side-channel
// where Buffer.from(provided, 'hex') would silently truncate at the first
// non-hex char, causing timingSafeEqual to throw synchronously — a path
// noticeably faster than the constant-time compare, so an attacker could
// distinguish "my hex was malformed" from "my hex was valid but wrong".
const SHA256_HEX_RE = /^[0-9a-fA-F]{64}$/;

export function verifyWebhookSignature(rawBody: string, signatureHeader: string | null): boolean {
  const secret = process.env.GITHUB_APP_WEBHOOK_SECRET;
  if (!secret || !signatureHeader) return false;
  const [scheme, provided] = signatureHeader.split('=');
  if (scheme !== 'sha256' || !provided) return false;
  // Up-front structural validation — any reject before this point is not a
  // timing risk because no HMAC has been computed yet.
  if (!SHA256_HEX_RE.test(provided)) return false;

  // Lazy import — avoids paying for createHmac on every request.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { createHmac, timingSafeEqual } = require('crypto') as typeof import('crypto');
  const expected = createHmac('sha256', secret).update(rawBody).digest('hex');
  // Both buffers are now guaranteed to be exactly 32 bytes — timingSafeEqual
  // runs the full constant-time loop with no early throw branch.
  return timingSafeEqual(Buffer.from(expected, 'hex'), Buffer.from(provided, 'hex'));
}
