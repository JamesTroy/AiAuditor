import { describe, it, expect, afterEach } from 'vitest';
import { RateLimiter } from '@/lib/rateLimit';

describe('RateLimiter', () => {
  const limiters: RateLimiter[] = [];

  function create(opts?: Partial<{ windowMs: number; maxRequests: number; maxEntries: number }>) {
    const rl = new RateLimiter({
      windowMs: opts?.windowMs ?? 60_000,
      maxRequests: opts?.maxRequests ?? 3,
      maxEntries: opts?.maxEntries,
      cleanupIntervalMs: 60_000, // long interval to avoid interference
    });
    limiters.push(rl);
    return rl;
  }

  afterEach(() => {
    limiters.forEach((rl) => rl.destroy());
    limiters.length = 0;
  });

  it('allows requests within the limit', () => {
    const rl = create({ maxRequests: 3 });
    expect(rl.check('ip1').allowed).toBe(true);
    expect(rl.check('ip1').allowed).toBe(true);
    expect(rl.check('ip1').allowed).toBe(true);
  });

  it('denies requests over the limit', () => {
    const rl = create({ maxRequests: 2 });
    rl.check('ip1');
    rl.check('ip1');
    const result = rl.check('ip1');
    expect(result.allowed).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it('tracks separate keys independently', () => {
    const rl = create({ maxRequests: 1 });
    expect(rl.check('ip1').allowed).toBe(true);
    expect(rl.check('ip2').allowed).toBe(true);
    expect(rl.check('ip1').allowed).toBe(false);
    expect(rl.check('ip2').allowed).toBe(false);
  });

  it('returns correct remaining count', () => {
    const rl = create({ maxRequests: 5 });
    expect(rl.check('ip1').remaining).toBe(4);
    expect(rl.check('ip1').remaining).toBe(3);
    expect(rl.check('ip1').remaining).toBe(2);
  });

  it('returns standard rate-limit headers', () => {
    const rl = create({ maxRequests: 3 });
    const result = rl.check('ip1');
    expect(result.headers).toHaveProperty('X-RateLimit-Limit', '3');
    expect(result.headers).toHaveProperty('X-RateLimit-Remaining', '2');
    expect(result.headers).toHaveProperty('X-RateLimit-Reset');
  });

  it('includes Retry-After header when denied', () => {
    const rl = create({ maxRequests: 1 });
    rl.check('ip1');
    const denied = rl.check('ip1');
    expect(denied.allowed).toBe(false);
    expect(denied.headers).toHaveProperty('Retry-After');
  });

  it('does not include Retry-After header when allowed', () => {
    const rl = create({ maxRequests: 5 });
    const allowed = rl.check('ip1');
    expect(allowed.allowed).toBe(true);
    expect(allowed.headers).not.toHaveProperty('Retry-After');
  });

  it('enforces maxEntries cap', () => {
    const rl = create({ maxRequests: 10, maxEntries: 2 });
    expect(rl.check('ip1').allowed).toBe(true);
    expect(rl.check('ip2').allowed).toBe(true);
    // Third unique key should be rejected
    const result = rl.check('ip3');
    expect(result.allowed).toBe(false);
  });
});
