// Pure-function tests for the easing engine that powers useCountUp.
// The React hook is a thin shell over countUpAt — its behaviour reduces
// to "feed successive rAF timestamps into countUpAt and call setState
// with the result", so locking down the pure function's contract gives
// us coverage of the actual animation curve without needing a DOM,
// React renderer, or fake timers.

import { describe, it, expect } from 'vitest';
import { countUpAt } from '@/lib/hooks/useCountUp';

describe('countUpAt', () => {
  it('returns `from` at t=0', () => {
    expect(countUpAt(0, 0, 0, 100, 600)).toBe(0);
    expect(countUpAt(1000, 1000, 42, 100, 600)).toBe(42);
  });

  it('returns `target` at t=durationMs (clamp at 1.0)', () => {
    expect(countUpAt(0, 600, 0, 100, 600)).toBe(100);
    expect(countUpAt(0, 5000, 0, 100, 600)).toBe(100); // beyond duration → still target
  });

  it('handles count-down (target < from)', () => {
    expect(countUpAt(0, 0, 100, 0, 600)).toBe(100);
    expect(countUpAt(0, 600, 100, 0, 600)).toBe(0);
    // Midway: easeOutCubic at t=0.5 ≈ 0.875, so 100 - 87 = 13.
    expect(countUpAt(0, 300, 100, 0, 600)).toBe(13);
  });

  it('uses easeOutCubic — most progress made early, settles softly', () => {
    // At t=0.5, easeOutCubic = 1 - (0.5)^3 = 0.875.
    // 0 + (100 - 0) * 0.875 = 87.5 → rounded = 88.
    expect(countUpAt(0, 300, 0, 100, 600)).toBe(88);

    // At t=0.25, easeOutCubic = 1 - (0.75)^3 ≈ 0.578.
    // 0 + 100 * 0.578 = 57.8 → 58.
    expect(countUpAt(0, 150, 0, 100, 600)).toBe(58);

    // At t=0.75, easeOutCubic = 1 - (0.25)^3 ≈ 0.984.
    expect(countUpAt(0, 450, 0, 100, 600)).toBe(98);
  });

  it('does not return values outside [from, target]', () => {
    // Even for unusual but valid inputs, the eased value stays in range.
    for (let ms = 0; ms <= 600; ms += 50) {
      const v = countUpAt(0, ms, 0, 100, 600);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('is monotonic — value never decreases as time advances (for count-up)', () => {
    let prev = -1;
    for (let ms = 0; ms <= 600; ms += 25) {
      const v = countUpAt(0, ms, 0, 100, 600);
      expect(v).toBeGreaterThanOrEqual(prev);
      prev = v;
    }
  });

  it('is monotonic — value never increases as time advances (for count-down)', () => {
    let prev = 101;
    for (let ms = 0; ms <= 600; ms += 25) {
      const v = countUpAt(0, ms, 100, 0, 600);
      expect(v).toBeLessThanOrEqual(prev);
      prev = v;
    }
  });

  it('clamps negative progress (now < start) to `from`', () => {
    // Defensive guard against clock-skew or out-of-order timestamps.
    expect(countUpAt(1000, 500, 0, 100, 600)).toBe(0);
  });

  it('handles target === from (no animation needed)', () => {
    expect(countUpAt(0, 0, 50, 50, 600)).toBe(50);
    expect(countUpAt(0, 300, 50, 50, 600)).toBe(50);
    expect(countUpAt(0, 600, 50, 50, 600)).toBe(50);
  });

  it('rounds to integer at every step', () => {
    // 7 → 13 over 600ms. Intermediate value at t=0.3 ≈ 0.657 → 7 + 6*0.657 = 10.94 → 11.
    const v = countUpAt(0, 180, 7, 13, 600);
    expect(Number.isInteger(v)).toBe(true);
    expect(v).toBe(11);
  });

  it('honours a non-zero start anchor (rAF timestamp pattern)', () => {
    // Real-world: first rAF callback gives the platform's high-res timestamp
    // as `now`, which we anchor as `start`. Subsequent frames should
    // interpolate based on (now - start), not against any absolute origin.
    const start = 12345.678;
    expect(countUpAt(start, start, 0, 100, 600)).toBe(0);
    expect(countUpAt(start, start + 600, 0, 100, 600)).toBe(100);
    expect(countUpAt(start, start + 300, 0, 100, 600)).toBe(88);
  });
});
