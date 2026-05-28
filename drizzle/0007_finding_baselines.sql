-- Finding baselines: per-finding identity store so audits can suppress
-- findings that were already present in a known-good baseline (e.g., main
-- branch). Drives the "only show new findings on this PR" UX without
-- requiring an audit-to-audit join on every comparison.

CREATE TABLE "finding_baselines" (
  "id"             text PRIMARY KEY,
  "userId"         text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "scopeKey"       text NOT NULL,
  "findingHash"    text NOT NULL,
  "title"          text NOT NULL,
  "path"           text,
  "severity"       text NOT NULL,
  "classification" text NOT NULL,
  "createdAt"      timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "idx_fb_unique" ON "finding_baselines" ("userId","scopeKey","findingHash");
CREATE INDEX "idx_fb_scope" ON "finding_baselines" ("userId","scopeKey");
