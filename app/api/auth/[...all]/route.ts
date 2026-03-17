import { NextRequest } from 'next/server';
import { createHash } from 'crypto';
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import {
  RateLimiter,
  authLoginLimiter,
  authSignupLimiter,
  authResetLimiter,
  auth2faLimiter,
  authGeneralLimiter,
  perEmailLoginLimiter,
} from '@/lib/rateLimit';

const { GET: authGet, POST: authPost } = toNextJsHandler(auth);

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

// Map auth sub-paths to their dedicated rate limiters.
function getLimiterForPath(pathname: string): RateLimiter {
  if (pathname.endsWith('/sign-in/email')) return authLoginLimiter;
  if (pathname.endsWith('/sign-up/email')) return authSignupLimiter;
  if (pathname.endsWith('/forgot-password')) return authResetLimiter;
  if (pathname.endsWith('/reset-password')) return authResetLimiter;
  if (pathname.endsWith('/two-factor/verify')) return auth2faLimiter;
  if (pathname.endsWith('/two-factor/enable')) return auth2faLimiter;
  if (pathname.endsWith('/two-factor/disable')) return auth2faLimiter;
  if (pathname.endsWith('/verify-email')) return authGeneralLimiter;
  // Organization endpoints
  if (pathname.includes('/organization/create')) return authSignupLimiter;
  if (pathname.includes('/organization/create-invitation')) return authGeneralLimiter;
  return authGeneralLimiter;
}

// Paths that accept email in the request body for per-email rate limiting.
const EMAIL_RATE_LIMITED_PATHS = ['/sign-in/email', '/sign-up/email'];

export async function POST(req: NextRequest) {
  const limiter = getLimiterForPath(req.nextUrl.pathname);
  const rl = await limiter.check(getIp(req));
  if (!rl.allowed) {
    return new Response('Too many requests. Please try again later.', {
      status: 429,
      headers: rl.headers,
    });
  }

  // CLOUD-014: Per-email rate limiting for login and signup endpoints.
  // Mitigates distributed credential stuffing that bypasses IP-based limits.
  const needsEmailCheck = EMAIL_RATE_LIMITED_PATHS.some((p) =>
    req.nextUrl.pathname.endsWith(p),
  );
  if (needsEmailCheck) {
    try {
      const clone = req.clone();
      const body = await clone.json();
      if (typeof body?.email === 'string' && body.email.length > 0) {
        // Hash email to avoid storing PII in Redis.
        const emailKey = createHash('sha256')
          .update(body.email.toLowerCase().trim())
          .digest('hex');
        const emailRl = await perEmailLoginLimiter.check(emailKey);
        if (!emailRl.allowed) {
          return new Response(
            'Too many attempts for this account. Please try again later.',
            { status: 429, headers: emailRl.headers },
          );
        }
      }
    } catch {
      // Body parse failed — let better-auth handle the error.
    }
  }

  return authPost(req);
}

export { authGet as GET };
