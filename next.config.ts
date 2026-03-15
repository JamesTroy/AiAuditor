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
      {
        source: '/:path*',
        headers: securityHeaders,
      },
    ];
  },
};

export default nextConfig;
