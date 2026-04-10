import { pgTable, text, boolean, timestamp, integer, index, check, uniqueIndex } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { encryptedText } from '@/lib/crypto';

// ─── Better Auth core tables ────────────────────────────────────

export const user = pgTable('user', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  emailVerified: boolean('emailVerified').notNull().default(false),
  image: text('image'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  // admin plugin
  role: text('role').default('user'),
  banned: boolean('banned').default(false),
  banReason: text('banReason'),
  banExpires: timestamp('banExpires', { withTimezone: true }),
  // 2FA plugin
  twoFactorEnabled: boolean('twoFactorEnabled').default(false),
  // Workspace context — injected as <workspace_context> into every audit system prompt.
  // Stores compliance standards, domain info, coding conventions (max ~2000 chars).
  workspaceContext: text('workspaceContext'),
});

export const session = pgTable('session', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  token: text('token').notNull().unique(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  ipAddress: text('ipAddress'),
  userAgent: text('userAgent'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  // organization plugin
  activeOrganizationId: text('activeOrganizationId'),
}, (t) => [
  index('idx_session_userId').on(t.userId),
  index('idx_session_expiresAt').on(t.expiresAt),
]);

export const account = pgTable('account', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  accountId: text('accountId').notNull(),
  providerId: text('providerId').notNull(),
  accessToken: encryptedText('accessToken'),
  refreshToken: encryptedText('refreshToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
  scope: text('scope'),
  idToken: encryptedText('idToken'),
  password: text('password'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_account_userId').on(t.userId),
  index('idx_account_provider').on(t.providerId, t.accountId),
]);

export const verification = pgTable('verification', {
  id: text('id').primaryKey(),
  identifier: text('identifier').notNull(),
  value: text('value').notNull(),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_verification_identifier').on(t.identifier),
]);

// ─── 2FA plugin table ───────────────────────────────────────────

export const twoFactorTable = pgTable('twoFactor', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  secret: encryptedText('secret').notNull(),
  backupCodes: encryptedText('backupCodes').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_twoFactor_userId').on(t.userId),
]);

// ─── Organization plugin tables ─────────────────────────────────

export const organizationTable = pgTable('organization', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  slug: text('slug').notNull().unique(),
  logo: text('logo'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  metadata: text('metadata'),
});

export const member = pgTable('member', {
  id: text('id').primaryKey(),
  organizationId: text('organizationId').notNull()
    .references(() => organizationTable.id, { onDelete: 'cascade' }),
  userId: text('userId').notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  role: text('role').notNull().default('member'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_member_orgId').on(t.organizationId),
  index('idx_member_userId').on(t.userId),
  index('idx_member_orgId_userId').on(t.organizationId, t.userId),
]);

export const invitation = pgTable('invitation', {
  id: text('id').primaryKey(),
  organizationId: text('organizationId').notNull()
    .references(() => organizationTable.id, { onDelete: 'cascade' }),
  email: text('email').notNull(),
  role: text('role').notNull(),
  status: text('status').notNull().default('pending'),
  inviterId: text('inviterId').notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  expiresAt: timestamp('expiresAt', { withTimezone: true }).notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_invitation_orgId').on(t.organizationId),
  index('idx_invitation_email').on(t.email),
]);

// ─── Shared types ──────────────────────────────────────────────

export const AUDIT_STATUSES = ['pending', 'running', 'completed', 'failed'] as const;
export type AuditStatus = typeof AUDIT_STATUSES[number];

// ─── App-specific tables ────────────────────────────────────────

export const audit = pgTable('audit', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  organizationId: text('organizationId')
    .references(() => organizationTable.id, { onDelete: 'set null' }),
  agentId: text('agentId').notNull(),
  agentName: text('agentName').notNull(),
  input: text('input').notNull(),
  result: text('result'),
  status: text('status').$type<AuditStatus>().notNull().default('pending'),
  score: integer('score'),
  durationMs: integer('durationMs'),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_audit_userId_createdAt').on(t.userId, t.createdAt),
  index('idx_audit_status').on(t.status),
  // PERF-018: Composite index covering the 3 dashboard queries (userId + status + createdAt).
  index('idx_audit_user_status_created').on(t.userId, t.status, t.createdAt),
  // PERF-018: Index for stale audit cleanup query.
  index('idx_audit_status_updated').on(t.status, t.updatedAt),
  // Team audit queries.
  index('idx_audit_orgId_createdAt').on(t.organizationId, t.createdAt),
  check('audit_status_check', sql`${t.status} IN ('pending', 'running', 'completed', 'failed')`),
  check('audit_score_check', sql`${t.score} IS NULL OR (${t.score} >= 0 AND ${t.score} <= 100)`),
  check('audit_durationMs_check', sql`${t.durationMs} IS NULL OR ${t.durationMs} >= 0`),
]);

// ─── Dismissal analytics ────────────────────────────────────────
// Aggregate counters — one row per agent, no PII, no per-user data.
// Incremented via fire-and-forget POST /api/analytics/dismissal.
// Used in the admin dashboard to identify which agents produce the most false positives.

export const agentDismissalStats = pgTable('agent_dismissal_stats', {
  agentId:   text('agent_id').primaryKey(),
  agentName: text('agent_name').notNull(),
  // Total dismissals and restorations
  dismissals: integer('dismissals').notNull().default(0),
  restorations: integer('restorations').notNull().default(0),
  // Breakdown by severity — helps identify which severity levels are over-flagged
  dismissalsCritical: integer('dismissals_critical').notNull().default(0),
  dismissalsHigh:     integer('dismissals_high').notNull().default(0),
  dismissalsMedium:   integer('dismissals_medium').notNull().default(0),
  dismissalsLow:      integer('dismissals_low').notNull().default(0),
  // Breakdown by confidence — [CERTAIN] dismissals are the most alarming
  dismissalsCertain:  integer('dismissals_certain').notNull().default(0),
  dismissalsLikely:   integer('dismissals_likely').notNull().default(0),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('idx_agent_dismissal_stats_agentId').on(t.agentId),
]);

// ─── Finding dismissals ──────────────────────────────────────────
// Append-only audit trail for dismiss/restore actions on individual findings.
// One row per action — reconstruct current state by replaying events.
// RBAC enforced at the API layer (CRITICAL/HIGH require admin or senior_reviewer).

export const findingDismissals = pgTable('finding_dismissals', {
  id:         text('id').primaryKey(),
  auditId:    text('auditId').notNull().references(() => audit.id, { onDelete: 'cascade' }),
  findingId:  text('findingId').notNull(),
  userId:     text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  action:     text('action', { enum: ['dismiss', 'restore'] }).notNull(),
  severity:   text('severity', { enum: ['critical', 'high', 'medium', 'low', 'informational'] }).notNull(),
  confidence: text('confidence', { enum: ['certain', 'likely', 'possible'] }),
  reason:     text('reason'),
  createdAt:  timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_fd_auditId').on(t.auditId),
  index('idx_fd_userId').on(t.userId),
  index('idx_fd_auditId_finding').on(t.auditId, t.findingId),
  index('idx_fd_createdAt').on(t.createdAt),
]);
