// DB wrappers for the finding_baselines table.
//
// All scoping is by (userId, scopeKey). The unique index on
// (userId, scopeKey, findingHash) means saveBaseline can safely batch-insert
// with onConflictDoNothing — re-saving an existing baseline is a no-op for
// already-known findings.

import crypto from 'crypto';
import { eq, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { findingBaselines } from '@/lib/auth-schema';
import { hashFinding } from '@/lib/baselines/findingHash';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

const BULK_CHUNK = 500;

export interface SaveBaselineResult {
  saved: number;     // rows actually inserted (new identity)
  skipped: number;   // rows that already existed for this scope
  totalSeen: number; // count of findings passed in
}

/**
 * Persist the findings as the baseline for (userId, scopeKey). Re-callable —
 * already-known hashes are skipped without error.
 */
export async function saveBaseline(opts: {
  userId: string;
  scopeKey: string;
  findings: StructuredFinding[];
}): Promise<SaveBaselineResult> {
  if (opts.findings.length === 0) {
    return { saved: 0, skipped: 0, totalSeen: 0 };
  }

  // Pre-compute hashes so we can de-dup the incoming batch (a single set of
  // findings can contain two entries that hash to the same value — they're
  // the same finding by definition, only one row should land).
  const byHash = new Map<string, StructuredFinding>();
  for (const f of opts.findings) byHash.set(hashFinding(f), f);

  const rows = Array.from(byHash.entries()).map(([h, f]) => ({
    id: crypto.randomUUID(),
    userId: opts.userId,
    scopeKey: opts.scopeKey,
    findingHash: h,
    title: f.title,
    path: extractPath(f.location),
    severity: f.severity,
    classification: f.classification,
  }));

  let saved = 0;
  for (let i = 0; i < rows.length; i += BULK_CHUNK) {
    const chunk = rows.slice(i, i + BULK_CHUNK);
    const result = await db
      .insert(findingBaselines)
      .values(chunk)
      .onConflictDoNothing({
        target: [findingBaselines.userId, findingBaselines.scopeKey, findingBaselines.findingHash],
      })
      .returning({ id: findingBaselines.id });
    saved += result.length;
  }

  return {
    saved,
    skipped: rows.length - saved,
    totalSeen: opts.findings.length,
  };
}

/**
 * Load every baseline hash for (userId, scopeKey). Returns a Set for O(1)
 * membership checks during diff.
 */
export async function loadBaselineHashes(opts: {
  userId: string;
  scopeKey: string;
}): Promise<Set<string>> {
  const rows = await db
    .select({ findingHash: findingBaselines.findingHash })
    .from(findingBaselines)
    .where(
      and(
        eq(findingBaselines.userId, opts.userId),
        eq(findingBaselines.scopeKey, opts.scopeKey),
      ),
    );
  return new Set(rows.map((r) => r.findingHash));
}

/**
 * Delete every baseline row for (userId, scopeKey). Returns the number of
 * rows actually deleted (0 if nothing was stored).
 */
export async function clearBaseline(opts: {
  userId: string;
  scopeKey: string;
}): Promise<number> {
  const deleted = await db
    .delete(findingBaselines)
    .where(
      and(
        eq(findingBaselines.userId, opts.userId),
        eq(findingBaselines.scopeKey, opts.scopeKey),
      ),
    )
    .returning({ id: findingBaselines.id });
  return deleted.length;
}

/**
 * List the distinct scopes a user has baselines for, with row counts.
 * Used by the future "manage baselines" UI.
 */
export async function listBaselineScopes(userId: string): Promise<
  Array<{ scopeKey: string; count: number; latestCreatedAt: Date | null }>
> {
  // drizzle-orm supports raw SQL for aggregates; using imports to keep TS happy.
  const { sql } = await import('drizzle-orm');
  const rows = await db
    .select({
      scopeKey: findingBaselines.scopeKey,
      count: sql<number>`COUNT(*)::int`,
      latestCreatedAt: sql<Date | null>`MAX(${findingBaselines.createdAt})`,
    })
    .from(findingBaselines)
    .where(eq(findingBaselines.userId, userId))
    .groupBy(findingBaselines.scopeKey);
  return rows;
}

function extractPath(location: string | undefined | null): string | null {
  if (!location) return null;
  const m = location.match(/([\w./@-]+\.[a-zA-Z]+)/);
  return m ? m[1] : null;
}
