-- Adds the stable cross-audit identity (findingHash) and a (userId, findingHash)
-- index to finding_dismissals so dismissal-driven learning can recognise the
-- same finding pattern across audits in O(1) per row.

ALTER TABLE "finding_dismissals" ADD COLUMN IF NOT EXISTS "findingHash" text;
CREATE INDEX IF NOT EXISTS "idx_fd_user_hash" ON "finding_dismissals" ("userId","findingHash");
