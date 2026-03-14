// In-memory sliding window rate limiter.
//
// ARCH-001 KNOWN LIMITATION: This counter is process-scoped (Node.js module memory).
// In any multi-worker, multi-instance, or serverless deployment (Vercel, AWS Lambda, etc.)
// each process starts with a fresh counter, making this limiter trivially bypassable.
//
// For production with untrusted traffic, replace with a Redis- or Upstash-backed
// atomic counter (e.g. INCR + EXPIRE) so the window is shared across all workers.
//
// Current scope: acceptable for a single-process `next start` or local dev server.

const WINDOW_MS = 60_000; // 1 minute
const MAX_REQUESTS = 10;  // requests per IP per window

// Map<ip, timestamp[]>
const requestLog = new Map<string, number[]>();

export function checkRateLimit(ip: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const windowStart = now - WINDOW_MS;

  const timestamps = (requestLog.get(ip) ?? []).filter((t) => t > windowStart);
  timestamps.push(now);
  requestLog.set(ip, timestamps);

  const count = timestamps.length;
  const allowed = count <= MAX_REQUESTS;
  const remaining = Math.max(0, MAX_REQUESTS - count);

  return { allowed, remaining };
}
