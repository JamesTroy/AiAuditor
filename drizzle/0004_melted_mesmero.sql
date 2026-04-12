CREATE TABLE "org_audit_defaults" (
	"org_id" text PRIMARY KEY NOT NULL,
	"share_with_all_members" boolean DEFAULT true NOT NULL,
	"allow_member_rerun" boolean DEFAULT true NOT NULL,
	"require_admin_approval_for_external" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "org_billing" (
	"org_id" text PRIMARY KEY NOT NULL,
	"stripe_customer_id" text,
	"stripe_subscription_id" text,
	"plan" text DEFAULT 'free' NOT NULL,
	"seats" text DEFAULT '1' NOT NULL,
	"status" text DEFAULT 'active' NOT NULL,
	"current_period_end" timestamp,
	"cancel_at_period_end" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_billing_stripe_customer_id_unique" UNIQUE("stripe_customer_id"),
	CONSTRAINT "org_billing_stripe_subscription_id_unique" UNIQUE("stripe_subscription_id")
);
--> statement-breakpoint
CREATE TABLE "org_notification_prefs" (
	"org_id" text NOT NULL,
	"user_id" text NOT NULL,
	"new_member_joins" boolean DEFAULT true NOT NULL,
	"audit_score_below_70" boolean DEFAULT true NOT NULL,
	"critical_finding_detected" boolean DEFAULT true NOT NULL,
	"weekly_digest" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "org_notification_prefs_org_id_user_id_pk" PRIMARY KEY("org_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "org_audit_defaults" ADD CONSTRAINT "org_audit_defaults_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_billing" ADD CONSTRAINT "org_billing_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "org_notification_prefs" ADD CONSTRAINT "org_notification_prefs_org_id_organization_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organization"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "onp_org_idx" ON "org_notification_prefs" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "onp_user_idx" ON "org_notification_prefs" USING btree ("user_id");