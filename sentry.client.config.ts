// AUDIT-SENTRY: Client-side Sentry configuration.
// Only initializes when NEXT_PUBLIC_SENTRY_DSN is set — no-op in dev without it.

import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    // Performance: sample 10% of transactions in production to control costs.
    tracesSampleRate: 0.1,
    // Replay: capture sessions on error only (no continuous recording).
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 1.0,
    // Filter noisy errors that aren't actionable.
    ignoreErrors: [
      // Browser extensions
      /^ResizeObserver loop/,
      // Network failures users can retry
      /^Failed to fetch/,
      /^Load failed/,
      /^NetworkError/,
      // AbortController (user navigated away)
      /^AbortError/,
    ],
    environment: process.env.NODE_ENV,
  });
}
