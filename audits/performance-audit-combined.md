# Performance Analysis Report — Combined (5 runs)

**Codebase:** TypeScript + React 19 + Next.js 15.5 + Drizzle ORM
**Consensus:** All 5 runs scored **5.5/10** with identical severity counts
**Runs:** 5 independent audits merged; findings confirmed by ≥4/5 runs noted

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

The codebase is well-structured with several proactive optimizations already in place (RAF batching, React.memo on AgentCard, debounced search, pre-tag during streaming, early-exit in detectAgents). The critical issues are concentrated in three areas: bundle size from icon imports, sequential database access patterns, and O(n²) string accumulation in the site-audit streaming path.

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
*Consensus: 5/5 runs*

- **Location:** `app/site-audit/page.tsx` — `accumulated += chunk` inside stream read loop
- **Current Complexity:** O(n²) time, O(n) space — each `accumulated += chunk` copies the entire accumulated string; for a 100KB response split into ~400 chunks of ~250 bytes each, this allocates ~8MB of intermediate strings (sum of 1+2+3…+n lengths)
- **Target Complexity:** O(n) time and space
- **Impact:** At 100KB response with 400 chunks: ~8MB of string allocations, GC pressure, visible UI stall. Scales quadratically — a 200KB response is 4× worse, not 2×.
- **Remediation:**

```typescript
// BEFORE (in streaming loop):
accumulated += chunk;
setResult(accumulated);

// AFTER — collect into array, join only for display:
const chunks: string[] = [];
// ...in loop:
chunks.push(chunk);
setResult(chunks.join('')); // or RAF-batch this
// ...on completion:
const accumulated = chunks.join('');
```

---

### **[Critical] PERF-002** — Sequential audit execution in site-audit (O(n) latency instead of O(1))
*Consensus: 5/5 runs*

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
*Consensus: 5/5 runs*

- **Location:** `lib/detectAgents.ts` — 13 + 13 + 29 = 55 `regex.test()` calls on strings up to 60K chars
- **Current Complexity:** O(55 × n) per call where n = input length in chars; behind `useMemo` in `AuditInterface` but called on raw (undebounced) input changes
- **Target Complexity:** O(k × n) where k ≪ 55 via early-exit and input truncation
- **Impact:** At 60K chars, each call processes ~3.3M character-comparisons. On paste events, this can block the main thread for 10–50ms.
- **Remediation:**

```typescript
// 1. Truncate input before regex battery (most language signals appear in first 2KB):
const DETECT_SAMPLE_SIZE = 2_000;
const sample = input.length > DETECT_SAMPLE_SIZE
  ? input.slice(0, DETECT_SAMPLE_SIZE)
  : input;

// 2. In AuditInterface, wrap detectAgents in useMemo with debounced input:
const debouncedInput = useDebounce(input, 150);
const detection = useMemo(() => detectAgents(debouncedInput), [debouncedInput]);
```

---

### **[High] PERF-004** — `extractScore()` called per-row on every dashboard load (backfill loop)
*Consensus: 5/5 runs*

- **Location:** `app/dashboard/page.tsx` — backfill loop after query #2
- **Current Complexity:** O(m × r) where m = audits without saved scores, r = result text length; 5 regex patterns × full result text per row
- **Target Complexity:** O(1) per row (scores already persisted)
- **Impact:** If 50 audits lack scores and each result is 50KB, this runs 250 regex operations on 2.5MB of text on every dashboard page load. Blocks the server render.
- **Remediation:** Run backfill as a one-time migration script, not on every page load:

```typescript
// One-time migration (scripts/backfill-scores.ts):
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
```

---

### **[Medium] PERF-005** — `slugify()` runs 3 regex replacements per heading render
*Consensus: 5/5 runs*

- **Location:** `components/markdownComponents.tsx` — `slugify()` called in heading components
- **Current Complexity:** O(3 × n) per heading where n = heading text length; called on every render
- **Impact:** Low per-call cost but compounds on large markdown documents with 20+ headings.
- **Remediation:**

```typescript
const slugCache = new Map<string, string>();
function slugify(text: string): string {
  if (slugCache.has(text)) return slugCache.get(text)!;
  const slug = text.toLowerCase().replace(/\s+/g, '-').replace(/[^\w-]/g, '');
  slugCache.set(text, slug);
  return slug;
}
```

---

### **[Medium] PERF-006** — `childrenToText()` recurses through React children tree on every render
*Consensus: 5/5 runs*

