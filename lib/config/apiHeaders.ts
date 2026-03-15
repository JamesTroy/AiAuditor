// CACHE-002/007: Shared response headers for all API routes.
// Standardizes Cache-Control to 'no-store' (prohibits any storage) and adds
// X-Accel-Buffering: no for Railway's nginx layer to prevent stream buffering.

/** Headers for streaming text responses (audit, chat, synthesize, site-audit). */
export const STREAM_RESPONSE_HEADERS: Record<string, string> = {
  'Content-Type': 'text/plain; charset=utf-8',
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
  'X-Accel-Buffering': 'no',
};

/** Headers for non-streaming API responses (JSON, plain text). */
export const API_RESPONSE_HEADERS: Record<string, string> = {
  'Cache-Control': 'no-store',
  'X-Content-Type-Options': 'nosniff',
};
