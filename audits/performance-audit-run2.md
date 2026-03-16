# Performance Analysis Report

**Codebase:** TypeScript + React 19 + Next.js 15.5 + Drizzle ORM
**Analysis Date:** Based on submitted source

---

## 1. Executive Summary

| Attribute | Value |
|---|---|
| Language / Framework | TypeScript + React 19 + Next.js 15.5 + Drizzle ORM |
| Overall Performance Risk | **High** |
| Critical Findings | 3 |
| High Findings | 8 |
| Medium Findings | 9 |
| Low Findings | 6 |
| **Highest-Impact Bottleneck** | `site-audit/page.tsx` O(n²) string concatenation during streaming + sequential audit execution — compounds into multi-second stalls on 100KB responses |

The codebase is well-structured with several proactive optimizations already in place (RAF batching, React.memo on AgentCard, debounced search, pre tag during streaming). The critical issues are concentrated in three areas: bundle size from icon imports, sequential database queries on the dashboard, and string accumulation in the site-audit streaming path.

---

## 2. Severity Legend

| Severity | Meaning |
|---|---|
| Critical | Causes timeouts, OOM crashes, or O(n²+) behavior on real-world inputs |
| High | Significant throughput degradation or memory growth under load |
| Medium | Measurable overhead; acceptable now but will fail at scale |
| Low | Minor inefficiency; worth fixing but low urgency |

---

## 3. Algorithmic Complexity Analysis

### **[Critical] PERF-001** — O(n²) string accumulation in site-audit streaming

- **Location:** `app/site-audit/page.tsx` — streaming loop
- **Current Complexity:** O(n²) time, O(n) space — each `accumulated += chunk` copies the entire accumulated string
- **Target Complexity:** O(n) time, O(n) space
- **Impact:** At 100KB response with ~1KB chunks (100 iterations), the final iterations copy ~99KB each. Total work ≈ 5,000KB of string copies vs. 100KB optimal. On a 100KB audit this is a ~50× memory write amplification. On mobile or low-end hardware this causes visible jank.
- **Remediation:**

```typescript
// BEFORE (in streaming loop):
accumulated += chunk;

// AFTER — collect into array, join once at completion:
const chunks: string[] = [];
// ...in loop:
chunks.push(chunk);
// ...on completion:
const accumulated = chunks.join('');
setResult(accumulated);
```

---

### **[Critical] PERF-002** — Sequential audit execution in site-audit (O(n) latency instead of O(1))

- **Location:** `app/site-audit/page.tsx` — `streamSingleAudit()` loop
- **Current Complexity:** O(n) wall-clock time where n = number of agents selected (up to ~50)
- **Target Complexity:** O(1) wall-clock time with bounded concurrency
- **Impact:** 10 sequential audits × ~30s each = 5 minutes. With concurrency-4 parallelism: ~75s. A 4× speedup at minimum; up to 10× for full agent sets.
- **Remediation:**

```typescript
// BEFORE:
for (const agent of selectedAgents) {
  await streamSingleAudit(agent, input);
}

// AFTER — bounded concurrency pool (p-limit or manual):
const CONCURRENCY = 4; // respect Anthropic rate limits
const limit = pLimit(CONCURRENCY);
await Promise.all(
  selectedAgents.map((agent) =>
    limit(() => streamSingleAudit(agent, input))
  )
);

// If p-limit is undesirable, manual semaphore:
async function runWithConcurrency<T>(
  tasks: (() => Promise<T>)[],
  concurrency: number
): Promise<T[]> {
  const results: T[] = [];
  const executing = new Set<Promise<void>>();
  for (const task of tasks) {
    const p = task().then((r) => { results.push(r); executing.delete(p as unknown as Promise<void>); });
    executing.add(p as unknown as Promise<void>);
    if (executing.size >= concurrency) await Promise.race(executing);
  }
  await Promise.all(executing);
  return results;
}
```

---

### **[Critical] PERF-003** — 55-regex detectAgents() on raw (undebounced) input in AuditInterface

- **Location:** `components/AuditInterface.tsx` — `useMemo` calling `detectAgents()`
- **Current Complexity:** O(r × n) per keystroke where r=55 regexes, n=input length (up to 60K chars). useMemo only prevents re-computation when the input reference is stable — it still runs on every character typed.
- **Target Complexity:** O(r × n) but gated behind a 150ms debounce
- **Impact:** At 60K chars, each regex test on a complex pattern can take 0.5–2ms. 55 tests = 27–110ms per keystroke. This blocks the main thread and causes input lag. The HomeSearch debounce does NOT protect AuditInterface.
- **Remediation:**

```typescript
// In AuditInterface.tsx — add debounced value:
import { useDeferredValue } from 'react';

// Replace direct input use in detectAgents useMemo:
const deferredInput = useDeferredValue(input); // React 19 — schedules at lower priority

const detectedAgents = useMemo(
  () => deferredInput.length >= 10 ? detectAgents(deferredInput) : [],
  [deferredInput]
);

// OR — explicit debounce hook if deterministic timing is needed:
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}
const debouncedInput = useDebounced(input, 150);
const detectedAgents = useMemo(() => detectAgents(debouncedInput), [debouncedInput]);
```

---

### **[High] PERF-004** — 4 sequential DB queries on dashboard page load

- **Location:** `app/dashboard/page.tsx`
- **Current Complexity:** O(4 × RTT) latency — queries run one after another
- **Target Complexity:** O(1 × RTT) — parallelized
- **Impact:** At 5ms per query (local DB) = 20ms sequential vs. 5ms parallel. At 20ms per query (remote DB) = 80ms sequential vs. 20ms parallel. 4× reduction in DB wait time.
- **Remediation:**

