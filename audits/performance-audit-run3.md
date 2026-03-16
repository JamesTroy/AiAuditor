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

The codebase is well-structured with several good patterns already in place (RAF batching, React.memo, debouncing, early exits). However, three issues require immediate attention: the O(n²) string accumulation in site-audit streaming, four sequential database queries on every dashboard load, and 167KB of avoidable First Load JS from icon and markdown library imports.

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
- **Current Complexity:** O(n²) time, O(n) space — `accumulated += chunk` creates a new string on every chunk; for a 100KB response split into ~400 chunks of ~250 bytes each, this allocates ~8MB of intermediate strings (sum of 1+2+3…+n lengths)
- **Target Complexity:** O(n) time and space
- **Impact:** At 100KB response with 400 chunks: ~8MB of string allocations, GC pressure, visible UI stall. Scales quadratically — a 200KB response is 4× worse, not 2×.
- **Remediation:**

```typescript
// BEFORE (in streaming loop):
accumulated += chunk;

// AFTER — collect into array, join once at the end:
const chunks: string[] = [];
// ...in loop:
chunks.push(chunk);
// ...on completion:
const accumulated = chunks.join('');
```

---

### **[Critical] PERF-002** — Sequential audit execution in site-audit (O(n) latency instead of O(1))

- **Location:** `app/site-audit/page.tsx` — `streamSingleAudit()` called in a for-loop
- **Current Complexity:** O(n) wall-clock time where n = number of agents selected; each audit waits for the previous to complete before starting
- **Target Complexity:** O(1) wall-clock time (bounded by slowest single audit)
- **Impact:** With 5 agents × ~30s each = 150s sequential vs. ~30s parallel. At 10 agents: 300s vs. 30s. This is the dominant latency source for site audits.
- **Remediation:**

```typescript
// BEFORE:
for (const agent of selectedAgents) {
  await streamSingleAudit(agent, url, ...);
}

// AFTER — run all audits concurrently, stream results independently:
// Each audit writes to its own state slot; use Promise.allSettled to
// handle partial failures gracefully.
const auditPromises = selectedAgents.map((agent) =>
  streamSingleAudit(agent, url, updateAgentResult, signal).catch((err) => {
    updateAgentResult(agent.id, { status: 'error', error: String(err) });
  })
);
await Promise.allSettled(auditPromises);
```

Note: Anthropic rate limits may require a concurrency cap (e.g., `p-limit` with concurrency=3–5).

---

### **[High] PERF-003** — 55 regex tests on full input string per keystroke in `detectAgents()`

- **Location:** `lib/detectAgents.ts` — 13 + 13 + 29 = 55 `regex.test()` calls on strings up to 60K chars
- **Current Complexity:** O(55 × n) per call where n = input length in chars; behind `useMemo` in `AuditInterface` but called on raw (undebounced) input changes there
- **Target Complexity:** O(k × n) where k ≪ 55 via early-exit and input truncation
- **Impact:** At 60K chars, each call processes ~3.3M character-comparisons. At 60fps during paste events, this can block the main thread for 10–50ms per frame.
- **Remediation:**

```typescript
// 1. Truncate input before regex battery (most language signals appear in first 2KB):
const DETECT_SAMPLE_SIZE = 2_000;
const sample = input.length > DETECT_SAMPLE_SIZE
  ? input.slice(0, DETECT_SAMPLE_SIZE)
  : input;

// 2. In AuditInterface, wrap detectAgents in useMemo with debounced input,
//    not raw input:
const debouncedInput = useDebounce(input, 150);
const detection = useMemo(() => detectAgents(debouncedInput), [debouncedInput]);

// 3. Order rules by hit-rate (most common languages first) and short-circuit
//    after finding a high-confidence match (score > threshold).
```

---

### **[High] PERF-004** — `extractScore()` called per-row on every dashboard load (backfill loop)

- **Location:** `app/dashboard/page.tsx` — backfill loop after query #2
- **Current Complexity:** O(m × r) where m = audits without saved scores, r = result text length; 5 regex patterns × full result text per row
- **Target Complexity:** O(1) per row (scores already persisted)
- **Impact:** If 50 audits lack scores and each result is 50KB, this runs 250 regex operations on 2.5MB of text on every dashboard page load. Blocks the server render.
- **Remediation:** Run backfill as a one-time migration script, not on every page load. Add a database migration to populate `score` for all historical rows:

```typescript
// One-time migration (run once, not on every request):
// scripts/backfill-scores.ts
const auditsWithoutScore = await db
  .select({ id: auditTable.id, result: auditTable.result })
  .from(auditTable)
  .where(and(isNull(auditTable.score), isNotNull(auditTable.result)));

for (const audit of auditsWithoutScore) {
  const score = extractScore(audit.result ?? '');
  if (score !== null) {
    await db.update(auditTable)
      .set({ score })
      .where(eq(auditTable.id, audit.id));
  }
}

// In dashboard/page.tsx: remove the backfill block entirely.
// The score column is now always populated at audit-save time (already done in route.ts).
```

