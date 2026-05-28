// Baselines API.
//
//   POST   /api/baselines             Save findings as the baseline for a scopeKey.
//   GET    /api/baselines             List the caller's baseline scopes (with counts).
//   DELETE /api/baselines?scopeKey=k  Clear a baseline.
//
// Diff (returns only findings not already in the baseline) lives at
// /api/baselines/diff to keep the request semantics distinct.

import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { auth } from '@/lib/auth';
import { settingsLimiter } from '@/lib/rateLimit';
import { saveBaselineRequestSchema } from '@/lib/schemas/baselineRequest';
import { saveBaseline, listBaselineScopes, clearBaseline } from '@/lib/baselines/store';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

export const runtime = 'nodejs';

function getIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0].trim() ??
    req.headers.get('x-real-ip') ??
    '127.0.0.1'
  );
}

export async function POST(req: NextRequest) {
  const rl = await settingsLimiter.check(getIp(req));
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

  const parsed = saveBaselineRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const result = await saveBaseline({
    userId: session.user.id,
    scopeKey: parsed.data.scopeKey,
    findings: parsed.data.findings as StructuredFinding[],
  });

  return NextResponse.json(result, { status: 201 });
}

export async function GET(req: NextRequest) {
  const rl = await settingsLimiter.check(getIp(req));
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers });
  }

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scopes = await listBaselineScopes(session.user.id);
  return NextResponse.json({ scopes });
}

export async function DELETE(req: NextRequest) {
  const rl = await settingsLimiter.check(getIp(req));
  if (!rl.allowed) {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429, headers: rl.headers });
  }

  const session = await auth.api.getSession({ headers: await nextHeaders() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const scopeKey = req.nextUrl.searchParams.get('scopeKey');
  if (!scopeKey || scopeKey.length < 1 || scopeKey.length > 200) {
    return NextResponse.json({ error: 'scopeKey query param required' }, { status: 400 });
  }

  const deleted = await clearBaseline({ userId: session.user.id, scopeKey });
  return NextResponse.json({ deleted });
}
