# Rate Limiting — Audit Input

## Project context
- **Framework**: Next.js 15 App Router (API route handlers)
- **Current rate limiting**: Custom in-memory sliding-window limiter on 2 of 7 endpoints
- **Traffic volume**: Low — single-digit QPS currently, expected to grow
- **Cost-sensitive endpoints**: `/api/audit` calls Anthropic Claude API (~$0.01–0.05/request); `/api/fetch-url` makes outbound HTTP requests
- **Known concerns**:
  - Auth endpoints (`/api/auth/*`) have zero rate limiting — login brute force possible
  - Health check endpoints have zero rate limiting — potential for monitoring abuse
  - Rate limiter is process-scoped (in-memory Map) — ineffective with multiple Railway instances
  - No per-user rate limiting — only per-IP, so authenticated users share limits with NAT'd networks
  - No global rate limit or WAF — no CDN-level protection configured

---

## 1. Complete API Endpoint Inventory

| Endpoint | Method | Auth Required | Rate Limited | Cost | Purpose |
|----------|--------|--------------|-------------|------|---------|
| `/api/audit` | POST | No (optional) | Yes (10/min/IP) | High (Anthropic API) | Run AI code audit |
| `/api/fetch-url` | POST | No | Yes (30/min/IP) | Low (outbound HTTP) | Fetch GitHub raw content |
| `/api/auth/[...all]` | GET, POST | No | **No** | Low (DB queries) | All auth operations (login, signup, 2FA, OAuth, password reset) |
| `/api/health` | GET | No | **No** | None | Liveness check |
| `/api/health/db` | GET | No | **No** | Low (DB query) | Database connectivity check |

---

## 2. Rate Limiting Implementation

```
--- lib/rateLimit.ts ---
```

