// DX-019: Shared Redis client singleton.
// Both lib/cache.ts and lib/rateLimit.ts need an Upstash Redis client.
// This module initialises one shared instance to avoid doubling connection
// count against Upstash's limits and to provide a single pattern for
// Redis initialisation across the codebase.
//
// Returns null when credentials are missing — callers must handle the
// no-Redis path (e.g., in-memory fallback or no-op caching).

import { Redis } from '@upstash/redis';

export const redis: Redis | null =
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
    ? new Redis({
        url: process.env.UPSTASH_REDIS_REST_URL,
        token: process.env.UPSTASH_REDIS_REST_TOKEN,
      })
    : null;
