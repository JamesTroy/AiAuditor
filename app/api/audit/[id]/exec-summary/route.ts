// POST /api/audit/[id]/exec-summary
//
// Lazy, cached plain-English summary of an audit aimed at PMs / security
// leads / execs. First call generates + caches on the audit row; subsequent
// calls return the cached summary instantly. POST with `{ regenerate: true }`
// to force a fresh synth (e.g. after dismissing findings).
//
// Differs from the older /api/audit/summary endpoint, which is a stateless
// pass-through that takes raw findings in the request body. That endpoint
// stays in place for callers that already have the findings in hand (e.g.
// PR review flow) and don't need persistence.

import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { audit as auditTable } from '@/lib/auth-schema';
import { synthesisLimiter, userDailyAuditLimiter } from '@/lib/rateLimit';
import {
  generateExecutiveSummary,
  type ExecutiveSummary,
} from '@/lib/ai/executiveSummary';
import { parseAuditResult } from '@/lib/parseAuditResult';
import type { StructuredFinding } from '@/lib/ai/findingSchema';
import type { Finding } from '@/lib/parseAuditResult';

export const runtime = 'nodejs';

const requestSchema = z.object({
  regenerate: z.boolean().optional(),
}).optional();

// Best-effort hydrate StructuredFinding from the lighter Finding the parser
// returns. The summary engine only reads severity / confidence /
// classification / title / location, so this lossy reshape is safe.
function toStructured(f: Finding): StructuredFinding {
  return {
    id: f.id,
    severity: f.severity,
    confidence: f.confidence ?? 'likely',
    classification: f.classification ?? 'deficiency',
    title: f.title,
    location: f.location,
    code_snippet: f.code_snippet,
    cwe: f.cwe,
    attack_vector: f.attack_vector,
    exploit_scenario: f.exploit_scenario,
    dataflow_path: f.dataflow_path,
    sanitization_checked: f.sanitization_checked,
    assumption: f.assumption,
    remediation: f.remediation ?? '',
    demotion: f.demotion,
  };
}

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: auditId } = await params;

  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = await synthesisLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers });
  }

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown = {};
  try {
    if (req.headers.get('content-length') && Number(req.headers.get('content-length')) > 0) {
      body = await req.json();
    }
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }
  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }
  const regenerate = parsed.data?.regenerate ?? false;

  // Audit ownership check — prevents IDOR. Future: relax to org members.
  const [row] = await db
    .select({
      id: auditTable.id,
      agentName: auditTable.agentName,
      result: auditTable.result,
      score: auditTable.score,
      status: auditTable.status,
      executiveSummary: auditTable.executiveSummary,
      executiveSummaryGeneratedAt: auditTable.executiveSummaryGeneratedAt,
    })
    .from(auditTable)
    .where(and(eq(auditTable.id, auditId), eq(auditTable.userId, session.user.id)))
    .limit(1);
  if (!row) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }
  if (row.status !== 'completed') {
    return NextResponse.json({ error: 'Audit is not complete' }, { status: 409 });
  }

  // Cache hit: return immediately, no model call, no rate-limit decrement
  // against the daily AI budget.
  if (!regenerate && row.executiveSummary) {
    try {
      return NextResponse.json({
        summary: JSON.parse(row.executiveSummary) as ExecutiveSummary,
        cached: true,
        generatedAt: row.executiveSummaryGeneratedAt,
      });
    } catch {
      // Stored JSON is corrupt — fall through to regenerate.
    }
  }

  // Cache miss (or regenerate). Charge the daily AI limit only here.
  const userRl = await userDailyAuditLimiter.check(session.user.id);
  if (!userRl.allowed) {
    return NextResponse.json({ error: 'Daily AI limit reached.' }, { status: 429, headers: userRl.headers });
  }

  if (!row.result) {
    return NextResponse.json({ error: 'Audit has no result to summarise' }, { status: 422 });
  }
  const metrics = parseAuditResult(row.result);
  // Prefer the filtered list (drops [POSSIBLE] / [SUGGESTION]) — the summary
  // should reflect what the developer is actually being asked to fix.
  const findings: StructuredFinding[] = (metrics.filteredFindings.length > 0
    ? metrics.filteredFindings
    : metrics.findings
  ).map(toStructured);

  try {
    const summary = await generateExecutiveSummary({
      findings,
      score: row.score ?? metrics.score ?? 0,
      agentNames: [row.agentName],
    });
    // Persist for future views. Best-effort — if the write fails, still
    // return the summary so the user doesn't see an error.
    try {
      await db.update(auditTable)
        .set({
          executiveSummary: JSON.stringify(summary),
          executiveSummaryGeneratedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(auditTable.id, auditId));
    } catch { /* swallow — caller still gets the summary */ }
    return NextResponse.json({ summary, cached: false, generatedAt: new Date() });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json({ error: `Summary generation failed: ${message}` }, { status: 502 });
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: auditId } = await params;
  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const [row] = await db
    .select({
      executiveSummary: auditTable.executiveSummary,
      executiveSummaryGeneratedAt: auditTable.executiveSummaryGeneratedAt,
    })
    .from(auditTable)
    .where(and(eq(auditTable.id, auditId), eq(auditTable.userId, session.user.id)))
    .limit(1);
  if (!row) return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  if (!row.executiveSummary) {
    return NextResponse.json({ summary: null, cached: false, generatedAt: null });
  }
  try {
    return NextResponse.json({
      summary: JSON.parse(row.executiveSummary) as ExecutiveSummary,
      cached: true,
      generatedAt: row.executiveSummaryGeneratedAt,
    });
  } catch {
    return NextResponse.json({ summary: null, cached: false, generatedAt: null });
  }
}
