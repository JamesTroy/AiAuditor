import { NextRequest } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { auditLimiter, dailyAuditBudget } from '@/lib/rateLimit';
import { STREAM_RESPONSE_HEADERS } from '@/lib/config/apiHeaders';
import { cachedFetch } from '@/lib/cache';
import { anthropicProvider } from '@/lib/ai/anthropicProvider';
import { getAgent } from '@/lib/agents';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { audit as auditTable } from '@/lib/auth-schema';
import { eq } from 'drizzle-orm';

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
const MAX_RESULT_CHARS = 100_000;

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

  // Detect logged-in user for DB persistence
  let userId: string | null = null;
  try {
    const session = await auth.api.getSession({ headers: await nextHeaders() });
    userId = session?.user?.id ?? null;
  } catch { /* anonymous — no DB persistence */ }

  // CACHE-013: Fetch website content with Redis cache (TTL 10 min).
  // Avoids re-fetching the same site on repeated audits within a session.
  let truncated: string;
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
    truncated = data;
  } catch (err) {
    return new Response(
      `Failed to fetch site: ${err instanceof Error ? err.message : String(err)}`,
      { status: 502 },
    );
  }

  // Stream results from each agent sequentially
  const encoder = new TextEncoder();
  const decoder = new TextDecoder();
  const timeoutSignal = AbortSignal.timeout(STREAM_TIMEOUT_MS);

  const stream = new ReadableStream({
    async start(controller) {
      for (const agentId of agentIds) {
        if (timeoutSignal.aborted) break;

        const agent = getAgent(agentId);
        if (!agent) continue;

        // Create DB record for logged-in users
        let auditRecordId: string | null = null;
        const agentStartedAt = Date.now();
        if (userId) {
          try {
            const id = crypto.randomUUID();
            await db.insert(auditTable).values({
              id,
              userId,
              agentId,
              agentName: agent.name,
              input: url.slice(0, 10_000),
              status: 'running',
            });
            auditRecordId = id;
          } catch {
            // DB write failed — continue without persistence
          }
        }

        // Write section header
        controller.enqueue(
          encoder.encode(`\n\n${'='.repeat(60)}\n## ${agent.name} Audit\n${'='.repeat(60)}\n\n`),
        );

        const chunks: string[] = [];

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
              if (value) chunks.push(decoder.decode(value, { stream: true }));
              controller.enqueue(value);
            }
          } finally {
            reader.releaseLock();
          }

          // Save completed audit to DB
          if (auditRecordId) {
            try {
              const fullResult = chunks.join('');
              const scoreMatch = fullResult.match(/(\d{1,3})\s*\/\s*100/);
              const score = scoreMatch ? parseInt(scoreMatch[1], 10) : null;
              await db.update(auditTable)
                .set({
                  result: fullResult.slice(0, MAX_RESULT_CHARS),
                  status: 'completed',
                  score: score && score >= 0 && score <= 100 ? score : null,
                  durationMs: Date.now() - agentStartedAt,
                  updatedAt: new Date(),
                })
                .where(eq(auditTable.id, auditRecordId));
            } catch { /* DB update failed — result was still streamed */ }
          }

          // Emit metadata comment so the frontend can parse per-agent info
          const durationMs = Date.now() - agentStartedAt;
          controller.enqueue(
            encoder.encode(`\n<!--AGENT_META:${JSON.stringify({ agentId, agentName: agent.name, durationMs })}-->\n`),
          );
        } catch (err) {
          const isTimeout = err instanceof Error && err.name === 'TimeoutError';
          const msg = isTimeout ? '[Timed out]' : `[Error: ${err instanceof Error ? err.message : String(err)}]`;
          controller.enqueue(encoder.encode(`\n\n${msg}\n`));

          // Mark as failed in DB
          if (auditRecordId) {
            try {
              await db.update(auditTable)
                .set({ status: 'failed', durationMs: Date.now() - agentStartedAt, updatedAt: new Date() })
                .where(eq(auditTable.id, auditRecordId));
            } catch { /* ignore */ }
          }

          if (isTimeout) break;
        }
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: STREAM_RESPONSE_HEADERS,
  });
}