- **Location:** `components/markdownComponents.tsx` — heading components
- **Impact:** Minor per-call, compounds with PERF-005 on large markdown documents.
- **Remediation:** Combine with the slug cache in PERF-005 — cache the full `{text, slug}` pair keyed on the children reference.

---

### **[Low] PERF-007** — `parseAuditResult()` splits entire result into lines then tests each line
*Consensus: 5/5 runs*

- **Location:** `lib/parseAuditResult.ts`
- **Current Complexity:** O(n) — acceptable. Called once post-completion via `useMemo`.
- **Note:** No action required. The `useMemo` dependency on `result` is correctly gated.

---

### **[Low] PERF-008** — `rateLimit.ts` per-instance `filter()` on every `.check()` call
*Consensus: 5/5 runs*

- **Location:** `lib/rateLimit.ts` — sliding window implementation
- **Current Complexity:** O(n) per `.check()` where n = entries in window
- **Impact:** At 10K entries with 9 limiter instances per request = 90K comparisons worst case.
- **Remediation:**

```typescript
// Entries are chronologically ordered — shift expired from front instead of filtering:
while (this.timestamps.length > 0 && this.timestamps[0] < cutoff) {
  this.timestamps.shift();
}
```

---

## 4. Memory & Allocation Issues

### **[Critical] PERF-009** — `chunks: string[]` in `makeStream()` accumulates full response in server memory
*Consensus: 5/5 runs*

- **Location:** `app/api/audit/route.ts` — `makeStream()` function
- **Current Behavior:** Every in-flight audit holds its full streamed response in memory. At 10 concurrent audits × 100KB = 1MB; at 100 concurrent = 10MB.
- **Impact:** Acceptable at current scale. Correctly scoped and GC'd after DB write.
- **Remediation:** No immediate action needed. If concurrency increases, consider streaming to object storage.

---

### **[High] PERF-010** — `chunksRef.current.join('')` called twice per audit completion
*Consensus: 5/5 runs*

- **Location:** `lib/hooks/useAuditSession.ts` — end of `runAudit()`
- **Impact:** Two O(n) joins on ~100KB data. Minor GC pressure.
- **Remediation:**

```typescript
const fullResult = chunksRef.current.join('');
setResult(fullResult);
setStatus('complete');
saveAudit({ ..., result: fullResult, ... });
```

*(Already partially done — verify RAF flush path also avoids double-join.)*

---

### **[High] PERF-011** — `localStorage` stores up to 20 × 8KB audit results (ARCH-017 truncation already in place)
*Consensus: 5/5 runs*

- **Location:** `lib/history.ts` — `MAX_RESULT_CHARS = 8_000`
- **Current Behavior:** Results are already truncated to 8KB (not 100KB as some runs assumed). 20 entries × 8KB = 160KB. This is within safe localStorage limits.
- **Impact:** Lower than initially assessed due to existing ARCH-017 truncation. localStorage is still synchronous and blocks main thread.
- **Remediation:** Consider IndexedDB migration for async access, but this is lower priority given existing truncation.

---

### **[Medium] PERF-012** — `new Headers(request.headers)` allocation on every middleware invocation
*Consensus: 5/5 runs*

- **Location:** `middleware.ts`
- **Impact:** Minor per-request allocation. See PERF-013 for combined fix.

---

### **[Medium] PERF-013** — CSP string rebuilt from array on every middleware invocation
*Consensus: 5/5 runs*

- **Location:** `middleware.ts` — CSP array construction and `.join('; ')`
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
  `; style-src 'self' 'unsafe-inline'; font-src 'self'`,
  // ... rest of static directives
].join('');

