// VULN-007: Nonce-based Content Security Policy.
//
// A static CSP in next.config.ts must use 'unsafe-inline' because Next.js
// injects inline hydration scripts at runtime that cannot be hashed ahead of
// time. A per-request nonce solves this: each response carries a unique nonce
// that is stamped on those inline scripts by the Next.js runtime (via the
// x-nonce request header convention), removing the need for 'unsafe-inline'
// in script-src for modern browsers.
//
// Policy notes:
// - 'strict-dynamic': modern browsers propagate nonce trust to dynamically
//   loaded scripts, enabling Next.js chunk loading without an explicit hash.
// - 'unsafe-inline': kept as a fallback for browsers that don't support nonces
//   (they ignore 'strict-dynamic'; modern browsers ignore 'unsafe-inline' when
//   a nonce or 'strict-dynamic' is present, so there is no net regression).
// - 'unsafe-eval': required only in dev for webpack eval-source-maps.
// - style-src still requires 'unsafe-inline' (Tailwind + Next.js inline styles;
//   removing it would require a separate style nonce — out of scope here).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// Routes that require authentication
const PROTECTED_PREFIXES = ['/dashboard', '/settings', '/admin'];

// Routes that authenticated users should be redirected away from
const AUTH_ROUTES = ['/login', '/signup', '/forgot-password'];

// PERF-013: Pre-compute static CSP parts at module scope (runs once at cold start).
const isDev = process.env.NODE_ENV === 'development';
const hasPlausible = !!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

const CSP_BEFORE_NONCE = "default-src 'self'; script-src 'nonce-";
const CSP_AFTER_NONCE = [
  "' 'strict-dynamic' 'unsafe-inline'",
  isDev ? " 'unsafe-eval'" : '',
  hasPlausible ? ' https://plausible.io' : '',
  "; style-src 'self' 'unsafe-inline'",
  "; font-src 'self'",
  "; img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
  `; connect-src 'self'${hasPlausible ? ' https://plausible.io' : ''}`,
  "; frame-ancestors 'none'",
  "; object-src 'none'",
  "; base-uri 'self'",
  "; form-action 'self'",
  '; upgrade-insecure-requests',
  '; report-uri /api/csp-report',
  '; report-to csp-endpoint',
].join('');

// PERF-021: Pre-serialize Report-To header at module scope.
const REPORT_TO_HEADER = JSON.stringify({
  group: 'csp-endpoint',
  max_age: 86400,
  endpoints: [{ url: '/api/csp-report' }],
});

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Auth gate ──────────────────────────────────────────────────
  const sessionCookie = getSessionCookie(request);
  const isProtected = PROTECTED_PREFIXES.some((p) => pathname.startsWith(p));
  const isAuthRoute = AUTH_ROUTES.some((p) => pathname.startsWith(p));

  if (isProtected && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    // AUTH-001: Only pass safe relative paths as callbackUrl
    const safePath = pathname.startsWith('/') && !pathname.startsWith('//') ? pathname : '/dashboard';
    loginUrl.searchParams.set('callbackUrl', safePath);
    return NextResponse.redirect(loginUrl);
  }

  // NOTE: We intentionally do NOT redirect logged-in users away from auth routes.
  // The session cookie may be stale/expired, which causes a redirect loop:
  // /login → (middleware: cookie exists) → /dashboard → (no valid session) → /login.
  // Let the login page handle already-authenticated users client-side instead.

  // ── CSP nonce ──────────────────────────────────────────────────
  // PERF-020: Use UUID directly as nonce — 122 bits of entropy is sufficient.
  const nonce = crypto.randomUUID();

  // PERF-013: Per-request cost is one string concatenation instead of array allocation + 12 joins.
  const csp = CSP_BEFORE_NONCE + nonce + CSP_AFTER_NONCE;

  // Forward nonce to the Next.js runtime — it stamps this value onto the
  // inline hydration scripts it generates, making them pass the nonce check.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Report-To', REPORT_TO_HEADER);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // SESS-004: Defense-in-depth for legacy browsers that don't support frame-ancestors.
  response.headers.set('X-Frame-Options', 'DENY');
  // SESS-005: HSTS — prevent SSL stripping attacks.
  if (!isDev) {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload',
    );
  }
  return response;
}

export const config = {
  matcher: [
    // Run on all routes except Next.js static assets and image optimisation.
    // Those responses have no inline scripts; skipping them avoids unnecessary
    // nonce generation overhead on every static file request.
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