---

### **[Medium] PERF-005** — `slugify()` runs 3 regex replacements per heading render

- **Location:** `components/markdownComponents.tsx` — `slugify()` called in heading components
- **Current Complexity:** O(3 × n) per heading where n = heading text length; called on every render
- **Target Complexity:** O(n) with memoization
- **Impact:** Low per-call cost but called on every re-render of markdown output. For a 100KB audit result with 20 headings, this is 60 regex ops per render cycle.
- **Remediation:**

```typescript
// Memoize slugify results with a module-level Map:
const slugCache = new Map<string, string>();
function slugify(text: string): string {
  if (slugCache.has(text)) return slugCache.get(text)!;
  const slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  slugCache.set(text, slug);
  return slug;
}
// Clear cache between audit sessions to prevent unbounded growth.
```

---

### **[Medium] PERF-006** — `childrenToText()` recurses through React children tree on every render

- **Location:** `components/markdownComponents.tsx` — `childrenToText()` in heading components
- **Current Complexity:** O(d × b) where d = tree depth, b = branching factor; called on every heading render
- **Target Complexity:** O(1) with memoization or by using `String(children)` for simple cases
- **Impact:** Minor per-call, but compounds with PERF-005 on large markdown documents.
- **Remediation:** Combine with the slug cache in PERF-005 — cache the full `{text, slug}` pair keyed on the children reference.

---

### **[Low] PERF-007** — `parseAuditResult()` splits entire result into lines then tests each line

- **Location:** `lib/parseAuditResult.ts`
- **Current Complexity:** O(n × L) where n = result length, L = lines count; called once post-completion via `useMemo`
- **Target Complexity:** Already O(n) — acceptable. The `useMemo` dependency on `result` is correct.
- **Impact:** Negligible — called once, not in a hot loop. No action required beyond confirming `useMemo` is correctly gated on `result`.

---

### **[Low] PERF-008** — `rateLimit.ts` per-instance `filter()` on every `.check()` call

- **Location:** `lib/rateLimit.ts` — sliding window implementation
- **Current Complexity:** O(n) per `.check()` where n = entries in window (up to `maxEntries = 10K`)
- **Target Complexity:** O(log n) with a sorted deque / binary search for the cutoff index
- **Impact:** At 10K entries and high traffic, each check scans up to 10K timestamps. With 9 limiter instances checked per request, this is 90K comparisons per request at worst case.
- **Remediation:** Use a deque (doubly-ended queue) and pop expired entries from the front rather than filtering the entire array:

```typescript
// Entries are always appended in chronological order, so expired entries
// are always at the front. Shift them off instead of filtering:
while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
  this.timestamps.shift(); // O(1) amortized with a proper deque
}
// Use a circular buffer or the 'denque' package for true O(1) shift.
```

---

## 4. Memory & Allocation Issues

### **[Critical] PERF-009** — `chunks: string[]` in `makeStream()` accumulates full 100KB response in server memory per concurrent audit

- **Location:** `app/api/audit/route.ts` — `makeStream()` function
- **Current Behavior:** Every in-flight audit holds its full streamed response in a `string[]` array in the Node.js heap until the stream completes and the DB write finishes. At 10 concurrent audits × 100KB = 1MB minimum; at 100 concurrent = 10MB.
- **Impact:** Medium at current scale (~10/min peak), but grows linearly. The array is correctly scoped to the request closure and will be GC'd after the DB write — this is acceptable at current scale but worth noting.
- **Remediation:** No immediate action needed at current scale. If concurrency increases, consider streaming the result directly to object storage (S3/R2) and storing only a reference in the DB.

---

### **[High] PERF-010** — `chunksRef.current.join('')` called twice per audit completion in `useAuditSession`

- **Location:** `lib/hooks/useAuditSession.ts` — end of `runAudit()`
- **Current Behavior:** `chunksRef.current.join('')` is called once for the final `setResult()` and the result is also used for `saveAudit()`. This is two O(n) joins on the same data.
- **Impact:** Minor — two allocations of the full result string (~100KB each). GC pressure but not a stall.
- **Remediation:**

```typescript
// Compute once, reuse:
const fullResult = chunksRef.current.join('');
setResult(fullResult);
setStatus('complete');
saveAudit({ ..., result: fullResult, ... });
```

*(Already partially done in the shown code — verify the RAF flush path also avoids double-join.)*

---

### **[High] PERF-011** — `localStorage` stores up to 20 × 100KB audit results = 2MB of localStorage

