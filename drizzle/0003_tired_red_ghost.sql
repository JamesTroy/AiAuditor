CREATE TABLE "agent_dismissal_stats" (
	"agent_id" text PRIMARY KEY NOT NULL,
	"agent_name" text NOT NULL,
	"dismissals" integer DEFAULT 0 NOT NULL,
	"restorations" integer DEFAULT 0 NOT NULL,
	"dismissals_critical" integer DEFAULT 0 NOT NULL,
	"dismissals_high" integer DEFAULT 0 NOT NULL,
	"dismissals_medium" integer DEFAULT 0 NOT NULL,
	"dismissals_low" integer DEFAULT 0 NOT NULL,
	"dismissals_certain" integer DEFAULT 0 NOT NULL,
	"dismissals_likely" integer DEFAULT 0 NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finding_dismissals" (
	"id" text PRIMARY KEY NOT NULL,
	"auditId" text NOT NULL,
	"findingId" text NOT NULL,
	"userId" text NOT NULL,
	"action" text NOT NULL,
	"severity" text NOT NULL,
	"confidence" text,
	"reason" text,
	"createdAt" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
DROP INDEX "idx_member_orgId_userId";--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "workspaceContext" text;--> statement-breakpoint
ALTER TABLE "finding_dismissals" ADD CONSTRAINT "finding_dismissals_auditId_audit_id_fk" FOREIGN KEY ("auditId") REFERENCES "public"."audit"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finding_dismissals" ADD CONSTRAINT "finding_dismissals_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "idx_agent_dismissal_stats_agentId" ON "agent_dismissal_stats" USING btree ("agent_id");--> statement-breakpoint
CREATE INDEX "idx_fd_auditId" ON "finding_dismissals" USING btree ("auditId");--> statement-breakpoint
CREATE INDEX "idx_fd_userId" ON "finding_dismissals" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "idx_fd_auditId_finding" ON "finding_dismissals" USING btree ("auditId","findingId");--> statement-breakpoint
CREATE INDEX "idx_fd_createdAt" ON "finding_dismissals" USING btree ("createdAt");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_member_orgId_userId" ON "member" USING btree ("organizationId","userId");--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_status_check" CHECK ("invitation"."status" IN ('pending', 'accepted', 'rejected', 'expired', 'canceled'));