```typescript
// BEFORE:
const totalCount = await db.select(...).from(auditTable).where(...);
const scores = await db.select(...).from(auditTable).where(...);
const trend = await db.select(...).from(auditTable).where(...).limit(10);
const audits = await db.select(...).from(auditTable).where(...).limit(21);

// AFTER:
const [totalCount, scores, trend, audits] = await Promise.all([
  db.select({ count: count() }).from(auditTable).where(eq(auditTable.userId, userId)),
  db.select({ score: auditTable.score, result: auditTable.result })
    .from(auditTable).where(and(eq(auditTable.userId, userId), eq(auditTable.status, 'completed'))),
  db.select({ score: auditTable.score, result: auditTable.result, createdAt: auditTable.createdAt })
    .from(auditTable).where(...).orderBy(desc(auditTable.createdAt)).limit(10),
  db.select().from(auditTable).where(...).orderBy(desc(auditTable.createdAt)).limit(21),
]);
```

---

### **[High] PERF-005** — extractScore() backfill loop on every dashboard load

- **Location:** `app/dashboard/page.tsx` — post-query backfill
- **Current Complexity:** O(n × r) where n = audits without scores, r = 5 regex patterns. Runs on every page load.
- **Target Complexity:** O(1) — run once via migration or background job
- **Impact:** If 50 audits lack scores, 50 × 5 regex operations + 50 DB writes fire on every dashboard load. Under concurrent users this creates a write storm.
- **Remediation:**

```typescript
// Option A — one-time migration script (preferred):
// scripts/backfill-scores.ts
const auditsWithoutScore = await db.select()
  .from(auditTable)
  .where(and(isNull(auditTable.score), eq(auditTable.status, 'completed')));

await Promise.all(
  auditsWithoutScore.map(async (audit) => {
    const score = extractScore(audit.result ?? '');
    if (score !== null) {
      await db.update(auditTable)
        .set({ score })
        .where(eq(auditTable.id, audit.id));
    }
  })
);

// Option B — if backfill must stay in page.tsx, gate behind a flag:
// Only run if the count of null-score completed audits > 0 (add a cheap COUNT query)
// and rate-limit to once per 5 minutes per user via a server-side cache
```

---

### **[High] PERF-006** — CSP string rebuilt from scratch on every middleware invocation

- **Location:** `middleware.ts` — CSP array construction
- **Current Complexity:** O(1) per request but allocates ~15 string segments + array + join on every non-static request
- **Target Complexity:** O(1) with pre-computed template strings
- **Impact:** Middleware runs on every request. At 1000 req/s, this creates 15,000 short-lived string allocations/sec. The `isDev` and `hasPlausible` checks are constant for the process lifetime but re-evaluated every request.
- **Remediation:**

```typescript
// Compute once at module initialization:
const isDev = process.env.NODE_ENV === 'development';
const hasPlausible = !!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

const SCRIPT_SRC_PARTS = [
  "'strict-dynamic'",
  "'unsafe-inline'",
  ...(isDev ? ["'unsafe-eval'"] : []),
  ...(hasPlausible ? ['https://plausible.io'] : []),
].join(' ');

const CONNECT_SRC = `connect-src 'self'${hasPlausible ? ' https://plausible.io' : ''}`;

const REPORT_TO_VALUE = JSON.stringify({
  group: 'csp-endpoint',
  max_age: 86400,
  endpoints: [{ url: '/api/csp-report' }],
});

const STATIC_HEADERS = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  ...(isDev ? {} : { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' }),
} as const;

// In middleware — only nonce changes per request:
export function middleware(request: NextRequest) {
  // ...auth checks...
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = [
    "default-src 'self'",
    `script-src 'nonce-${nonce}' ${SCRIPT_SRC_PARTS}`,
    "style-src 'self' 'unsafe-inline'",
    "font-src 'self'",
    "img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com",
    CONNECT_SRC,
    "frame-ancestors 'none'",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    'upgrade-insecure-requests',
    "report-uri /api/csp-report",
    "report-to csp-endpoint",
  ].join('; ');
  // Apply nonce + static headers...
}
```

---

### **[Medium] PERF-007** — `chunksRef.current.join('')` called twice in useAuditSession

- **Location:** `lib/hooks/useAuditSession.ts` — end of `runAudit`
- **Current Complexity:** O(n) join called twice (once in RAF callback, once at completion)
- **Target Complexity:** O(n) join called once
- **Impact:** Minor — at 100KB result this is a redundant 100KB string allocation. Low urgency but trivially fixable.
- **Remediation:**

```typescript
// At completion, the RAF has already been cancelled.
// The final join is correct — just ensure the RAF callback also
// reads from the same ref without double-joining:
const fullResult = chunksRef.current.join('');
setResult(fullResult);
setStatus('complete');
saveAudit({ ..., result: fullResult });
// RAF callback should NOT call join() — it should read a pre-joined ref:
const latestRef = useRef('');
// In RAF: setResult(latestRef.current) — update latestRef in the read loop
```

---

### **[Medium] PERF-008** — `rateLimit.ts` O(n) array filter on every `.check()` call

- **Location:** `lib/rateLimit.ts` — sliding window implementation
- **Current Complexity:** O(n) filter + push per check, where n = entries in window (up to maxEntries=10K)
- **Target Complexity:** O(log n) with a sorted deque or O(1) amortized with a circular buffer
- **Impact:** At 10K entries and 1000 req/s, each check filters 10K items. 9 limiter instances × 10K filter = 90K comparisons per request. Acceptable now but degrades linearly with traffic.
- **Remediation:**

```typescript
// Replace filter with a deque that pops expired entries from the front:
class SlidingWindowLimiter {
  private timestamps: number[] = []; // maintained in sorted order
  
  check(key: string, windowMs: number, limit: number): boolean {
    const now = Date.now();
    const cutoff = now - windowMs;
    // Pop expired entries from front (O(k) where k = expired count, amortized O(1))
    let i = 0;
    while (i < this.timestamps.length && this.timestamps[i] < cutoff) i++;
    if (i > 0) this.timestamps.splice(0, i);
    
    if (this.timestamps.length >= limit) return false;
    this.timestamps.push(now);
    return true;
  }
}
```