- **Location:** `lib/history.ts` (inferred from `saveAudit()` calls)
- **Current Behavior:** Each audit result (up to 100KB) is serialized to JSON and stored in localStorage. 20 entries = up to 2MB. localStorage is synchronous and blocks the main thread on read/write.
- **Impact:** `localStorage.setItem()` with 2MB of data can block the main thread for 5–50ms on mobile devices. `localStorage` quota is typically 5–10MB; 20 × 100KB = 2MB uses 20–40% of quota.
- **Remediation:**

```typescript
// 1. Truncate stored results to a summary (first 500 chars + score):
saveAudit({
  ...,
  result: fullResult.slice(0, 500), // store snippet only
  score: extractScore(fullResult),   // store parsed score
});

// 2. Or migrate to IndexedDB (async, larger quota, no main-thread blocking):
// Use 'idb-keyval' (1.5KB) for a simple key-value store over IndexedDB.
import { set, get } from 'idb-keyval';
await set(`audit-${timestamp}`, auditEntry);
```

---

### **[Medium] PERF-012** — `new Headers(request.headers)` allocation on every middleware invocation

- **Location:** `middleware.ts` — `const requestHeaders = new Headers(request.headers)`
- **Current Behavior:** A full `Headers` object is cloned on every non-static request, even for requests that don't need the nonce (e.g., API routes that don't render HTML).
- **Impact:** Minor per-request allocation, but middleware runs on every request. At 1000 req/s, this is 1000 `Headers` clones/s.
- **Remediation:** See PERF-013 for the combined fix (skip nonce generation for non-HTML routes).

---

### **[Medium] PERF-013** — CSP string rebuilt from array on every middleware invocation

- **Location:** `middleware.ts` — CSP array construction and `.join('; ')`
- **Current Behavior:** The CSP string is reconstructed on every request. The static portions (everything except the nonce) never change between requests.
- **Target:** Pre-compute the static CSP template at module initialization; only interpolate the nonce per-request.
- **Remediation:**

```typescript
// At module scope (runs once at cold start):
const isDev = process.env.NODE_ENV === 'development';
const hasPlausible = !!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;

const CSP_TEMPLATE_BEFORE_NONCE = `default-src 'self'; script-src 'nonce-`;
const CSP_TEMPLATE_AFTER_NONCE = [
  `' 'strict-dynamic' 'unsafe-inline'`,
  isDev ? ` 'unsafe-eval'` : '',
  hasPlausible ? ` https://plausible.io` : '',
  `; style-src 'self' 'unsafe-inline'`,
  // ... rest of static directives
].join('');

// Per-request (hot path):
export function middleware(request: NextRequest) {
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');
  const csp = CSP_TEMPLATE_BEFORE_NONCE + nonce + CSP_TEMPLATE_AFTER_NONCE;
  // ...
}
```

Estimated savings: ~15µs per request (array allocation + 12 string joins eliminated). At 1000 req/s = 15ms/s of CPU saved.

---

### **[Low] PERF-014** — `DOT_COLORS` map iterated per agent badge in `site-audit/page.tsx`

- **Location:** `app/site-audit/page.tsx` — `dotColor()` function
- **Current Behavior:** 18-entry map iterated on every badge render. If implemented as an array of `[key, value]` pairs with `.find()`, this is O(18) per call.
- **Target:** O(1) with a `Map` or plain object lookup.
- **Remediation:**

```typescript
// If DOT_COLORS is already a Record<string, string> or Map, ensure lookup is:
const color = DOT_COLORS[agentId] ?? DEFAULT_COLOR; // O(1)
// Not: Object.entries(DOT_COLORS).find(([k]) => k === agentId) // O(n)
```

---

### **[Low] PERF-015** — `new TextEncoder()` / `new TextDecoder()` instantiated inside stream callbacks

- **Location:** `app/api/audit/route.ts` — `makeStream()` creates `encoder` and `decoder` inside the function; `lib/ai/anthropicProvider.ts` uses a module-level `encoder` (correct)
- **Current Behavior:** `makeStream()` creates a new `TextDecoder` per stream invocation. `TextDecoder` construction is cheap but unnecessary.
- **Remediation:** Hoist to module scope alongside the existing module-level `encoder` in `anthropicProvider.ts`.

---

## 5. I/O & Async Performance

### **[Critical] PERF-016** — 4 sequential DB queries on every dashboard page load

- **Location:** `app/dashboard/page.tsx`
- **Current Behavior:** Queries execute sequentially: count → scores → trend → paginated list. Total latency = sum of all 4 query round-trips (e.g., 4 × 5ms = 20ms minimum; 4 × 50ms = 200ms under load).
- **Target:** Parallel execution — total latency = max of all 4 query times.
- **Impact:** ~3× dashboard load time reduction at median DB latency; ~4× at high latency. This is the primary server-side latency bottleneck.
- **Remediation:**

```typescript
// BEFORE (sequential):
const totalCount = await db.select(...).from(auditTable).where(...);
const allScores = await db.select(...).from(auditTable).where(...);
const trendData = await db.select(...).from(auditTable).where(...).limit(10);
const paginatedAudits = await db.select(...).from(auditTable).where(...).limit(21);

