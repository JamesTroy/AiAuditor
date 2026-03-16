// Custom in-memory sliding-window rate limiter.
//
// Design:
//   - Each RateLimiter instance tracks a map of key → timestamp[] where the
//     key is typically an IP address.
//   - A sliding window keeps only timestamps within the last `windowMs` ms,
//     so the counter naturally decays without a hard reset boundary.
//   - A background cleanup interval evicts entries that have no timestamps in
//     the current window, bounding memory to active keys only.
//   - A hard cap (`maxEntries`) prevents a memory-DoS from a flood of unique IPs.
//     Once the cap is reached, new IPs are rejected until space opens up.
//   - `check()` returns standard rate-limit HTTP headers ready to attach to any
//     response, including 429s and successful responses (so clients know their
//     remaining budget).
//
// KNOWN LIMITATION: This store is process-scoped (Node.js module memory).
// In multi-worker / serverless deployments each worker has its own counter,
// making the effective limit N × maxRequests across N workers.
// Replace with a Redis/Upstash atomic counter (INCR + EXPIRE) for
// shared-state rate limiting across workers.

export interface RateLimiterConfig {
  /** Length of the sliding window in milliseconds. */
  windowMs: number;
  /** Maximum requests allowed per key per window. */
  maxRequests: number;
  /**
   * Hard ceiling on the number of unique keys tracked simultaneously.
   * New keys are rejected (429) once this is reached.
   * Default: 10_000.
   */
  maxEntries?: number;
  /**
   * How often to sweep and evict idle entries (milliseconds).
   * Default: windowMs (entries stay at most one window after going idle).
   */
  cleanupIntervalMs?: number;
}

export interface RateLimitResult {
  /** Whether the request is within the limit. */
  allowed: boolean;
  /** Requests remaining in the current window (0 when denied). */
  remaining: number;
  /**
   * Unix-ms timestamp at which the oldest counted request will fall out of
   * the window, freeing one slot. Useful for Retry-After calculations.
   */
  resetAt: number;
  /**
   * Ready-to-use HTTP headers to attach to the response.
   * Includes X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset,
   * and Retry-After (only when denied).
   */
  headers: Record<string, string>;
}

export class RateLimiter {
  private readonly windowMs: number;
  private readonly maxRequests: number;
  private readonly maxEntries: number;
  private readonly store = new Map<string, { timestamps: number[]; head: number }>();
  private readonly timer: ReturnType<typeof setInterval>;

  constructor(config: RateLimiterConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    this.maxEntries = config.maxEntries ?? 10_000;

    const cleanupMs = config.cleanupIntervalMs ?? config.windowMs;
    this.timer = setInterval(() => this.cleanup(), cleanupMs);
    // Don't hold the Node.js event loop open just for cleanup.
    if (typeof this.timer.unref === 'function') this.timer.unref();
  }

  /**
   * Record a request for `key` and return the rate-limit decision.
   * Always records the request first; the caller must honour `allowed`.
   */
  // PERF-008: Pointer-based eviction instead of .filter() or .shift() per call.
  // Timestamps are chronologically ordered — advance a head pointer past expired entries.
  check(key: string): RateLimitResult {
    const now = Date.now();
    const windowStart = now - this.windowMs;

    let entry = this.store.get(key);

    // Enforce the entry cap for new keys.
    if (!entry && this.store.size >= this.maxEntries) {
      const resetAt = now + this.windowMs;
      return {
        allowed: false,
        remaining: 0,
        resetAt,
        headers: this.buildHeaders(false, 0, resetAt),
      };
    }

    if (!entry) {
      entry = { timestamps: [], head: 0 };
      this.store.set(key, entry);
    }

    // Advance head past expired entries — O(expired) amortized across all calls.
    while (entry.head < entry.timestamps.length && entry.timestamps[entry.head] <= windowStart) {
      entry.head++;
    }

    // Periodically compact to avoid unbounded array growth.
    if (entry.head > 1000) {
      entry.timestamps = entry.timestamps.slice(entry.head);
      entry.head = 0;
    }

    entry.timestamps.push(now);
    const count = entry.timestamps.length - entry.head;
    const allowed = count <= this.maxRequests;
    const remaining = Math.max(0, this.maxRequests - count);

    // Reset time: when the oldest active request will expire.
    const oldestInWindow = entry.timestamps[entry.head] ?? now;
    const resetAt = oldestInWindow + this.windowMs;

    return { allowed, remaining, resetAt, headers: this.buildHeaders(allowed, remaining, resetAt) };
  }

