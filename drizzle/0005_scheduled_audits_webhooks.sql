-- Scheduled audits: periodic audit runs against a GitHub repo.
CREATE TABLE "scheduled_audits" (
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
);

CREATE INDEX "idx_sa_userId" ON "scheduled_audits" ("userId");
CREATE INDEX "idx_sa_enabled_schedule" ON "scheduled_audits" ("enabled", "schedule");

-- Webhook configurations: API-key-gated pre-deploy score gates.
CREATE TABLE "webhook_configs" (
  "id"             text PRIMARY KEY,
  "userId"         text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "name"           text NOT NULL,
  "apiKeyHash"     text NOT NULL UNIQUE,
  "apiKeyPreview"  text NOT NULL,
  "threshold"      integer NOT NULL DEFAULT 70,
  "enabled"        boolean NOT NULL DEFAULT true,
  "lastUsedAt"     timestamptz,
  "createdAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX "idx_wc_userId" ON "webhook_configs" ("userId");
CREATE UNIQUE INDEX "idx_wc_apiKeyHash" ON "webhook_configs" ("apiKeyHash");