```typescript
// Custom in-memory sliding-window rate limiter.
//
// Design:
//   - Each RateLimiter instance tracks a map of key → timestamp[] where the
//     key is typically an IP address.
//   - A sliding window keeps only timestamps within the last `windowMs` ms,
//     so the counter naturally decays without a hard reset boundary.
//   - A background cleanup interval evicts entries that have no timestamps in
//     the current window, bounding memory to active keys only.
//   - A hard cap (`maxEntries`) prevents a memory-DoS from a flood of unique IPs.
//     Once the cap is reached, new IPs are rejected until space opens up.
//   - `check()` returns standard rate-limit HTTP headers ready to attach to any
//     response, including 429s and successful responses (so clients know their
//     remaining budget).
//
// KNOWN LIMITATION: This store is process-scoped (Node.js module memory).
// In multi-worker / serverless deployments each worker has its own counter,
// making the effective limit N × maxRequests across N workers.
// Replace with a Redis/Upstash atomic counter (INCR + EXPIRE) for
// shared-state rate limiting across workers.

export interface RateLimiterConfig {
  /** Length of the sliding window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per key per window. */
  maxRequests: number;
  /**
   * Hard ceiling on the number of unique keys tracked simultaneously.
   * New keys are rejected (429) once this is reached.
   * Default: 10_000.
   */
  maxEntries?: number;
  /**
   * How often to sweep and evict idle entries (milliseconds).
   * Default: windowMs (entries stay at most one window after going idle).
   */
  cleanupIntervalMs?: number;
}

export interface RateLimitResult {
  /** Whether the request is within the limit. */
  allowed: boolean;
  /** Requests remaining in the current window (0 when denied). */
  remaining: number;
  /**
   * Unix-ms timestamp at which the oldest counted request will fall out of
   * the window, freeing one slot. Useful for Retry-After calculations.
   */
  resetAt: number;
  /**
   * Ready-to-use HTTP headers to attach to the response.
   * Includes X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset,
   * and Retry-After (only when denied).
   */
  headers: Record<string, string>;
}

export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxEntries: number;
  private readonly store = new Map<string, number[]>();
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(config: RateLimiterConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    this.maxEntries = config.maxEntries ?? 10_000;

    const cleanupMs = config.cleanupIntervalMs ?? config.windowMs;
    this.timer = setInterval(() => this.cleanup(), cleanupMs);
    // Don't hold the Node.js event loop open just for cleanup.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  /**
   * Record a request for `key` and return the rate-limit decision.
   * Always records the request first; the caller must honour `allowed`.
   */
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    // Evict timestamps outside the window.
    const timestamps = (this.store.get(key) ?? []).filter((t) => t > windowStart);

    // Enforce the entry cap for new keys.
    if (!this.store.has(key) && this.store.size >= this.maxEntries) {
      const resetAt = now + this.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        headers: this.buildHeaders(false, 0, resetAt),
      };
    }

    timestamps.push(now);
    this.store.set(key, timestamps);

    const count = timestamps.length;
    const allowed = count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - count);

    // Reset time: when the oldest request in the window will expire.
    const oldestInWindow = timestamps[0] ?? now;
    const resetAt = oldestInWindow + this.windowMs;

    return { allowed, remaining, resetAt, headers: this.buildHeaders(allowed, remaining, resetAt) };
  }

  /** Stop the background cleanup timer. Call this in tests to avoid open handles. */
  destroy(): void {
    clearInterval(this.timer);
  }

  private cleanup(): void {
    const windowStart = Date.now() - this.windowMs;
    for (const [key, timestamps] of this.store) {
      const active = timestamps.filter((t) => t > windowStart);
      if (active.length === 0) {
        this.store.delete(key);
      } else {
        this.store.set(key, active);
      }
    }
  }

  private buildHeaders(
    allowed: boolean,
    remaining: number,
    resetAt: number,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(this.maxRequests),
      'X-RateLimit-Remaining': String(remaining),
      // Seconds since epoch, matching the de-facto RateLimit-Reset convention.
      'X-RateLimit-Reset': String(Math.ceil(resetAt / 1_000)),
    };
    if (!allowed) {
      const retryAfterSecs = Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000));
      headers['Retry-After'] = String(retryAfterSecs);
    }
    return headers;
  }
}

// ---------------------------------------------------------------------------
// Named instances — one per logical endpoint.
// Tune limits independently as traffic patterns become clearer.
// ---------------------------------------------------------------------------

/** Primary audit endpoint: 10 requests per minute per IP. */
export const auditLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});

/** URL-fetch endpoint: 30 requests per minute per IP (cheaper operation). */
export const fetchUrlLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
});
```

### Rate limit state storage
- **In-memory** `Map<string, number[]>` — process-scoped, not shared across instances
- **No Redis, no external store**
- Background `setInterval` cleanup with `.unref()` to avoid holding the event loop

### Configured limits

| Limiter | Window | Max Requests | Max Entries |
|---------|--------|-------------|-------------|
| `auditLimiter` | 60s | 10/IP | 10,000 |
| `fetchUrlLimiter` | 60s | 30/IP | 10,000 |

---

## 3. Rate-limited endpoint: `/api/audit` (AI cost endpoint)

```
--- app/api/audit/route.ts ---
```

