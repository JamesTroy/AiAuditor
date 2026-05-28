// Dismissal-driven learning.
//
// When a user dismisses the same finding identity (= same findingHash) on
// multiple audits, treat that as a strong signal that the finding is a
// false-positive for their codebase/style and auto-suppress it on future
// audits. The hash is stable across line shifts (see lib/baselines/findingHash.ts),
// so "the same finding dismissed 3 times" means the same underlying pattern,
// not the same row.
//
// Suppression is NET — a later `restore` of the same finding cancels the
// dismissal. So a user can un-suppress a pattern by restoring it once.

import { sql, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { findingDismissals } from '@/lib/auth-schema';
import { hashFinding } from '@/lib/baselines/findingHash';
import { diffAgainstBaseline } from '@/lib/baselines/diff';
import type { StructuredFinding } from '@/lib/ai/findingSchema';

/** Default threshold — dismissed at least this many times in a row to suppress. */
export const DEFAULT_SUPPRESS_THRESHOLD = 3;

/**
 * Compute the user's per-hash net dismissal count and return the set of
 * hashes whose count meets or exceeds `minDismissals`.
 *
 * "Net" = dismissals minus restorations. A restore counts as -1 so the user
 * can un-suppress by restoring a finding they previously dismissed.
 */
export async function getUserSuppressedHashes(opts: {
  userId: string;
  minDismissals?: number;
}): Promise<Set<string>> {
  const min = opts.minDismissals ?? DEFAULT_SUPPRESS_THRESHOLD;

  const rows = await db
    .select({
      findingHash: findingDismissals.findingHash,
      // count(dismiss) - count(restore); ignore rows without a hash (legacy).
      netCount: sql<number>`
        SUM(CASE WHEN ${findingDismissals.action} = 'dismiss' THEN 1 ELSE 0 END)
        - SUM(CASE WHEN ${findingDismissals.action} = 'restore' THEN 1 ELSE 0 END)
      `.as('netCount'),
    })
    .from(findingDismissals)
    .where(eq(findingDismissals.userId, opts.userId))
    .groupBy(findingDismissals.findingHash)
    .having(sql`
      ${findingDismissals.findingHash} IS NOT NULL
      AND SUM(CASE WHEN ${findingDismissals.action} = 'dismiss' THEN 1 ELSE 0 END)
        - SUM(CASE WHEN ${findingDismissals.action} = 'restore' THEN 1 ELSE 0 END)
      >= ${min}
    `);

  const out = new Set<string>();
  for (const row of rows) {
    if (row.findingHash) out.add(row.findingHash);
  }
  return out;
}

export interface SuppressionDiffResult {
  /** Findings the user has NOT dismissed enough times to suppress. */
  surviving: StructuredFinding[];
  /** Findings auto-suppressed by past dismissals. */
  suppressed: StructuredFinding[];
  /** Total hashes the user has marked as suppressed. */
  suppressionSetSize: number;
}

/**
 * Convenience: given findings + a userId, return the survivors after
 * dismissal-learned suppression. Pure post-processing — does not mutate
 * the dismissal store.
 */
export async function applyDismissalSuppressions(opts: {
  findings: StructuredFinding[];
  userId: string;
  minDismissals?: number;
}): Promise<SuppressionDiffResult> {
  const suppressionSet = await getUserSuppressedHashes({
    userId: opts.userId,
    minDismissals: opts.minDismissals,
  });
  const { newFindings, preExisting } = diffAgainstBaseline(opts.findings, suppressionSet);
  return {
    surviving: newFindings,
    suppressed: preExisting,
    suppressionSetSize: suppressionSet.size,
  };
}

/** Hash a finding for storage — re-exported for callers that want consistency. */
export { hashFinding };
