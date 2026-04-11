// DX-020: Centralized constants — replaces magic numbers scattered across files.
// Grouped by domain so related values are easy to find and tune together.

// ── Anthropic API ────────────────────────────────────────────────
export const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
export const ANTHROPIC_MAX_TOKENS = 16_384;
export const ANTHROPIC_MAX_RETRIES = 3;
export const ANTHROPIC_RETRY_BASE_MS = 1_000;

// ── Stream / request limits ─────────────────────────────────────
/** Hard server-side timeout for audit streams. Security/architecture audits on large inputs routinely exceed 2 min. */
export const STREAM_TIMEOUT_MS = 300_000;     // 5 min
/** Per-chunk read timeout — prevents stalled streams from holding serverless functions open. */
export const CHUNK_TIMEOUT_MS = 30_000;       // 30 sec
/** Maximum request body size (advisory; field lengths also enforced by Zod). */
export const MAX_CONTENT_LENGTH = 600_000;    // ~600 KB — accommodates 500k input + 15k runtime context + context files
/** Truncate stored audit results to prevent oversized DB rows. */
export const MAX_RESULT_CHARS = 100_000;
/** Maximum chars of user input stored in the audit DB record. */
export const MAX_AUDIT_INPUT_CHARS = 10_000;

// ── Stale audit cleanup ─────────────────────────────────────────
/** Mark 'running' audits older than this as 'failed' (stream crash / server restart). */
export const STALE_AUDIT_THRESHOLD_MS = 30 * 60_000;  // 30 min
/** Run stale cleanup at most once per this interval. */
export const STALE_CLEANUP_INTERVAL_MS = 5 * 60_000;  // 5 min
