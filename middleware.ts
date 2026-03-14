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

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Auth gate ──────────────────────────────────────────────────
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

  // ── CSP nonce ──────────────────────────────────────────────────
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const isDev = process.env.NODE_ENV === 'development';

  const csp = [
    "default-src 'self'",
    [
      'script-src',
      `'nonce-${nonce}'`,
      "'strict-dynamic'",
      "'unsafe-inline'", // ignored by nonce-aware browsers; fallback for legacy
      ...(isDev ? ["'unsafe-eval'"] : []),
    ].join(' '),
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
  ].join('; ');

  // Forward nonce to the Next.js runtime — it stamps this value onto the
  // inline hydration scripts it generates, making them pass the nonce check.
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set('x-nonce', nonce);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('Content-Security-Policy', csp);
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