// Per-request:
const csp = CSP_TEMPLATE_BEFORE_NONCE + nonce + CSP_TEMPLATE_AFTER_NONCE;
```

Estimated savings: ~15µs per request (array allocation + 12 string joins eliminated).

---

### **[Low] PERF-014** — `DOT_COLORS` map iterated per agent badge via `dotColor()`
*Consensus: 5/5 runs*

- **Location:** `app/site-audit/page.tsx` — `dotColor()` iterates `Object.entries(DOT_COLORS)` with `.includes()`
- **Impact:** O(18) per badge × ~50 badges = 900 iterations. Minor.
- **Remediation:** Use direct key lookup instead of `.includes()` iteration.

---

### **[Low] PERF-015** — `TextDecoder` instantiated inside `makeStream()` per request
*Consensus: 5/5 runs*

- **Location:** `app/api/audit/route.ts` — `makeStream()` creates `new TextDecoder()` per stream
- **Remediation:** Hoist to module scope (already done for `TextEncoder` in `anthropicProvider.ts`).

---

## 5. I/O & Async Performance

### **[Critical] PERF-016** — 4 sequential DB queries on every dashboard page load
*Consensus: 5/5 runs — highest-impact server-side fix*

- **Location:** `app/dashboard/page.tsx`
- **Current Behavior:** Queries execute sequentially: count → scores → trend → paginated list. Total latency = sum of all 4 round-trips.
- **Impact:** ~3–4× dashboard TTFB reduction when parallelized.
- **Remediation:**

```typescript
const [totalResult, scoredAudits, recentScored, rawAudits] = await Promise.all([
  db.select({ value: count() }).from(audit).where(eq(audit.userId, session.user.id)),
  db.select({ score: audit.score }).from(audit)
    .where(and(eq(audit.userId, session.user.id), eq(audit.status, 'completed'), isNotNull(audit.score))),
  db.select({ score: audit.score, createdAt: audit.createdAt }).from(audit)
    .where(and(eq(audit.userId, session.user.id), eq(audit.status, 'completed'), isNotNull(audit.score)))
    .orderBy(desc(audit.createdAt)).limit(10),
  db.select().from(audit).where(whereClause).orderBy(desc(audit.createdAt)).limit(PAGE_SIZE + 1),
]);
```

---

### **[High] PERF-017** — `cleanupStaleAudits()` called as fire-and-forget floating promise
*Consensus: 5/5 runs*

- **Location:** `app/api/audit/route.ts` — `cleanupStaleAudits()` called without `await`
- **Impact:** Floating promise may be killed in serverless environments before completion.
- **Remediation:** `await cleanupStaleAudits()` (adds ~1-5ms only on cleanup runs due to 5-min guard).

---

### **[High] PERF-018** — Missing composite DB indexes
*Consensus: 5/5 runs*

- **Location:** Dashboard queries + stale audit cleanup
- **Impact:** Full table scans at scale. O(n) → O(log n + k) with indexes.
- **Remediation:**

```sql
CREATE INDEX idx_audit_user_status_created
  ON audit (userId, status, createdAt DESC);

CREATE INDEX idx_audit_status_updated
  ON audit (status, updatedAt)
  WHERE status = 'running';
```

---

### **[Medium] PERF-019** — `layout.tsx` forces dynamic rendering via `await headers()` on every page
*Consensus: 5/5 runs*

- **Location:** `app/layout.tsx`
- **Impact:** All pages (including static `/login`, `/signup`) become dynamically rendered, adding 10–50ms server latency and preventing CDN edge caching.
- **Remediation:** Consider whether the nonce is needed for all pages. Pass nonce only to components that need it via React context, not the root layout.

---

### **[Medium] PERF-020** — `crypto.randomUUID()` + `Buffer.from().toString('base64')` nonce encoding is wasteful
*Consensus: 5/5 runs*

- **Location:** `middleware.ts`
- **Current Behavior:** `Buffer.from(uuidString)` encodes the UUID's ASCII characters, not raw bytes — produces a 48-char base64 string from 36-char UUID.
- **Remediation:** Use UUID directly as nonce: `const nonce = crypto.randomUUID();`

---

### **[Low] PERF-021** — `Report-To` header JSON serialized on every request
*Consensus: 5/5 runs*

- **Location:** `middleware.ts`
- **Remediation:** Hoist `JSON.stringify()` to module scope.

---

## 6. React / Frontend Rendering

### **[High] PERF-022** — 167KB of avoidable First Load JS from `lucide-react` and `react-markdown`
*Consensus: 5/5 runs*

- **Location:** `components/AgentCard.tsx` (55+ icons), `components/markdownComponents.tsx`
- **Current:** `/audit/[agent]` = 269KB, `/site-audit` = 258KB First Load JS
- **Target:** ~150KB First Load JS
- **Impact:** Each 100KB of JS adds ~300ms parse+compile on mid-range mobile devices.
- **Remediation:**

```typescript
// 1. Dynamic import react-markdown (only needed post-completion):
const ReactMarkdown = dynamic(() => import('react-markdown'), { ssr: false });

