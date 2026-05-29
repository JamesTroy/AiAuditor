// Dismissal-driven demotion.
//
// When a finding pattern (= same findingHash) has been dismissed enough times
// net (dismiss − restore), demote it in future audits instead of suppressing
// it outright. The finding stays visible — users see what was demoted and
// why — but its severity and confidence both drop, so it stops dominating
// the prioritised list and the deterministic score formula.
//
//   ≥ 3 net dismissals → 'soft'   bucket: severity −1, confidence −1
//   ≥ 5 net dismissals → 'strong' bucket: severity −2, confidence −1
//
// Scope: org-scoped when the audit is org-scoped (counts pool across
// teammates), user-scoped otherwise. Mirrors the dashboard owner pattern.
// Org-scoped reads consider only rows tagged with that organizationId;
// user-scoped reads consider only rows with NULL organizationId belonging
// to the calling user. Existing pre-migration rows are NULL — those continue
// to count toward user scope (preserves the learning each user has built).
//
// Pure post-processing — does not mutate the dismissal store. Reads are
// indexed by (organizationId, findingHash) and (userId, findingHash) so the
// overhead per audit is one indexed aggregate query.

import { sql, eq, isNull, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { findingDismissals } from '@/lib/auth-schema';
import { hashFinding } from '@/lib/baselines/findingHash';
import type {
  StructuredFinding,
  FindingSeverity,
  FindingConfidence,
  DemotionMetadata,
} from '@/lib/ai/findingSchema';

// Ordered low→high so a "demote N steps" is a leftward shift of N.
const SEVERITY_ORDER: readonly FindingSeverity[] = [
  'informational',
  'low',
  'medium',
  'high',
  'critical',
] as const;

const CONFIDENCE_ORDER: readonly FindingConfidence[] = [
  'possible',
  'likely',
  'certain',
] as const;

/** Net dismissal count → demotion bucket, or null if below threshold. */
export function bucketFor(
  net: number,
): { sevSteps: number; confSteps: number; bucket: 'soft' | 'strong' } | null {
  if (net >= 5) return { sevSteps: 2, confSteps: 1, bucket: 'strong' };
  if (net >= 3) return { sevSteps: 1, confSteps: 1, bucket: 'soft' };
  return null;
}

function demoteLevel<T extends string>(order: readonly T[], current: T, steps: number): T {
  const i = order.indexOf(current);
  if (i < 0) return current;
  return order[Math.max(0, i - steps)];
}

/** Demote a single severity by N steps. Exposed for testing. */
export function demoteSeverity(s: FindingSeverity, steps: number): FindingSeverity {
  return demoteLevel(SEVERITY_ORDER, s, steps);
}

/** Demote a single confidence by N steps. Exposed for testing. */
export function demoteConfidence(c: FindingConfidence, steps: number): FindingConfidence {
  return demoteLevel(CONFIDENCE_ORDER, c, steps);
}

/**
 * Read the user's or org's per-hash net dismissal count.
 *
 * Org scope: aggregates ALL members' dismissals tagged with this org.
 * User scope: aggregates only this user's dismissals with NO org (NULL).
 *   We deliberately exclude org-tagged dismissals from user scope so that a
 *   user moving in/out of orgs doesn't carry org-team noise into their solo
 *   audits.
 */
export async function getNetDismissalsByHash(opts: {
  userId: string;
  organizationId: string | null;
}): Promise<Map<string, number>> {
  const scopeFilter = opts.organizationId
    ? eq(findingDismissals.organizationId, opts.organizationId)
    : and(
        eq(findingDismissals.userId, opts.userId),
        isNull(findingDismissals.organizationId),
      );

  const rows = await db
    .select({
      findingHash: findingDismissals.findingHash,
      netCount: sql<number>`
        SUM(CASE WHEN ${findingDismissals.action} = 'dismiss' THEN 1 ELSE 0 END)
        - SUM(CASE WHEN ${findingDismissals.action} = 'restore' THEN 1 ELSE 0 END)
      `.as('net_count'),
    })
    .from(findingDismissals)
    .where(scopeFilter)
    .groupBy(findingDismissals.findingHash)
    .having(sql`${findingDismissals.findingHash} IS NOT NULL`);

  const out = new Map<string, number>();
  for (const row of rows) {
    if (row.findingHash && Number(row.netCount) > 0) {
      out.set(row.findingHash, Number(row.netCount));
    }
  }
  return out;
}

export interface DemotionResult<F extends StructuredFinding = StructuredFinding> {
  /** Findings array with `demotion` metadata attached where applicable. */
  findings: F[];
  /** How many findings in this audit were actually demoted. */
  demotedCount: number;
  /** Distinct patterns the scope has learned (net ≥3). */
  learnedPatternCount: number;
  /** Scope actually used — for logging and UI badge wording. */
  scope: 'user' | 'organization';
}

/**
 * Pure function for tests: apply a precomputed counts map to a finding list.
 *
 * Generic over `F extends StructuredFinding` so callers passing a richer
 * finding type (e.g. `ValidatedFinding`) get the same type back. The
 * `demotion` field is added on top of the input type via the optional
 * `demotion?` declared on `StructuredFinding`.
 */
export function applyDemotionsToFindings<F extends StructuredFinding>(
  findings: F[],
  counts: Map<string, number>,
  scope: 'user' | 'organization',
): DemotionResult<F> {
  let demotedCount = 0;
  let learnedPatternCount = 0;
  for (const n of counts.values()) {
    if (n >= 3) learnedPatternCount++;
  }
  const out: F[] = findings.map((f) => {
    const h = hashFinding(f);
    const net = counts.get(h);
    if (net === undefined) return f;
    const b = bucketFor(net);
    if (!b) return f;
    const meta: DemotionMetadata = {
      netDismissals: net,
      originalSeverity: f.severity,
      originalConfidence: f.confidence,
      bucket: b.bucket,
      scope,
    };
    demotedCount++;
    return {
      ...f,
      severity: demoteSeverity(f.severity, b.sevSteps),
      confidence: demoteConfidence(f.confidence, b.confSteps),
      demotion: meta,
    };
  });
  return { findings: out, demotedCount, learnedPatternCount, scope };
}

/**
 * Apply dismissal-driven demotion to a fresh audit's findings.
 *
 * Fails open: any error returns the original findings unchanged with
 * demotedCount = 0. Demotion is a quality-of-life feature; an outage in the
 * learning store must not break the audit pipeline.
 */
export async function applyDismissalDemotions<F extends StructuredFinding>(opts: {
  findings: F[];
  userId: string | undefined;
  organizationId: string | null;
}): Promise<DemotionResult<F>> {
  const scope: 'user' | 'organization' = opts.organizationId ? 'organization' : 'user';
  if (!opts.userId && !opts.organizationId) {
    return { findings: opts.findings, demotedCount: 0, learnedPatternCount: 0, scope };
  }
  try {
    const counts = await getNetDismissalsByHash({
      userId: opts.userId ?? '',
      organizationId: opts.organizationId,
    });
    return applyDemotionsToFindings(opts.findings, counts, scope);
  } catch {
    return { findings: opts.findings, demotedCount: 0, learnedPatternCount: 0, scope };
  }
}
