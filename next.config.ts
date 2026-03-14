import type { NextConfig } from 'next';

// VULN-004/009/015: Security headers applied to every route.
// next/font/google self-hosts font files at build time (/_next/static/media/),
// so font-src 'self' is sufficient — no runtime call to fonts.googleapis.com.
// This resolves VULN-015 (no external assets without SRI).
const securityHeaders = [
  // VULN-004: HSTS — instructs browsers to always use HTTPS.
  // VULN-014: Combined with TLS this is the integrity guarantee for streamed responses.
  {
    key: 'Strict-Transport-Security',
    value: 'max-age=63072000; includeSubDomains',
  },
  // VULN-009: Content Security Policy.
  // 'unsafe-inline' for script/style is required by Next.js App Router hydration
  // and Tailwind. Nonce-based CSP would remove this but requires larger refactor.
  // The policy still provides meaningful protection via connect-src, frame-ancestors,
  // object-src, and form-action restrictions.
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline'",
      "style-src 'self' 'unsafe-inline'",
      "font-src 'self'",
      "img-src 'self' data: blob:", // blob: required for Download button (URL.createObjectURL)
      "connect-src 'self'",         // fetch('/api/audit') is same-origin only
      "frame-ancestors 'none'",     // prevents clickjacking
      "object-src 'none'",          // blocks Flash/plugins
      "base-uri 'self'",            // prevents base-tag injection
      "form-action 'self'",         // no forms post to external origins
      'upgrade-insecure-requests',
    ].join('; '),
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