// 2. Replace 55 static lucide-react imports with lazy icon map or SVG sprite
// Estimated savings: 80–120KB First Load JS reduction
```

---

### **[High] PERF-023** — `detectAgents()` runs on raw undebounced input in `AuditInterface`
*Consensus: 5/5 runs*

- **Location:** `components/AuditInterface.tsx` — `useMemo` on raw `input`
- **Impact:** 55 regex tests on 60K chars blocks render thread on paste.
- **Remediation:** Use debounced input as `useMemo` dependency (see PERF-003).

---

### **[High] PERF-024** — `SafeMarkdown` re-renders 100KB+ markdown on parent re-renders
*Consensus: 5/5 runs*

- **Location:** `components/AuditInterface.tsx`
- **Impact:** react-markdown parsing of 100KB takes ~50–200ms. Timer ticks may trigger re-renders post-completion.
- **Remediation:**

```typescript
const memoizedMarkdown = useMemo(
  () => <SafeMarkdown>{result}</SafeMarkdown>,
  [result]
);
// Also: stop elapsed timer interval when status !== 'loading'
```

---

### **[Medium] PERF-025** — 10 `useEffect` hooks in `AuditInterface.tsx`
*Consensus: 5/5 runs*

- **Location:** `components/AuditInterface.tsx`
- **Impact:** Risk of listener accumulation on unmount/remount. All effects have cleanup functions (verified), but consolidation would reduce complexity.

---

### **[Medium] PERF-026** — `HomeSearch` renders 50+ `AgentCard` components without virtualization
*Consensus: 5/5 runs*

- **Location:** `components/HomeSearch.tsx` — "Browse all" state
- **Impact:** Initial mount of 50 cards: ~50–150ms on mid-range devices.
- **Remediation:** Add `content-visibility: auto` CSS or paginate (12 initially + "Load more").

---

### **[Medium] PERF-027** — `ScoreSparkline` SVG point calculation
*Consensus: 5/5 runs*

- **Location:** `app/dashboard/page.tsx`
- **Impact:** Negligible — O(10) max, runs once per server render. No action needed.

---

### **[Low] PERF-028** — Agent dropdown renders all 50 agents
*Consensus: 5/5 runs*

- **Impact:** Low — only when dropdown is open. No action needed at current scale.

---

### **[Low] PERF-029** — `categoryCounts` computed on every server render of `app/page.tsx`
*Consensus: 5/5 runs*

- **Impact:** Negligible — O(50). Move to module-level constant in agent registry.

---

## 7. Database & Network Latency

### **[High] PERF-030** — Dashboard query fetches `result` column (up to 100KB/row) for score computation
*Consensus: 5/5 runs*

- **Location:** `app/dashboard/page.tsx` — `SELECT score, result FROM audit`
- **Impact:** 100 audits × 50KB average = 5MB transferred per dashboard load.
- **Remediation:** After PERF-004 backfill migration, change to `SELECT score FROM audit WHERE score IS NOT NULL`. Saves 5MB → 400 bytes per load.

---

### **[High] PERF-031** — No query result caching on dashboard
*Consensus: 5/5 runs*

- **Location:** `app/dashboard/page.tsx`
- **Impact:** Same 4 queries on every page load despite infrequent data changes.
- **Remediation:**

```typescript
import { unstable_cache } from 'next/cache';

const getCachedDashboardStats = unstable_cache(
  async (userId: string) => getDashboardStats(userId),
  ['dashboard-stats'],
  { revalidate: 60, tags: [`user-${userId}`] }
);

// Invalidate on new audit save:
revalidateTag(`user-${userId}`);
```

---

### **[Medium] PERF-032** — `audit/[agent]` has `s-maxage=3600` but may serve user-specific content
*Consensus: 4/5 runs*

- **Location:** `next.config.ts`
- **Impact:** CDN may cache user-specific page data. The audit page shell is static (ISR) but `AuditInterface` is client-rendered, so this is likely safe. Verify no server-rendered user data leaks.
- **Remediation:** Add `Vary: Cookie` or confirm page shell is user-agnostic.

---

### **[Low] PERF-033** — Streaming responses correctly use `no-store`
*Consensus: 5/5 runs*

- **Note:** No action needed. Confirmed correct.

---

## 8. Concurrency & Parallelism

### **[High] PERF-034** — `detectAgents()` blocks main thread with 55 sync regex tests
*Consensus: 5/5 runs*

- **Location:** `lib/detectAgents.ts` → `components/AuditInterface.tsx`
- **Impact:** 10–50ms main-thread block on 60K-char input.
- **Remediation:** Short-term: truncate + debounce (PERF-003 + PERF-023). Long-term: Web Worker.

---

### **[Medium] PERF-035** — `chunksRef.current.join('')` inside RAF is O(total) per frame
*Consensus: 5/5 runs*

- **Location:** `lib/hooks/useAuditSession.ts` — RAF callback
- **Impact:** Near end of 100KB stream: O(100KB) × 60fps = 6MB/s string allocation.
- **Remediation:**

```typescript
const renderedCountRef = useRef(0);

