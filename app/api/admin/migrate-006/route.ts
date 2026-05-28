// One-time migration endpoint for the github_installations + pr_audits
// tables introduced by drizzle/0006_github_app.sql. Delete this route in a
// follow-up commit after the migration is applied to production.
//
// Mirrors the pattern used by the (now-removed) migrate-005 route. Idempotent
// — all statements use IF NOT EXISTS so re-runs are safe.
//
//   curl -X POST https://aiauditor-production.up.railway.app/api/admin/migrate-006 \
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
      CREATE TABLE IF NOT EXISTS "github_installations" (
        "installationId"        integer PRIMARY KEY,
        "userId"                text REFERENCES "user"("id") ON DELETE SET NULL,
        "accountLogin"          text NOT NULL,
        "accountType"           text NOT NULL,
        "repositorySelection"   text NOT NULL,
        "repositories"          text NOT NULL DEFAULT '[]',
        "config"                text NOT NULL DEFAULT '{}',
        "suspendedAt"           timestamptz,
        "installedAt"           timestamptz NOT NULL DEFAULT now(),
        "updatedAt"             timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "gi_accountType_check" CHECK ("accountType" IN ('User', 'Organization')),
        CONSTRAINT "gi_repositorySelection_check" CHECK ("repositorySelection" IN ('all', 'selected'))
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_gi_userId" ON "github_installations" ("userId")`);
    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_gi_accountLogin" ON "github_installations" ("accountLogin")`);

    await db.execute(sql`
      CREATE TABLE IF NOT EXISTS "pr_audits" (
        "id"                  text PRIMARY KEY,
        "installationId"      integer NOT NULL REFERENCES "github_installations"("installationId") ON DELETE CASCADE,
        "repoFullName"        text NOT NULL,
        "prNumber"            integer NOT NULL,
        "headSha"             text NOT NULL,
        "action"              text NOT NULL,
        "status"              text NOT NULL DEFAULT 'queued',
        "auditId"             text,
        "postedReviewId"      integer,
        "postedCheckRunId"    integer,
        "score"               integer,
        "findingsTotal"       integer,
        "findingsCritical"    integer,
        "findingsHigh"        integer,
        "errorMessage"        text,
        "startedAt"           timestamptz,
        "completedAt"         timestamptz,
        "createdAt"           timestamptz NOT NULL DEFAULT now(),
        CONSTRAINT "pra_status_check" CHECK ("status" IN ('queued','running','posted','failed','skipped'))
      )
    `);

    await db.execute(sql`CREATE INDEX IF NOT EXISTS "idx_pra_pr" ON "pr_audits" ("installationId","repoFullName","prNumber")`);
    await db.execute(sql`CREATE UNIQUE INDEX IF NOT EXISTS "idx_pra_headSha" ON "pr_audits" ("installationId","repoFullName","prNumber","headSha")`);

    return NextResponse.json({ ok: true, message: 'Migration 006 applied successfully' });
  } catch (err) {
    const e = err as Record<string, unknown>;
    return NextResponse.json({
      error: String(e.message ?? err),
      code: e.code,
      detail: e.detail,
    }, { status: 500 });
  }
}
