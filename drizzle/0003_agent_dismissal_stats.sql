CREATE TABLE "agent_dismissal_stats" (
  "agent_id"            text PRIMARY KEY,
  "agent_name"          text NOT NULL,
  "dismissals"          integer NOT NULL DEFAULT 0,
  "restorations"        integer NOT NULL DEFAULT 0,
  "dismissals_critical" integer NOT NULL DEFAULT 0,
  "dismissals_high"     integer NOT NULL DEFAULT 0,
  "dismissals_medium"   integer NOT NULL DEFAULT 0,
  "dismissals_low"      integer NOT NULL DEFAULT 0,
  "dismissals_certain"  integer NOT NULL DEFAULT 0,
  "dismissals_likely"   integer NOT NULL DEFAULT 0,
  "updated_at"          timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX "idx_agent_dismissal_stats_agentId" ON "agent_dismissal_stats" ("agent_id");
