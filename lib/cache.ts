import { createHash } from 'crypto';

// CACHE-013/017: Redis-backed cache for external fetch results.
// Uses Upstash Redis (HTTP-based, connection-less) which works on Railway
// and any future serverless deployment without connection pooling issues.
//
// When UPSTASH_REDIS_REST_URL is not set, falls back to a no-op cache
// so the app still works without Redis (just without caching).

let redis: import('@upstash/redis').Redis | null = null;

async function getRedis() {
  if (redis) return redis;
  if (!process.env.UPSTASH_REDIS_REST_URL || !process.env.UPSTASH_REDIS_REST_TOKEN) {
    return null;
  }
  const { Redis } = await import('@upstash/redis');
  redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL,
    token: process.env.UPSTASH_REDIS_REST_TOKEN,
  });
  return redis;
}

function cacheKey(prefix: string, url: string): string {
  const hash = createHash('sha256').update(url).digest('hex').slice(0, 32);
  return `${prefix}:${hash}`;
}

// CACHE-023: Fetch with Redis cache and mutex-based stampede protection.
// Only the first request populates the cache; concurrent requests wait.
export async function cachedFetch(
  url: string,
  options: {
    ttlSeconds: number;
    maxBytes?: number;
    fetchOptions?: RequestInit;
    prefix?: string;
  },
): Promise<{ data: string; cached: boolean }> {
  const { ttlSeconds, maxBytes = 30_000, fetchOptions, prefix = 'fetch' } = options;
  const client = await getRedis();
  const key = cacheKey(prefix, url);
  // PERF-010: Hoist lockKey to function scope — used in both lock acquire and release.
  const lockKey = `lock:${key}`;

  // Try cache first.
  if (client) {
    try {
      const cached = await client.get<string>(key);
      if (cached !== null) return { data: cached, cached: true };
    } catch {
      // Redis error — fall through to direct fetch.
    }

    // CACHE-023: Acquire lock to prevent stampede.
    try {
      const acquired = await client.set(lockKey, '1', { nx: true, ex: 10 });
      if (!acquired) {
        // PERF-009: Poll in 50ms intervals (up to 500ms) instead of a fixed 300ms sleep.
        // Resolves faster when the lock holder finishes quickly.
        for (let waited = 0; waited < 500; waited += 50) {
          await new Promise((r) => setTimeout(r, 50));
          try {
            const cached = await client.get<string>(key);
            if (cached !== null) return { data: cached, cached: true };
          } catch { break; }
        }
        // Lock holder may have failed — fall through to direct fetch.
      }
    } catch {
      // Lock acquisition failed — proceed without lock.
    }
  }

  // Cache miss — fetch from origin.
  const res = await fetch(url, fetchOptions);
  if (!res.ok) {
    throw new Error(`Fetch failed: HTTP ${res.status}`);
  }
  const text = await res.text();
  const truncated = text.slice(0, maxBytes);

  // Write to cache (best-effort).
  if (client) {
    try {
      await client.setex(key, ttlSeconds, truncated);
    } catch {
      // Cache write failed — not critical.
    }
    try {
      await client.del(lockKey);
    } catch {
      // Lock cleanup failed — will auto-expire.
    }
  }

  return { data: truncated, cached: false };
}

// Direct cache get/set for arbitrary data (e.g., GitHub PR metadata).
export async function cacheGet<T>(key: string): Promise<T | null> {
  const client = await getRedis();
  if (!client) return null;
  try {
    return await client.get<T>(key);
  } catch {
    return null;
  }
}

export async function cacheSet(key: string, value: unknown, ttlSeconds: number): Promise<void> {
  const client = await getRedis();
  if (!client) return;
  try {
    await client.setex(key, ttlSeconds, JSON.stringify(value));
  } catch {
    // Best-effort.
  }
}

export { cacheKey };
