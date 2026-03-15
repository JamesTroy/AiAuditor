import { NextRequest } from 'next/server';
import { revalidatePath } from 'next/cache';
import { agents } from '@/lib/agents';
import { API_RESPONSE_HEADERS } from '@/lib/config/apiHeaders';

// CACHE-011/021: Admin endpoint for on-demand cache invalidation.
// Protected by a shared secret (REVALIDATION_SECRET env var).
// Called from deploy hooks or manually for emergency content corrections.
//
// Usage:
//   POST /api/admin/revalidate
//   Authorization: Bearer <REVALIDATION_SECRET>
//   Body: { "targets": ["agent-pages"] }
//
// Supported targets:
//   - "agent-pages"  — all ISR agent audit pages (/audit/[agent])
//   - "static-pages" — /privacy, /how-it-works
//   - "all"          — purge all cacheable pages

const VALID_TARGETS = new Set(['agent-pages', 'static-pages', 'all']);

export async function POST(req: NextRequest) {
  const secret = process.env.REVALIDATION_SECRET;
  if (!secret) {
    return new Response('REVALIDATION_SECRET not configured', {
      status: 503,
      headers: API_RESPONSE_HEADERS,
    });
  }

  const authHeader = req.headers.get('authorization');
  if (authHeader !== `Bearer ${secret}`) {
    return new Response('Unauthorized', {
      status: 401,
      headers: API_RESPONSE_HEADERS,
    });
  }

  let body: { targets?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400, headers: API_RESPONSE_HEADERS });
  }

  const targets = Array.isArray(body.targets)
    ? body.targets.filter((t): t is string => typeof t === 'string')
    : [];
  if (targets.length === 0) {
    return new Response('Missing or empty "targets" array', {
      status: 400,
      headers: API_RESPONSE_HEADERS,
    });
  }

  const invalid = targets.filter((t) => !VALID_TARGETS.has(t));
  if (invalid.length > 0) {
    return new Response(
      `Invalid targets: ${invalid.join(', ')}. Valid: ${[...VALID_TARGETS].join(', ')}`,
      { status: 400, headers: API_RESPONSE_HEADERS },
    );
  }

  const revalidated: string[] = [];

  for (const target of targets) {
    if (target === 'agent-pages' || target === 'all') {
      for (const agent of agents) {
        revalidatePath(`/audit/${agent.id}`);
      }
      revalidated.push('agent-pages');
    }
    if (target === 'static-pages' || target === 'all') {
      revalidatePath('/privacy');
      revalidatePath('/how-it-works');
      revalidatePath('/');
      revalidated.push('static-pages');
    }
  }

  return Response.json(
    { revalidated: [...new Set(revalidated)], timestamp: new Date().toISOString() },
    { headers: API_RESPONSE_HEADERS },
  );
}
