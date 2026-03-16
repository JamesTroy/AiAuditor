import { pgTable, text, boolean, timestamp, integer, index, check } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

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
  accessToken: text('accessToken'),
  refreshToken: text('refreshToken'),
  accessTokenExpiresAt: timestamp('accessTokenExpiresAt', { withTimezone: true }),
  refreshTokenExpiresAt: timestamp('refreshTokenExpiresAt', { withTimezone: true }),
  scope: text('scope'),
  idToken: text('idToken'),
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
  secret: text('secret').notNull(),
  backupCodes: text('backupCodes').notNull(),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
}, (t) => [
  index('idx_twoFactor_userId').on(t.userId),
]);

// ─── App-specific tables ────────────────────────────────────────

export const audit = pgTable('audit', {
  id: text('id').primaryKey(),
  userId: text('userId')
    .notNull()
    .references(() => user.id, { onDelete: 'cascade' }),
  agentId: text('agentId').notNull(),
  agentName: text('agentName').notNull(),
  input: text('input').notNull(),
  result: text('result'),
  status: text('status').notNull().default('pending'),
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
  check('audit_status_check', sql`${t.status} IN ('pending', 'running', 'completed', 'failed')`),
  check('audit_score_check', sql`${t.score} IS NULL OR (${t.score} >= 0 AND ${t.score} <= 100)`),
  check('audit_durationMs_check', sql`${t.durationMs} IS NULL OR ${t.durationMs} >= 0`),
]);