---

### **[Medium] PERF-009** — `slugify()` runs 3 regex replacements per heading render in SafeMarkdown

- **Location:** `components/markdownComponents.tsx`
- **Current Complexity:** O(n) × 3 regex passes per heading, called on every render
- **Target Complexity:** O(n) × 3 but memoized
- **Impact:** Low per-call cost but called on every re-render of any component using SafeMarkdown. Memoization eliminates redundant work.
- **Remediation:**

```typescript
const slugCache = new Map<string, string>();

function slugify(text: string): string {
  if (slugCache.has(text)) return slugCache.get(text)!;
  const slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '').replace(/-+/g, '-');
  slugCache.set(text, slug);
  return slug;
}
// Bound cache size to prevent unbounded growth:
// if (slugCache.size > 500) slugCache.clear();
```

---

### **[Low] PERF-010** — `anonymizeIp()` splits and re-joins IP string on every audit request

- **Location:** `app/api/audit/route.ts`
- **Current Complexity:** O(n) split + slice + join — trivial but allocates 3 arrays per request
- **Target Complexity:** O(n) single-pass regex
- **Impact:** Negligible at current scale. Mention for completeness.
- **Remediation:**

```typescript
function anonymizeIp(ip: string): string {
  // IPv6: keep first 3 groups
  if (ip.includes(':')) {
    return ip.replace(/^([\da-f]+:[\da-f]+:[\da-f]+):.*$/i, '$1::/48');
  }
  // IPv4: zero last octet
  return ip.replace(/\.\d+$/, '.0');
}
```

---

### **[Low] PERF-011** — `parseAuditResult.ts` splits entire result into lines then tests each with regex

- **Location:** `lib/parseAuditResult.ts`
- **Current Complexity:** O(n × r) where n = lines, r = regex patterns per line
- **Target Complexity:** O(n) with single-pass regex using `matchAll` on the full string
- **Impact:** Called once after audit completes (not in a hot loop). At 100KB / ~50 chars/line = 2000 lines × 3 patterns = 6000 regex tests. Acceptable but improvable.
- **Remediation:** Replace line-by-line loop with a single `matchAll` using a combined pattern that captures severity + context in one pass.

---

### **[Low] PERF-012** — `escapeUserInput()` uses two sequential `.replace()` calls

- **Location:** `app/api/audit/route.ts`
- **Current Complexity:** O(n) × 2 passes
- **Target Complexity:** O(n) single pass
- **Remediation:**

```typescript
function escapeUserInput(input: string): string {
  return input.replace(/[<>]/g, (c) => c === '<' ? '&lt;' : '&gt;');
}
```

---

## 4. Memory & Allocation Issues

### **[High] PERF-013** — AgentCard imports 55+ lucide-react icons at module scope

- **Location:** `components/AgentCard.tsx`
- **Current Behavior:** 55+ named imports from `lucide-react` at module scope. Even with tree-shaking, the import map object (`BUILT_IN_ICONS`) holding ~60 icon component references is allocated once and held for the module lifetime. More critically, this forces the bundler to include all 55 icon modules in the chunk that contains AgentCard.
- **Impact:** Contributes to the 269KB First Load JS on `/audit/[agent]` and 116KB on `/`. Each lucide icon is ~1–3KB minified; 55 icons = 55–165KB of icon code in the bundle before tree-shaking. After tree-shaking this is better, but the dynamic lookup pattern (`BUILT_IN_ICONS[iconName]`) may defeat tree-shaking entirely depending on how the map is constructed.
- **Target:** Lazy-load icons or use a single dynamic import map that tree-shakes correctly.
- **Remediation:**

```typescript
// Option A — dynamic import per icon (best tree-shaking):
// In AgentCard.tsx:
import dynamic from 'next/dynamic';
import type { LucideProps } from 'lucide-react';

const iconCache = new Map<string, React.ComponentType<LucideProps>>();

async function getIcon(name: string): Promise<React.ComponentType<LucideProps>> {
  if (iconCache.has(name)) return iconCache.get(name)!;
  // lucide-react supports dynamic imports:
  const mod = await import(`lucide-react`);
  const Icon = (mod as Record<string, unknown>)[name] as React.ComponentType<LucideProps>;
  iconCache.set(name, Icon);
  return Icon;
}

// Option B — if SSR is needed, use a smaller icon set:
// Replace lucide-react with @phosphor-icons/react (smaller) or
// inline only the 10 most-used icons as SVG strings.

// Option C — split the icon map into a separate chunk:
// Move BUILT_IN_ICONS to a separate file imported with next/dynamic
const AgentIconMap = dynamic(() => import('@/lib/agentIconMap'), { ssr: false });
```

---

### **[High] PERF-014** — `chunks: string[]` in `makeStream()` accumulates full audit result in server memory

- **Location:** `app/api/audit/route.ts` — `makeStream()` function
- **Current Behavior:** Every streaming chunk is pushed to `chunks[]` array and held in memory until the stream completes, then joined for DB persistence. For a 100KB audit, this holds 100KB in the Node.js heap per concurrent audit.
- **Impact:** At 10 concurrent audits × 100KB = 1MB. Low absolute impact but grows linearly. The real issue is that the array is never released until the stream's `start()` closure exits — if the stream is long-lived (5 min), this memory is held for the full duration.
- **Remediation:**

