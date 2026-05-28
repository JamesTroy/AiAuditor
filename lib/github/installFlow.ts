// CSRF-protected install flow for the Claudit GitHub App.
//
// Signed-state pattern (no Redis or cookie session needed):
//   1. /install builds a state token = base64({ userId, ts }) + HMAC.
//   2. GitHub round-trips the state on the callback URL.
//   3. /callback verifies the HMAC + checks the timestamp is within
//      INSTALL_STATE_TTL_MS. Falls back to confirming the user's session
//      matches the state's userId as defence-in-depth.
//
// Signing key reuses BETTER_AUTH_SECRET (already validated at module init
// to be ≥ 32 chars).

import { createHmac, timingSafeEqual } from 'crypto';
import type { NextRequest } from 'next/server';

export const INSTALL_STATE_TTL_MS = 10 * 60_000;
const DEFAULT_APP_SLUG = 'clauditconsulting';

/**
 * Return the externally-visible origin (e.g., https://aiauditor-production.up.railway.app).
 *
 * Why this helper exists: in Node.js-runtime route handlers, `req.url` is the
 * raw URL Node sees on the socket, which on Railway is the internal container
 * address `http://0.0.0.0:8080`. Using `new URL('/login', req.url)` for a
 * redirect therefore emits `Location: http://0.0.0.0:8080/login` — un-routable
 * from the user's browser. Middleware (Edge runtime) does NOT have this issue
 * because `request.url` there is forwarded-host-aware.
 *
 * Resolution order:
 *   1. x-forwarded-host + x-forwarded-proto (set by Railway's edge)
 *   2. host header + assumed https
 *   3. NEXT_PUBLIC_APP_URL env var
 *   4. http://localhost:3000 (local dev)
 */
export function publicOrigin(req: NextRequest): string {
  const proto = req.headers.get('x-forwarded-proto') ?? 'https';
  const host = req.headers.get('x-forwarded-host') ?? req.headers.get('host');
  if (host) return `${proto}://${host}`;
  return process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
}

interface StatePayload {
  userId: string;
  ts: number;
}

function getSecret(): string {
  const s = process.env.BETTER_AUTH_SECRET;
  if (!s || s.length < 32) {
    throw new Error('BETTER_AUTH_SECRET must be set (≥32 chars) for install-state signing.');
  }
  return s;
}

function base64urlEncode(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input) : input;
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(input: string): Buffer {
  const pad = '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

/** Build a signed state token tying the install request to a specific user. */
export function signInstallState(userId: string): string {
  const payload: StatePayload = { userId, ts: Date.now() };
  const body = base64urlEncode(JSON.stringify(payload));
  const sig = createHmac('sha256', getSecret()).update(body).digest();
  return `${body}.${base64urlEncode(sig)}`;
}

/**
 * Verify a state token. Returns the decoded payload when valid, or null
 * for any failure mode (bad format, bad HMAC, expired).
 */
export function verifyInstallState(state: string | null): StatePayload | null {
  if (!state) return null;
  const parts = state.split('.');
  if (parts.length !== 2) return null;
  const [body, sigB64] = parts;

  let providedSig: Buffer, expectedSig: Buffer;
  try {
    providedSig = base64urlDecode(sigB64);
    expectedSig = createHmac('sha256', getSecret()).update(body).digest();
  } catch {
    return null;
  }
  if (providedSig.length !== expectedSig.length) return null;
  if (!timingSafeEqual(providedSig, expectedSig)) return null;

  let payload: StatePayload;
  try {
    payload = JSON.parse(base64urlDecode(body).toString('utf8')) as StatePayload;
  } catch {
    return null;
  }
  if (typeof payload.userId !== 'string' || typeof payload.ts !== 'number') return null;
  if (Date.now() - payload.ts > INSTALL_STATE_TTL_MS) return null;
  return payload;
}

/**
 * Build the GitHub install URL for this App. The slug is configurable via
 * GITHUB_APP_SLUG; defaults to the current production slug for backward
 * compatibility on existing deploys.
 */
export function getGitHubInstallUrl(state: string): string {
  const slug = process.env.GITHUB_APP_SLUG ?? DEFAULT_APP_SLUG;
  const url = new URL(`https://github.com/apps/${slug}/installations/new`);
  url.searchParams.set('state', state);
  return url.toString();
}
