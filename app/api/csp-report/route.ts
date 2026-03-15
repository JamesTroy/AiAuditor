import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

// CSP violation reporting endpoint.
// Browsers send POST requests here when a Content-Security-Policy violation occurs.
// We log violations server-side so they can be monitored without a third-party service.

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Browsers send either { "csp-report": { ... } } (report-uri format)
    // or an array of Reporting API v1 objects (report-to format).
    const report = body?.['csp-report'] ?? body;

    // eslint-disable-next-line no-console
    console.log(JSON.stringify({
      ts: new Date().toISOString(),
      level: 'warn',
      event: 'csp_violation',
      ...typeof report === 'object' && report !== null ? {
        blockedUri: report['blocked-uri'] ?? report.blockedURL,
        violatedDirective: report['violated-directive'] ?? report.effectiveDirective,
        documentUri: report['document-uri'] ?? report.documentURL,
        disposition: report.disposition,
      } : {},
    }));
  } catch {
    // Malformed report — ignore silently
  }

  return new Response(null, { status: 204 });
}
