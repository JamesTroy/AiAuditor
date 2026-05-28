import { useEffect, useRef, useState } from 'react';

/**
 * Animate an integer from 0 (or from the previous value) up to `target`
 * over `durationMs`. Returns the current frame value.
 *
 * Honours prefers-reduced-motion by snapping straight to the target — the
 * accessibility cost of a counting animation is non-zero for users with
 * vestibular sensitivity, and a static number is fully informative anyway.
 *
 * First-paint behaviour: starts at 0 and animates up to `target` on mount.
 * Earlier versions initialised value to target on first paint, which made
 * the very first appearance skip the animation entirely — so users opening
 * a fully-static list never saw the count-up fire.
 */
export function useCountUp(target: number | null, durationMs = 600): number {
  const [value, setValue] = useState<number>(0);
  // `null` sentinel for "never animated yet" — distinct from "animated and
  // landed on this value". Without this, the equality check below would
  // short-circuit on the very first effect run.
  const lastTarget = useRef<number | null>(null);

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
