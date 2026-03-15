import type { NextConfig } from 'next';

// Security headers applied to every route via next.config.ts.
// VULN-007: Content-Security-Policy is intentionally absent here — it is set
// dynamically in middleware.ts with a per-request nonce, which allows removing
// 'unsafe-inline' from script-src for nonce-aware browsers.
// All other security headers remain here since they are static and need no nonce.
const securityHeaders = [
  // HSTS — instructs browsers to always use HTTPS.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  // Belt-and-suspenders clickjacking protection for browsers that predate CSP frame-ancestors.
  {
    key: 'X-Frame-Options',
    value: 'DENY',
  },
  {
    key: 'X-Content-Type-Options',
    value: 'nosniff',
  },
  {
    key: 'Referrer-Policy',
    value: 'strict-origin-when-cross-origin',
  },
  {
    key: 'Permissions-Policy',
    value: 'camera=(), microphone=(), geolocation=()',
  },
];

const nextConfig: NextConfig = {
  experimental: {
    sri: {
      algorithm: 'sha256',
    },
  },
  async redirects() {
    return [
      {
        source: '/stack',
        destination: '/how-it-works',
        permanent: true,
      },
    ];
  },
  async headers() {
    return [
      // Security headers on all routes.
      {
        source: '/:path*',
        headers: securityHeaders,
      },
      // CACHE-003: Vary header on API routes — prevents cache poisoning if a CDN
      // or shared proxy is added. Keys cached responses on auth/cookie state.
      {
        source: '/api/:path*',
        headers: [
          { key: 'Vary', value: 'Authorization, Cookie' },
        ],
      },
      // CACHE-003/009/025: CDN-ready cache headers for static and ISR pages.
      // s-maxage controls shared cache (CDN) TTL; max-age controls browser TTL;
      // stale-while-revalidate allows serving stale while fetching fresh copy.
      {
        source: '/audit/:agent',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=60' },
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      },
      {
        source: '/(privacy|how-it-works)',
        headers: [
          { key: 'Cache-Control', value: 'public, s-maxage=2592000, stale-while-revalidate=86400' },
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      },
      // CACHE-003: Default Vary: Accept-Encoding for all other pages.
      {
        source: '/((?!api|_next).*)',
        headers: [
          { key: 'Vary', value: 'Accept-Encoding' },
        ],
      },
    ];
  },
};

export default nextConfig;
