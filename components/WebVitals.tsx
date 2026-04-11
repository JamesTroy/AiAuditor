'use client';

// AUDIT-CWV: Report Core Web Vitals to Plausible analytics as custom events.
// Tracks LCP, INP, CLS, FCP, and TTFB — the five metrics Google uses for
// page experience ranking. Only fires when Plausible is configured.
//
// Sends events as: pageview with custom props (Plausible custom events API).
// Each metric fires exactly once per page load.

import { useEffect } from 'react';
import { onLCP, onINP, onCLS, onFCP, onTTFB } from 'web-vitals';
import type { Metric } from 'web-vitals';

function sendToPlausible(metric: Metric) {
  // Plausible custom events: window.plausible() is injected by the Plausible script.
  // If Plausible isn't loaded (no domain configured), this is a no-op.
  const plausible = (window as Record<string, unknown>).plausible as
    | ((event: string, opts: { props: Record<string, string | number> }) => void)
    | undefined;

  if (!plausible) return;

  plausible('Web Vitals', {
    props: {
      metric: metric.name,
      value: Math.round(metric.name === 'CLS' ? metric.value * 1000 : metric.value),
      rating: metric.rating, // 'good' | 'needs-improvement' | 'poor'
      path: window.location.pathname,
    },
  });
}

export default function WebVitals() {
  useEffect(() => {
    onLCP(sendToPlausible);
    onINP(sendToPlausible);
    onCLS(sendToPlausible);
    onFCP(sendToPlausible);
    onTTFB(sendToPlausible);
  }, []);

  return null;
}
