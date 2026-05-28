-- GitHub App installations and per-PR audit history.
--
-- githubInstallations:  one row per install of the Claudit GitHub App.
--                       installationId is GitHub's own stable ID, used as PK.
--                       userId links to the Claudit user who owns the install
--                       for billing (PR audits charge their daily budget).
-- pr_audits:            one row per (installation, repo, PR, head_sha) — a
--                       single audit run. Re-pushing a PR creates a new row;
--                       the previous row's postedReviewId is used to dismiss
--                       the prior GitHub review.

CREATE TABLE "github_installations" (
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
);

CREATE INDEX "idx_gi_userId" ON "github_installations" ("userId");
CREATE INDEX "idx_gi_accountLogin" ON "github_installations" ("accountLogin");

CREATE TABLE "pr_audits" (
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
);

CREATE INDEX "idx_pra_pr" ON "pr_audits" ("installationId","repoFullName","prNumber");
CREATE UNIQUE INDEX "idx_pra_headSha" ON "pr_audits" ("installationId","repoFullName","prNumber","headSha");