```typescript
// Use a single growing string with a size cap, or a PassThrough stream:
// Better: use a TransformStream to tee the stream — one branch to client, one to accumulator
function makeStream(/* ... */): ReadableStream {
  let accumulated = '';
  const MAX_RESULT_CHARS = 100_000;
  
  return new ReadableStream({
    async start(controller) {
      const reader = upstream.getReader();
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          controller.enqueue(value);
          if (auditRecord && accumulated.length < MAX_RESULT_CHARS) {
            // Only accumulate up to the cap — avoid unbounded growth
            accumulated += decoder.decode(value, { stream: true });
            if (accumulated.length > MAX_RESULT_CHARS) {
              accumulated = accumulated.slice(0, MAX_RESULT_CHARS);
            }
          }
        }
        // Save accumulated to DB...
      } finally {
        accumulated = ''; // explicit release
        reader.releaseLock();
        controller.close();
      }
    },
  });
}
```

---

### **[High] PERF-015** — `lastStaleCleanup` is a module-level mutable variable (serverless cold-start reset)

- **Location:** `app/api/audit/route.ts`
- **Current Behavior:** `let lastStaleCleanup = 0` is reset to 0 on every cold start in serverless environments (Vercel, AWS Lambda). This means the cleanup runs on the first request after every cold start, not every 5 minutes as intended.
- **Impact:** In serverless with frequent cold starts, stale cleanup runs on nearly every request, adding a DB write to the audit hot path. In long-running Node.js, it works correctly.
- **Remediation:**

```typescript
// Option A — move cleanup to a cron job / Vercel Cron:
// vercel.json:
// { "crons": [{ "path": "/api/cleanup-stale-audits", "schedule": "*/5 * * * *" }] }

// Option B — use a DB-side scheduled job or pg_cron

// Option C — if module-level state must be used, accept the serverless limitation
// and add a comment documenting the behavior
```

---

### **[Medium] PERF-016** — `localStorage` stores up to 20 full audit results (up to 2MB)

- **Location:** `lib/history.ts` (referenced via `saveAudit` in `useAuditSession.ts`)
- **Current Behavior:** Each audit result can be up to 100KB. 20 entries × 100KB = 2MB in localStorage. localStorage is synchronous and blocks the main thread on read/write.
- **Impact:** `localStorage.setItem` with 2MB of data can block the main thread for 5–50ms on mobile. `JSON.parse` of the full history array on every read adds additional cost.
- **Remediation:**

```typescript
// Option A — store only metadata + truncated preview in localStorage,
// full results in IndexedDB (async):
interface HistoryEntry {
  id: string;
  agentId: string;
  agentName: string;
  inputSnippet: string;
  resultPreview: string; // first 500 chars only
  timestamp: number;
}
// Full results stored in IndexedDB via idb-keyval or similar

// Option B — compress results before storage:
// import { compress, decompress } from 'lz-string';
// localStorage.setItem('audit_history', compress(JSON.stringify(entries)));
```

---

### **[Medium] PERF-017** — `rateLimit.ts` 9 background `setInterval` cleanup timers running permanently

- **Location:** `lib/rateLimit.ts`
- **Current Behavior:** Each of the 9 rate limiter instances starts a `setInterval` at construction time. These run for the lifetime of the Node.js process.
- **Impact:** 9 timers × varying intervals (1min–1hr) = constant background work. Minor CPU overhead but prevents the process from exiting cleanly in test environments. More importantly, in serverless environments these timers are created on every cold start and never cleaned up.
- **Remediation:**

```typescript
// Use lazy cleanup — clean on access rather than on a timer:
check(key: string): RateLimitResult {
  const now = Date.now();
  const entry = this.store.get(key);
  if (entry) {
    // Clean expired timestamps on access (amortized O(1)):
    const cutoff = now - this.windowMs;
    let i = 0;
    while (i < entry.timestamps.length && entry.timestamps[i] < cutoff) i++;
    if (i > 0) entry.timestamps.splice(0, i);
  }
  // ... rest of check logic
}
// Remove all setInterval calls
```

---

### **[Low] PERF-018** — `new TextEncoder()` / `new TextDecoder()` instantiated inside stream closures

- **Location:** `app/api/audit/route.ts` — `makeStream()`, `lib/ai/anthropicProvider.ts`
- **Current Behavior:** `encoder` in `anthropicProvider.ts` is correctly module-scoped. However, `decoder` in `makeStream()` is instantiated inside the function closure, creating a new instance per audit request.
- **Impact:** Negligible per-instance cost, but worth noting for consistency.
- **Remediation:** Hoist `decoder` to module scope alongside `encoder`.

---

## 5. I/O & Async Performance

### **[High] PERF-019** — Dashboard 4 sequential DB queries (duplicate of PERF-004, I/O perspective)

- **Location:** `app/dashboard/page.tsx`
- **Current Behavior:** Four `await db.select()` calls in sequence. Each waits for the previous to complete before starting.
- **Impact:** See PERF-004. From an I/O perspective: each query holds a connection from the pool for its duration. Sequential queries hold the connection 4× longer than necessary, reducing pool availability under concurrent users.
- **Remediation:** See PERF-004 (`Promise.all`).

---

### **[High] PERF-020** — `layout.tsx` forces dynamic rendering via `await headers()` on every page

- **Location:** `app/layout.tsx`
- **Current Behavior:** `await headers()` (called to extract the CSP nonce) opts the entire layout — and therefore every page — out of static generation. Next.js cannot cache any page that calls `headers()` in its render tree.
- **Impact:** Every page load hits the Node.js server instead of being served from the CDN edge cache. For pages like `/login`, `/signup`, and `/` that could be fully static, this adds 50–200ms of server latency per request.
- **Target:** Serve static pages from CDN; only inject nonce for pages that need it.
- **Remediation:**

