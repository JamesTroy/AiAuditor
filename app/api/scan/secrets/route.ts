// POST /api/scan/secrets
//
// Deterministic secrets detection over a code paste — pure regex+entropy,
// no model call. Cheap enough to run unconditionally before any audit.
// Returns redacted matches: every reported value is already masked, never
// echoed back in cleartext.
//
// Body: { input: string }
// Returns: { matches: SecretMatch[], scanned: number }
//
// No userDailyAuditLimiter charge — this is a regex pass, not a model call.

import { NextRequest, NextResponse } from 'next/server';
import { headers as nextHeaders } from 'next/headers';
import { auth } from '@/lib/auth';
import { z } from 'zod';
import { fpRatesLimiter } from '@/lib/rateLimit';
import { scanForSecrets } from '@/lib/secretsScanner';
import { MAX_AUDIT_INPUT_CHARS } from '@/lib/config/constants';

export const runtime = 'nodejs';

const scanRequestSchema = z.object({
  input: z.string().min(1).max(MAX_AUDIT_INPUT_CHARS),
});

export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0].trim() ?? req.headers.get('x-real-ip') ?? '127.0.0.1';
  const rl = await fpRatesLimiter.check(ip);
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

  const parsed = scanRequestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 422 });
  }

  const matches = scanForSecrets(parsed.data.input);
  return NextResponse.json({
    matches,
    scanned: parsed.data.input.length,
  });
}
