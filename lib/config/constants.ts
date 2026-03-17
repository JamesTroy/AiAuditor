// DX-020: Centralized constants — replaces magic numbers scattered across files.
// Grouped by domain so related values are easy to find and tune together.

// ── Anthropic API ────────────────────────────────────────────────
export const ANTHROPIC_MODEL = 'claude-sonnet-4-6';
export const ANTHROPIC_MAX_TOKENS = 16_384;
export const ANTHROPIC_MAX_RETRIES = 3;
export const ANTHROPIC_RETRY_BASE_MS = 1_000;

// ── Site audit limits ──────────────────────────────────────────
/** How many audit agents stream concurrently during a site audit. Higher = faster but uses more API quota. */
export const SITE_AUDIT_CONCURRENCY = 50;
/** Maximum number of agents a user can select per site audit run. 0 = unlimited. */
export const MAX_AGENTS_PER_RUN = 0;

// ── Adaptive concurrency (safeguard #1 + #3) ──────────────────
/** Floor for adaptive concurrency — never go below this. */
export const MIN_CONCURRENCY = 5;
/** Error rate threshold (0-1) that triggers concurrency reduction. */
export const ERROR_RATE_THRESHOLD = 0.2;
/** Factor to reduce concurrency by when error rate exceeds threshold. */
export const CONCURRENCY_BACKOFF_FACTOR = 0.5;
/** How long (ms) to wait before attempting to ramp concurrency back up. */
export const CONCURRENCY_RECOVERY_MS = 15_000;

// ── Per-run token budget (safeguard #2) ────────────────────────
/** Max estimated output tokens per site audit run. 125 agents × 16K = ~2M; cap at 1.5M. */
export const MAX_TOKENS_PER_RUN = 1_500_000;
/** Estimated output tokens per agent (used for budget tracking before real counts arrive). */
export const EST_TOKENS_PER_AGENT = 12_000;

// ── Full-run cooldown (safeguard #7) ───────────────────────────
/** Minimum seconds between full audit runs (50+ agents). */
export const FULL_RUN_COOLDOWN_SECS = 300;  // 5 min
/** Agent count threshold that triggers cooldown enforcement. */
export const FULL_RUN_AGENT_THRESHOLD = 50;

// ── Stream / request limits ─────────────────────────────────────
/** Hard server-side timeout for audit streams. Security/architecture audits on large inputs routinely exceed 2 min. */
export const STREAM_TIMEOUT_MS = 300_000;     // 5 min
/** Per-chunk read timeout — prevents stalled streams from holding serverless functions open. */
export const CHUNK_TIMEOUT_MS = 30_000;       // 30 sec
/** Maximum request body size (advisory; field lengths also enforced by Zod). */
export const MAX_CONTENT_LENGTH = 200_000;    // ~200 KB
/** Truncate stored audit results to prevent oversized DB rows. */
export const MAX_RESULT_CHARS = 100_000;
/** Maximum chars of user input stored in the audit DB record. */
export const MAX_AUDIT_INPUT_CHARS = 10_000;

// ── Stale audit cleanup ─────────────────────────────────────────
/** Mark 'running' audits older than this as 'failed' (stream crash / server restart). */
export const STALE_AUDIT_THRESHOLD_MS = 30 * 60_000;  // 30 min
/** Run stale cleanup at most once per this interval. */
export const STALE_CLEANUP_INTERVAL_MS = 5 * 60_000;  // 5 min
