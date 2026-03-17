import { NextRequest } from 'next/server';
import { auditLimiter } from '@/lib/rateLimit';
import { anthropicProvider } from '@/lib/ai/anthropicProvider';
import { STREAM_RESPONSE_HEADERS, ALLOWED_ORIGINS } from '@/lib/config/apiHeaders';
import { escapeXml } from '@/lib/escapeXml';

export const runtime = 'nodejs';

const SYNTHESIS_PROMPT = `You are a senior engineering lead reviewing multiple audit reports for the same codebase.

Your job is to produce a concise, actionable **Remediation Roadmap** by:

1. **Filtering** — Ignore findings tagged [POSSIBLE] (low confidence) and [SUGGESTION] (not defects). Focus only on [CERTAIN] and [LIKELY] findings classified as [VULNERABILITY] or [DEFICIENCY].
2. **Deduplicating** — Many audits flag the same underlying issue. Group related findings. If two agents flag the same root cause, count it once.
3. **Prioritizing** — Order by impact: security vulnerabilities first, then correctness bugs, then performance, then best-practice improvements. Within each level, rank [CERTAIN] findings above [LIKELY].
4. **Correlating** — Identify root causes that span multiple audit categories (e.g., a missing input validation that shows up in both Security and Forms audits).
5. **Summarizing** — For each grouped issue, give: severity, confidence, affected areas, and a one-line remediation action.

Understanding confidence tags in the input:
- [CERTAIN] = definitively causes an issue (include in roadmap)
- [LIKELY] = strong evidence but depends on runtime context (include in roadmap)
- [POSSIBLE] = speculative (exclude from roadmap)

Understanding classification tags in the input:
- [VULNERABILITY] = exploitable issue (always include)
- [DEFICIENCY] = measurable gap from best practice (always include)
- [SUGGESTION] = nice-to-have improvement (exclude from roadmap, mention only in summary)

Output format:

## Remediation Roadmap

### Critical Priority
- [Finding group name]: [one-line description]. Confidence: [Certain/Likely]. Affects: [agents that flagged it]. Fix: [action].

### High Priority
...

### Medium Priority
...

### Low Priority
...

## Suggestions (not scored)
[Brief list of improvement suggestions that don't indicate defects, if any were found across audits]

## Cross-Cutting Patterns
[2-3 sentences identifying systemic patterns across the audits]

## Overall Assessment
[2-3 sentences on the codebase's overall health and the most impactful improvement to make first]

Keep the output concise — under 800 words. Focus on actionable next steps, not restating findings.`;

const MAX_INPUT_CHARS = 80_000;
const STREAM_TIMEOUT_MS = 120_000;


export async function POST(req: NextRequest) {
  const origin = req.headers.get('origin');
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return new Response('Forbidden', { status: 403 });
  }

  const ip =
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1';

  const rl = await auditLimiter.check(ip);
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

  try {
    const stream = anthropicProvider.streamAudit(
      SYNTHESIS_PROMPT,
      `<audit_results>\n${escapeXml(truncated)}\n</audit_results>`,
      { signal: AbortSignal.timeout(STREAM_TIMEOUT_MS) },
    );

    return new Response(stream, {
      headers: STREAM_RESPONSE_HEADERS,
    });
  } catch (err) {
    console.error('[synthesize] stream error', err instanceof Error ? err.message : err);
    return new Response('Failed to generate synthesis. Please try again.', { status: 500 });
  }
}
