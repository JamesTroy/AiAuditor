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
  // ARCH-REVIEW-003: Enforce one membership per user per org at the DB level.
  uniqueIndex('uq_member_orgId_userId').on(t.organizationId, t.userId),
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
  // ARCH-REVIEW-004: Constrain invitation status to valid values.
  check('invitation_status_check', sql`${t.status} IN ('pending', 'accepted', 'rejected', 'expired', 'canceled')`),
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
  // Auto-detected stack metadata captured at audit time. Backfilled for
  // future audits only — historical rows stay NULL. Enables dashboard
  // filters like "all my Next.js audits" or "TS audits with criticals".
  detectedLanguage:  text('detectedLanguage'),
  detectedFramework: text('detectedFramework'),
  detectedPatterns:  text('detectedPatterns'),       // JSON array (string)
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
  // Dashboard filter index — find all my "react" or "nextjs" audits fast.
  index('idx_audit_user_framework').on(t.userId, t.detectedFramework),
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

// ─── Scheduled audits ────────────────────────────────────────────
// Periodic audit runs against a connected GitHub repo.
// The cron runner (POST /api/cron/scheduled-audits) processes due rows
// and emails the owner when the score drops below threshold or by 5+ pts.

export const scheduledAudits = pgTable('scheduled_audits', {
  id:           text('id').primaryKey(),
  userId:       text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:         text('name').notNull(),
  repoUrl:      text('repoUrl').notNull(),
  githubToken:  encryptedText('githubToken'),
  branch:       text('branch').notNull().default('main'),
  schedule:     text('schedule', { enum: ['daily', 'weekly'] }).notNull().default('daily'),
  threshold:    integer('threshold').notNull().default(70),
  lastScore:    integer('lastScore'),
  lastRunAt:    timestamp('lastRunAt', { withTimezone: true }),
  lastAuditId:  text('lastAuditId'),
  enabled:      boolean('enabled').notNull().default(true),
  createdAt:    timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:    timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_sa_userId').on(t.userId),
  index('idx_sa_enabled_schedule').on(t.enabled, t.schedule),
]);

// ─── Webhook configurations ──────────────────────────────────────
// Pre-deploy gates: a POST to /api/webhooks/pre-deploy with the right
// apiKey runs an audit and returns 200 (pass) or 422 (fail).
// Intended for GitHub Actions CI steps that block deploys on low scores.

export const webhookConfigs = pgTable('webhook_configs', {
  id:            text('id').primaryKey(),
  userId:        text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  name:          text('name').notNull(),
  apiKeyHash:    text('apiKeyHash').notNull().unique(),
  apiKeyPreview: text('apiKeyPreview').notNull(),
  threshold:     integer('threshold').notNull().default(70),
  enabled:       boolean('enabled').notNull().default(true),
  lastUsedAt:    timestamp('lastUsedAt', { withTimezone: true }),
  createdAt:     timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_wc_userId').on(t.userId),
  uniqueIndex('idx_wc_apiKeyHash').on(t.apiKeyHash),
]);

// ─── GitHub App installations ────────────────────────────────────
// Tracks each install of the GitHub App. Installation ID is GitHub's
// stable identifier; we use it as primary key.
// userId links to the Claudit user account that owns the install (for
// billing — PR audits decrement that user's daily audit budget).

export const githubInstallations = pgTable('github_installations', {
  installationId:      integer('installationId').primaryKey(),
  userId:              text('userId').references(() => user.id, { onDelete: 'set null' }),
  accountLogin:        text('accountLogin').notNull(),
  accountType:         text('accountType', { enum: ['User', 'Organization'] }).notNull(),
  repositorySelection: text('repositorySelection', { enum: ['all', 'selected'] }).notNull(),
  // Array of { id, full_name }. Empty when repositorySelection='all'
  // (we'd hit GitHub on demand instead of mirroring all repos here).
  repositories:        text('repositories').notNull().default('[]'),
  // Per-installation config (threshold, agents, skip patterns). Free-form JSON
  // so we can extend without migrations.
  config:              text('config').notNull().default('{}'),
  suspendedAt:         timestamp('suspendedAt', { withTimezone: true }),
  installedAt:         timestamp('installedAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt:           timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_gi_userId').on(t.userId),
  index('idx_gi_accountLogin').on(t.accountLogin),
]);