```typescript
import { NextRequest } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { getAgent } from '@/lib/agents';
import { auditLimiter } from '@/lib/rateLimit';
import { anthropicProvider } from '@/lib/ai/anthropicProvider';
import { auditRequestSchema } from '@/lib/schemas/auditRequest';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { audit as auditTable } from '@/lib/auth-schema';
import { eq } from 'drizzle-orm';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
}

export const runtime = 'nodejs';

const MAX_CONTENT_LENGTH = 120_000;
const STREAM_TIMEOUT_MS = 300_000; // 5 min hard timeout

const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ].filter(Boolean) as string[],
);

function log(level: 'info' | 'warn' | 'error', event: string, data?: Record<string, unknown>) {
  const entry = { ts: new Date().toISOString(), level, event, ...data };
  (level === 'info' ? console.log : level === 'warn' ? console.warn : console.error)(JSON.stringify(entry));
}

function anonymizeIp(ip: string): string {
  if (ip.includes(':')) return ip.split(':').slice(0, 3).join(':') + '::/48';
  const parts = ip.split('.');
  if (parts.length === 4) return `${parts[0]}.${parts[1]}.${parts[2]}.0`;
  return ip;
}

export async function POST(req: NextRequest) {
  const requestId = crypto.randomUUID();

  // CSRF origin check
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    log('warn', 'csrf_origin_rejected', { requestId, origin });
    return new Response('Forbidden', { status: 403, headers: { 'X-Request-Id': requestId } });
  }

  // Optional bearer token auth
  const expectedToken = process.env.API_ACCESS_TOKEN;
  if (expectedToken) {
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${expectedToken}`) {
      return new Response('Unauthorized', { status: 401, headers: { 'X-Request-Id': requestId } });
    }
  }

  // Rate limiting — 10 req/min/IP
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ?? '127.0.0.1';

  const rl = auditLimiter.check(ip);
  if (!rl.allowed) {
    log('warn', 'rate_limit_exceeded', { requestId, ip: anonymizeIp(ip) });
    return new Response('Too many requests. Please wait a moment.', {
      status: 429,
      headers: { ...rl.headers, 'X-Request-Id': requestId },
    });
  }

  // Content-Length pre-check
  const contentLengthHeader = req.headers.get('content-length');
  if (contentLengthHeader !== null) {
    const declaredLength = parseInt(contentLengthHeader, 10);
    if (!isNaN(declaredLength) && declaredLength > MAX_CONTENT_LENGTH) {
      return new Response('Request body too large', { status: 413 });
    }
  }

  // Parse + Zod validate body
  let rawBody: unknown;
  try { rawBody = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const parsed = auditRequestSchema.safeParse(rawBody);
  if (!parsed.success) return new Response(parsed.error.issues[0]?.message ?? 'Invalid request', { status: 400 });

  // ... streams to Anthropic API, stores result in DB
  // Auth is optional — anonymous users can run audits
}
```

### Security layers on this endpoint (in order):
1. CSRF origin check (allowlist)
2. Optional bearer token (`API_ACCESS_TOKEN`)
3. Per-IP rate limit (10/min sliding window)
4. Content-Length pre-check (120KB max)
5. Zod schema validation
6. 5-minute stream timeout (`AbortSignal.timeout`)

---

## 4. Rate-limited endpoint: `/api/fetch-url` (outbound HTTP proxy)

```
--- app/api/fetch-url/route.ts ---
```

```typescript
import { NextRequest } from 'next/server';
import { isAllowedUrl, ALLOWED_URL_DESCRIPTION } from '@/lib/config/urlAllowlist';
import { fetchUrlLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';
const MAX_BYTES = 30_000;

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ?? '127.0.0.1';

  const rl = fetchUrlLimiter.check(ip);
  if (!rl.allowed) {
    return new Response('Too many requests. Please wait a moment.', { status: 429, headers: rl.headers });
  }

  let body: { url?: unknown };
  try { body = await req.json(); } catch { return new Response('Invalid JSON', { status: 400 }); }

  const { url } = body;
  if (typeof url !== 'string' || !url.trim()) return new Response('Missing url', { status: 400 });

  const trimmed = url.trim();
  if (!isAllowedUrl(trimmed)) {
    return new Response(`Only raw GitHub and Gist URLs are supported (${ALLOWED_URL_DESCRIPTION})`, { status: 400 });
  }

  let fetchRes: Response;
  try {
    fetchRes = await fetch(trimmed, {
      headers: { 'User-Agent': 'Claudit/1.0' },
      signal: AbortSignal.timeout(10_000),
      redirect: 'error', // VULN-013: Never follow redirects
    });
  } catch (err) {
    return new Response(`Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`, { status: 502 });
  }

  if (!fetchRes.ok) return new Response(`Remote returned ${fetchRes.status}`, { status: 502 });

  const contentType = fetchRes.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    return new Response('URL returned HTML — use a raw content URL instead', { status: 400 });
  }

  const text = await fetchRes.text();
  const truncated = text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;

  return new Response(truncated, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8', 'X-Content-Type-Options': 'nosniff', 'Cache-Control': 'no-store' },
  });
}
```

### Security layers:
1. Per-IP rate limit (30/min)
2. URL allowlist (3 GitHub hosts, HTTPS only, no redirects)
3. HTML content rejection
4. 30KB response truncation
5. 10s fetch timeout

---

## 5. Unprotected endpoint: `/api/auth/[...all]` (ALL auth operations)

```
--- app/api/auth/[...all]/route.ts ---
```

```typescript
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';