// AFTER (parallel):
const [totalCount, allScores, trendData, paginatedAudits] = await Promise.all([
  db.select({ count: count() }).from(auditTable).where(eq(auditTable.userId, userId)),
  db.select({ score: auditTable.score })
    .from(auditTable)
    .where(and(eq(auditTable.userId, userId), eq(auditTable.status, 'completed'))),
  db.select({ score: auditTable.score, createdAt: auditTable.createdAt })
    .from(auditTable)
    .where(and(eq(auditTable.userId, userId), isNotNull(auditTable.score)))
    .orderBy(desc(auditTable.createdAt))
    .limit(10),
  db.select().from(auditTable)
    .where(eq(auditTable.userId, userId))
    .orderBy(desc(auditTable.createdAt))
    .limit(21),
]);
```

Estimated speedup: 3–4× reduction in dashboard TTFB.

---

### **[High] PERF-017** — `cleanupStaleAudits()` called synchronously (fire-and-forget without await) on every POST to `/api/audit`

- **Location:** `app/api/audit/route.ts` — `cleanupStaleAudits()` called without `await`
- **Current Behavior:** The function is async but called without `await`. This means the DB update runs as an untracked promise. If it throws after the 5-minute interval, the error is caught internally — but the promise is not attached to the request lifecycle, creating a potential "floating promise" that could execute after the serverless function has returned.
- **Impact:** In serverless environments (Vercel), floating promises may be killed before completion. The `lastStaleCleanup` guard prevents excessive calls, but the pattern is fragile.
- **Remediation:**

```typescript
// Option A: Await it (adds ~1-5ms to request on cleanup runs, negligible given 5-min interval):
await cleanupStaleAudits();

// Option B: Move to a dedicated cron job (Vercel Cron, pg_cron, or a separate
// scheduled function) — cleanest solution:
// vercel.json: { "crons": [{ "path": "/api/cron/cleanup-stale-audits", "schedule": "*/5 * * * *" }] }
```

---

### **[High] PERF-018** — Missing DB indexes inferred from query patterns

- **Location:** `app/dashboard/page.tsx` queries + `app/api/audit/route.ts`
- **Current Behavior:** Queries filter on `userId`, `status`, `updatedAt`, and order by `createdAt`. Without composite indexes, each query performs a full table scan filtered in memory.
- **Impact:** At 10K audit rows per user, an unindexed `WHERE userId = ? AND status = 'completed' ORDER BY createdAt DESC` scans all rows. With an index, this is O(log n + k) where k = result rows.
- **Remediation:**

```sql
-- Composite index covering the most common query pattern:
CREATE INDEX idx_audit_user_status_created
  ON audit (userId, status, createdAt DESC);

-- For stale cleanup query (updatedAt filter):
CREATE INDEX idx_audit_status_updated
  ON audit (status, updatedAt)
  WHERE status = 'running'; -- partial index (PostgreSQL)
```

In Drizzle schema:
```typescript
export const auditIndexes = {
  userStatusCreated: index('idx_audit_user_status_created')
    .on(auditTable.userId, auditTable.status, auditTable.createdAt),
};
```

---

### **[Medium] PERF-019** — `layout.tsx` forces dynamic rendering via `await headers()` on every page

- **Location:** `app/layout.tsx`
- **Current Behavior:** Calling `await headers()` in the root layout opts the entire application out of static rendering. Every page — including fully static pages like `/login`, `/signup` — becomes dynamically rendered on every request.
- **Impact:** Pages that could be statically generated (and served from CDN edge) instead hit the Node.js runtime on every request. For `/login` and `/signup` (123KB First Load JS), this adds 10–50ms of server latency per visit.
- **Remediation:** Pass the nonce via a React context or `searchParams` only to components that need it (e.g., `<Script>` tags). Alternatively, use Next.js `unstable_noStore()` only in the specific server components that need the nonce, not the root layout. Consider whether the nonce is actually needed for all pages or only for pages that render inline scripts.

---

### **[Medium] PERF-020** — `crypto.randomUUID()` + `Buffer.from().toString('base64')` on every middleware invocation

- **Location:** `middleware.ts`
- **Current Behavior:** `crypto.randomUUID()` generates a UUID (128 bits of entropy), then `Buffer.from()` base64-encodes it. The UUID is already a string; `Buffer.from(uuidString)` encodes the UUID's ASCII characters, not its raw bytes — this produces a 48-character base64 string from a 36-character UUID string, which is wasteful and semantically incorrect (should encode the raw 16 bytes for a compact nonce).
- **Impact:** Minor CPU waste; the nonce is longer than necessary. More importantly, this runs on every non-static request.
- **Remediation:**

```typescript
// Correct: encode raw UUID bytes (16 bytes → 24 base64 chars):
const nonce = Buffer.from(
  crypto.randomUUID().replace(/-/g, ''), 'hex'
).toString('base64');

