import { NextRequest } from 'next/server';
import { fetchUrlLimiter } from '@/lib/rateLimit';
import { API_RESPONSE_HEADERS, ALLOWED_ORIGINS } from '@/lib/config/apiHeaders';
import { cachedFetch } from '@/lib/cache';

export const runtime = 'nodejs';

/** Security-relevant HTTP headers to capture for audit context. */
const SECURITY_HEADERS = [
  'content-security-policy',
  'content-security-policy-report-only',
  'strict-transport-security',
  'x-frame-options',
  'x-content-type-options',
  'referrer-policy',
  'permissions-policy',
  'x-powered-by',
  'x-xss-protection',
  'cross-origin-opener-policy',
  'cross-origin-embedder-policy',
  'cross-origin-resource-policy',
  'content-type',
  'cache-control',
  'server',
  'x-dns-prefetch-control',
  'report-to',
] as const;

/** Extract nonce values from HTML to verify rotation between requests. */
function extractNonces(html: string): string[] {
  const nonces = new Set<string>();
  const re = /nonce="([^"]+)"/g;
  let match: RegExpExecArray | null;
  while ((match = re.exec(html)) !== null) {
    nonces.add(match[1]);
  }
  return [...nonces];
}

/** Fetch HTTP response headers from a live (uncached) request. */
async function fetchLiveHeaders(
  url: string,
  signal: AbortSignal,
): Promise<{ headers: Record<string, string>; nonces: string[]; html?: string }> {
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Claudit/1.0 (Site Audit Bot)',
      Accept: 'text/html, text/plain, */*',
    },
    signal,
    redirect: 'error',
  });

  const headers: Record<string, string> = {};
  for (const name of SECURITY_HEADERS) {
    const value = res.headers.get(name);
    if (value) headers[name] = value;
  }

  // Read enough HTML to extract nonces (first 5KB is enough)
  const text = await res.text();
  const snippet = text.slice(0, 5000);
  const nonces = extractNonces(snippet);

  return { headers, nonces, html: text };
}

/** Build a context block summarizing server-side security posture. */
function buildServerContext(
  url: string,
  headers: Record<string, string>,
  nonceRotates: boolean | null,
  nonce1: string[],
  nonce2: string[],
): string {
  const lines: string[] = [
    '<!-- SERVER CONTEXT (collected by Claudit crawler — NOT visible in static HTML) -->',
    '<!--',
    `  URL: ${url}`,
    '  The following HTTP response headers were observed on a live request:',
    '',
  ];

  if (Object.keys(headers).length === 0) {
    lines.push('  (No security-relevant headers detected)');
  } else {
    for (const [name, value] of Object.entries(headers)) {
      // Truncate very long CSP headers to avoid bloating the context
      const display = value.length > 500 ? value.slice(0, 500) + '…' : value;
      lines.push(`  ${name}: ${display}`);
    }
  }

  lines.push('');

  // CSP nonce rotation verification
  if (nonceRotates === true) {
    lines.push('  CSP Nonce Verification: PASS — nonces rotate between requests.');
    lines.push(`    Request 1 nonces: ${nonce1.join(', ') || '(none found)'}`);
    lines.push(`    Request 2 nonces: ${nonce2.join(', ') || '(none found)'}`);
    lines.push('    The nonce values differ, confirming per-request generation.');
    lines.push('    DO NOT flag the nonce as static/reused — it is correctly implemented.');
  } else if (nonceRotates === false) {
    lines.push('  CSP Nonce Verification: FAIL — same nonce appeared in both requests.');
    lines.push(`    Nonce value(s): ${nonce1.join(', ')}`);
    lines.push('    This suggests the nonce is static or the page is cached with a fixed nonce.');
  } else if (nonce1.length === 0) {
    lines.push('  CSP Nonce Verification: N/A — no nonce attributes found in HTML.');
  }

  lines.push('');
  lines.push('  IMPORTANT FOR AUDITORS:');
  lines.push('  - Use the HTTP headers above to assess security posture. Do NOT flag');
  lines.push('    missing headers based on HTML alone — check the headers above first.');
  lines.push('  - If CSP nonce rotation is PASS, do NOT flag nonces as static/leaked.');
  lines.push('  - SRI (integrity attributes) on script tags may be partially applied by');
  lines.push('    the framework — check if SRI is configured server-side before flagging.');
  lines.push('  - The HTML below is a single response snapshot. Server-side behavior');
  lines.push('    (middleware, dynamic rendering) cannot be fully assessed from HTML alone.');
  lines.push('-->');
  lines.push('');

  return lines.join('\n');
}

/**
 * Fetch site content for site audits.
 * Returns HTTP headers context + truncated HTML/text that the frontend
 * passes to individual /api/audit calls.
 */
export async function POST(req: NextRequest) {
  // CSRF origin check
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';

  const rl = await fetchUrlLimiter.check(ip);
  if (!rl.allowed) {
    return new Response('Too many requests. Please wait a moment.', {
      status: 429,
      headers: rl.headers,
    });
  }

  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) {
    return new Response('Missing url', { status: 400 });
  }

  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return new Response('Only HTTP/HTTPS URLs are supported', { status: 400 });
  }

  try {
    const signal = AbortSignal.timeout(15_000);

    // Fetch 1: Get live headers + nonces from an uncached request.
    const req1 = await fetchLiveHeaders(url, signal);

    // Fetch 2: Second request to verify nonce rotation (parallel-safe).
    let nonceRotates: boolean | null = null;
    let nonce2: string[] = [];

    if (req1.nonces.length > 0) {
      try {
        const req2 = await fetchLiveHeaders(url, AbortSignal.timeout(10_000));
        nonce2 = req2.nonces;
        // Nonces rotate if at least one nonce differs between requests
        const nonce1Set = new Set(req1.nonces);
        nonceRotates = nonce2.some((n) => !nonce1Set.has(n));
      } catch {
        // Second request failed — can't verify rotation
        nonceRotates = null;
      }
    }

    // Use cached HTML for the main content (saves bandwidth on repeated audits).
    const { data } = await cachedFetch(url, {
      ttlSeconds: 600,
      maxBytes: 30_000,
      prefix: 'site',
      fetchOptions: {
        headers: {
          'User-Agent': 'Claudit/1.0 (Site Audit Bot)',
          Accept: 'text/html, text/plain, */*',
        },
        signal: AbortSignal.timeout(15_000),
        // VULN-015: Never follow redirects — a redirect could reach internal
        // addresses even if the original URL was public.
        redirect: 'error',
      },
    });

    // Prepend server context so audit agents can see HTTP headers + nonce status.
    const context = buildServerContext(url, req1.headers, nonceRotates, req1.nonces, nonce2);

    return new Response(context + data, {
      headers: {
        ...API_RESPONSE_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch {
    return new Response('Failed to fetch site. The URL may be unreachable or redirecting.', { status: 502 });
  }
}