```typescript
// Option A — use Next.js 15 `unstable_noStore` selectively:
// Move nonce injection to a separate server component that wraps only
// the <script> tags, not the entire layout.

// Option B — use a middleware-only nonce approach without layout.tsx reading headers():
// Pass nonce via a custom header read only in Script components:
// In layout.tsx — remove `await headers()` call
// Use next/script with the nonce prop read from a dedicated server component:

// app/_components/NonceScript.tsx (server component):
import { headers } from 'next/headers';
export async function NonceScript() {
  const nonce = (await headers()).get('x-nonce') ?? '';
  return <script nonce={nonce} dangerouslySetInnerHTML={{ __html: '' }} />;
}
// Only import NonceScript in pages that need inline scripts,
// not in the root layout.

// Option C — accept dynamic rendering but add `export const revalidate = 60`
// to pages that don't need per-request freshness.
```

---

### **[Medium] PERF-021** — `crypto.randomUUID()` + `Buffer.from().toString('base64')` on every middleware request

- **Location:** `middleware.ts`
- **Current Behavior:** `crypto.randomUUID()` generates a UUID (128-bit random), then `Buffer.from(uuid).toString('base64')` base64-encodes the UUID string (not the bytes). This encodes the 36-character UUID string to base64, producing a 48-character string — not a compact nonce.
- **Impact:** Two allocations per request (UUID string + base64 string). The base64 encoding of a UUID string is unnecessary — the UUID itself is already a valid nonce. Minor CPU overhead but semantically wasteful.
- **Remediation:**

```typescript
// Option A — use UUID directly as nonce (already cryptographically random):
const nonce = crypto.randomUUID().replace(/-/g, '');

// Option B — generate compact random bytes for a shorter nonce:
const nonceBytes = new Uint8Array(16);
crypto.getRandomValues(nonceBytes);
const nonce = Buffer.from(nonceBytes).toString('base64');
// This produces a proper 24-char base64 nonce from raw bytes
```

---

### **[Medium] PERF-022** — `cleanupStaleAudits()` called synchronously (fire-and-forget) on every POST request

- **Location:** `app/api/audit/route.ts` — `POST()` handler
- **Current Behavior:** `cleanupStaleAudits()` is called without `await` — it's fire-and-forget. The DB update runs in the background. However, the function is called on every POST request, and the `lastStaleCleanup` check is not atomic (race condition under concurrent requests).
- **Impact:** Under concurrent requests, multiple invocations can pass the `now - lastStaleCleanup < STALE_CLEANUP_INTERVAL_MS` check simultaneously before any of them updates `lastStaleCleanup`, triggering multiple simultaneous cleanup queries.
- **Remediation:**

```typescript
// Set lastStaleCleanup BEFORE the async work to prevent concurrent runs:
async function cleanupStaleAudits() {
  const now = Date.now();
  if (now - lastStaleCleanup < STALE_CLEANUP_INTERVAL_MS) return;
  lastStaleCleanup = now; // Set immediately — before await
  try {
    const cutoff = new Date(now - STALE_AUDIT_THRESHOLD_MS);
    await db.update(auditTable)
      .set({ status: 'failed', updatedAt: new Date() })
      .where(and(eq(auditTable.status, 'running'), lt(auditTable.updatedAt, cutoff)));
  } catch (err) {
    lastStaleCleanup = 0; // Reset on failure to allow retry
    console.error(/* ... */);
  }
}
```

---

### **[Low] PERF-023** — Missing HTTP caching on dashboard API responses

- **Location:** `app/dashboard/page.tsx` (server component), `next.config.ts`
- **Current Behavior:** Dashboard page has no `Cache-Control` header. Every navigation to `/dashboard` triggers 4 fresh DB queries.
- **Impact:** For data that changes at most once per audit (~10/min), a 30-second stale-while-revalidate cache would eliminate ~95% of DB queries.
- **Remediation:**

```typescript
// In app/dashboard/page.tsx:
export const revalidate = 30; // ISR — revalidate every 30 seconds

// OR for per-user data (can't use ISR), use unstable_cache:
import { unstable_cache } from 'next/cache';

const getDashboardData = unstable_cache(
  async (userId: string) => {
    const [count, scores, trend, audits] = await Promise.all([/* queries */]);
    return { count, scores, trend, audits };
  },
  ['dashboard-data'],
  { revalidate: 30, tags: [`user-${userId}`] }
);
```

---

## 6. React / Frontend Rendering

### **[High] PERF-024** — Bundle size: 269KB First Load JS on `/audit/[agent]` (target: <150KB)

- **Location:** Build output — `/audit/[agent]` route
- **Current State:** 269KB First Load JS. The 46KB shared chunk (`chunks/1255`) plus route-specific JS. Primary contributors: `react-markdown` + `remark-gfm` (~45KB), `lucide-react` icon imports (~30–80KB depending on tree-shaking), `@anthropic-ai/sdk` if accidentally bundled client-side, `better-auth` client.
- **Impact:** On a 3G connection (1.5Mbps), 269KB takes ~1.4 seconds to download before any JS executes. LCP and TTI are directly impacted.
- **Remediation:**

```typescript
// 1. Lazy-load react-markdown (only needed after audit completes):
const ReactMarkdown = dynamic(() => import('react-markdown'), {
  loading: () => <div className="animate-pulse h-4 bg-gray-200 rounded" />,
  ssr: false,
});

// 2. Audit the 46KB shared chunk — likely contains a heavy dependency
// used across all routes. Run: ANALYZE=true next build
// Add to next.config.ts:
const withBundleAnalyzer = require('@next/bundle-analyzer')({
  enabled: process.env.ANALYZE === 'true',
});

// 3. Verify @anthropic-ai/sdk is NOT in client bundle:
// It should only appear in server-side code. Add to next.config.ts:
// experimental: { serverComponentsExternalPackages: ['@anthropic-ai/sdk'] }

// 4. Replace react-markdown with a lighter alternative for simple cases:
// - marked (~10KB) for non-React contexts
// - For React: use a custom renderer for the specific markdown features used
```

