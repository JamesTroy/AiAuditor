// In-memory sliding window rate limiter.
// Safe for a single-process personal tool (Next.js dev or `next start`).
// Restarts clear the window — acceptable for a personal tool with no persistence needs.

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
