import { NextRequest } from 'next/server';
import { fetchUrlLimiter } from '@/lib/rateLimit';
import { API_RESPONSE_HEADERS, ALLOWED_ORIGINS } from '@/lib/config/apiHeaders';
import { cachedFetch } from '@/lib/cache';
import { validateUrlForSSRF } from '@/lib/ssrf';
import { escapeXml } from '@/lib/escapeXml';

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

// ── SPA / Architecture Detection ──────────────────────────────────────────
// Detects client-side SPA frameworks from HTML markers so audit agents can
// calibrate their findings for the actual architecture instead of penalizing
// an HTML shell for missing SSR features.

interface ArchitectureInfo {
  isSPA: boolean;
  framework: string | null;
  signals: string[];
}

function detectArchitecture(html: string): ArchitectureInfo {
  const signals: string[] = [];
  let framework: string | null = null;

  // React / Next.js
  if (html.includes('__next') || html.includes('_next/static')) {
    framework = 'Next.js';
    signals.push('Next.js build artifacts detected (_next/static)');
  } else if (html.includes('data-reactroot') || html.includes('__NEXT_DATA__') || html.includes('react-root')) {
    framework = 'React';
    signals.push('React root element detected');
  }

  // Vue / Nuxt
  if (html.includes('__nuxt') || html.includes('_nuxt/')) {
    framework = 'Nuxt';
    signals.push('Nuxt build artifacts detected');
  } else if (html.includes('data-v-') || html.includes('id="app"') && html.includes('vue')) {
    framework = framework ?? 'Vue';
    signals.push('Vue markers detected');
  }

  // Angular
  if (html.includes('ng-version') || html.includes('ng-app') || html.includes('angular')) {
    framework = framework ?? 'Angular';
    signals.push('Angular markers detected');
  }

  // Svelte / SvelteKit
  if (html.includes('__sveltekit') || html.includes('svelte')) {
    framework = framework ?? 'SvelteKit';
    signals.push('SvelteKit markers detected');
  }

  // Generic SPA shell detection: mostly empty <body> with large JS bundles
  const bodyMatch = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  const bodyContent = bodyMatch?.[1] ?? '';
  const textContent = bodyContent.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
  const scriptCount = (html.match(/<script[\s>]/g) ?? []).length;

  if (textContent.length < 200 && scriptCount > 3) {
    signals.push(`Thin HTML shell (${textContent.length} chars of text content, ${scriptCount} script tags) — likely client-rendered SPA`);
  }

  // Root mount points
  if (/<div\s+id=["'](root|app|__next)["'][^>]*>\s*<\/div>/i.test(html)) {
    signals.push('Empty root mount point detected (client-side hydration target)');
  }

  const isSPA = signals.length > 0 && (textContent.length < 500 || framework !== null);

  return { isSPA, framework, signals };
}

/** Build a context block summarizing server-side security posture and architecture. */
function buildServerContext(
  url: string,
  headers: Record<string, string>,
  nonceRotates: boolean | null,
  nonce1: string[],
  nonce2: string[],
  html: string,
): string {
  const arch = detectArchitecture(html);

  const lines: string[] = [
    '--- SITE AUDIT CONTEXT (collected by Claudit crawler) ---',
    '',
    `URL: ${escapeXml(url)}`,
    '',
    '=== HTTP Response Headers ===',
    '',
  ];

  if (Object.keys(headers).length === 0) {
    lines.push('(No security-relevant headers detected)');
  } else {
    for (const [name, value] of Object.entries(headers)) {
      const display = value.length > 500 ? value.slice(0, 500) + '…' : value;
      lines.push(`${escapeXml(name)}: ${escapeXml(display)}`);
    }
  }

  lines.push('');

  // CSP nonce rotation verification
  if (nonceRotates === true) {
    lines.push('CSP Nonce Verification: PASS — nonces rotate between requests.');
    lines.push(`  Request 1 nonces: ${nonce1.map(n => escapeXml(n)).join(', ') || '(none found)'}`);
    lines.push(`  Request 2 nonces: ${nonce2.map(n => escapeXml(n)).join(', ') || '(none found)'}`);
  } else if (nonceRotates === false) {
    lines.push('CSP Nonce Verification: FAIL — same nonce appeared in both requests.');
    lines.push(`  Nonce value(s): ${nonce1.map(n => escapeXml(n)).join(', ')}`);
  } else if (nonce1.length === 0) {
    lines.push('CSP Nonce Verification: N/A — no nonce attributes found in HTML.');
  }

  // ── Architecture detection ──────────────────────────────────────
  lines.push('');
  lines.push('=== Architecture Detection ===');
  lines.push('');
  if (arch.isSPA) {
    lines.push(`Architecture: Single-Page Application (SPA)${arch.framework ? ` — ${escapeXml(arch.framework)}` : ''}`);
    lines.push('Signals:');
    for (const sig of arch.signals) {
      lines.push(`  - ${escapeXml(sig)}`);
    }
    lines.push('');
    lines.push('SPA AUDIT GUIDANCE:');
    lines.push('This page is a client-rendered SPA. The HTML you see is a thin shell —');
    lines.push('most content, routing, and interactivity are rendered client-side by JavaScript.');
    lines.push('Adjust your analysis accordingly:');
    lines.push('  - Do NOT penalize for missing server-rendered content, inline critical CSS,');
    lines.push('    <noscript> tags, or server-side meta tags — these are expected in SPAs.');
    lines.push('  - Do NOT flag empty <body> or missing text content as an issue.');
    lines.push('  - PWA manifest, service worker, and offline support are optional features,');
    lines.push('    not requirements — score them as suggestions, not deficiencies.');
    lines.push('  - SEO: note that SPAs rely on client-side rendering or pre-rendering;');
    lines.push('    missing meta tags in the HTML shell may be injected by the JS framework.');
    lines.push('  - Mobile: if the SPA has explicit mobile gating (e.g., a component that');
    lines.push('    blocks mobile access), mobile UX findings are architecturally mitigated.');
    lines.push('  - Focus your analysis on what IS present: JS bundles, security headers,');
    lines.push('    authentication patterns, API endpoints, and client-side security.');
  } else {
    lines.push('Architecture: Server-rendered / traditional (SSR or static HTML)');
    if (arch.framework) {
      lines.push(`Framework detected: ${escapeXml(arch.framework)}`);
    }
    if (arch.signals.length > 0) {
      lines.push('Signals:');
      for (const sig of arch.signals) {
        lines.push(`  - ${escapeXml(sig)}`);
      }
    }
  }

  // ── Finding classification guidance ──────────────────────────────
  lines.push('');
  lines.push('=== Finding Classification ===');
  lines.push('');
  lines.push('Classify every finding into exactly one of these categories:');
  lines.push('  [VULNERABILITY] — Exploitable security issue with a real attack vector');
  lines.push('  [DEFICIENCY]    — Measurable gap from best practice that has real impact');
  lines.push('  [SUGGESTION]    — Improvement opportunity; nice-to-have, not a deficiency');
  lines.push('  [NOT APPLICABLE] — Finding does not apply to this architecture (e.g.,');
  lines.push('                     missing SSR content on an SPA, missing PWA manifest');
  lines.push('                     on a developer tool)');
  lines.push('');
  lines.push('Prefix each finding title with its classification tag, e.g.:');
  lines.push('  - **[VULNERABILITY] [CRITICAL]** Missing CSRF protection on login form');
  lines.push('  - **[SUGGESTION] [LOW]** Add preconnect hints for third-party origins');
  lines.push('  - **[NOT APPLICABLE]** No critical CSS inlined (SPA — content is JS-rendered)');

  // ── Scoring guidance ──────────────────────────────────────────
  lines.push('');
  lines.push('=== Scoring Calibration ===');
  lines.push('');
  lines.push('When computing the Overall Score:');
  lines.push('  - Only [VULNERABILITY] and [DEFICIENCY] findings should lower the score.');
  lines.push('  - [SUGGESTION] findings should NOT reduce the score — they are opportunities.');
  lines.push('  - [NOT APPLICABLE] findings MUST NOT affect the score in any way.');
  lines.push('  - A site with no vulnerabilities and only suggestions should score 7+/10.');
  lines.push('  - A site with strong security headers, proper auth, and good practices');
  lines.push('    should not score below 5/10 because of missing optional features.');
  lines.push('  - Score what IS there, not what COULD be there.');

  lines.push('');
  lines.push('--- END SITE AUDIT CONTEXT ---');
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

  // SSRF-001: Validate URL against private/internal IP ranges before fetching.
  const ssrfError = await validateUrlForSSRF(url);
  if (ssrfError) {
    return new Response(ssrfError, { status: 400 });
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

    // PROMPT-INJ-001: Strip HTML comments from fetched content before LLM ingestion.
    // Attackers embed adversarial instructions in HTML comments to manipulate audit output.
    const sanitizedData = data.replace(/<!--[\s\S]*?-->/g, '');

    // FP-004: Warn agents when HTML was truncated so they don't flag
    // "missing" elements that exist beyond the truncation boundary.
    const MAX_BYTES = 30_000;
    const truncationWarning = data.length >= MAX_BYTES
      ? `\n=== TRUNCATION WARNING ===\nThis HTML was truncated to ~${MAX_BYTES} bytes. Elements beyond this boundary are NOT visible to you. Do NOT flag missing elements, scripts, or meta tags unless you can confirm they are absent from the visible portion. If unsure, classify the finding as [POSSIBLE] rather than [CERTAIN].\n=== END WARNING ===\n\n`
      : '';

    // Prepend server context so audit agents can see HTTP headers, nonce status,
    // architecture detection, finding classification rules, and scoring guidance.
    const context = buildServerContext(url, req1.headers, nonceRotates, req1.nonces, nonce2, data);

    return new Response(truncationWarning + context + sanitizedData, {
      headers: {
        ...API_RESPONSE_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch {
    return new Response('Failed to fetch site. The URL may be unreachable or redirecting.', { status: 502 });
  }
}