---

### **[High] PERF-025** — `react-markdown` renders 100KB+ audit results synchronously

- **Location:** `app/site-audit/page.tsx` — `SafeMarkdown` on completion
- **Current Behavior:** When a 100KB audit result completes, `SafeMarkdown` (wrapping `react-markdown`) renders the entire result synchronously. `react-markdown` parses the full markdown AST, then React reconciles the full component tree.
- **Impact:** Parsing 100KB of markdown can take 50–200ms on mid-range devices, blocking the main thread. With 50 agents in site-audit, this could happen 50 times.
- **Remediation:**

```typescript
// Option A — use React.startTransition to defer markdown rendering:
const [showMarkdown, setShowMarkdown] = useState(false);
useEffect(() => {
  if (isComplete) {
    startTransition(() => setShowMarkdown(true));
  }
}, [isComplete]);

// Option B — virtualize the markdown output by splitting on headings:
// Split result at H2/H3 boundaries, render only visible sections
// using IntersectionObserver

// Option C — use a Web Worker for markdown parsing:
// Parse markdown AST in worker, send serialized result to main thread
```

---

### **[High] PERF-026** — AuditInterface has 10 useEffect hooks; several have dependency array risks

- **Location:** `components/AuditInterface.tsx`
- **Current Behavior:** 10 `useEffect` hooks. Without seeing the full dependency arrays, the risk is: effects with missing dependencies silently use stale closures; effects with over-specified dependencies re-run unnecessarily on every render.
- **Specific Risk:** The "detection" effect that calls `detectAgents()` — if it depends on `input` directly (not the debounced value), it runs on every keystroke and potentially triggers re-renders of the agent suggestion UI.
- **Impact:** Each unnecessary effect execution can trigger additional state updates and re-renders, compounding with the 60fps RAF loop during streaming.
- **Remediation:**

```typescript
// Audit each useEffect with React DevTools Profiler:
// 1. Add display names to all effects for profiling
// 2. Replace effects that only compute derived state with useMemo
// 3. For the auto-scroll effects — use a single effect with a ref:

const bottomRef = useRef<HTMLDivElement>(null);
useEffect(() => {
  if (shouldAutoScroll) {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }
}, [result, shouldAutoScroll]); // Single scroll effect, not two
```

---

### **[Medium] PERF-027** — HomeSearch renders 50+ AgentCards without virtualization

- **Location:** `components/HomeSearch.tsx` — "Browse all" expanded state
- **Current Behavior:** When expanded, all 50+ `AgentCard` components are rendered into the DOM simultaneously. Each card has CSS transitions and icon lookups.
- **Impact:** Initial render of 50 cards × ~5ms each = ~250ms render time. Subsequent re-renders (on search input change) re-filter and re-render the visible subset. React.memo on AgentCard helps but doesn't eliminate the DOM node cost.
- **Remediation:**

```typescript
// Option A — virtualize with @tanstack/react-virtual:
import { useVirtualizer } from '@tanstack/react-virtual';

const parentRef = useRef<HTMLDivElement>(null);
const virtualizer = useVirtualizer({
  count: filteredAgents.length,
  getScrollElement: () => parentRef.current,
  estimateSize: () => 120, // estimated card height
  overscan: 5,
});

// Option B — paginate: show 12 cards initially, "Load more" button
// This is simpler and sufficient for 50 agents:
const [visibleCount, setVisibleCount] = useState(12);
const visibleAgents = filteredAgents.slice(0, visibleCount);
```

---

### **[Medium] PERF-028** — `ScoreSparkline` recalculates SVG points on every dashboard render

- **Location:** `app/dashboard/page.tsx` — `ScoreSparkline` component
- **Current Behavior:** SVG polyline point calculation runs on every render of the dashboard page. The data (last 10 scores) doesn't change between renders.
- **Impact:** Minor — point calculation is O(n) where n=10. But it's a server component so it runs on every request, not just client re-renders.
- **Remediation:**

```typescript
// Memoize point calculation (if client component) or compute once (server component):
// Since this is a server component, the calculation already runs once per request.
// If converted to a client component for interactivity, wrap in useMemo:
const points = useMemo(() =>
  scores.map((s, i) => `${(i / (scores.length - 1)) * 100},${100 - s}`).join(' '),
  [scores]
);
```

---

### **[Medium] PERF-029** — `childrenToText()` in markdownComponents.tsx recurses through React children on every heading render

- **Location:** `components/markdownComponents.tsx`
- **Current Behavior:** `childrenToText()` recursively traverses the React children tree to extract text for slug generation. Called on every heading render.
- **Impact:** For deeply nested heading content, this is O(depth × children). In practice headings are shallow, so impact is low. But combined with `slugify()` (PERF-009), every heading render does 2 passes over the content.
- **Remediation:** Combine `childrenToText` + `slugify` into a single memoized function, or use the `node.position` data from remark to extract the raw text directly.

---

### **[Low] PERF-030** — `otherAgents` dropdown renders all 50 agents grouped by 7 categories without virtualization

- **Location:** `components/AuditInterface.tsx` — agent switcher dropdown
- **Current Behavior:** The "switch agent" dropdown renders all ~50 agents in 7 category groups. This is a hidden dropdown (not visible until opened), but the DOM nodes are created on initial render.
- **Impact:** ~50 DOM nodes created but hidden. Minor memory overhead. Becomes noticeable if AuditInterface is rendered many times (it isn't — it's a single-page component).
- **Remediation:** Use `display: none` with conditional rendering (`isOpen && <Dropdown />`) to avoid creating DOM nodes until needed. This is likely already the case — verify.

---

## 7. Database & Network Latency

### **[High] PERF-031** — Missing index on `audit.userId + audit.status + audit.createdAt`

