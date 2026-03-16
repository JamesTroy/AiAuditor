import { NextRequest } from 'next/server';
import { RateLimiter } from '@/lib/rateLimit';

export const runtime = 'nodejs';

// CSP violation reporting endpoint.
// Browsers send POST requests here when a Content-Security-Policy violation occurs.
// We log violations server-side so they can be monitored without a third-party service.

// RL-005: Rate limit CSP reports — 30 reports/IP/min to prevent flood attacks.
const cspReportLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  prefix: 'csp-report',
});

// Body size cap: 4 KB is more than enough for any legitimate CSP report.
const MAX_BODY_BYTES = 4096;

// PRIV-009: Strip query parameters from document-uri to avoid logging PII.
function stripQueryParams(uri: string): string {
  try {
    const u = new URL(uri);
    return u.origin + u.pathname;
  } catch {
    return uri;
  }
}

// Filter out false positives from browser extensions, built-ins, and bots.
const noisePatterns = [
  /^chrome-extension:\/\//,
  /^moz-extension:\/\//,
  /^safari-extension:\/\//,
  /^ms-browser-extension:\/\//,
  /^about:/,
  /^blob:/,
  /^data:/,
  /^inline$/,
  /^eval$/,
];

export async function POST(req: NextRequest) {
  // Rate limiting
  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';

  const rl = await cspReportLimiter.check(ip);
  if (!rl.allowed) {
    return new Response(null, { status: 429, headers: rl.headers });
  }

  // Content-Type validation — browsers send CSP reports as application/csp-report or application/json.
  const ct = req.headers.get('content-type') ?? '';
  if (!ct.includes('application/csp-report') && !ct.includes('application/json') && !ct.includes('application/reports+json')) {
    return new Response(null, { status: 415 });
  }

  // Body size cap — reject oversized payloads before parsing.
  const contentLength = req.headers.get('content-length');
  if (contentLength !== null && parseInt(contentLength, 10) > MAX_BODY_BYTES) {
    return new Response(null, { status: 413 });
  }

  try {
    const rawText = await req.text();
    if (rawText.length > MAX_BODY_BYTES) {
      return new Response(null, { status: 413 });
    }

    const body = JSON.parse(rawText);

    // Browsers send either { "csp-report": { ... } } (report-uri format)
    // or an array of Reporting API v1 objects (report-to format).
    const report = body?.['csp-report'] ?? body;
    if (typeof report !== 'object' || report === null) return new Response(null, { status: 204 });

    // Schema validation — only extract known string fields, ignore everything else.
    const blockedUri: string = String(report['blocked-uri'] ?? report.blockedURL ?? '').slice(0, 500);
    const violatedDirective: string = String(report['violated-directive'] ?? report.effectiveDirective ?? '').slice(0, 200);
    const documentUri: string = stripQueryParams(String(report['document-uri'] ?? report.documentURL ?? '').slice(0, 500));
    const sourceFile: string = String(report['source-file'] ?? report.sourceFile ?? '').slice(0, 500);
    const disposition: string = String(report.disposition ?? '').slice(0, 20);

    const urisToCheck = [blockedUri, sourceFile];
    if (urisToCheck.some(uri => noisePatterns.some(p => p.test(uri)))) {
      return new Response(null, { status: 204 });
    }

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'warn',
      event: 'csp_violation',
      blockedUri,
      violatedDirective,
      documentUri,
      disposition,
    }));
  } catch {
    // Malformed report — ignore silently
  }

  return new Response(null, { status: 204 });
}