export const { GET, POST } = toNextJsHandler(auth);
```

### Auth operations handled (all unauthenticated, all unrate-limited):
- `POST /api/auth/sign-up/email` — Create account
- `POST /api/auth/sign-in/email` — Login with email/password
- `POST /api/auth/sign-out` — Logout
- `POST /api/auth/forgot-password` — Send password reset email
- `POST /api/auth/reset-password` — Reset password with token
- `POST /api/auth/verify-email` — Verify email token
- `GET /api/auth/callback/github` — GitHub OAuth callback
- `GET /api/auth/callback/google` — Google OAuth callback
- `POST /api/auth/two-factor/verify` — Verify 2FA OTP
- `GET /api/auth/get-session` — Check current session

**No rate limiting, no CSRF origin check, no IP logging on any of these.**

---

## 6. Unprotected endpoints: Health checks

```
--- app/api/health/route.ts ---
```

```typescript
export const runtime = 'nodejs';

export function GET() {
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error(JSON.stringify({ ts: new Date().toISOString(), level: 'error', event: 'health_check_failed', reason: 'ANTHROPIC_API_KEY not configured' }));
    return new Response(null, { status: 503 });
  }
  return Response.json({ status: 'ok' });
}
```

```
--- app/api/health/db/route.ts ---
```

```typescript
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function GET() {
  try {
    await db.execute(sql`SELECT 1 as ok`);
    const tables = await db.execute(
      sql`SELECT tablename FROM pg_tables WHERE schemaname = 'public' ORDER BY tablename`
    );
    return Response.json({
      db: 'connected',
      tables: tables.map((r: Record<string, unknown>) => r.tablename),
    });
  } catch (err) {
    const e = err instanceof Error ? err : new Error(String(err));
    return Response.json({
      db: 'error',
      message: e.message,
      code: 'code' in e ? (e as Record<string, unknown>).code : undefined,
      dbHost: (process.env.DATABASE_URL ?? '').replace(/\/\/.*:.*@/, '//***:***@'),
    }, { status: 500 });
  }
}
```

**No rate limiting on either health endpoint.**

---

## 7. Middleware (auth gate + CSP — no rate limiting)

```
--- middleware.ts ---
```

```typescript
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

const PROTECTED_PREFIXES = ['/dashboard', '/settings', '/admin'];
const AUTH_ROUTES = ['/login', '/signup', '/forgot-password'];

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  const sessionCookie = getSessionCookie(request);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('callbackUrl', pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthRoute && sessionCookie) {
    return NextResponse.redirect(new URL('/dashboard', request.url));
  }

  // Nonce-based CSP generation (per-request)
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  const csp = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' 'strict-dynamic' 'unsafe-inline'${isDev ? " 'unsafe-eval'" : ''}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set('Content-Security-Policy', csp);
  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};
```

---

## 8. AI Provider (cost driver)

```
--- lib/ai/anthropicProvider.ts ---
```

```typescript
import Anthropic from '@anthropic-ai/sdk';

const MODEL = 'claude-sonnet-4-6';
const MAX_TOKENS = 8192;
const TEMPERATURE = 0;
const MAX_RETRIES = 3;
const RETRY_BASE_MS = 1_000;
const RETRYABLE_STATUS = new Set([429, 500, 502, 503, 529]);

