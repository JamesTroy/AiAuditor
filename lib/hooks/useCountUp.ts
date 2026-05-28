import { useEffect, useRef, useState } from 'react';

/**
 * Pure easeOutCubic interpolation between `from` and `target`, based on
 * how far through the duration we are at time `now`. Exposed at module
 * level so it can be unit-tested directly without React, DOM, or rAF —
 * the React hook below is a thin shell that just drives this on each
 * frame.
 */
export function countUpAt(
  start: number,
  now: number,
  from: number,
  target: number,
  durationMs: number,
): number {
  // Zero (or negative) duration means "snap" — return target immediately,
  // both because dividing by zero produces Infinity and because the caller's
  // intent in passing 0 is unambiguous.
  if (durationMs <= 0) return target;
  const t = Math.min(1, Math.max(0, (now - start) / durationMs));
  const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
  return Math.round(from + (target - from) * eased);
}

/**
 * Animate an integer from 0 (or from the previous displayed value) up to
 * `target` over `durationMs`. Returns the current frame value.
 *
 * Behaviour:
 *  - First paint: starts at 0 and animates up to `target` on mount.
 *  - Target changes mid-animation: cancels the in-flight animation and
 *    starts a new one from whatever's currently on screen (via a ref —
 *    no stale-closure capture of React state).
 *  - prefers-reduced-motion: snaps directly to `target`. Read at the start
 *    of each animation; toggling the OS preference mid-animation will not
 *    interrupt the current one, but the next animation respects it.
 *  - SSR: useEffect is client-only, so performance.now / rAF / matchMedia
 *    are always defined when this runs. No environment guards needed.
 */
export function useCountUp(target: number | null, durationMs = 600): number {
  const [value, setValue] = useState<number>(0);

  // Live mirror of what's painted on screen. Read by the effect as the
  // animation's starting point, written every frame. Using a ref instead
  // of the closure-captured `value` state avoids needing `value` in the
  // dependency array (which would restart the animation every frame).
  const displayRef = useRef<number>(0);
  // Last target we animated TO. Lets a same-target re-render short-circuit
  // without restarting the animation. null sentinel = "never animated yet".
  const lastTarget = useRef<number | null>(null);

  // Round the caller-supplied target to an integer up-front. The hook's
  // animation pipeline operates in integer space (countUpAt rounds each
  // frame), so accepting a non-integer means `next` can never equal
  // `target` exactly — a value-based termination would never fire and
  // we'd loop forever. Coercing once at the boundary eliminates the bug.
  const intTarget = target === null ? null : Math.round(target);

  useEffect(() => {
    if (intTarget === null) {
      lastTarget.current = null;
      return;
    }
    if (lastTarget.current === intTarget) return;
    lastTarget.current = intTarget;

    // Optional chaining covers the jsdom-without-matchMedia case (some
    // test environments) without adding the `typeof window` guard back —
    // useEffect only runs client-side, so `window` itself is always present.
    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
    if (reduce) {
      displayRef.current = intTarget;
      setValue(intTarget);
      return;
    }

    const from = displayRef.current;
    let cancelled = false;
    // null sentinel — only call cancelAnimationFrame on a real handle so we
    // never pass 0 into it (per-spec it's a no-op, but it's cleaner not to
    // feed bogus IDs to the platform).
    let frame: number | null = null;
    let start: number | null = null;

    const tick = (now: number) => {
      if (cancelled) return;
      // Anchor `start` to the first rAF callback (not performance.now() at
      // schedule time) so we don't overshoot on the first frame.
      if (start === null) start = now;
      const elapsed = now - start;
      // Time-based termination — when the duration is up, snap to exact
      // target and stop. Belt-and-braces vs the value-based check: even
      // if rounding never lands on target (e.g. wild future refactor),
      // we still terminate.
      if (elapsed >= durationMs) {
        displayRef.current = intTarget;
        setValue(intTarget);
        return;
      }
      const next = countUpAt(start, now, from, intTarget, durationMs);
      displayRef.current = next;
      setValue(next);
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => {
      cancelled = true;
      if (frame !== null) cancelAnimationFrame(frame);
    };
  }, [intTarget, durationMs]);

  return value;
}