- **Location:** `lib/auth-schema.ts` (Drizzle schema) — inferred from query patterns
- **Current Behavior:** Dashboard queries filter by `userId`, `status`, and order by `createdAt`. Without a composite index, each query performs a full table scan filtered by userId.
- **Impact:** At 10K audit rows per user, a full scan vs. index scan is the difference between 10ms and 0.1ms per query. At 100 users × 4 queries = 400 scans per page load cycle.
- **Remediation:**

```typescript
// In Drizzle schema (lib/auth-schema.ts):
export const audit = pgTable('audit', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull(),
  status: text('status').notNull(),
  score: integer('score'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  // ...other columns
}, (table) => ({
  // Composite index for dashboard queries:
  userStatusCreatedIdx: index('audit_user_status_created_idx')
    .on(table.userId, table.status, table.createdAt),
  // Index for stale cleanup query:
  statusUpdatedIdx: index('audit_status_updated_idx')
    .on(table.status, table.updatedAt),
}));
```

---

### **[High] PERF-032** — Dashboard fetches `result` column for score backfill (large text column in SELECT)

- **Location:** `app/dashboard/page.tsx` — scores query
- **Current Behavior:** `SELECT score, result FROM audit WHERE userId = ? AND status = 'completed'` — fetches the full `result` text (up to 100KB per row) for every completed audit, just to run `extractScore()` on rows where `score IS NULL`.
- **Impact:** If a user has 50 completed audits × 100KB results = 5MB transferred from DB to app server on every dashboard load. This is the single largest unnecessary data transfer in the codebase.
- **Remediation:**

```typescript
// Option A — run backfill as a one-time migration (see PERF-005)
// This eliminates the need to fetch result on dashboard load entirely.

// Option B — if backfill must stay, only fetch result for rows where score IS NULL:
import { isNull } from 'drizzle-orm';

const auditsNeedingBackfill = await db
  .select({ id: auditTable.id, result: auditTable.result })
  .from(auditTable)
  .where(and(
    eq(auditTable.userId, userId),
    eq(auditTable.status, 'completed'),
    isNull(auditTable.score)
  ));
// This fetches result ONLY for rows that need backfill
// All other score queries use the stored score column directly
```

---

### **[Medium] PERF-033** — No query result caching for dashboard data

- **Location:** `app/dashboard/page.tsx`
- **Current Behavior:** Every navigation to `/dashboard` triggers fresh DB queries. Dashboard data (audit history) changes at most ~10 times per minute per user.
- **Impact:** Unnecessary DB load. At 100 concurrent users each refreshing every 30 seconds = 200 DB query sets/minute = 800 individual queries/minute for data that changes rarely.
- **Remediation:** See PERF-023 — use `unstable_cache` with a 30-second TTL and user-specific cache tags. Invalidate on new audit completion via `revalidateTag`.

---

### **[Medium] PERF-034** — `getAgent()` registry lookup on every audit POST request

- **Location:** `app/api/audit/route.ts` — `getAgent(agentType)`
- **Current Behavior:** Agent registry is likely a linear search or object lookup. If it's a linear array search, it's O(n) where n=50 agents on every request.
- **Impact:** Minor at n=50. But if the registry is rebuilt on every call (e.g., reads from disk), this is a significant I/O issue.
- **Remediation:** Ensure the agent registry is a `Map<string, AgentConfig>` initialized once at module scope, making lookups O(1).

---

### **[Low] PERF-035** — Missing `ETag` / `Last-Modified` on audit result API responses

- **Location:** `lib/config/apiHeaders.ts` — `STREAM_RESPONSE_HEADERS`
- **Current Behavior:** Streaming responses correctly cannot be cached. But completed audit results fetched for display (if any GET endpoint exists) should have cache headers.
- **Impact:** Low — streaming responses are inherently non-cacheable. Applicable only if a GET `/api/audit/[id]` endpoint exists.
- **Remediation:** Add `Cache-Control: private, max-age=3600` and `ETag` based on audit ID + updatedAt timestamp to any GET audit result endpoints.

---

## 8. Concurrency & Parallelism

### **[Critical] PERF-036** — Site-audit runs N audits sequentially on the main async thread (duplicate of PERF-002, concurrency perspective)

- **Location:** `app/site-audit/page.tsx`
- **Current Behavior:** Each `streamSingleAudit()` call awaits the full completion of the previous audit before starting the next. The Anthropic API supports concurrent requests; the bottleneck is self-imposed.
- **Impact:** 10 agents × 30s = 5 minutes. With concurrency-4: ~75s. With concurrency-8 (if rate limits allow): ~40s. This is the single largest user-perceived latency issue in the application.
- **Remediation:** See PERF-002. Additionally, consider streaming results to the UI as each agent completes rather than waiting for all to finish.

---

### **[High] PERF-037** — RAF loop in `useAuditSession` runs at 60fps but state updates are coalesced — verify no redundant renders

- **Location:** `lib/hooks/useAuditSession.ts` — RAF batching
- **Current Behavior:** The RAF pattern correctly coalesces multiple chunks into a single state update per frame. However, if `setResult` triggers a re-render of `AuditInterface` (826 lines), and `AuditInterface` has expensive `useMemo` computations that depend on `result`, those memos re-run at 60fps during streaming.
- **Impact:** `parseAuditResult()` (useMemo on result) would run at 60fps during streaming if its dependency is `result`. This is 60 × O(n) regex operations per second on a growing string.
- **Remediation:**

```typescript
// In AuditInterface.tsx — only run parseAuditResult when streaming is complete:
const parsedResult = useMemo(() => {
  if (status !== 'complete') return null; // Skip during streaming
  return parseAuditResult(result);
}, [result, status]); // status prevents running during streaming
```

---

