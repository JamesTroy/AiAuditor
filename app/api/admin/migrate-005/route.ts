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
      CREATE TABLE IF NOT EXISTS "scheduled_audits" (
        "id"           text PRIMARY KEY,
        "userId"       text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "name"         text NOT NULL,
        "repoUrl"      text NOT NULL,
        "githubToken"  text,
        "branch"       text NOT NULL DEFAULT 'main',
        "schedule"     text NOT NULL DEFAULT 'daily',
        "threshold"    integer NOT NULL DEFAULT 70,
        "lastScore"    integer,
        "lastRunAt"    timestamptz,
        "lastAuditId"  text,
        "enabled"      boolean NOT NULL DEFAULT true,
        "createdAt"    timestamptz NOT NULL DEFAULT now(),
        "updatedAt"    timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "sa_schedule_check" CHECK ("schedule" IN ('daily', 'weekly'))
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_sa_userId" ON "scheduled_audits" ("userId")
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_sa_enabled_schedule" ON "scheduled_audits" ("enabled", "schedule")
    `);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "webhook_configs" (
        "id"             text PRIMARY KEY,
        "userId"         text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
        "name"           text NOT NULL,
        "apiKeyHash"     text NOT NULL UNIQUE,
        "apiKeyPreview"  text NOT NULL,
        "threshold"      integer NOT NULL DEFAULT 70,
        "enabled"        boolean NOT NULL DEFAULT true,
        "lastUsedAt"     timestamptz,
        "createdAt"      timestamptz NOT NULL DEFAULT now()
      )
    `);

    await db.execute(sql`
      CREATE INDEX IF NOT EXISTS "idx_wc_userId" ON "webhook_configs" ("userId")
    `);

    await db.execute(sql`
      CREATE UNIQUE INDEX IF NOT EXISTS "idx_wc_apiKeyHash" ON "webhook_configs" ("apiKeyHash")
    `);

    return NextResponse.json({ ok: true, message: 'Migration 005 applied successfully' });
  } catch (err) {
    const e = err as Record<string, unknown>;
    return NextResponse.json({
      error: String(e.message ?? err),
      code: e.code,
      detail: e.detail,
    }, { status: 500 });
  }
}
