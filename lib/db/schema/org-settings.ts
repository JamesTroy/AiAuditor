// Org-level settings tables for notifications, audit defaults, and billing.
// Run: npx drizzle-kit generate && npx drizzle-kit migrate

import {
  pgTable,
  text,
  boolean,
  timestamp,
  primaryKey,
  index,
} from 'drizzle-orm/pg-core';
import { organizationTable } from '@/lib/auth-schema';

// ── Org notification preferences ────────────────────────────────────────────
// Per-member, per-org. One row per (org, user) pair.

export const orgNotificationPrefs = pgTable(
  'org_notification_prefs',
  {
    orgId: text('org_id').notNull().references(() => organizationTable.id, { onDelete: 'cascade' }),
    userId: text('user_id').notNull(),
    newMemberJoins: boolean('new_member_joins').notNull().default(true),
    auditScoreBelow70: boolean('audit_score_below_70').notNull().default(true),
    criticalFindingDetected: boolean('critical_finding_detected').notNull().default(true),
    weeklyDigest: boolean('weekly_digest').notNull().default(false),
    updatedAt: timestamp('updated_at').notNull().defaultNow(),
  },
  (t) => [
    primaryKey({ columns: [t.orgId, t.userId] }),
    index('onp_org_idx').on(t.orgId),
    index('onp_user_idx').on(t.userId),
  ],
);

export type OrgNotificationPrefs = typeof orgNotificationPrefs.$inferSelect;

// ── Org audit defaults ──────────────────────────────────────────────────────
// One row per org. Created on first save.

export const orgAuditDefaults = pgTable('org_audit_defaults', {
  orgId: text('org_id').primaryKey().references(() => organizationTable.id, { onDelete: 'cascade' }),
  shareWithAllMembers: boolean('share_with_all_members').notNull().default(true),
  allowMemberRerun: boolean('allow_member_rerun').notNull().default(true),
  requireAdminApprovalForExternal: boolean('require_admin_approval_for_external').notNull().default(false),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type OrgAuditDefaults = typeof orgAuditDefaults.$inferSelect;

// ── Org billing (Stripe) ────────────────────────────────────────────────────
// Stores Stripe customer + active subscription per org.
// Updated by the Stripe webhook handler.

export const orgBilling = pgTable('org_billing', {
  orgId: text('org_id').primaryKey().references(() => organizationTable.id, { onDelete: 'cascade' }),
  stripeCustomerId: text('stripe_customer_id').unique(),
  stripeSubId: text('stripe_subscription_id').unique(),
  plan: text('plan').notNull().default('free'), // 'free' | 'pro' | 'team' | 'enterprise'
  seats: text('seats').notNull().default('1'),
  status: text('status').notNull().default('active'),
  currentPeriodEnd: timestamp('current_period_end'),
  cancelAtPeriodEnd: boolean('cancel_at_period_end').notNull().default(false),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
});

export type OrgBilling = typeof orgBilling.$inferSelect;
