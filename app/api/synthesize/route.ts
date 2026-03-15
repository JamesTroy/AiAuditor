import { NextRequest } from 'next/server';
import { auditLimiter } from '@/lib/rateLimit';
import { anthropicProvider } from '@/lib/ai/anthropicProvider';
import { STREAM_RESPONSE_HEADERS } from '@/lib/config/apiHeaders';

export const runtime = 'nodejs';

const SYNTHESIS_PROMPT = `You are a senior engineering lead reviewing multiple audit reports for the same codebase.

Your job is to produce a concise, actionable **Remediation Roadmap** by:

1. **Deduplicating** — Many audits flag the same underlying issue. Group related findings.
2. **Prioritizing** — Order by impact: security vulnerabilities first, then correctness bugs, then performance, then best-practice improvements.
3. **Correlating** — Identify root causes that span multiple audit categories (e.g., a missing input validation that shows up in both Security and Forms audits).
4. **Summarizing** — For each grouped issue, give: severity, affected areas, and a one-line remediation action.

Output format:

## Remediation Roadmap

### Critical Priority
- [Finding group name]: [one-line description]. Affects: [agents that flagged it]. Fix: [action].

### High Priority
...

### Medium Priority
...

### Low Priority
...

## Cross-Cutting Patterns
[2-3 sentences identifying systemic patterns across the audits]

## Overall Assessment
[2-3 sentences on the codebase's overall health and the most impactful improvement to make first]

Keep the output concise — under 800 words. Focus on actionable next steps, not restating findings.`;

const MAX_INPUT_CHARS = 80_000;
const STREAM_TIMEOUT_MS = 120_000;

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
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';

  const rl = auditLimiter.check(ip);
  if (!rl.allowed) {
    return new Response('Too many requests.', { status: 429, headers: rl.headers });
  }

  let body: { results?: unknown };
  try {
    body = await req.json();
  } catch {
    return new Response('Invalid JSON', { status: 400 });
  }

  const results = typeof body.results === 'string' ? body.results : '';
  if (!results || results.length < 100) {
    return new Response('Missing or too short audit results', { status: 400 });
  }

  const truncated = results.slice(0, MAX_INPUT_CHARS);

  const stream = anthropicProvider.streamAudit(
    SYNTHESIS_PROMPT,
    `<audit_results>\n${truncated}\n</audit_results>`,
    { signal: AbortSignal.timeout(STREAM_TIMEOUT_MS) },
  );

  return new Response(stream, {
    headers: STREAM_RESPONSE_HEADERS,
  });
}
