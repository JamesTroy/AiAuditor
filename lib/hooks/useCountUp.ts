import { useEffect, useRef, useState } from 'react';

/**
 * Animate an integer from 0 (or from the previous value) up to `target`
 * over `durationMs`. Returns the current frame value.
 *
 * Honours prefers-reduced-motion by snapping straight to the target — the
 * accessibility cost of a counting animation is non-zero for users with
 * vestibular sensitivity, and a static number is fully informative anyway.
 */
export function useCountUp(target: number | null, durationMs = 600): number {
  const [value, setValue] = useState<number>(target ?? 0);
  // Track the value we last animated *from* so re-renders that pass the
  // same target don't restart the animation.
  const lastTarget = useRef<number | null>(target);

  useEffect(() => {
    if (target === null) return;
    if (lastTarget.current === target) return;
    lastTarget.current = target;

    const reduce =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduce) {
      setValue(target);
      return;
    }

    const start = performance.now();
    const from = value;
    let frame = 0;
    const tick = (now: number) => {
      const t = Math.min(1, (now - start) / durationMs);
      // easeOutCubic — fast start, gentle settle, feels right for a score.
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(from + (target - from) * eased));
      if (t < 1) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
    // value intentionally omitted — including it would restart the
    // animation on every paint.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, durationMs]);

  return value;
}