  /** Stop the background cleanup timer. Call this in tests to avoid open handles. */
  destroy(): void {
    clearInterval(this.timer);
  }

  private cleanup(): void {
    const windowStart = Date.now() - this.windowMs;
    for (const [key, entry] of this.store) {
      // Advance head past expired entries.
      while (entry.head < entry.timestamps.length && entry.timestamps[entry.head] <= windowStart) {
        entry.head++;
      }
      if (entry.head >= entry.timestamps.length) {
        this.store.delete(key);
      } else if (entry.head > 0) {
        entry.timestamps = entry.timestamps.slice(entry.head);
        entry.head = 0;
      }
    }
  }

  private buildHeaders(
    allowed: boolean,
    remaining: number,
    resetAt: number,
  ): Record<string, string> {
    const headers: Record<string, string> = {
      'X-RateLimit-Limit': String(this.maxRequests),
      'X-RateLimit-Remaining': String(remaining),
      // Seconds since epoch, matching the de-facto RateLimit-Reset convention.
      'X-RateLimit-Reset': String(Math.ceil(resetAt / 1_000)),
    };
    if (!allowed) {
      const retryAfterSecs = Math.max(1, Math.ceil((resetAt - Date.now()) / 1_000));
      headers['Retry-After'] = String(retryAfterSecs);
    }
    return headers;
  }
}

// ---------------------------------------------------------------------------
// Named instances — one per logical endpoint.
// Tune limits independently as traffic patterns become clearer.
// ---------------------------------------------------------------------------

/** Primary audit endpoint: 10 requests per minute per IP. */
export const auditLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 10,
});

/** Site audit batch: 30 requests per minute per IP (higher cap for sequential multi-agent runs). */
export const siteAuditLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
});

/** URL-fetch endpoint: 30 requests per minute per IP (cheaper operation). */
export const fetchUrlLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
});

// RL-001: Login brute-force protection — 5 attempts per 15 min per IP.
export const authLoginLimiter = new RateLimiter({
  windowMs: 15 * 60_000,
  maxRequests: 5,
});

// RL-002: Account creation spam — 3 sign-ups per hour per IP.
export const authSignupLimiter = new RateLimiter({
  windowMs: 60 * 60_000,
  maxRequests: 3,
});

// RL-003: Password reset email bomb — 3 resets per hour per IP.
export const authResetLimiter = new RateLimiter({
  windowMs: 60 * 60_000,
  maxRequests: 3,
});

// RL-004: 2FA OTP brute-force — 5 attempts per 15 min per IP.
export const auth2faLimiter = new RateLimiter({
  windowMs: 15 * 60_000,
  maxRequests: 5,
});

// General auth fallback — 30 req/min for all other auth routes.
export const authGeneralLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
});

// RL-010: Global daily audit call budget (in-memory; replace with Redis for multi-instance).
export const dailyAuditBudget = new RateLimiter({
  windowMs: 24 * 60 * 60_000,
  maxRequests: 500,
  maxEntries: 1, // single "global" key
  cleanupIntervalMs: 60 * 60_000,
});

// RL-011: Per-user daily audit limit — 50 audits per day per authenticated user.
export const userDailyAuditLimiter = new RateLimiter({
  windowMs: 24 * 60 * 60_000,
  maxRequests: 50,
  cleanupIntervalMs: 60 * 60_000,
});
