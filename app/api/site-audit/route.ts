import { NextRequest } from 'next/server';
import { auditLimiter, dailyAuditBudget } from '@/lib/rateLimit';
import { anthropicProvider } from '@/lib/ai/anthropicProvider';
import { getAgent } from '@/lib/agents';

if (!process.env.ANTHROPIC_API_KEY) {
  throw new Error('ANTHROPIC_API_KEY environment variable is not set.');
}

export const runtime = 'nodejs';

// Default set of agents for website analysis.
const DEFAULT_SITE_AGENTS = [
  'security',
  'seo-performance',
  'accessibility',
  'frontend-performance',
  'responsive-design',
  'code-quality',
];

const MAX_AGENTS_PER_REQUEST = 20;

const STREAM_TIMEOUT_MS = 300_000;

const ALLOWED_ORIGINS: ReadonlySet<string> = new Set(
  [
    process.env.NEXT_PUBLIC_APP_URL,
    process.env.RAILWAY_PUBLIC_DOMAIN && `https://${process.env.RAILWAY_PUBLIC_DOMAIN}`,
    'http://localhost:3000',
    'http://localhost:3001',
    'http://localhost:3002',
  ].filter(Boolean) as string[],
);

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

  // Rate limit — shares the audit limiter (10/min/IP)
  const rl = auditLimiter.check(ip);
  if (!rl.allowed) {
    return new Response('Too many requests. Please wait a moment.', {
      status: 429,
      headers: rl.headers,
    });
  }

  // Global daily budget
  const budget = dailyAuditBudget.check('global');
  if (!budget.allowed) {
    return new Response('Daily audit limit reached. Please try again tomorrow.', { status: 429 });
  }

  let body: { url?: unknown; agents?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const url = typeof body.url === 'string' ? body.url.trim() : '';
  if (!url) {
    return new Response('Missing url', { status: 400 });
  }

  // Validate agent selection (optional — defaults to curated 6)
  let agentIds: string[];
  if (Array.isArray(body.agents) && body.agents.length > 0) {
    if (body.agents.length > MAX_AGENTS_PER_REQUEST) {
      return new Response(`Maximum ${MAX_AGENTS_PER_REQUEST} agents per request`, { status: 400 });
    }
    const invalid = body.agents.filter((id: unknown) => typeof id !== 'string' || !getAgent(id as string));
    if (invalid.length > 0) {
      return new Response(`Invalid agent IDs: ${invalid.join(', ')}`, { status: 400 });
    }
    agentIds = body.agents as string[];
  } else {
    agentIds = DEFAULT_SITE_AGENTS;
  }

  // Validate URL
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return new Response('Invalid URL', { status: 400 });
  }
  if (!['http:', 'https:'].includes(parsed.protocol)) {
    return new Response('Only HTTP/HTTPS URLs are supported', { status: 400 });
  }

  // Fetch the website content
  let pageContent: string;
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Claudit/1.0 (Site Audit Bot)',
        Accept: 'text/html, text/plain, */*',
      },
      signal: AbortSignal.timeout(15_000),
      redirect: 'follow',
    });
    if (!res.ok) {
      return new Response(`Failed to fetch site: HTTP ${res.status}`, { status: 502 });
    }
    pageContent = await res.text();
  } catch (err) {
    return new Response(
      `Failed to fetch site: ${err instanceof Error ? err.message : String(err)}`,
      { status: 502 },
    );
  }

  // Truncate to 30K chars to stay within model context limits
  const truncated = pageContent.slice(0, 30_000);
  const siteInput = `Website URL: ${url}\n\n--- Page Source (first ${Math.min(pageContent.length, 30_000).toLocaleString()} chars) ---\n${truncated}`;

  // Stream results from each agent sequentially
  const encoder = new TextEncoder();
  const timeoutSignal = AbortSignal.timeout(STREAM_TIMEOUT_MS);

  const stream = new ReadableStream({
    async start(controller) {
      for (const agentId of agentIds) {
        if (timeoutSignal.aborted) break;

        const agent = getAgent(agentId);
        if (!agent) continue;

        // Write section header
        controller.enqueue(
          encoder.encode(`\n\n${'='.repeat(60)}\n## ${agent.name} Audit\n${'='.repeat(60)}\n\n`),
        );

        try {
          const upstream = anthropicProvider.streamAudit(
            agent.systemPrompt,
            `<user_content>\n${truncated}\n</user_content>`,
            { signal: timeoutSignal },
          );

          const reader = upstream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
          } finally {
            reader.releaseLock();
          }
        } catch (err) {
          const msg =
            err instanceof Error && err.name === 'TimeoutError'
              ? '[Timed out]'
              : `[Error: ${err instanceof Error ? err.message : String(err)}]`;
          controller.enqueue(encoder.encode(`\n\n${msg}\n`));
          if (err instanceof Error && err.name === 'TimeoutError') break;
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'X-Content-Type-Options': 'nosniff',
      'Cache-Control': 'no-cache',
    },
  });
}