// Or simply use the UUID string directly as the nonce (already URL-safe enough for CSP):
const nonce = crypto.randomUUID();
```

---

### **[Low] PERF-021** — `Report-To` header JSON serialized on every middleware invocation

- **Location:** `middleware.ts` — `JSON.stringify({...})` called per request
- **Current Behavior:** The `Report-To` header value is a static JSON object that never changes, but `JSON.stringify()` is called on every request.
- **Remediation:**

```typescript
// At module scope:
const REPORT_TO_HEADER = JSON.stringify({
  group: 'csp-endpoint',
  max_age: 86400,
  endpoints: [{ url: '/api/csp-report' }],
});

// In middleware:
response.headers.set('Report-To', REPORT_TO_HEADER);
```

---

## 6. React / Frontend Rendering

### **[High] PERF-022** — 167KB of avoidable First Load JS from `lucide-react` and `react-markdown`

- **Location:** `components/AgentCard.tsx` (55+ icon imports), `components/markdownComponents.tsx` (react-markdown)
- **Current Behavior:** `/audit/[agent]` has 269KB First Load JS; `/site-audit` has 258KB. The 46KB shared chunk (`chunks/1255`) plus react-markdown and lucide-react icons are the primary contributors. Even with tree-shaking, importing 55+ named icons from lucide-react at module scope forces the bundler to include all 55 icon modules in the chunk that imports `AgentCard`.
- **Impact:** 269KB First Load JS → target ~150KB. Each 100KB of JS adds ~300ms parse+compile time on a mid-range mobile device (Moto G4 class).
- **Remediation:**

```typescript
// 1. Dynamic import react-markdown (only needed post-audit-completion):
const ReactMarkdown = dynamic(() => import('react-markdown'), {
  loading: () => <pre>{content}</pre>, // already done during streaming
  ssr: false,
});

// 2. For AgentCard icons — use a single icon component with dynamic lookup
//    instead of 55 static imports:
// icons.ts — lazy icon map:
const iconMap: Record<string, () => Promise<{ default: LucideIcon }>> = {
  'code': () => import('lucide-react/dist/esm/icons/code'),
  'shield': () => import('lucide-react/dist/esm/icons/shield'),
  // ...
};

// Or use a single generic icon with CSS/SVG sprite approach.

// 3. Alternatively, replace lucide-react with @lucide/lab or a custom SVG sprite
//    that only includes the 55 icons actually used (~3KB vs ~46KB).
```

Estimated savings: 80–120KB reduction in First Load JS for `/audit/[agent]` and `/site-audit`.

---

### **[High] PERF-023** — `AuditInterface.tsx` calls `detectAgents()` on raw (undebounced) input via `useMemo`

- **Location:** `components/AuditInterface.tsx` — `useMemo` depending on raw `input` state
- **Current Behavior:** `useMemo` recomputes `detectAgents(input)` on every render triggered by input changes. While `useMemo` prevents recomputation if `input` hasn't changed, React may render `AuditInterface` for other reasons (parent re-renders, other state changes), and any input change triggers an immediate 55-regex evaluation.
- **Impact:** On a 60K-char paste event, this blocks the render thread for the duration of 55 regex tests before the UI updates. Perceived as input lag.
- **Remediation:**

```typescript
// Use a debounced value as the useMemo dependency:
const debouncedInput = useDebounce(input, 150); // existing hook pattern
const detection = useMemo(
  () => (debouncedInput.length >= 10 ? detectAgents(debouncedInput) : null),
  [debouncedInput]
);
```

---

### **[High] PERF-024** — `SafeMarkdown` renders 100KB+ markdown on every re-render of completed audit

- **Location:** `components/AuditInterface.tsx` + `components/markdownComponents.tsx`
- **Current Behavior:** After audit completion, `SafeMarkdown` renders the full result. If `AuditInterface` re-renders for any reason (e.g., timer tick, other state change), `react-markdown` re-parses and re-renders the full 100KB markdown tree.
- **Impact:** `react-markdown` parsing of 100KB text takes ~50–200ms. If the elapsed timer (1s interval) triggers re-renders, this fires every second post-completion.
- **Remediation:**

```typescript
// Memoize the SafeMarkdown output:
const memoizedMarkdown = useMemo(
  () => <SafeMarkdown content={result} />,
  [result] // only re-render when result actually changes
);

