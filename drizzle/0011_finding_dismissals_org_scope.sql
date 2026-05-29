-- Org-scope dismissal learning.
--
-- Add organizationId to finding_dismissals so dismissal-driven demotion can
-- pool signal across teammates. When a team dismisses the same finding
-- pattern 3+ times collectively, the next audit demotes that pattern's
-- severity/confidence for everyone in the org — not just the dismisser.
--
-- Backfill from audit.organizationId so legacy rows pick up the right org
-- where one existed at audit time. Rows whose audit had no active org stay
-- NULL and continue counting toward per-user scope only.

ALTER TABLE "finding_dismissals"
  ADD COLUMN IF NOT EXISTS "organizationId" text
    REFERENCES "organization"("id") ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS "idx_fd_org_hash"
  ON "finding_dismissals" ("organizationId", "findingHash");

UPDATE "finding_dismissals" fd
   SET "organizationId" = a."organizationId"
  FROM "audit" a
 WHERE a."id" = fd."auditId"
   AND fd."organizationId" IS NULL
   AND a."organizationId" IS NOT NULL;