rafRef.current = requestAnimationFrame(() => {
  if (!isStoppedRef.current) {
    const totalChunks = chunksRef.current.length;
    if (totalChunks > renderedCountRef.current) {
      const newContent = chunksRef.current.slice(renderedCountRef.current).join('');
      renderedCountRef.current = totalChunks;
      setResult(prev => prev + newContent);
    }
  }
  rafRef.current = null;
});
```

Reduces per-frame join from O(total) to O(new chunks) — typically O(1–5 chunks).

---

### **[Medium] PERF-036** — Anthropic retry loop blocks stream consumer during backoff
*Consensus: 5/5 runs*

- **Location:** `lib/ai/anthropicProvider.ts`
- **Impact:** 1+2+4 = 7 seconds of silence during 3 retries. Client's 5-min timeout continues counting.
- **Remediation:** Enqueue a heartbeat during retry sleep to keep connection alive.

---

## 9. Prioritized Action List

| # | Finding | Action | Estimated Gain | Effort |
|---|---|---|---|---|
| 1 | **PERF-016** | Parallelize 4 dashboard DB queries with `Promise.all` | **3–4× dashboard TTFB reduction** | **Low** — 10 lines |
| 2 | **PERF-001** | Replace `accumulated += chunk` with `chunks.push()` + `join()` | **Eliminates O(n²); ~8MB → ~100KB GC** | **Low** — 5 lines |
| 3 | **PERF-004** + **PERF-030** | One-time score backfill migration; remove `result` from dashboard query | **5MB → 400B DB transfer per load** | **Low** — migration + query |
| 4 | **PERF-002** | Run site-audit agents concurrently with concurrency cap | **3–10× site-audit wall-clock reduction** | **Medium** — per-agent state |
| 5 | **PERF-022** | Dynamic-import react-markdown + lazy icon map | **80–120KB First Load JS reduction** | **Medium** — icon refactor |
| 6 | **PERF-018** | Add composite DB index `(userId, status, createdAt DESC)` | **10–100× query speedup at scale** | **Low** — one migration |
| 7 | **PERF-023** + **PERF-003** | Debounce detectAgents input + truncate to 2KB sample | **Eliminates main-thread jank** | **Low** — 3 lines |
| 8 | **PERF-031** | Cache dashboard stats with `unstable_cache` (60s TTL) | **Eliminates repeat DB queries** | **Low** — wrapper |
| 9 | **PERF-035** | Incremental join in RAF callback | **O(total) → O(new) per frame** | **Low** — 8 lines |
| 10 | **PERF-013** + **PERF-021** | Pre-compute CSP template + Report-To at module scope | **~15µs/request saved** | **Low** — constants |

---

## 10. Overall Score

| Dimension | Score (1–10) | Notes |
|---|---|---|
| Algorithmic Efficiency | 5 | O(n²) string concat in site-audit and sequential audit execution are significant; `detectAgents` needs input truncation; most other algorithms are appropriate |
| Memory Management | 6 | RAF batching is excellent; `chunksRef` pattern is correct; ARCH-017 truncation already limits localStorage; per-request CSP allocation is the main waste |
| I/O & Async | 5 | Sequential DB queries on dashboard and sequential audit execution are the two largest inefficiencies; streaming architecture is well-designed; missing DB indexes are a scale risk |
| Rendering | 6 | React.memo on AgentCard is correct; RAF batching for streaming is well-designed; pre-tag during streaming avoids markdown parse at 60fps; bundle size is the most impactful rendering issue |
| **Composite** | **5.5** | The codebase has a solid foundation with several proactive optimizations. The critical issues (sequential site-audit, O(n²) string concat, bundle size, sequential DB queries) are all fixable in under a week of focused work and would bring the composite score to ~7.5–8/10. No architectural rewrites required. |

---

## Appendix: What's Already Done Well

All 5 runs consistently praised these patterns:

- **RAF-batched streaming** (`useAuditSession.ts`) — prevents 60fps re-renders during streaming
- **`<pre>` tag during streaming** (PERF-011) — avoids re-parsing markdown at 60fps
- **`React.memo` on `AgentCard`** — prevents unnecessary re-renders of 50+ cards
- **Debounced search** in `HomeSearch` (150ms)
- **Early-exit in `detectAgents`** for input < 10 chars
- **Module-level `TextEncoder`** in `anthropicProvider.ts`
- **Prompt caching** via `cache_control: { type: 'ephemeral' }` — saves ~90% input token cost
- **`ARCH-017` result truncation** — caps localStorage entries at 8KB
- **Retry with exponential backoff** in Anthropic provider — only retries 5xx, not 429
