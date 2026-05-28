// POST /api/findings/dismiss
//
// Session-gated dismiss/restore of a finding tied to a specific audit. Two
// things happen on every call:
//   1. Append a row to finding_dismissals — the audit trail, also the
//      source of truth for dismissal-driven learning (see lib/baselines/dismissalLearning.ts).
//   2. Compute and store the stable findingHash so the learning system can
//      recognise the same finding across future audits of the same code.
//
// Differs from the older /api/analytics/dismissal endpoint, which is
// anonymous + aggregate-only (no per-user data). That endpoint stays in
// place; both can be called from the dismissal UI.
//
// Body: { auditId, finding: StructuredFinding, action: 'dismiss'|'restore', reason? }

import crypto from 'crypto';
import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { audit as auditTable, findingDismissals } from '@/lib/auth-schema';
import { settingsLimiter } from '@/lib/rateLimit';
import { baselineFindingSchema } from '@/lib/schemas/baselineRequest';
import { hashFinding } from '@/lib/baselines/findingHash';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

export const runtime = 'nodejs';

const dismissRequestSchema = z.object({
  auditId: z.string().min(1).max(100),
  finding: baselineFindingSchema.extend({
    id: z.string().min(1).max(200),
    confidence: z.enum(['certain', 'likely', 'possible']).optional(),
  }),
  action: z.enum(['dismiss', 'restore']),
  reason: z.string().max(500).optional(),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = await settingsLimiter.check(ip);
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers });
  }

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const parsed = dismissRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  // Validate the audit exists and is owned by the caller — prevents writing
  // dismissal rows against other users' audits (IDOR).
  const [auditRow] = await db
    .select({ id: auditTable.id, userId: auditTable.userId })
    .from(auditTable)
    .where(and(eq(auditTable.id, parsed.data.auditId), eq(auditTable.userId, session.user.id)))
    .limit(1);
  if (!auditRow) {
    return NextResponse.json({ error: 'Audit not found' }, { status: 404 });
  }

  const finding = parsed.data.finding as StructuredFinding;
  const findingHash = hashFinding(finding);

  await db.insert(findingDismissals).values({
    id: crypto.randomUUID(),
    auditId: parsed.data.auditId,
    findingId: finding.id,
    userId: session.user.id,
    action: parsed.data.action,
    severity: finding.severity,
    confidence: finding.confidence,
    reason: parsed.data.reason ?? null,
    findingHash,
  });

  return NextResponse.json({ ok: true, findingHash }, { status: 201 });
}
