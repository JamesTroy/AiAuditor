import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { toNextJsHandler } from 'better-auth/next-js';
import {
  RateLimiter,
  authLoginLimiter,
  authSignupLimiter,
  authResetLimiter,
  auth2faLimiter,
  authGeneralLimiter,
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
  return authGeneralLimiter;
}

export async function POST(req: NextRequest) {
  const limiter = getLimiterForPath(req.nextUrl.pathname);
  const rl = limiter.check(getIp(req));
  if (!rl.allowed) {
    return new Response('Too many requests. Please try again later.', {
      status: 429,
      headers: rl.headers,
    });
  }
  return authPost(req);
}

export { authGet as GET };
