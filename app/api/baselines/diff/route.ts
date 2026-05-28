// POST /api/baselines/diff
//
// Given a current set of findings + a scopeKey, return:
//   - newFindings: findings whose hash is NOT in the stored baseline
//   - preExistingCount: how many findings were suppressed as already known
//   - baselineSize: total hashes in the stored baseline
//
// Read-only — does NOT mutate the baseline. Callers use this to render
// "X new findings (Y pre-existing)" without changing what's tracked.
//
// Empty baseline → every finding is "new" (the caller has no baseline yet
// and is implicitly comparing against zero).

import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { auth } from '@/lib/auth';
import { settingsLimiter } from '@/lib/rateLimit';
import { diffBaselineRequestSchema } from '@/lib/schemas/baselineRequest';
import { loadBaselineHashes } from '@/lib/baselines/store';
import { diffAgainstBaseline } from '@/lib/baselines/diff';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

export const runtime = 'nodejs';

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

  const parsed = diffBaselineRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const baselineHashes = await loadBaselineHashes({
    userId: session.user.id,
    scopeKey: parsed.data.scopeKey,
  });

  const { newFindings, preExisting } = diffAgainstBaseline(
    parsed.data.findings as StructuredFinding[],
    baselineHashes,
  );

  return NextResponse.json({
    newFindings,
    newCount: newFindings.length,
    preExistingCount: preExisting.length,
    baselineSize: baselineHashes.size,
  });
}
