// CLOUD-019: Hybrid rate limiter — uses Upstash Redis when available for
// cross-replica consistency, falls back to in-memory sliding window.
//
// Design:
//   - Each RateLimiter instance tracks a map of key → timestamp[] where the
//     key is typically an IP address (in-memory mode).
//   - When Redis is available, uses @upstash/ratelimit sliding window for
//     shared state across all Railway replicas.
//   - Falls back to in-memory on Redis error or missing credentials.
//   - A hard cap (`maxEntries`) prevents memory-DoS from unique IP floods.
//   - `check()` is async to support the Redis path.

import { Ratelimit } from '@upstash/ratelimit';
import { redis } from '@/lib/redis';

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
  /** Redis key prefix (e.g., 'audit', 'auth-login'). Required for Redis mode. */
  prefix?: string;
  /**
   * When true, a Redis failure causes check() to DENY the request rather than
   * fall back to per-replica in-memory counting. Required for budget-sensitive
   * GLOBAL counters (dailyAuditBudget, userDailyAuditLimiter) because the
   * per-replica fallback effectively multiplies the budget by replica count.
   * Default: false (fail-open to in-memory for per-IP/per-email limiters).
   */
  failClosedOnStoreError?: boolean;
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

/** Convert milliseconds to @upstash/ratelimit Duration string. */
function toDuration(ms: number): string {
  if (ms >= 86400000 && ms % 86400000 === 0) return `${ms / 86400000} d`;
  if (ms >= 3600000 && ms % 3600000 === 0) return `${ms / 3600000} h`;
  if (ms >= 60000 && ms % 60000 === 0) return `${ms / 60000} m`;
  if (ms >= 1000 && ms % 1000 === 0) return `${ms / 1000} s`;
  return `${ms} ms`;
}

export class RateLimiter {
  private readonly windowMs: number;
  readonly maxRequests: number;
  private readonly maxEntries: number;
  private readonly failClosed: boolean;
  private readonly store = new Map<string, { timestamps: number[]; head: number }>();
  private readonly timer: ReturnType<typeof setInterval>;
  private readonly redisLimiter: Ratelimit | null;

  constructor(config: RateLimiterConfig) {
    this.windowMs = config.windowMs;
    this.maxRequests = config.maxRequests;
    this.maxEntries = config.maxEntries ?? 10_000;
    this.failClosed = config.failClosedOnStoreError ?? false;

    const cleanupMs = config.cleanupIntervalMs ?? config.windowMs;
    this.timer = setInterval(() => this.cleanup(), cleanupMs);
    // Don't hold the Node.js event loop open just for cleanup.
    if (typeof this.timer.unref === 'function') this.timer.unref();

    // CLOUD-019: Create Redis-backed limiter when available.
    this.redisLimiter =
      redis && config.prefix
        ? new Ratelimit({
            redis,
            limiter: Ratelimit.slidingWindow(
              config.maxRequests,
              toDuration(config.windowMs) as Parameters<typeof Ratelimit.slidingWindow>[1],
            ),
            prefix: `rl:${config.prefix}`,
            analytics: false,
          })
        : null;
  }

