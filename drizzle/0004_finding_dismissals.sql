-- Migration: finding_dismissals
-- Persistent audit trail for finding dismiss/restore actions.
-- Replaces localStorage-only dismissals with a server-side append-only ledger.
-- RBAC enforced at the API layer (CRITICAL/HIGH require admin or senior_reviewer role).

CREATE TABLE "finding_dismissals" (
  "id"          text PRIMARY KEY,
  "auditId"     text NOT NULL
    REFERENCES "audit"("id") ON DELETE CASCADE,
  "findingId"   text NOT NULL,
  "userId"      text NOT NULL
    REFERENCES "user"("id") ON DELETE CASCADE,
  "action"      text NOT NULL,
  "severity"    text NOT NULL,
  "confidence"  text,
  "reason"      text,
  "createdAt"   timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT "fd_action_check"
    CHECK ("action" IN ('dismiss', 'restore')),
  CONSTRAINT "fd_severity_check"
    CHECK ("severity" IN ('critical', 'high', 'medium', 'low', 'informational'))
);

CREATE INDEX "idx_fd_auditId"         ON "finding_dismissals" ("auditId");
CREATE INDEX "idx_fd_userId"          ON "finding_dismissals" ("userId");
CREATE INDEX "idx_fd_auditId_finding" ON "finding_dismissals" ("auditId", "findingId");
CREATE INDEX "idx_fd_createdAt"       ON "finding_dismissals" ("createdAt" DESC);
