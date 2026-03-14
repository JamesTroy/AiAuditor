import { NextRequest } from 'next/server';

export const runtime = 'nodejs';

const MAX_BYTES = 30_000;

// Only allow fetching from trusted raw-content hosts
const ALLOWED_PATTERNS = [
  /^https:\/\/raw\.githubusercontent\.com\//,
  /^https:\/\/gist\.githubusercontent\.com\//,
  /^https:\/\/gist\.github\.com\/[^/]+\/[^/]+\/raw\//,
];

export async function POST(req: NextRequest) {
  let body: { url?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const { url } = body;
  if (typeof url !== 'string' || !url.trim()) {
    return new Response('Missing url', { status: 400 });
  }

  const trimmed = url.trim();
  const allowed = ALLOWED_PATTERNS.some((p) => p.test(trimmed));
  if (!allowed) {
    return new Response(
      'Only raw GitHub and Gist URLs are supported (raw.githubusercontent.com, gist.githubusercontent.com, gist.github.com/.../raw/)',
      { status: 400 },
    );
  }

  let fetchRes: Response;
  try {
    fetchRes = await fetch(trimmed, {
      headers: { 'User-Agent': 'AiAudit/1.0' },
      signal: AbortSignal.timeout(10_000),
    });
  } catch (err) {
    return new Response(`Failed to fetch URL: ${err instanceof Error ? err.message : String(err)}`, { status: 502 });
  }

  if (!fetchRes.ok) {
    return new Response(`Remote returned ${fetchRes.status}`, { status: 502 });
  }

  const contentType = fetchRes.headers.get('content-type') ?? '';
  if (contentType.includes('text/html')) {
    return new Response('URL returned HTML — use a raw content URL instead', { status: 400 });
  }

  const text = await fetchRes.text();
  const truncated = text.length > MAX_BYTES ? text.slice(0, MAX_BYTES) : text;

  return new Response(truncated, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-store',
    },
  });
}
