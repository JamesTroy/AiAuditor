// One-time migration endpoint for drizzle/0007_finding_baselines.sql.
// Delete this route in a follow-up commit once applied in production.
//
//   curl -X POST https://aiauditor-production.up.railway.app/api/admin/migrate-007 \
//     -H "Authorization: Bearer $CRON_SECRET"

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
      CREATE TABLE IF NOT EXISTS "finding_baselines" (
        "id"             text PRIMARY KEY,
        "userId"         text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "scopeKey"       text NOT NULL,
        "findingHash"    text NOT NULL,
        "title"          text NOT NULL,
        "path"           text,
        "severity"       text NOT NULL,
        "classification" text NOT NULL,
        "createdAt"      timestamptz NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "idx_fb_unique" ON "finding_baselines" ("userId","scopeKey","findingHash")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_fb_scope" ON "finding_baselines" ("userId","scopeKey")`);

    return NextResponse.json({ ok: true, message: 'Migration 007 applied successfully' });
  } catch (err) {
    const e = err as Record<string, unknown>;
    return NextResponse.json({
      error: String(e.message ?? err),
      code: e.code,
      detail: e.detail,
    }, { status: 500 });
  }
}
