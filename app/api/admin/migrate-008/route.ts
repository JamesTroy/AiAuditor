// One-time migration for drizzle/0008_audit_stack_tagging.sql — adds the
// detectedLanguage / detectedFramework / detectedPatterns columns and the
// dashboard filter index to the audit table. Idempotent.
// Delete this route in a follow-up commit once applied in production.

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { sql } from 'drizzle-orm';

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const secret = req.headers.get('authorization')?.replace('Bearer ', '').trim();
  if (!process.env.CRON_SECRET || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    await db.execute(sql`ALTER TABLE "audit" ADD COLUMN IF NOT EXISTS "detectedLanguage"  text`);
    await db.execute(sql`ALTER TABLE "audit" ADD COLUMN IF NOT EXISTS "detectedFramework" text`);
    await db.execute(sql`ALTER TABLE "audit" ADD COLUMN IF NOT EXISTS "detectedPatterns"  text`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_audit_user_framework" ON "audit" ("userId","detectedFramework")`);

    return NextResponse.json({ ok: true, message: 'Migration 008 applied successfully' });
  } catch (err) {
    const e = err as Record<string, unknown>;
    return NextResponse.json({
      error: String(e.message ?? err),
      code: e.code,
      detail: e.detail,
    }, { status: 500 });
  }
}