// ─── PR audit history ────────────────────────────────────────────
// One row per (installation, repo, PR, head_sha) — uniquely identifies a
// single audit run. When a PR is re-pushed (new head_sha), we look up the
// previous row to find postedReviewId and dismiss it before posting fresh.

// ─── Finding baselines ───────────────────────────────────────────
// Per-finding identity tracking: lets a caller mark a set of findings as
// "already known" (e.g., baseline for a repo's main branch) so that future
// audits surface only NEW findings instead of re-flagging legacy code.
//
// scopeKey is a free-form caller-defined identifier. Conventions:
//   - 'audit:<auditId>'                           web-app audit baseline
//   - 'gh:<installationId>:<repoFullName>'        PR-review baseline
//   - 'sched:<scheduledAuditId>'                  scheduled-audit baseline
//
// findingHash is deterministic: see lib/baselines/findingHash.ts. Stable
// across line shifts and whitespace; sensitive to file renames and rewrites.

export const findingBaselines = pgTable('finding_baselines', {
  id:             text('id').primaryKey(),
  userId:         text('userId').notNull().references(() => user.id, { onDelete: 'cascade' }),
  scopeKey:       text('scopeKey').notNull(),
  findingHash:    text('findingHash').notNull(),
  title:          text('title').notNull(),
  path:           text('path'),
  severity:       text('severity').notNull(),
  classification: text('classification').notNull(),
  createdAt:      timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  uniqueIndex('idx_fb_unique').on(t.userId, t.scopeKey, t.findingHash),
  index('idx_fb_scope').on(t.userId, t.scopeKey),
]);

export const PR_AUDIT_STATUSES = ['queued', 'running', 'posted', 'failed', 'skipped'] as const;

export const prAudits = pgTable('pr_audits', {
  id:                 text('id').primaryKey(),
  installationId:     integer('installationId').notNull().references(() => githubInstallations.installationId, { onDelete: 'cascade' }),
  repoFullName:       text('repoFullName').notNull(),
  prNumber:           integer('prNumber').notNull(),
  headSha:            text('headSha').notNull(),
  action:             text('action').notNull(),       // 'opened' | 'reopened' | 'synchronize' | 'ready_for_review'
  status:             text('status', { enum: PR_AUDIT_STATUSES }).notNull().default('queued'),
  // Link to the audit table when we create a corresponding Claudit audit row
  // (so the user can see PR runs in their dashboard alongside web audits).
  auditId:            text('auditId'),
  postedReviewId:     integer('postedReviewId'),      // GitHub review ID we created
  postedCheckRunId:   integer('postedCheckRunId'),    // GitHub check-run ID we created
  score:              integer('score'),               // 0–100, from quickScore
  findingsTotal:      integer('findingsTotal'),
  findingsCritical:   integer('findingsCritical'),
  findingsHigh:       integer('findingsHigh'),
  errorMessage:       text('errorMessage'),
  startedAt:          timestamp('startedAt', { withTimezone: true }),
  completedAt:        timestamp('completedAt', { withTimezone: true }),
  createdAt:          timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  // Find the most recent run for a given PR (latest head_sha for re-push dismissal).
  index('idx_pra_pr').on(t.installationId, t.repoFullName, t.prNumber),
  // Find the exact head_sha row (idempotency on webhook retries).
  uniqueIndex('idx_pra_headSha').on(t.installationId, t.repoFullName, t.prNumber, t.headSha),
]);
