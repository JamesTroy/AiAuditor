// One-time migration for drizzle/0011_finding_dismissals_org_scope.sql.
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
      ALTER TABLE "finding_dismissals"
        ADD COLUMN IF NOT EXISTS "organizationId" text
        REFERENCES "organization"("id") ON DELETE CASCADE
    `);
    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_fd_org_hash"
        ON "finding_dismissals" ("organizationId","findingHash")
    `);
    const backfill = await db.execute(sql`
      UPDATE "finding_dismissals" fd
         SET "organizationId" = a."organizationId"
        FROM "audit" a
       WHERE a."id" = fd."auditId"
         AND fd."organizationId" IS NULL
         AND a."organizationId" IS NOT NULL
    `);

    return NextResponse.json({
      ok: true,
      message: 'Migration 011 applied successfully',
      backfilled: (backfill as { rowCount?: number }).rowCount ?? null,
    });
  } catch (err) {
    const e = err as Record<string, unknown>;
    return NextResponse.json({
      error: String(e.message ?? err),
      code: e.code,
      detail: e.detail,
    }, { status: 500 });
  }
}
