'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Tuned smooth-scroll wrapper.
 *
 * The earlier version of this component shipped with `duration: 1.2` which
 * meant every scroll input took >1s to settle — that's literally what
 * "scrolling feels laggy" feels like. This version uses `lerp` mode
 * (linear interpolation toward target every frame, no fixed duration) so
 * the velocity always tracks input closely. The numbers below were tuned
 * to feel responsive on desktop trackpads/mice without overshooting.
 *
 * Disabled cases:
 *   - prefers-reduced-motion → bail; user gets native scroll.
 *   - touch devices (phones/tablets) → bail; native iOS/Android momentum
 *     scrolling is already excellent and Lenis tends to fight it.
 *   - Lenis only runs its rAF loop while there is actual scroll velocity
 *     to apply, so idle pages don't burn frame budget.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    // Coarse pointer = primarily touch. Skip Lenis here — native is better.
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const lenis = new Lenis({
      lerp: 0.12,             // 0.05 (silky) – 0.20 (snappy). 0.12 is the sweet spot.
      wheelMultiplier: 1.0,   // 1:1 with native wheel events — no amplification
      smoothWheel: true,
      syncTouch: false,       // never touch touch input
      autoRaf: true,          // Lenis manages its own rAF, only when needed
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  return null;
}
