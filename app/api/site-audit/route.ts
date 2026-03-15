import { NextRequest } from 'next/server';
import { fetchUrlLimiter } from '@/lib/rateLimit';
import { API_RESPONSE_HEADERS } from '@/lib/config/apiHeaders';
import { cachedFetch } from '@/lib/cache';

export const runtime = 'nodejs';

const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ].filter(Boolean) as string[],
);

/**
 * Fetch site content for site audits.
 * Returns truncated HTML/text that the frontend passes to individual /api/audit calls.
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

  const rl = fetchUrlLimiter.check(ip);
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
        redirect: 'follow',
      },
    });
    return new Response(data, {
      headers: {
        ...API_RESPONSE_HEADERS,
        'Content-Type': 'text/plain; charset=utf-8',
      },
    });
  } catch (err) {
    return new Response(
      `Failed to fetch site: ${err instanceof Error ? err.message : String(err)}`,
      { status: 502 },
    );
  }
}
