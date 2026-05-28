// POST /api/findings/learned-suppressions
//
// Apply dismissal-driven suppressions to a list of findings. Returns:
//   - surviving: findings the user hasn't dismissed enough times to suppress
//   - suppressed: findings auto-suppressed by past dismissals (≥ threshold)
//   - suppressionSetSize: total distinct hashes the user has marked as
//     suppressed (informational — for "we've learned N patterns" UX)
//
// Read-only — does NOT mutate the dismissal store. Pair this with
// /api/findings/dismiss to feed the learning system.
//
// Body: { findings: StructuredFinding[], minDismissals?: number }
// Default minDismissals = 3.

import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { settingsLimiter } from '@/lib/rateLimit';
import { baselineFindingSchema, MAX_FINDINGS } from '@/lib/schemas/baselineRequest';
import { applyDismissalSuppressions } from '@/lib/baselines/dismissalLearning';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

export const runtime = 'nodejs';

const requestSchema = z.object({
  findings: z.array(baselineFindingSchema).max(MAX_FINDINGS),
  minDismissals: z.number().int().min(1).max(20).optional(),
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

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await applyDismissalSuppressions({
    findings: parsed.data.findings as StructuredFinding[],
    userId: session.user.id,
    minDismissals: parsed.data.minDismissals,
  });

  return NextResponse.json({
    surviving: result.surviving,
    survivingCount: result.surviving.length,
    suppressed: result.suppressed,
    suppressedCount: result.suppressed.length,
    suppressionSetSize: result.suppressionSetSize,
  });
}
