// Shared Motion variants and transitions used across the site.
//
// Why this file exists: a "stunning" feel comes from CONSISTENCY, not from
// every component picking its own easing and duration. Every motion in the
// app should pull from these tokens; one-off custom values are a smell.
//
// Motion respects prefers-reduced-motion automatically when wrapping in
// <MotionConfig reducedMotion="user">; we set that at the root.

import type { Transition, Variants } from 'motion/react';

// ── Durations ────────────────────────────────────────────────────────
export const DURATION = {
  fast: 0.15,
  normal: 0.3,
  slow: 0.5,
} as const;

// ── Easings ──────────────────────────────────────────────────────────
// Custom cubic bezier — smooth ease-out that feels natural for content reveals.
// Borrowed from the Material Design "decelerate" curve.
export const EASE_OUT_SOFT = [0.16, 1, 0.3, 1] as const;
// Sharper ease for small UI elements (chips, tags, hover changes).
export const EASE_OUT_SNAPPY = [0.32, 0.72, 0, 1] as const;

// ── Transitions (reusable presets) ───────────────────────────────────
export const transitions = {
  /** Default reveal — soft, normal duration. Use for sections and cards. */
  soft: {
    duration: DURATION.normal,
    ease: EASE_OUT_SOFT,
  } satisfies Transition,
  /** Quick UI feedback — small elements that should respond fast. */
  snappy: {
    duration: DURATION.fast,
    ease: EASE_OUT_SNAPPY,
  } satisfies Transition,
  /** Gentle spring — for hover and tap on cards. Doesn't oscillate. */
  springGentle: {
    type: 'spring',
    stiffness: 220,
    damping: 26,
    mass: 0.6,
  } satisfies Transition,
  /** Bouncier spring — for the occasional emphasis (CTA tap, success). */
  springBouncy: {
    type: 'spring',
    stiffness: 400,
    damping: 20,
    mass: 0.5,
  } satisfies Transition,
} as const;

// ── Variants ─────────────────────────────────────────────────────────

/** Fade + slide up. Default for content sections and list items. */
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 8 },
  visible: { opacity: 1, y: 0, transition: transitions.soft },
};

/** Pure fade. For overlays, modals, and elements where motion would be noisy. */
export const fadeOnly: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: transitions.soft },
};

/** Scale + fade — for elements that "pop into existence" (chips, badges, modals). */
export const popIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  visible: { opacity: 1, scale: 1, transition: transitions.snappy },
};

/**
 * Stagger container — wrap a list with this and use a child variant
 * (fadeUp, popIn, etc.) on each child to get a sequenced reveal.
 */
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

/** Slightly slower stagger — for big-feature reveals (dashboard hero, etc.). */
export const staggerContainerSlow: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.1,
      delayChildren: 0.08,
    },
  },
};

// ── Whileh interactive presets ───────────────────────────────────────

/** Card hover lift — subtle Y translate. Pair with a CSS shadow change. */
export const hoverLift = {
  y: -2,
  transition: transitions.springGentle,
};

/** Tap feedback — slight scale down. Use on buttons and clickable cards. */
export const tapScale = {
  scale: 0.97,
  transition: transitions.snappy,
};
