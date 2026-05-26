// FP-thresholds — shared between the runtime FP-rate endpoint, the parser,
// and the admin dashboard so all three agree on what counts as "trusted"
// vs "filtered" vs "cold-start."
//
// Changing these values changes user-visible behaviour:
//   - Raising MIN_LIKELY_DISMISSALS makes the FP filter trigger later
//   - Lowering LIKELY_FP_RATE_THRESHOLD makes the filter more aggressive
//   - Raising MIN_AUDITS_FOR_TRUST keeps new agents in cold-start longer

/** Minimum [LIKELY] dismissals before we trust the per-agent FP signal. */
export const MIN_LIKELY_DISMISSALS = 5;

/** Fraction of dismissals that must be [LIKELY] for the high-FP filter to kick in. */
export const LIKELY_FP_RATE_THRESHOLD = 0.40;

/** Minimum audits run before an agent leaves cold-start status. */
export const MIN_AUDITS_FOR_TRUST = 20;