// Ensure the elapsed timer useEffect does NOT cause AuditInterface to re-render
// after status === 'complete' (stop the interval on completion).
```

---

### **[Medium] PERF-025** — 10 `useEffect` hooks in `AuditInterface.tsx` — risk of missed cleanup and stale closures

- **Location:** `components/AuditInterface.tsx`
- **Current Behavior:** 10 `useEffect` hooks with varying dependency arrays. Each hook that adds event listeners (clipboard, outside click, ESC handler, scroll) must return a cleanup function. Missing cleanups cause listener accumulation on re-mount.
- **Impact:** If `AuditInterface` unmounts and remounts (e.g., route navigation), each missing cleanup adds a duplicate listener. With 4 listener-adding effects × 10 remounts = 40 stacked listeners.
- **Remediation:** Audit each `useEffect` for cleanup functions. Consider consolidating related effects (e.g., all keyboard handlers into one effect).

---

### **[Medium] PERF-026** — `HomeSearch` renders 50+ `AgentCard` components without virtualization

- **Location:** `components/HomeSearch.tsx` — "Browse all" expanded state
- **Current Behavior:** All 50+ `AgentCard` components are rendered into the DOM simultaneously. Each card has CSS transitions and icon lookups.
- **Impact:** Initial render of 50 cards takes ~50–150ms on mid-range devices. With `React.memo` on `AgentCard`, subsequent re-renders are fast — but the initial mount cost is paid every time the user expands "Browse all."
- **Remediation:**

```typescript
// Option A: Virtualize with TanStack Virtual (handles grid layouts):
import { useVirtualizer } from '@tanstack/react-virtual';

// Option B: Paginate — show 12 cards initially, "Load more" button.
// This is simpler and likely sufficient at 50 agents.

// Option C: Keep current approach but add `content-visibility: auto` CSS
// to each card container — browser skips rendering off-screen cards:
// .agent-card { content-visibility: auto; contain-intrinsic-size: 200px; }
```

---

### **[Medium] PERF-027** — `ScoreSparkline` SVG point calculation runs on every dashboard render

- **Location:** `app/dashboard/page.tsx` — `ScoreSparkline` component
- **Current Behavior:** SVG polyline points are recalculated on every render of the dashboard. If the dashboard re-renders (e.g., pagination state change), the sparkline recalculates all points.
- **Impact:** Minor — O(n) where n ≤ 10 points. But it's a server component, so this only runs once per request. If `ScoreSparkline` is a client component, wrap point calculation in `useMemo`.
- **Remediation:**

```typescript
// If client component:
const points = useMemo(() => calculatePoints(scores), [scores]);
```

---

### **[Low] PERF-028** — Agent dropdown in `AuditInterface` renders all 50 agents grouped by 7 categories without virtualization

- **Location:** `components/AuditInterface.tsx` — `otherAgents` dropdown
- **Current Behavior:** All 50 agents rendered in a dropdown. The dropdown is conditionally rendered (not always visible), so this only matters when open.
- **Impact:** Low — dropdown open/close is infrequent. No action required unless agent count grows beyond ~200.

---

### **[Low] PERF-029** — `categoryCounts` computed by iterating all agents on every server render of `app/page.tsx`

- **Location:** `app/page.tsx`
- **Current Behavior:** `categoryCounts` iterates all agents on every server render. Since agents are static (compile-time data), this should be computed at build time.
- **Impact:** Negligible — O(50) iteration. But with `layout.tsx` forcing dynamic rendering (PERF-019), this runs on every request.
- **Remediation:** Move `categoryCounts` to a module-level constant in the agents registry (computed once at module load).

---

## 7. Database & Network Latency

### **[High] PERF-030** — Query #2 fetches `result` column for all completed audits to compute average score

- **Location:** `app/dashboard/page.tsx` — `SELECT score, result FROM audit WHERE userId = ? AND status = 'completed'`
- **Current Behavior:** The `result` column (up to 100KB per row) is fetched for all completed audits, presumably to run `extractScore()` on rows where `score IS NULL`. After the backfill migration (PERF-004), `result` should never need to be fetched for score computation.
- **Impact:** If a user has 100 completed audits × 50KB average result = 5MB transferred from DB to app server on every dashboard load.
- **Remediation:** After applying PERF-004 (backfill migration), change query #2 to:

```typescript
// Only fetch the score column — never fetch result for dashboard:
db.select({ score: auditTable.score })
  .from(auditTable)
  .where(and(
    eq(auditTable.userId, userId),
    eq(auditTable.status, 'completed'),
    isNotNull(auditTable.score) // only rows with scores
  ))
