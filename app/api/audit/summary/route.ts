// POST /api/audit/summary
//
// Generate a plain-English executive summary for an audit's findings.
// One Anthropic call — fast and cheap; intended for non-engineer
// stakeholders (PMs, security leads, execs).
//
// Body: { findings: StructuredFinding[], score: number, agentNames?: string[] }
// Returns: { headline, topRisks: string[], recommendedAction }
//
// Charges userDailyAuditLimiter (this is a model call, however cheap).

import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { auth } from '@/lib/auth';
import { synthesisLimiter, userDailyAuditLimiter } from '@/lib/rateLimit';
import { summaryRequestSchema } from '@/lib/schemas/summaryRequest';
import { generateExecutiveSummary } from '@/lib/ai/executiveSummary';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = await synthesisLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers });
  }

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const userRl = await userDailyAuditLimiter.check(session.user.id);
  if (!userRl.allowed) {
    return NextResponse.json({ error: 'Daily AI limit reached.' }, { status: 429, headers: userRl.headers });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = summaryRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const summary = await generateExecutiveSummary({
      findings: parsed.data.findings as StructuredFinding[],
      score: parsed.data.score,
      agentNames: parsed.data.agentNames,
    });
    return NextResponse.json(summary);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Summary generation failed: ${message}` }, { status: 502 });
  }
}
