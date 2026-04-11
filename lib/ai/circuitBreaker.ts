// CLOUD-030: Redis-backed circuit breaker for Anthropic API calls.
//
// Prevents cascading failures when the Anthropic API is degraded or down.
// After `threshold` consecutive failures, the circuit opens and immediately
// rejects new requests for `resetTimeoutMs`. After the timeout, a single
// "half-open" probe request is allowed through to test recovery.
//
// ARCH-REVIEW-007: Upgraded from process-scoped to Redis-backed.
// All replicas share circuit state via Redis — when one replica detects
// Anthropic is down, ALL replicas stop sending requests immediately.
// Falls back to in-memory state when Redis is unavailable.

import { redis } from '@/lib/redis';

type CircuitState = 'closed' | 'open' | 'half-open';

// eslint-disable-next-line no-console
const log = (level: 'info' | 'warn', event: string, data?: Record<string, unknown>) =>
  console[level === 'warn' ? 'warn' : 'log'](JSON.stringify({
    ts: new Date().toISOString(), level, event, ...data,
  }));

export class CircuitBreaker {
  // In-memory state — used as fallback when Redis is unavailable,
  // and as a local cache to avoid Redis calls on every request.
  private localFailures = 0;
  private localLastFailureTime = 0;
  private localState: CircuitState = 'closed';

  private readonly redisKey: string;

  constructor(
    private readonly name: string,
    private readonly threshold = 5,
    private readonly resetTimeoutMs = 60_000,
  ) {
    this.redisKey = `cb:${name}`;
  }

  /**
   * Check whether a request should be allowed through.
   * Reads shared state from Redis when available, falls back to local state.
   */
  async allowRequest(): Promise<boolean> {
    const state = await this.getState();

    if (state.state === 'closed') return true;

    if (state.state === 'open') {
      const elapsed = Date.now() - state.lastFailureTime;
      if (elapsed > this.resetTimeoutMs) {
        // Transition to half-open — allow one probe request.
        // Use Redis SETNX to ensure only ONE replica sends the probe.
        const acquired = await this.tryAcquireProbe();
        if (acquired) {
          await this.setState('half-open', state.failures, state.lastFailureTime);
          log('info', 'circuit_half_open', { name: this.name, elapsed });
          return true;
        }
        // Another replica already claimed the probe — stay blocked.
        return false;
      }
      return false;
    }

    // half-open: one probe was already dispatched. Block everything else
    // until onSuccess() (closes circuit) or onFailure() (re-opens).
    return false;
  }

  /** Record a successful API call — closes the circuit. */
  async onSuccess(): Promise<void> {
    const prev = await this.getState();
    await this.setState('closed', 0, 0);
    await this.releaseProbe();
    this.localState = 'closed';
    this.localFailures = 0;
    this.localLastFailureTime = 0;

    if (prev.state !== 'closed') {
      log('info', 'circuit_closed', { name: this.name, previousState: prev.state });
    }
  }

  /** Record a failed API call — may open the circuit. */
  async onFailure(): Promise<void> {
    const now = Date.now();
    const state = await this.getState();
    const failures = state.failures + 1;

    this.localFailures = failures;
    this.localLastFailureTime = now;

    if (failures >= this.threshold) {
      const wasOpen = state.state === 'open';
      await this.setState('open', failures, now);
      await this.releaseProbe();
      this.localState = 'open';

      if (!wasOpen) {
        log('warn', 'circuit_opened', {
          name: this.name,
          failures,
          threshold: this.threshold,
          resetTimeoutMs: this.resetTimeoutMs,
        });
      }
    } else {
      await this.setState(state.state === 'half-open' ? 'open' : 'closed', failures, now);
      if (state.state === 'half-open') {
        this.localState = 'open';
        log('warn', 'circuit_probe_failed', { name: this.name, failures });
      }
    }
  }

  /** Current state (for health checks / admin endpoints). */
  async isOpen(): Promise<boolean> {
    const state = await this.getState();
    return state.state === 'open';
  }

  // ── Redis state management ──────────────────────────────────────

  private async getState(): Promise<{
    state: CircuitState;
    failures: number;
    lastFailureTime: number;
  }> {
    if (!redis) {
      return {
        state: this.localState,
        failures: this.localFailures,
        lastFailureTime: this.localLastFailureTime,
      };
    }

    try {
      const data = await redis.hgetall(this.redisKey) as Record<string, string> | null;
      if (!data || !data.state) {
        return { state: 'closed', failures: 0, lastFailureTime: 0 };
      }
      return {
        state: (data.state as CircuitState) || 'closed',
        failures: parseInt(data.failures || '0', 10),
        lastFailureTime: parseInt(data.lastFailureTime || '0', 10),
      };
    } catch {
      // Redis unavailable — fall back to local state.
      return {
        state: this.localState,
        failures: this.localFailures,
        lastFailureTime: this.localLastFailureTime,
      };
    }
  }

  private async setState(
    state: CircuitState,
    failures: number,
    lastFailureTime: number,
  ): Promise<void> {
    // Always update local state (fast path + fallback).
    this.localState = state;
    this.localFailures = failures;
    this.localLastFailureTime = lastFailureTime;

    if (!redis) return;

    try {
      // Use pipeline for atomic write.
      const pipeline = redis.pipeline();
      pipeline.hset(this.redisKey, {
        state,
        failures: String(failures),
        lastFailureTime: String(lastFailureTime),
      });
      // Auto-expire the key after 2× the reset timeout so stale state
      // doesn't persist forever if the breaker closes normally.
      pipeline.expire(this.redisKey, Math.ceil((this.resetTimeoutMs * 2) / 1000));
      await pipeline.exec();
    } catch {
      // Redis write failed — local state is still consistent.
    }
  }

  /**
   * Acquire the half-open probe lock. Returns true if this replica won.
   * Uses SETNX (set-if-not-exists) so exactly one replica gets the probe.
   */
  private async tryAcquireProbe(): Promise<boolean> {
    if (!redis) {
      // In-memory: always allow (single process, no contention).
      return true;
    }
    try {
      const probeKey = `${this.redisKey}:probe`;
      // SET NX with TTL — lock expires after resetTimeoutMs to prevent deadlock.
      const acquired = await redis.set(probeKey, '1', {
        nx: true,
        ex: Math.ceil(this.resetTimeoutMs / 1000),
      });
      return acquired === 'OK';
    } catch {
      return true; // Redis failed — allow the probe (better to try than block forever).
    }
  }

  /** Release the probe lock (on success or when re-opening). */
  private async releaseProbe(): Promise<void> {
    if (!redis) return;
    try {
      await redis.del(`${this.redisKey}:probe`);
    } catch {
      // Best effort.
    }
  }
}

export const anthropicCircuitBreaker = new CircuitBreaker('anthropic', 5, 60_000);
