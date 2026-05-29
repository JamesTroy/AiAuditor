// One-time migration for drizzle/0012_audit_executive_summary.sql.
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
    await db.execute(sql`
      ALTER TABLE "audit"
        ADD COLUMN IF NOT EXISTS "executiveSummary" text,
        ADD COLUMN IF NOT EXISTS "executiveSummaryGeneratedAt" timestamp with time zone
    `);

    return NextResponse.json({ ok: true, message: 'Migration 012 applied successfully' });
  } catch (err) {
    const e = err as Record<string, unknown>;
    return NextResponse.json({
      error: String(e.message ?? err),
      code: e.code,
      detail: e.detail,
    }, { status: 500 });
  }
}