```

Estimated savings: 5MB → 400 bytes per dashboard load (100 rows × 4-byte integer).

---

### **[High] PERF-031** — No query result caching on dashboard — same 4 queries run on every page load

- **Location:** `app/dashboard/page.tsx`
- **Current Behavior:** Dashboard data (total count, average score, trend) changes infrequently but is recomputed on every page load.
- **Impact:** Unnecessary DB load; adds 20–200ms to every dashboard TTFB.
- **Remediation:**

```typescript
// Use Next.js built-in fetch caching with revalidation:
// For server components using Drizzle (not fetch), use React's cache():
import { cache } from 'react';

const getDashboardStats = cache(async (userId: string) => {
  // ... parallel queries
});

// Or use unstable_cache for cross-request caching with TTL:
import { unstable_cache } from 'next/cache';

const getCachedDashboardStats = unstable_cache(
  async (userId: string) => getDashboardStats(userId),
  ['dashboard-stats'],
  { revalidate: 60, tags: [`user-${userId}`] } // 60s TTL, invalidate on new audit
);

// Invalidate on new audit save:
import { revalidateTag } from 'next/cache';
revalidateTag(`user-${userId}`);
```

---

### **[Medium] PERF-032** — `audit/[agent]` route has `s-maxage=3600` but the page is dynamic (contains user-specific state)

- **Location:** `next.config.ts` — cache headers for `/audit/:agent`
- **Current Behavior:** `s-maxage=3600` tells CDNs to cache the audit page for 1 hour. But the audit page renders user-specific content (session state, history). If a CDN caches this, different users may see each other's cached pages.
- **Impact:** Potential data leak if a CDN (Vercel Edge, Cloudflare) caches a response containing user-specific data. At minimum, add `private` or `Vary: Cookie`.
- **Remediation:**

```typescript
// In next.config.ts, change audit page cache header:
{
  source: '/audit/:agent',
  headers: [
    { key: 'Cache-Control', value: 'private, no-store' }
    // OR if the page shell is truly static and data is client-fetched:
    // { key: 'Cache-Control', value: 'public, s-maxage=3600, stale-while-revalidate=86400' }
  ]
}
```

---

### **[Low] PERF-033** — No HTTP caching on `/api/audit` streaming responses

- **Location:** `lib/config/apiHeaders.ts` — `STREAM_RESPONSE_HEADERS`
- **Current Behavior:** Streaming responses correctly cannot be cached. No issue here.
- **Note:** Confirmed no action needed for streaming endpoints.

---

## 8. Concurrency & Parallelism

### **[High] PERF-034** — `detectAgents()` runs 55 regex tests synchronously on the main thread

- **Location:** `lib/detectAgents.ts` called from `components/AuditInterface.tsx`
- **Current Behavior:** All 55 regex tests run synchronously on the browser's main thread, blocking rendering during execution.
- **Impact:** On a 60K-char input, this can block the main thread for 10–50ms, causing dropped frames (jank) during typing or paste.
- **Remediation:**

```typescript
// Short-term: Apply input truncation (PERF-003) + debouncing (PERF-023).
// This reduces the problem to ~2KB input × 55 regexes ≈ <1ms.

// Long-term: Move detectAgents() to a Web Worker:
// workers/detectAgents.worker.ts
self.onmessage = (e: MessageEvent<string>) => {
  const result = detectAgents(e.data);
  self.postMessage(result);
};

// In AuditInterface:
const workerRef = useRef<Worker>();
useEffect(() => {
  workerRef.current = new Worker(
    new URL('../workers/detectAgents.worker.ts', import.meta.url)
  );
  workerRef.current.onmessage = (e) => setDetection(e.data);
  return () => workerRef.current?.terminate();
}, []);
```

---

### **[Medium] PERF-035** — RAF loop in `useAuditSession` correctly throttles to 60fps but `chunksRef.current.join('')` inside RAF is O(n) per frame

- **Location:** `lib/hooks/useAuditSession.ts` — RAF callback
- **Current Behavior:** Inside the RAF callback: `setResult(chunksRef.current.join(''))`. At 60fps during a 5-minute audit with 100KB of text split into ~400 chunks, this join runs up to 60 times per second. Each join is O(total accumulated length). In the worst case (near end of stream), this is O(100KB) × 60fps = 6MB/s of string allocation.
- **Impact:** Moderate GC pressure during streaming. The RAF batching correctly prevents more than one join per frame, which is the right approach. The issue is that the join cost grows as the result grows.
- **Remediation:**

```typescript
// Track the last-rendered length to avoid re-joining already-rendered chunks:
const renderedLengthRef = useRef(0);

