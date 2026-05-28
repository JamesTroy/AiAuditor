// One-time migration for drizzle/0010_pr_audits_bigint_ids.sql.
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
    await db.execute(sql`ALTER TABLE "pr_audits" ALTER COLUMN "postedReviewId"   TYPE bigint`);
    await db.execute(sql`ALTER TABLE "pr_audits" ALTER COLUMN "postedCheckRunId" TYPE bigint`);
    return NextResponse.json({ ok: true, message: 'Migration 010 applied successfully' });
  } catch (err) {
    const e = err as Record<string, unknown>;
    return NextResponse.json({
      error: String(e.message ?? err),
      code: e.code,
      detail: e.detail,
    }, { status: 500 });
  }
}
