'use client';

import { useEffect } from 'react';
import Lenis from 'lenis';

/**
 * Smooth-scroll wrapper, tuned silky.
 *
 * Two previous attempts at smooth scroll felt laggy. Both were correctly
 * removed — but the underlying cause was actually compositor saturation
 * from CSS filter:blur(100px) decorative orbs and background-position
 * shimmer animations across multiple pages, not Lenis itself. Those are
 * now fixed (PRs #28 and #29), so Lenis runs against a healthy compositor
 * and the silky feel actually lands.
 *
 *   lerp: 0.08   — small ε per frame; silky, never feels stuck. The
 *                  responsiveness/silkiness trade is a personal taste
 *                  call; bump to 0.10–0.12 for more snap.
 *   autoRaf: true — Lenis only spends rAF budget while there is actual
 *                  scroll velocity. Idle pages cost nothing.
 *   syncTouch: false — touch input is left to native iOS/Android
 *                      momentum; Lenis only handles wheel/trackpad.
 *
 * Bails on prefers-reduced-motion and on coarse-pointer (touch) devices.
 */
export default function SmoothScroll() {
  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (window.matchMedia('(pointer: coarse)').matches) return;

    const lenis = new Lenis({
      lerp: 0.08,
      wheelMultiplier: 1.0,
      smoothWheel: true,
      syncTouch: false,
      autoRaf: true,
    });

    return () => {
      lenis.destroy();
    };
  }, []);

  return null;
}