// In RAF callback:
rafRef.current = requestAnimationFrame(() => {
  if (!isStoppedRef.current) {
    // Only join if new chunks have arrived since last render:
    const totalChunks = chunksRef.current.length;
    if (totalChunks > 0) {
      // Append only new content to previous result:
      const newContent = chunksRef.current.slice(renderedLengthRef.current).join('');
      renderedLengthRef.current = totalChunks;
      setResult(prev => prev + newContent);
    }
  }
  rafRef.current = null;
});
```

This reduces the per-frame join from O(total) to O(new chunks since last frame) — typically O(1–5 chunks).

---

### **[Medium] PERF-036** — `anthropicProvider.streamAudit()` retry loop uses exponential backoff but blocks the stream consumer during retries

- **Location:** `lib/ai/anthropicProvider.ts` — retry loop with `await sleep()`
- **Current Behavior:** During a retry, the `ReadableStream` controller is paused (no data enqueued) for `RETRY_BASE_MS * 2^(attempt-1)` ms (1s, 2s, 4s). The client's streaming connection is held open but silent.
- **Impact:** The client's 5-minute `AbortSignal.timeout` continues counting during retry sleeps. At 3 retries with max backoff: 1+2+4 = 7 seconds of silence. This is acceptable but the client has no visibility into the retry state.
- **Remediation:** Enqueue a heartbeat comment during retry sleep to prevent client-side timeout:

```typescript
// During retry sleep, send a keep-alive:
await sleep(delay);
// If not aborted, send a no-op byte to keep the connection alive:
if (!options?.signal?.aborted) {
  controller.enqueue(encoder.encode('')); // or a SSE comment: ': retry\n\n'
}
```

---

## 9. Prioritized Action List

| # | Finding | Action | Estimated Gain | Effort |
|---|---|---|---|---|
| 1 | **PERF-016** | Parallelize 4 dashboard DB queries with `Promise.all` | 3–4× dashboard TTFB reduction | **Low** — 10 lines changed |
| 2 | **PERF-002** | Run site-audit agents concurrently with `Promise.allSettled` + concurrency cap | 3–10× site-audit wall-clock time reduction | **Medium** — requires per-agent state slots |
| 3 | **PERF-001** | Replace `accumulated += chunk` with `chunks.push(chunk)` + final `join()` | Eliminates O(n²) allocations; ~8MB → ~100KB GC pressure per 100KB audit | **Low** — 5 lines changed |
| 4 | **PERF-022** | Dynamic-import `react-markdown` + replace 55 static icon imports with lazy map | 80–120KB First Load JS reduction; ~300ms faster mobile parse | **Medium** — requires icon map refactor |
| 5 | **PERF-004** + **PERF-030** | Run score backfill as one-time migration; remove `result` column from dashboard query | Eliminates per-load regex battery; reduces DB transfer from 5MB → 400B | **Low** — migration script + query change |
| 6 | **PERF-018** | Add composite DB index on `(userId, status, createdAt DESC)` | O(n) → O(log n + k) query time; 10–100× speedup at scale | **Low** — one migration |
| 7 | **PERF-031** | Cache dashboard stats with `unstable_cache` (60s TTL) | Eliminates DB queries for repeat dashboard loads | **Low** — wrapper function |
| 8 | **PERF-011** | Truncate localStorage audit results to 500 chars or migrate to IndexedDB | Eliminates 2MB localStorage writes; prevents quota exhaustion | **Medium** — requires history API change |
| 9 | **PERF-023** + **PERF-003** | Debounce `detectAgents` input in `AuditInterface` + truncate to 2KB sample | Eliminates main-thread jank on large pastes | **Low** — 3 lines changed |
| 10 | **PERF-013** | Pre-compute static CSP template at module scope; interpolate only nonce | ~15µs/request × all requests; measurable at high traffic | **Low** — module-scope constant |

---

## 10. Overall Score

| Dimension | Score (1–10) | Notes |
|---|---|---|
| Algorithmic Efficiency | 5 | O(n²) string concat in site-audit and sequential audit execution are significant; `detectAgents` is well-structured but needs input truncation; most other algorithms are appropriate |
| Memory Management | 6 | RAF batching is excellent; `chunksRef` pattern is correct; localStorage overuse and per-request CSP array allocation are the main issues; no obvious leaks |
| I/O & Async | 5 | Sequential DB queries on dashboard is the primary issue; `cleanupStaleAudits` floating promise is fragile; anthropic retry pattern is solid; missing DB indexes are a latency risk at scale |
| Rendering | 6 | `React.memo` on `AgentCard` is correct; RAF batching for streaming is well-designed; `SafeMarkdown` re-render risk and missing `useMemo` on markdown output are the main gaps; bundle size is the most impactful rendering issue |
| **Composite** | **5.5** | Solid architectural foundation with several good patterns already in place. Three high-impact issues (sequential DB queries, O(n²) string concat, bundle size) are straightforward to fix and would bring the composite score to ~7.5. |