### **[Medium] PERF-038** — `detectAgents()` 55 regex tests are CPU-bound and run on the main thread

- **Location:** `lib/detectAgents.ts`
- **Current Behavior:** 55 regex tests on up to 60K characters, called on the main thread via useMemo.
- **Impact:** See PERF-003. At 60K chars, this can take 30–100ms, causing input lag. This is CPU-bound work that could be offloaded.
- **Remediation:**

```typescript
// Move detectAgents to a Web Worker:
// lib/workers/detectAgents.worker.ts
self.onmessage = (e: MessageEvent<string>) => {
  const result = detectAgents(e.data);
  self.postMessage(result);
};

// In AuditInterface.tsx:
const workerRef = useRef<Worker | null>(null);
useEffect(() => {
  workerRef.current = new Worker(
    new URL('@/lib/workers/detectAgents.worker.ts', import.meta.url)
  );
  workerRef.current.onmessage = (e) => setDetectedAgents(e.data);
  return () => workerRef.current?.terminate();
}, []);

const handleInputChange = useCallback(
  debounce((input: string) => {
    if (input.length >= 10) workerRef.current?.postMessage(input);
  }, 150),
  []
);
```

---

### **[Low] PERF-039** — `anthropicProvider.streamAudit()` retry loop uses exponential backoff without jitter

- **Location:** `lib/ai/anthropicProvider.ts`
- **Current Behavior:** Retry delay = `RETRY_BASE_MS * 2^(attempt-1)` — pure exponential backoff. Under concurrent failures (e.g., Anthropic 503), all retrying requests will retry at the same time (thundering herd).
- **Impact:** Low at current scale (~10 req/min). Becomes relevant at higher concurrency.
- **Remediation:**

```typescript
const delay = RETRY_BASE_MS * 2 ** (attempt - 1) * (0.5 + Math.random() * 0.5);
await sleep(delay);
```

---

## 9. Prioritized Action List

| # | Finding | Action | Estimated Gain | Effort |
|---|---|---|---|---|
| 1 | **PERF-002 / PERF-036** | Parallelize site-audit with concurrency-4 pool | **4–10× reduction in total audit time** (5min → 40–75s) | Medium (2–4h) |
| 2 | **PERF-001** | Replace string concatenation with chunk array in site-audit streaming | **~50× reduction in string allocation work** on 100KB results; eliminates GC pressure | Low (30min) |
| 3 | **PERF-024** | Lazy-load `react-markdown` with `next/dynamic`; run bundle analyzer to identify 46KB shared chunk | **~45–80KB bundle reduction** on audit routes; ~0.5s faster TTI on 3G | Medium (2–4h) |
| 4 | **PERF-013** | Audit lucide-react icon import pattern in AgentCard; verify tree-shaking is effective; switch to dynamic imports if BUILT_IN_ICONS map defeats tree-shaking | **Up to 80KB bundle reduction** if tree-shaking is currently defeated | Medium (2–4h) |
| 5 | **PERF-004 / PERF-019** | Parallelize 4 dashboard DB queries with `Promise.all` | **3–4× reduction in dashboard DB wait time** (80ms → 20ms at 20ms/query) | Low (1h) |
| 6 | **PERF-032** | Stop fetching `result` column for score display; run one-time backfill migration | **Up to 5MB/request reduction** in DB→app data transfer on dashboard | Medium (2–3h) |
| 7 | **PERF-031** | Add composite index on `(userId, status, createdAt)` | **100× query speedup** at scale (full scan → index scan) | Low (30min) |
| 8 | **PERF-020** | Remove `await headers()` from root layout; inject nonce only where needed | **Enables static generation** for `/login`, `/signup`, `/` — CDN-served, ~100–200ms latency reduction | High (4–8h) |
| 9 | **PERF-003** | Add `useDeferredValue` or explicit debounce to `detectAgents()` in AuditInterface | **Eliminates 30–100ms input lag** during code paste | Low (1h) |
| 10 | **PERF-037** | Gate `parseAuditResult` useMemo behind `status === 'complete'` | **Eliminates 60fps regex execution** during streaming | Low (15min) |
| 11 | **PERF-006** | Pre-compute static CSP parts at module scope in middleware | **~15 string allocations eliminated** per request; measurable at 1000+ req/s | Low (1h) |
| 12 | **PERF-005** | Replace dashboard backfill loop with one-time migration script | **Eliminates write storm** on dashboard load; removes O(n×r) work per page view | Medium (2h) |

---

## 10. Overall Score

| Dimension | Score (1–10) | Notes |
|---|---|---|
| Algorithmic Efficiency | 5/10 | O(n²) string concat in site-audit (Critical), sequential audit execution (Critical), undebounced regex on input (Critical) drag the score down significantly. RAF batching and early-exit in detectAgents show awareness of the problem. |
| Memory Management | 6/10 | Chunk accumulation in makeStream is bounded (MAX_RESULT_CHARS). localStorage 2MB cap is a real concern on mobile. Module-level encoder reuse is good. rateLimit setInterval timers in serverless are a leak risk. |
| I/O & Async | 5/10 | Sequential DB queries on dashboard and sequential audit execution are the two largest I/O inefficiencies. layout.tsx forcing dynamic rendering eliminates CDN caching for all pages. The streaming architecture itself is well-designed. |
| Rendering | 6/10 | React.memo on AgentCard is correct. RAF batching is a genuine optimization. Pre-tag during streaming (avoiding markdown parse at 60fps) is excellent. Missing: lazy react-markdown, virtualization for 50+ agent lists, parseAuditResult running during streaming. |
| **Composite** | **5.5/10** | The codebase has a solid foundation with several proactive optimizations. The critical issues (sequential site-audit, O(n²) string concat, bundle size, sequential DB queries) are all fixable in under a week of focused work and would bring the composite score to ~8/10. |