  /**
   * Record a request for `key` and return the rate-limit decision.
   * Uses Redis when available; falls back to in-memory on error.
   */
  async check(key: string): Promise<RateLimitResult> {
    if (this.redisLimiter) {
      try {
        const result = await this.redisLimiter.limit(key);
        return {
          allowed: result.success,
          remaining: result.remaining,
          resetAt: result.reset,
          headers: this.buildHeaders(result.success, result.remaining, result.reset),
        };
      } catch (err) {
        // Fail-closed limiters (budgets) must NOT fall back to in-memory —
        // per-replica counting would silently multiply the global budget.
        if (this.failClosed) {
          // eslint-disable-next-line no-console
          console.error(JSON.stringify({
            ts: new Date().toISOString(), level: 'error',
            event: 'redis_ratelimit_fail_closed',
            prefix: 'rl', // limiter prefix not stored; identify via call site
            error: err instanceof Error ? err.message : String(err),
          }));
          const resetAt = Date.now() + this.windowMs;
          return {
            allowed: false,
            remaining: 0,
            resetAt,
            headers: this.buildHeaders(false, 0, resetAt),
          };
        }
        // Fail-open for per-IP/per-email limiters — in-memory fallback is safe.
        // eslint-disable-next-line no-console
        console.warn(JSON.stringify({
          ts: new Date().toISOString(), level: 'warn',
          event: 'redis_ratelimit_fallback',
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    }
    return this.checkLocal(key);
  }

  /** In-memory sliding window implementation (original algorithm). */
  // PERF-008: Pointer-based eviction instead of .filter() or .shift() per call.
  private checkLocal(key: string): RateLimitResult {
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
  prefix: 'audit',
});

/** URL-fetch endpoint: 30 requests per minute per IP. */
export const fetchUrlLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  prefix: 'fetch-url',
});

// RL-001: Login brute-force protection — 5 attempts per 15 min per IP.
export const authLoginLimiter = new RateLimiter({
  windowMs: 15 * 60_000,
  maxRequests: 5,
  prefix: 'auth-login',
});

// RL-002: Account creation spam — 3 sign-ups per hour per IP.
export const authSignupLimiter = new RateLimiter({
  windowMs: 60 * 60_000,
  maxRequests: 3,
  prefix: 'auth-signup',
});

// RL-003: Password reset email bomb — 3 resets per hour per IP.
export const authResetLimiter = new RateLimiter({
  windowMs: 60 * 60_000,
  maxRequests: 3,
  prefix: 'auth-reset',
});

// RL-004: 2FA OTP brute-force — 5 attempts per 15 min per IP.
export const auth2faLimiter = new RateLimiter({
  windowMs: 15 * 60_000,
  maxRequests: 5,
  prefix: 'auth-2fa',
});

// General auth fallback — 30 req/min for all other auth routes.
export const authGeneralLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 30,
  prefix: 'auth-general',
});

// RL-010: Global daily audit call budget — Redis-backed when available (cross-replica).
// 2000/day supports ~16 full 125-agent runs across all users.
// Fail-closed: a Redis outage must not let each replica think it has its own
// 2000-request budget (that would silently multiply spend by replica count).
export const dailyAuditBudget = new RateLimiter({
  windowMs: 24 * 60 * 60_000,
  maxRequests: 2000,
  maxEntries: 1, // single global key — this limiter tracks one counter for the entire service
  cleanupIntervalMs: 60 * 60_000,
  prefix: 'daily-budget',
  failClosedOnStoreError: true,
});

// RL-011: Per-user daily audit limit — 500 audits per day per authenticated user.
// Raised from 50 to support multi-agent runs (125 agents = 1 run; 500 = ~4 full runs/day).
// Fail-closed: same reasoning as dailyAuditBudget — per-user counter must be
// consistent across replicas to prevent N× budget when Redis is down.
export const userDailyAuditLimiter = new RateLimiter({
  windowMs: 24 * 60 * 60_000,
  maxRequests: 500,
  cleanupIntervalMs: 60 * 60_000,
  prefix: 'user-daily',
  failClosedOnStoreError: true,
});

// SAFE-006: Per-IP burst guard — max 150 audits per 2-min window.
// Sits between auditLimiter (1-min/10req) and dailyAuditBudget (24h/2000req).
// Without this a single IP can legally re-clock the 1-min window repeatedly
// and drain the global Anthropic budget before the daily counter fires.
export const perIpConcurrencyLimiter = new RateLimiter({
  windowMs: 120_000,
  maxRequests: 150,
  prefix: 'ip-concurrent',
});

/** Synthesis endpoint: 20 requests per minute per IP (lighter than audits). */
export const synthesisLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  prefix: 'synthesis',
});

// CLOUD-014: Per-email login rate limiter — 10 attempts per hour per email.
// Mitigates distributed credential stuffing that bypasses IP-based limits.
export const perEmailLoginLimiter = new RateLimiter({
  windowMs: 60 * 60_000,
  maxRequests: 10,
  prefix: 'login-email',
});

// ARCH-REVIEW-001: Settings endpoint — 20 req/min per IP.
// Workspace context updates are rare; higher rates indicate automated abuse.
export const settingsLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 20,
  prefix: 'settings',
});

// ARCH-REVIEW-002: FP-rates endpoint — 60 req/min per IP.
// Read-only aggregate data; generous limit but prevents scraping.
export const fpRatesLimiter = new RateLimiter({
  windowMs: 60_000,
  maxRequests: 60,
  prefix: 'fp-rates',
});
