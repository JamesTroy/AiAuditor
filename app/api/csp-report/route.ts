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
    if (typeof report !== 'object' || report === null) return new Response(null, { status: 204 });

    const blockedUri: string = (report['blocked-uri'] ?? report.blockedURL ?? '').toString();
    const violatedDirective: string = (report['violated-directive'] ?? report.effectiveDirective ?? '').toString();
    const documentUri: string = (report['document-uri'] ?? report.documentURL ?? '').toString();
    const sourceFile: string = (report['source-file'] ?? report.sourceFile ?? '').toString();

    // Filter out false positives from browser extensions, built-ins, and bots.
    const noisePatterns = [
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^safari-extension:\/\//,
      /^ms-browser-extension:\/\//,
      /^about:/,
      /^blob:/,
      /^data:/,
      /^inline$/,          // generic "inline" with no useful context
      /^eval$/,            // extension-injected eval
    ];

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
      disposition: report.disposition,
    }));
  } catch {
    // Malformed report — ignore silently
  }

  return new Response(null, { status: 204 });
}
