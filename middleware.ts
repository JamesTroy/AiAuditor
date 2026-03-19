// Nonce-based Content Security Policy + security headers.
//
// Per-request nonce removes the need for 'unsafe-inline' in both script-src
// and style-src. The nonce is forwarded to the Next.js runtime via x-nonce
// header so it stamps inline hydration scripts and styles automatically.
//
// Policy notes:
// - 'strict-dynamic': propagates nonce trust to dynamically loaded scripts.
// - 'unsafe-eval': required only in dev for webpack eval-source-maps.
// - style-src uses nonce instead of 'unsafe-inline' (VULN-003).
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSessionCookie } from 'better-auth/cookies';

// Routes that require authentication
const PROTECTED_PREFIXES = ['/dashboard', '/settings', '/admin'];

// Routes that authenticated users should be redirected away from
const AUTH_ROUTES = ['/login', '/signup', '/forgot-password'];

const isDev = process.env.NODE_ENV === 'development';
const hasPlausible = !!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

// PERF-013 / CRYPTO-002 / VULN-003: Pre-compute static CSP fragments.
// The nonce is inserted at two points: script-src and style-src.
// 'unsafe-inline' removed from both — nonce-aware browsers use nonces,
// and legacy browsers that don't understand nonces get a stricter policy.
const CSP_SCRIPT_PRE = "default-src 'self'; script-src 'nonce-";
const CSP_SCRIPT_POST = [
  "' 'strict-dynamic'",
  isDev ? " 'unsafe-eval'" : '',
  hasPlausible ? ' https://plausible.io' : '',
].join('');
const CSP_STYLE_PRE = "; style-src 'self' 'nonce-";
const CSP_TAIL = [
  "'",
  "; font-src 'self'",
  "; img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
  `; connect-src 'self'${hasPlausible ? ' https://plausible.io' : ''}`,
  "; frame-ancestors 'none'",
  "; object-src 'none'",
  "; base-uri 'self'",
  "; form-action 'self'",
  '; upgrade-insecure-requests',
  '; report-to csp-endpoint',
].join('');

// PERF-021: Pre-serialize Report-To header at module scope.
const REPORT_TO_HEADER = JSON.stringify({
  group: 'csp-endpoint',
  max_age: 86400,
  endpoints: [{ url: '/api/csp-report' }],
});

// PERF-025: Pre-serialize Reporting-Endpoints header at module scope.
const REPORTING_ENDPOINTS = 'csp-endpoint="/api/csp-report"';

export function middleware(request: NextRequest) {
  const startMs = Date.now();
  const { pathname } = request.nextUrl;

  // ── Auth gate ──────────────────────────────────────────────────
  // SECURITY NOTE: getSessionCookie checks cookie *presence*, not *validity*.
  // A stale or revoked session cookie will pass this gate. Full session
  // verification happens server-side in route handlers and server components.
  // We intentionally do NOT redirect logged-in users away from auth routes
  // because the cookie may be stale, causing an infinite redirect loop:
  //   /login → (middleware: cookie exists) → /dashboard → (no valid session) → /login
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

  // ── CSP nonce ──────────────────────────────────────────────────
  // CRYPTO-003: Use crypto.getRandomValues for 128-bit nonce in base64url format
  // (more compact and slightly stronger than UUID v4's 122 bits).
  const nonceBytes = new Uint8Array(16);
  crypto.getRandomValues(nonceBytes);
  const nonce = btoa(String.fromCharCode(...nonceBytes))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

  // PERF-013: Build CSP with nonce in both script-src and style-src.
  const csp = CSP_SCRIPT_PRE + nonce + CSP_SCRIPT_POST + CSP_STYLE_PRE + nonce + CSP_TAIL;

  // Forward nonce to the Next.js runtime — it stamps this value onto the
  // inline hydration scripts it generates, making them pass the nonce check.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  // ── Security headers ────────────────────────────────────────
  response.headers.set('Content-Security-Policy', csp);
  response.headers.set('Report-To', REPORT_TO_HEADER);
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  // VULN-002: Expanded Permissions-Policy — deny all device APIs not used by the app.
  response.headers.set(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=(), bluetooth=(), magnetometer=(), gyroscope=(), accelerometer=(), autoplay=(), encrypted-media=(), picture-in-picture=()',
  );
  response.headers.set('X-Content-Type-Options', 'nosniff');
  // SESS-004: Defense-in-depth for legacy browsers that don't support frame-ancestors.
  response.headers.set('X-Frame-Options', 'DENY');
  // VULN-002: Suppress infrastructure disclosure (Railway sets `Server: railway-edge`).
  response.headers.set('Server', '');
  // VULN-008: Explicitly disable XSS auditor — it causes more issues than it prevents
  // in modern browsers and can be exploited for information leakage.
  response.headers.set('X-XSS-Protection', '0');
  // COOP/CORP: Cross-origin isolation headers for defense-in-depth.
  response.headers.set('Cross-Origin-Opener-Policy', 'same-origin');
  response.headers.set('Cross-Origin-Resource-Policy', 'same-origin');
  // Request correlation ID for tracing and debugging.
  const requestId = crypto.randomUUID();
  response.headers.set('X-Request-Id', requestId);
  // SESS-005: HSTS — prevent SSL stripping attacks.
  // Reporting-Endpoints: modern alternative to Report-To for CSP violation reports.
  response.headers.set('Reporting-Endpoints', REPORTING_ENDPOINTS);
  // Server-Timing: expose middleware latency for observability (visible in DevTools Network tab).
  const mwMs = Date.now() - startMs;
  response.headers.set('Server-Timing', `mw;dur=${mwMs};desc="Middleware"`);
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
