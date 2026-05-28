import { useEffect, useState } from 'react';

/**
 * Reactive `prefers-reduced-motion` hook.
 *
 * Returns `true` when the user has asked for reduced motion via their OS
 * preference, and updates if they toggle it mid-session.
 *
 * Why this exists as its own hook:
 *  - Centralises the SSR / jsdom / missing-matchMedia guards so every
 *    animation utility doesn't reinvent them.
 *  - Subscribes to the media query's `change` event so the value stays
 *    fresh — reading `matchMedia(…).matches` once at animation start
 *    misses the toggle case.
 *  - Removes `window.matchMedia` from animation hook bodies entirely, so
 *    the "missing guard" vs "redundant guard" review flip-flop has no
 *    target.
 *
 * SSR: `useState`'s lazy initialiser runs once, in whichever environment
 * the component first renders. On the server `window` is undefined, so we
 * return `false` (no preference known). The effect re-evaluates on the
 * client after hydration and triggers a re-render if needed.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState<boolean>(() => readPreference());

  useEffect(() => {
    const mql = getMediaQueryList();
    if (!mql) return;

    // Re-sync on mount in case the SSR snapshot disagreed with the client.
    setReduced(mql.matches);

    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    // Safari < 14 only supports addListener; modern browsers prefer
    // addEventListener. Try the modern API first.
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', onChange);
      return () => mql.removeEventListener('change', onChange);
    }
    mql.addListener(onChange);
    return () => mql.removeListener(onChange);
  }, []);

  return reduced;
}

function getMediaQueryList(): MediaQueryList | null {
  // typeof checks rather than optional chaining so this is safe in any
  // environment — SSR, jsdom without matchMedia, edge runtimes, etc.
  if (typeof window === 'undefined') return null;
  if (typeof window.matchMedia !== 'function') return null;
  return window.matchMedia('(prefers-reduced-motion: reduce)');
}

function readPreference(): boolean {
  const mql = getMediaQueryList();
  return mql?.matches ?? false;
}