const encoder = new TextEncoder();

function isRetryable(err: unknown): boolean {
  if (err instanceof Anthropic.APIError) return RETRYABLE_STATUS.has(err.status);
  return false;
}

export class AnthropicProvider {
  private client: Anthropic;

  constructor() { this.client = new Anthropic(); }

  streamAudit(systemPrompt: string, userInput: string, options?: { signal?: AbortSignal }): ReadableStream<Uint8Array> {
    const client = this.client;

    return new ReadableStream<Uint8Array>({
      async start(controller) {
        let attempt = 0;
        while (true) {
          attempt++;
          try {
            const stream = client.messages.stream(
              { model: MODEL, max_tokens: MAX_TOKENS, temperature: TEMPERATURE, system: systemPrompt, messages: [{ role: 'user', content: userInput }] },
              options?.signal ? { signal: options.signal } : undefined,
            );
            for await (const chunk of stream) {
              if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
                controller.enqueue(encoder.encode(chunk.delta.text));
              }
            }
            break; // success
          } catch (err) {
            if (options?.signal?.aborted) { controller.error(err); return; }
            if (attempt < MAX_RETRIES && isRetryable(err)) {
              await new Promise(r => setTimeout(r, RETRY_BASE_MS * 2 ** (attempt - 1)));
              continue;
            }
            controller.error(err); return;
          }
        }
        controller.close();
      },
    });
  }
}

export const anthropicProvider = new AnthropicProvider();
```

### Cost notes:
- Model: `claude-sonnet-4-6` — moderate cost per request
- Max 8192 output tokens per request
- Each audit request costs ~$0.01–0.05 depending on input/output size
- Retries up to 3x on transient errors — can multiply cost on 429/5xx bursts
- 10 req/min/IP = theoretical max 14,400 API calls/day from a single IP

---

## 9. URL Allowlist (for fetch-url proxy)

```
--- lib/config/urlAllowlist.ts ---
```

```typescript
const ALLOWED_HOSTS: ReadonlySet<string> = new Set([
  'raw.githubusercontent.com',
  'gist.githubusercontent.com',
  'gist.github.com',
]);

export function isAllowedUrl(rawUrl: string): boolean {
  let parsed: URL;
  try { parsed = new URL(rawUrl.trim()); } catch { return false; }

  if (parsed.protocol !== 'https:') return false;
  if (parsed.username || parsed.password) return false;
  if (parsed.port) return false;
  if (!ALLOWED_HOSTS.has(parsed.hostname)) return false;
  if (parsed.hostname === 'gist.github.com' && !parsed.pathname.includes('/raw/')) return false;

  return true;
}
```

---

## 10. Infrastructure / WAF / CDN configuration

- **No WAF configured** — no Cloudflare, AWS WAF, or Railway-level rate limiting
- **No CDN** — requests go directly to the Railway container
- **No `vercel.json` or `railway.toml`** with rate limit rules
- **No Redis or external rate limit store**

```
--- next.config.ts (security headers only, no rate limiting) ---
```

```typescript
const securityHeaders = [
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
];

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }];
  },
};
```

---

## Summary of gaps

| Endpoint | Rate Limited | Auth Required | Cost Risk |
|----------|:---:|:---:|:---:|
| `/api/audit` | 10/min/IP | No | **High** (Anthropic API) |
| `/api/fetch-url` | 30/min/IP | No | Low |
| `/api/auth/sign-in/email` | **None** | No | Low (brute force risk) |
| `/api/auth/sign-up/email` | **None** | No | Low (account spam risk) |
| `/api/auth/forgot-password` | **None** | No | Medium (email spam risk) |
| `/api/auth/two-factor/verify` | **None** | No | Low (OTP brute force risk) |
| `/api/health` | **None** | No | None |
| `/api/health/db` | **None** | No | Low (DB query per call) |
