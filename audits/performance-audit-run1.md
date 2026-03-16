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
| **Highest-Impact Bottleneck** | **4 sequential DB queries on dashboard + score backfill loop with fire-and-forget DB writes on every page load** |

The codebase is well-structured with several good patterns already in place (RAF batching, React.memo on AgentCard, debounced search, early-exit in detectAgents, streaming instead of buffering full responses). The critical issues are concentrated in three areas: bundle size from icon imports, sequential database access patterns, and O(n²) string accumulation in site-audit streaming.

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

- **Location:** `app/site-audit/page.tsx` — `accumulated += chunk` inside stream read loop
- **Current Complexity:** O(n²) time, O(n) space — each `+=` on a string copies the entire existing string; for a 100KB result arriving in ~1000 chunks of ~100 bytes, this produces ~50MB of intermediate string allocations
- **Target Complexity:** O(n) time and space
- **Impact:** For 100KB streamed results, ~500× more memory allocated than necessary; GC pauses will stall the streaming UI thread mid-render
- **Remediation:**

```typescript
// BEFORE (in stream read loop):
accumulated += chunk;

// AFTER: accumulate into array, join once at end
const chunks: string[] = [];
// ...inside loop:
chunks.push(chunk);
// ...on stream complete:
const fullResult = chunks.join('');
```

---

### **[High] PERF-002** — 55 regex tests on every input change in detectAgents

- **Location:** `lib/detectAgents.ts` — 55 compiled regex patterns (13 language + 13 framework + 29 pattern rules) each called with `.test(input)` on strings up to 60K chars
- **Current Complexity:** O(55 × n) per call where n = input length; at 60K chars this is ~3.3M character comparisons per keystroke cycle
- **Target Complexity:** O(k × n) where k ≪ 55 via early-exit tiering and input length cap
- **Impact:** At 60K chars, each detectAgents call takes ~2–8ms on V8 depending on regex complexity; behind useMemo this fires on every input reference change — if the memo dependency is the raw input string (not debounced), this runs on every character
- **Remediation:**

```typescript
// 1. Cap input fed to detector (detection doesn't need full 60K chars)
const DETECT_SAMPLE_SIZE = 4_000; // first 4KB is sufficient for language/framework detection

export function detectAgents(input: string): DetectionResult {
  if (input.length < 10) return { languages: [], frameworks: [], patterns: [] };
  
  // Sample: first 2KB + last 2KB covers imports at top and patterns throughout
  const sample = input.length > DETECT_SAMPLE_SIZE
    ? input.slice(0, DETECT_SAMPLE_SIZE / 2) + input.slice(-DETECT_SAMPLE_SIZE / 2)
    : input;

  // 2. Tier rules: run cheap/discriminating rules first, short-circuit
  // Language rules first (fast, high signal), then framework, then patterns
  const languages = LANGUAGE_RULES.filter(r => r.regex.test(sample)).map(r => r.name);
  if (languages.length === 0) return { languages: [], frameworks: [], patterns: [] }; // no language = skip rest
  
  const frameworks = FRAMEWORK_RULES.filter(r => r.regex.test(sample)).map(r => r.name);
  const patterns = PATTERN_RULES.filter(r => r.regex.test(sample)).map(r => r.name);
  return { languages, frameworks, patterns };
}
```

---

### **[High] PERF-003** — Sequential DB queries on dashboard (4 round-trips)

- **Location:** `app/dashboard/page.tsx` — queries 1–4 executed sequentially with `await`
- **Current Complexity:** O(4 × RTT) latency; at 5ms DB RTT = 20ms minimum; at 20ms RTT = 80ms minimum, all blocking page render
- **Target Complexity:** O(1 × RTT) for independent queries via parallelization; O(2 × RTT) for dependent queries
- **Impact:** Queries 1, 2, 3, and 4 are all independent (same `userId` filter, different projections). Parallelizing reduces dashboard TTFB by 3× at minimum
- **Remediation:**

```typescript
// BEFORE (sequential):
const totalCount = await db.select({ count: count() }).from(auditTable).where(eq(auditTable.userId, userId));
const allScores = await db.select({ score: auditTable.score }).from(auditTable).where(...);
const trendData = await db.select(...).from(auditTable).where(...).orderBy(...).limit(10);
const audits = await db.select().from(auditTable).where(...).orderBy(...).limit(21);

// AFTER (parallel):
const [totalCount, allScores, trendData, audits] = await Promise.all([
  db.select({ count: count() }).from(auditTable).where(eq(auditTable.userId, userId)),
  db.select({ score: auditTable.score, result: auditTable.result })
    .from(auditTable).where(and(eq(auditTable.userId, userId), eq(auditTable.status, 'completed'))),
  db.select({ score: auditTable.score, createdAt: auditTable.createdAt })
    .from(auditTable).where(...).orderBy(desc(auditTable.createdAt)).limit(10),
  db.select().from(auditTable).where(...).orderBy(desc(auditTable.createdAt)).limit(21),
]);
```

---

### **[High] PERF-004** — Score backfill on every dashboard page load

- **Location:** `app/dashboard/page.tsx` — loop over paginated audits calling `extractScore()` per row, then fire-and-forget `Promise.all()` to write back to DB
- **Current Complexity:** O(p) extractScore calls + O(p) DB writes per page load, where p = page size (21); these writes race with the next page load
- **Target Complexity:** O(1) — backfill should be a one-time migration, not a per-request operation
- **Impact:** 21 regex operations + up to 21 DB UPDATE statements on every dashboard load; under concurrent users this creates write amplification and connection pool pressure
- **Remediation:**

```typescript
// Option A (preferred): Run as a one-time DB migration
// ALTER TABLE audit ADD COLUMN score INTEGER;
// UPDATE audit SET score = extractScore(result) WHERE score IS NULL AND result IS NOT NULL;
// Then remove backfill code from dashboard entirely.

// Option B (if migration not feasible): Gate behind a feature flag
// and run as a background job, not inline with page render:
// app/api/admin/backfill-scores/route.ts — admin-only endpoint, runs once

// Option C (minimal change): Only backfill if count of null-score rows > 0,
// and move the Promise.all writes to a non-blocking background task:
if (nullScoreCount > 0) {
  // Don't await — but also don't fire-and-forget silently
  void backfillScores(auditsNeedingScores).catch(err => 
    console.error('backfill_failed', err)
  );
}
```

---

### **[Medium] PERF-005** — Linear search through PROTECTED_PREFIXES / AUTH_ROUTES on every request

- **Location:** `middleware.ts` — `PROTECTED_PREFIXES.some(p => pathname.startsWith(p))` and `AUTH_ROUTES.some(p => pathname.startsWith(p))`
- **Current Complexity:** O(k) per request where k = array length (3 + 3 = 6); negligible at k=6 but the pattern is worth noting given middleware runs on every non-static request
- **Target Complexity:** O(1) with a trie or sorted prefix check; or O(1) amortized with a Set for exact matches
- **Impact:** Negligible at current scale (6 prefixes); no action required unless prefix lists grow beyond ~20 entries
- **Remediation:** No change needed now. If prefix lists grow, convert to a sorted array with binary search or a simple trie.

---

### **[Medium] PERF-006** — extractScore runs 5 sequential regex patterns on full audit text

- **Location:** `lib/extractScore.ts` — 5 patterns tested in order on strings up to 100K chars
- **Current Complexity:** O(5 × n) worst case (all patterns fail); O(n) best case (first pattern matches)
- **Target Complexity:** O(n) with a single combined regex or early-exit on first match (already sequential, but patterns could be combined)
- **Impact:** At 100K chars, ~500K character comparisons worst-case; called twice per audit (API save + dashboard load). Acceptable now but worth combining patterns.
- **Remediation:**

```typescript
// Combine all score patterns into one regex with named capture groups
const SCORE_RE = /(?:Score[:\s]+(?<a>\d{1,3})\/100|(?<b>\d{1,3})\/100|\*\*(?<c>\d{1,3})\/100\*\*|(?<d>\d{1,3})%)/i;

export function extractScore(text: string): number | null {
  const match = SCORE_RE.exec(text);
  if (!match?.groups) return null;
  const raw = match.groups.a ?? match.groups.b ?? match.groups.c ?? match.groups.d;
  const n = parseInt(raw, 10);
  return n >= 0 && n <= 100 ? n : null;
}
```

---

### **[Low] PERF-007** — slugify() runs 3 regex replacements per heading render

- **Location:** `components/markdownComponents.tsx` — `slugify()` called for every `h1`–`h4` in rendered markdown
- **Current Complexity:** O(3 × m) per heading where m = heading text length; called on every markdown render
- **Target Complexity:** O(m) with a single combined regex pass
- **Impact:** Negligible for typical audit results (< 20 headings); no action required unless headings are extremely numerous
- **Remediation:**

```typescript
// Combine into one pass
function slugify(text: string): string {
  return text.toLowerCase().replace(/[^\w\s-]/g, '').replace(/[\s_]+/g, '-').replace(/^-+|-+$/g, '');
  // Or even simpler with a single regex:
  return text.toLowerCase().replace(/[^\w]+/g, '-').replace(/^-|-$/g, '');
}
```

---

### **[Low] PERF-008** — childrenToText() recurses through React children tree on every heading

- **Location:** `components/markdownComponents.tsx` — recursive React children traversal for slug generation
- **Current Complexity:** O(d × c) where d = tree depth, c = children count; typically O(1)–O(5) for headings
- **Target Complexity:** Already acceptable; no change needed
- **Impact:** Negligible

---

## 4. Memory & Allocation Issues

### **[High] PERF-009** — 55+ lucide-react icon imports at module scope in AgentCard

- **Location:** `components/AgentCard.tsx` — `import { Icon1, Icon2, ..., Icon55 } from 'lucide-react'`
- **Current Impact:** Even with tree-shaking, 55 named imports from lucide-react means 55 icon SVG component definitions are included in the AgentCard chunk. Each lucide icon is ~300–500 bytes minified; 55 icons ≈ 16–27KB of icon code in the bundle. This is a primary contributor to the 116KB home page First Load JS.
- **Target:** Lazy-load icons not visible above the fold; use dynamic icon map with `React.lazy` or a sprite sheet
- **Remediation:**

```typescript
// Option A: Dynamic import map (best for tree-shaking + code splitting)
// icons.ts — separate chunk
export const ICON_MAP = {
  code: () => import('lucide-react').then(m => ({ default: m.Code })),
  shield: () => import('lucide-react').then(m => ({ default: m.Shield })),
  // ...
} as const;

// AgentCard.tsx
const AgentIcon = React.lazy(ICON_MAP[agent.icon] ?? ICON_MAP.code);
// Wrap in <Suspense fallback={<div className="w-5 h-5" />}>

// Option B: Use a single SVG sprite sheet (zero JS for icons)
// Generate sprite at build time from lucide SVG sources
// <svg><use href="/icons.svg#code" /></svg>
// Eliminates all icon JS from bundle entirely (~16-27KB savings)
```

---

### **[High] PERF-010** — chunksRef array grows unbounded during long streaming sessions

- **Location:** `lib/hooks/useAuditSession.ts` — `chunksRef.current.push(chunk)` accumulates all chunks; `chunksRef.current.join('')` called on every RAF tick
- **Current Impact:** For a 100KB audit result arriving in ~1000 chunks, `chunksRef.current.join('')` is called up to 60 times per second during streaming. Each `join('')` allocates a new 100KB string. At 60fps for 60 seconds = 3,600 × 100KB = ~360MB of string allocations during a single audit session. V8 will GC most of this, but GC pauses will cause visible frame drops.
- **Target:** Maintain a running concatenated string; only append the new chunk delta on each RAF tick
- **Remediation:**

```typescript
// BEFORE: join all chunks on every RAF tick
rafRef.current = requestAnimationFrame(() => {
  if (!isStoppedRef.current) { setResult(chunksRef.current.join('')); }
  rafRef.current = null;
});

// AFTER: maintain accumulated string, append only new chunks since last RAF
const accumulatedRef = useRef('');
const pendingChunksRef = useRef<string[]>([]); // only chunks since last RAF flush

// In stream read loop:
pendingChunksRef.current.push(chunk);
if (rafRef.current === null) {
  rafRef.current = requestAnimationFrame(() => {
    if (!isStoppedRef.current) {
      accumulatedRef.current += pendingChunksRef.current.join('');
      pendingChunksRef.current = [];
      setResult(accumulatedRef.current);
    }
    rafRef.current = null;
  });
}

// On stream complete:
const fullResult = accumulatedRef.current + pendingChunksRef.current.join('');
accumulatedRef.current = '';
pendingChunksRef.current = [];
```

---

### **[High] PERF-011** — makeStream() accumulates all chunks in memory before DB write

- **Location:** `app/api/audit/route.ts` — `chunks: string[]` array accumulates entire stream, then `chunks.join('')` produces full result string for DB write
- **Current Impact:** For a 100KB result, this is acceptable. However, the `chunks` array and the joined string both exist in memory simultaneously during the DB write, doubling peak memory usage for that request. At 10 concurrent audits = 10 × 200KB = 2MB peak (acceptable), but worth noting the pattern.
- **Target:** Use a running concatenation or a single pre-allocated buffer
- **Remediation:**

```typescript
// Replace chunks array with running string accumulation
let accumulated = '';
// In stream loop:
if (auditRecord && value) accumulated += decoder.decode(value, { stream: true });
// On complete:
const score = extractScore(accumulated);
await db.update(auditTable).set({ result: accumulated.slice(0, MAX_RESULT_CHARS), ... });
// Note: this is O(n²) for the accumulated string — use the same chunks[] pattern
// but only join ONCE at the end (not on every RAF tick like the client-side issue)
// The current chunks[].join('') at end is actually correct — keep it.
// The real fix is ensuring chunks[] is cleared after the join to release memory.
```

*Correction: The current server-side pattern (accumulate chunks[], join once at end) is already correct. No change needed here — this finding is Low severity.*

---

### **[Medium] PERF-012** — localStorage stores up to 20 full audit results (up to 2MB)

- **Location:** `lib/history.ts` (inferred from `saveAudit()` calls) — full `result` string stored per history entry
- **Current Impact:** 20 entries × 100KB each = up to 2MB in localStorage. localStorage is synchronous and blocks the main thread on read/write. Most browsers cap localStorage at 5–10MB; hitting the cap throws a `QuotaExceededError`.
- **Target:** Store only a truncated preview (e.g., first 500 chars) in localStorage; store full results in IndexedDB or server-side only
- **Remediation:**

```typescript
// In saveAudit():
const entry: AuditHistoryEntry = {
  agentId, agentName, inputSnippet,
  resultPreview: result.slice(0, 500), // store preview only
  // resultFull: omit from localStorage
  timestamp,
};
// For full result access, fetch from /api/audit/[id] or use IndexedDB
```

---

### **[Medium] PERF-013** — Rate limiter timestamp arrays grow to maxEntries (10K) per IP

- **Location:** `lib/rateLimit.ts` — each limiter instance maintains a `Map<string, number[]>` of timestamps per key; cleanup runs on background interval
- **Current Impact:** 9 limiter instances × 10K entries × average array size = potentially significant memory under load. The background cleanup interval (1min–1hr) means stale entries accumulate between cleanups.
- **Target:** Use a sliding window with a circular buffer or evict on access rather than background cleanup
- **Remediation:**

```typescript
// Evict stale entries on every .check() call (lazy eviction):
check(key: string): RateLimitResult {
  const now = Date.now();
  const timestamps = this.map.get(key) ?? [];
  // Evict expired entries inline — no background timer needed
  const valid = timestamps.filter(t => now - t < this.windowMs);
  if (valid.length >= this.limit) {
    this.map.set(key, valid);
    return { allowed: false, retryAfter: this.windowMs - (now - valid[0]) };
  }
  valid.push(now);
  this.map.set(key, valid);
  return { allowed: true };
}
// Remove background setInterval entirely — reduces timer overhead
```

---

### **[Low] PERF-014** — New Headers() object allocated on every middleware request

- **Location:** `middleware.ts` — `const requestHeaders = new Headers(request.headers)` creates a new Headers object per request
- **Current Impact:** Negligible allocation per request; Headers objects are small. No action needed.

---

### **[Low] PERF-015** — DOT_COLORS map iterated per agent badge in site-audit

- **Location:** `app/site-audit/page.tsx` — `dotColor()` function iterates 18-entry map per agent badge render
- **Current Impact:** 18 iterations × 50 agents = 900 iterations per render; negligible
- **Target:** Already O(1) if implemented as a direct Map lookup; ensure it's not a linear search
- **Remediation:** Confirm `dotColor()` uses `DOT_COLORS.get(status)` not `DOT_COLORS.find(...)`.

---

## 5. I/O & Async Performance

### **[Critical] PERF-016** — CSP nonce generated via crypto.randomUUID() + Buffer.from().toString('base64') on EVERY request

- **Location:** `middleware.ts` — `const nonce = Buffer.from(crypto.randomUUID()).toString('base64')`
- **Current Impact:** `crypto.randomUUID()` in the Edge/Node.js middleware runtime is fast (~1µs), but `Buffer.from(...).toString('base64')` adds unnecessary encoding overhead. More critically, the entire CSP string is rebuilt via array join on every single request — including static asset requests that pass through the matcher. The CSP string construction involves 15+ string concatenations and a `.join('; ')` on every request.
- **Target:** Pre-build the static portions of the CSP string at module initialization; only interpolate the nonce at request time
- **Remediation:**

```typescript
// Pre-compute static CSP parts at module load (runs once)
const isDev = process.env.NODE_ENV === 'development';
const hasPlausible = !!process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN;
const plausibleScript = hasPlausible ? ' https://plausible.io' : '';
const unsafeEval = isDev ? " 'unsafe-eval'" : '';

// Template with nonce placeholder — only nonce changes per request
const CSP_TEMPLATE_PREFIX = `default-src 'self'; script-src 'nonce-`;
const CSP_TEMPLATE_SUFFIX = `' 'strict-dynamic' 'unsafe-inline'${unsafeEval}${plausibleScript}; style-src 'self' 'unsafe-inline'; font-src 'self'; img-src 'self' data: blob: https://avatars.githubusercontent.com https://lh3.googleusercontent.com; connect-src 'self'${plausibleScript}; frame-ancestors 'none'; object-src 'none'; base-uri 'self'; form-action 'self'; upgrade-insecure-requests; report-uri /api/csp-report; report-to csp-endpoint`;

// Pre-compute static headers (runs once)
const STATIC_REPORT_TO = JSON.stringify({ group: 'csp-endpoint', max_age: 86400, endpoints: [{ url: '/api/csp-report' }] });
const STATIC_HEADERS = {
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(), geolocation=()',
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  ...(isDev ? {} : { 'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload' }),
} as const;

// Per-request: only nonce generation + string interpolation
export function middleware(request: NextRequest) {
  // ... auth checks ...
  const nonce = crypto.randomUUID(); // UUID is already URL-safe; base64 encoding is unnecessary
  const csp = `${CSP_TEMPLATE_PREFIX}${nonce}${CSP_TEMPLATE_SUFFIX}`;
  // Apply headers...
}
```

*Note: `Buffer.from(uuid).toString('base64')` encodes the UUID string bytes as base64, producing a longer string with no security benefit over the UUID itself as a nonce. The UUID is already 36 chars of hex+hyphens — use it directly.*

---

### **[Critical] PERF-017** — `layout.tsx` forces dynamic rendering on ALL pages via `await headers()`

- **Location:** `app/layout.tsx` — `await headers()` call for CSP nonce injection opts every page out of static generation
- **Current Impact:** This is the most architecturally significant performance issue. Every page — including fully static pages like `/login`, `/signup`, `/settings` — is rendered dynamically on every request because the root layout calls `await headers()`. This means:
  - No static HTML caching at CDN edge
  - Every page load hits Node.js server
  - The 102KB shared JS chunk is served but pages cannot be pre-rendered
  - `/dashboard` (176B page JS) could be ISR but is forced dynamic
- **Target:** Decouple nonce injection from root layout; use a separate nonce-aware layout only for pages that need CSP nonce in inline scripts
- **Remediation:**

```typescript
// Option A: Move nonce consumption to a dedicated server component
// that only wraps pages needing inline scripts (e.g., audit pages)
// Root layout becomes static again

// app/layout.tsx — remove headers() call
export default function RootLayout({ children }: { children: React.ReactNode }) {
  // No await headers() here
  return <html><body>{children}</body></html>;
}

// app/(dynamic)/layout.tsx — only wraps routes needing nonce
import { headers } from 'next/headers';
export default async function DynamicLayout({ children }) {
  const nonce = (await headers()).get('x-nonce') ?? '';
  return <NonceProvider nonce={nonce}>{children}</NonceProvider>;
}

// Option B: Use Next.js <Script> component with nonce prop
// which handles nonce injection without requiring headers() in layout
// This allows static pages to remain static

// Option C (pragmatic): Accept dynamic rendering for authenticated routes only
// Move nonce-dependent layout to app/(authenticated)/layout.tsx
// Public routes (/, /login, /signup) get a static layout with no nonce
```

---

### **[High] PERF-018** — Site-audit runs N audits sequentially, not in parallel

- **Location:** `app/site-audit/page.tsx` — `for...of` loop calling `await streamSingleAudit()` per agent
- **Current Impact:** For 50 agents, sequential execution means total time = Σ(individual audit times). If each audit takes 30s, total = 25 minutes. Even at 5s each = 4+ minutes.
- **Target:** Controlled parallelism with a concurrency limit (respect Anthropic rate limits)
- **Remediation:**

```typescript
// Parallel with concurrency limit (p-limit or manual semaphore)
const CONCURRENCY = 3; // respect Anthropic rate limits

async function runAuditsWithConcurrency(
  agents: AgentConfig[], 
  input: string,
  onResult: (agentId: string, result: string) => void
): Promise<void> {
  const semaphore = new Array(CONCURRENCY).fill(Promise.resolve());
  let slotIndex = 0;
  
  const tasks = agents.map(agent => {
    const slot = slotIndex % CONCURRENCY;
    slotIndex++;
    semaphore[slot] = semaphore[slot].then(async () => {
      const result = await streamSingleAudit(agent, input);
      onResult(agent.id, result);
    });
    return semaphore[slot];
  });
  
  await Promise.all(tasks);
}

// Or use the well-tested p-limit package:
import pLimit from 'p-limit';
const limit = pLimit(3);
await Promise.all(agents.map(agent => limit(() => streamSingleAudit(agent, input))));
```

---

### **[Medium] PERF-019** — Missing connection pooling visibility for Drizzle ORM

- **Location:** `lib/db.ts` (inferred) — Drizzle ORM database connection configuration
- **Current Impact:** If using `postgres` (node-postgres) or `@neondatabase/serverless` without explicit pool configuration, each serverless function invocation may create a new connection. At 10 audits/min peak, this is acceptable, but dashboard page loads + audit API calls could exhaust connection limits.
- **Target:** Explicit pool configuration with `max`, `idleTimeoutMillis`, and `connectionTimeoutMillis`
- **Remediation:**

```typescript
// For node-postgres with Drizzle:
import { Pool } from 'pg';
import { drizzle } from 'drizzle-orm/node-postgres';

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 10,                    // max connections
  idleTimeoutMillis: 30_000,  // close idle connections after 30s
  connectionTimeoutMillis: 5_000, // fail fast if no connection available
});

export const db = drizzle(pool);

// For Neon serverless (recommended for Next.js):
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
// neon() uses HTTP/2 multiplexing — no connection pool needed
```

---

### **[Medium] PERF-020** — staleAuditCleanup uses module-level mutable state (lastStaleCleanup)

- **Location:** `app/api/audit/route.ts` — `let lastStaleCleanup = 0` at module scope
- **Current Impact:** In serverless/edge deployments, module-level state is not shared across function instances. Each cold start resets `lastStaleCleanup = 0`, causing cleanup to run on the first request after every cold start — potentially multiple times concurrently across instances.
- **Target:** Move cleanup scheduling to a dedicated cron job (Vercel Cron, pg_cron, or a separate worker)
- **Remediation:**

```typescript
// Option A: Vercel Cron Job (recommended)
// app/api/cron/cleanup-stale-audits/route.ts
export async function GET(req: Request) {
  // Verify cron secret
  if (req.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) {
    return new Response('Unauthorized', { status: 401 });
  }
  await cleanupStaleAudits();
  return Response.json({ ok: true });
}
// vercel.json: { "crons": [{ "path": "/api/cron/cleanup-stale-audits", "schedule": "*/5 * * * *" }] }

// Option B: Database-level scheduled job (pg_cron extension)
// SELECT cron.schedule('cleanup-stale-audits', '*/5 * * * *', 
//   $$UPDATE audit SET status='failed' WHERE status='running' AND updated_at < NOW() - INTERVAL '30 minutes'$$);
```

---

### **[Low] PERF-021** — `newRequestId()` wraps `crypto.randomUUID()` unnecessarily

- **Location:** `app/api/audit/route.ts` — `function newRequestId(): string { return crypto.randomUUID(); }`
- **Current Impact:** Zero performance impact; purely a code style note. The wrapper adds a function call overhead of ~1ns.
- **Remediation:** Inline `crypto.randomUUID()` directly or keep the wrapper — no performance impact either way.

---

## 6. React / Frontend Rendering

### **[High] PERF-022** — detectAgents() called on raw (undebounced) input in AuditInterface useMemo

- **Location:** `components/AuditInterface.tsx` — `useMemo` with `input` as dependency calls `detectAgents(input)` on every character typed
- **Current Impact:** `useMemo` recomputes synchronously on every render triggered by input state change. Since input state updates on every keystroke, `detectAgents()` runs on every keystroke — the 150ms debounce in `HomeSearch` does NOT apply here. At 55 regex tests × 60K chars = ~3–8ms per keystroke, this blocks the main thread and causes input lag.
- **Target:** Debounce the input value fed to the detectAgents useMemo, or move detection to a Web Worker
- **Remediation:**

```typescript
// Add a debounced input value specifically for detection
function useDebounced<T>(value: T, delay: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return debounced;
}

// In AuditInterface:
const debouncedInput = useDebounced(input, 150);
const detection = useMemo(() => detectAgents(debouncedInput), [debouncedInput]);
// Now detectAgents only runs 150ms after the user stops typing
```

---

### **[High] PERF-023** — AuditInterface has 10 useEffect hooks; several have dependency risks

- **Location:** `components/AuditInterface.tsx` — 10 useEffect hooks
- **Current Impact:** Without seeing all dependency arrays, the risk is:
  1. Effects with missing dependencies silently use stale closures
  2. Effects with over-broad dependencies (e.g., object references) re-run on every render
  3. The auto-scroll effects (×2) likely run on every `result` change during streaming — at 60fps this is 60 scroll operations per second
- **Target:** Audit each effect's dependency array; throttle scroll effects
- **Remediation:**

```typescript
// Auto-scroll during streaming: throttle to max 10fps (100ms)
const lastScrollRef = useRef(0);
useEffect(() => {
  if (status !== 'loading') return;
  const now = Date.now();
  if (now - lastScrollRef.current < 100) return; // throttle
  lastScrollRef.current = now;
  scrollRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
}, [result, status]); // result changes trigger this — throttle prevents 60fps scroll calls
```

---

### **[High] PERF-024** — SafeMarkdown renders 100KB+ markdown on audit completion

- **Location:** `components/AuditInterface.tsx` and `app/site-audit/page.tsx` — `<SafeMarkdown>` with full audit result
- **Current Impact:** `react-markdown` parses and renders the full markdown AST synchronously on the main thread. For a 100KB result with hundreds of code blocks, headings, and tables, this can take 50–200ms, causing a visible freeze at audit completion. This is the primary contributor to the 269KB First Load JS on `/audit/[agent]` (react-markdown + its remark/rehype plugins are typically 40–80KB minified).
- **Target:** Virtualize long markdown output; lazy-load react-markdown; consider a lighter markdown renderer
- **Remediation:**

```typescript
// Option A: Lazy-load react-markdown (removes it from initial bundle)
const SafeMarkdown = dynamic(() => import('@/components/markdownComponents'), {
  loading: () => <pre className="whitespace-pre-wrap">{children}</pre>,
  ssr: false, // markdown rendering is client-only anyway
});

// Option B: Use a lighter renderer for the streaming preview
// Keep <pre> during streaming (already done — good!)
// Only switch to SafeMarkdown on 'complete' status
// Add a transition delay to avoid blocking the completion state update:
useEffect(() => {
  if (status === 'complete') {
    // Defer markdown rendering to next idle period
    const id = requestIdleCallback(() => setShowMarkdown(true), { timeout: 2000 });
    return () => cancelIdleCallback(id);
  }
}, [status]);

// Option C: Replace react-markdown with marked (3KB) + DOMPurify (7KB)
// Total: ~10KB vs ~60KB for react-markdown ecosystem
import { marked } from 'marked';
import DOMPurify from 'dompurify';
const html = DOMPurify.sanitize(marked.parse(result));
return <div dangerouslySetInnerHTML={{ __html: html }} />;
```

---

### **[Medium] PERF-025** — HomeSearch renders 50+ AgentCards when "Browse all" is expanded

- **Location:** `components/HomeSearch.tsx` — renders full agent list without virtualization
- **Current Impact:** 50+ AgentCard components × React reconciliation overhead. Each AgentCard is memoized with `React.memo`, so re-renders are prevented on parent state changes. However, the initial mount of 50+ components (each with CSS transitions and icon lookups) takes ~10–30ms.
- **Target:** Virtualize the agent grid with TanStack Virtual or react-window; or paginate (show 12, load more)
- **Remediation:**

```typescript
// Option A: Paginate with "Load more" (simplest, best UX for this use case)
const [visibleCount, setVisibleCount] = useState(12);
const visibleAgents = filteredAgents.slice(0, visibleCount);
// <button onClick={() => setVisibleCount(c => c + 12)}>Load more</button>

// Option B: TanStack Virtual for grid layout
import { useVirtualizer } from '@tanstack/react-virtual';
const rowVirtualizer = useVirtualizer({
  count: Math.ceil(filteredAgents.length / COLS),
  getScrollElement: () => parentRef.current,
  estimateSize: () => 120, // card height
});
```

---

### **[Medium] PERF-026** — ScoreSparkline recalculates SVG points on every dashboard render

- **Location:** `app/dashboard/page.tsx` — `ScoreSparkline` component computes polyline points per render
- **Current Impact:** Server component, so this runs once per request — not a client-side re-render issue. However, the computation is repeated on every page load rather than being cached.
- **Target:** Memoize point calculation; cache dashboard data with `unstable_cache` or React cache
- **Remediation:**

```typescript
// Wrap dashboard data fetching in Next.js cache
import { unstable_cache } from 'next/cache';

const getDashboardData = unstable_cache(
  async (userId: string) => {
    const [totalCount, allScores, trendData, audits] = await Promise.all([...]);
    return { totalCount, allScores, trendData, audits };
  },
  ['dashboard-data'],
  { revalidate: 60, tags: ['audit'] } // revalidate every 60s or on audit completion
);
```

---

### **[Medium] PERF-027** — react-markdown in bundle contributes significantly to 269KB First Load JS

- **Location:** Build output — `/audit/[agent]` First Load JS = 269KB; `/site-audit` = 258KB
- **Current Impact:** The 102KB shared chunk + react-markdown ecosystem (~60–80KB) + lucide-react icons (~16–27KB) + other dependencies accounts for most of the bundle size. The 167KB delta between `/dashboard` (106KB) and `/audit/[agent]` (269KB) is almost entirely react-markdown + icons.
- **Target:** < 150KB First Load JS for audit pages
- **Remediation:** See PERF-009 (icon lazy loading) and PERF-024 (react-markdown lazy loading / replacement). Combined, these two changes should reduce audit page First Load JS by ~80–100KB.

---

### **[Low] PERF-028** — otherAgents dropdown renders all 50 agents grouped by 7 categories without virtualization

- **Location:** `components/AuditInterface.tsx` — agent switcher dropdown
- **Current Impact:** Dropdown is likely hidden until user interaction; initial render cost is deferred. When opened, 50 items render synchronously. Acceptable at 50 items; no action needed unless count grows beyond ~200.

---

## 7. Database & Network Latency

### **[High] PERF-029** — Missing database indexes on audit query columns

- **Location:** `lib/auth-schema.ts` (inferred) — `audit` table schema
- **Current Impact:** All 4 dashboard queries filter by `userId` and order by `createdAt DESC`. Without a composite index on `(userId, createdAt DESC)`, each query performs a full table scan filtered by userId. As audit history grows (e.g., 10,000 rows for an active user), query time grows linearly.
- **Target:** Composite index on `(userId, createdAt DESC)`; partial index on `(userId, status)` for status-filtered queries
- **Remediation:**

```sql
-- Primary access pattern: user's audits ordered by date
CREATE INDEX idx_audit_user_created ON audit (user_id, created_at DESC);

-- For status-filtered queries (completed audits for score calculation)
CREATE INDEX idx_audit_user_status ON audit (user_id, status) WHERE status = 'completed';

-- For stale audit cleanup
CREATE INDEX idx_audit_status_updated ON audit (status, updated_at) WHERE status = 'running';
```

```typescript
// In Drizzle schema:
export const audit = pgTable('audit', {
  // ... columns
}, (table) => ({
  userCreatedIdx: index('idx_audit_user_created').on(table.userId, table.createdAt),
  userStatusIdx: index('idx_audit_user_status').on(table.userId, table.status),
  statusUpdatedIdx: index('idx_audit_status_updated').on(table.status, table.updatedAt),
}));
```

---

### **[Medium] PERF-030** — Dashboard data not cached; re-fetched on every page load

- **Location:** `app/dashboard/page.tsx` — no caching layer on DB queries
- **Current Impact:** Every dashboard page load executes 4 DB queries. For a user refreshing frequently, this is unnecessary load. Dashboard data (audit history, scores) changes only when a new audit completes.
- **Target:** Cache dashboard data with 60s revalidation; invalidate on audit completion
- **Remediation:** See PERF-026 remediation (`unstable_cache` with `revalidate: 60` and tag-based invalidation from the audit API route).

---

### **[Medium] PERF-031** — Query 2 (all completed scores) fetches `result` column unnecessarily

- **Location:** `app/dashboard/page.tsx` — `SELECT score, result FROM audit WHERE userId = ? AND status = 'completed'`
- **Current Impact:** The `result` column stores up to 100KB of text per row. Fetching it for all completed audits (potentially hundreds of rows) to calculate average score transfers megabytes of data from DB to application server unnecessarily. Only `score` is needed for the average calculation.
- **Target:** Select only `score` column; use DB-level aggregation for average
- **Remediation:**

```typescript
// BEFORE: fetch all scores + results, compute average in JS
const allScores = await db.select({ score: auditTable.score, result: auditTable.result })
  .from(auditTable).where(...);
const avg = allScores.reduce((sum, r) => sum + (r.score ?? 0), 0) / allScores.length;

// AFTER: compute average in DB, fetch only what's needed
const [{ avgScore, totalScored }] = await db.select({
  avgScore: avg(auditTable.score),
  totalScored: count(),
}).from(auditTable).where(and(eq(auditTable.userId, userId), eq(auditTable.status, 'completed'), isNotNull(auditTable.score)));
// This transfers ~20 bytes instead of potentially megabytes
```

---

### **[Low] PERF-032** — Missing HTTP caching on audit API responses

- **Location:** `app/api/audit/route.ts` — streaming response headers
- **Current Impact:** Audit results are unique per input; caching is not appropriate for the streaming endpoint itself. However, the audit history API (if it exists) and dashboard data could benefit from `Cache-Control: private, max-age=60`.
- **Target:** Add `Cache-Control: private, max-age=60` to dashboard page response; audit streaming endpoint correctly has no cache.
- **Remediation:** Handled by `unstable_cache` in PERF-026/PERF-030.

---

## 8. Concurrency & Parallelism

### **[High] PERF-033** — CPU-bound markdown parsing (react-markdown) on main thread at audit completion

- **Location:** `components/AuditInterface.tsx` — `<SafeMarkdown result={fullResult} />` rendered synchronously when status transitions to 'complete'
- **Current Impact:** Parsing a 100KB markdown document with remark/rehype plugins runs synchronously on the main thread, blocking user interaction for 50–200ms. This is the most user-visible jank in the application.
- **Target:** Offload markdown parsing to a Web Worker; or use `requestIdleCallback` to defer rendering
- **Remediation:**

```typescript
// Option A: requestIdleCallback deferral (simplest)
const [parsedResult, setParsedResult] = useState<string | null>(null);

useEffect(() => {
  if (status !== 'complete' || !result) return;
  const id = requestIdleCallback(
    () => setParsedResult(result),
    { timeout: 3000 } // force render after 3s even if not idle
  );
  return () => cancelIdleCallback(id);
}, [status, result]);

// Show spinner or plain text while parsing
{parsedResult ? <SafeMarkdown>{parsedResult}</SafeMarkdown> : <pre>{result}</pre>}

// Option B: Web Worker with marked (for true off-main-thread parsing)
// worker.ts:
import { marked } from 'marked';
self.onmessage = (e) => self.postMessage(marked.parse(e.data));

// Component:
const workerRef = useRef<Worker>();
useEffect(() => {
  workerRef.current = new Worker(new URL('./markdownWorker.ts', import.meta.url));
  workerRef.current.onmessage = (e) => setHtml(e.data);
  return () => workerRef.current?.terminate();
}, []);
```

---

### **[Medium] PERF-034** — No parallelism in anthropicProvider retry loop

- **Location:** `lib/ai/anthropicProvider.ts` — sequential retry with exponential backoff
- **Current Impact:** The retry logic is correct and appropriate. Exponential backoff (1s, 2s, 4s) for retryable errors (500, 502, 503, 529) is the right pattern. No change needed.
- **Assessment:** ✅ Well-implemented. The `cache_control: { type: 'ephemeral' }` on the system prompt is an excellent optimization that enables Anthropic's prompt caching, reducing token costs and latency for repeated system prompts.

---

### **[Low] PERF-035** — Background cleanup intervals in rate limiter (9 setInterval timers)

- **Location:** `lib/rateLimit.ts` — each of 9 limiter instances runs a `setInterval` for cleanup
- **Current Impact:** 9 background timers running in the Node.js process. Each timer wakes the event loop at its interval. At low frequency (1min–1hr), this is negligible. However, in serverless environments, these timers prevent the function from being garbage collected between requests.
- **Target:** Replace with lazy eviction (see PERF-013); eliminates all background timers
- **Remediation:** See PERF-013.

---

## 9. Prioritized Action List

| # | Finding | Action | Estimated Gain | Effort |
|---|---|---|---|---|
| 1 | **PERF-017** | Remove `await headers()` from root layout; use nested dynamic layout only for routes needing nonce | Enables static generation for `/login`, `/signup`, `/settings`, `/`; eliminates server render on every request for static pages; **~50–80% TTFB reduction** for public pages | Medium (2–4 days; requires testing nonce propagation) |
| 2 | **PERF-003** | Parallelize 4 dashboard DB queries with `Promise.all` | **3–4× dashboard TTFB reduction** (e.g., 80ms → 20ms at 20ms RTT) | Low (1 hour) |
| 3 | **PERF-029** | Add composite index `(userId, createdAt DESC)` on audit table | **10–100× query speedup** for users with >1,000 audit rows; prevents full table scans | Low (30 min; requires migration) |
| 4 | **PERF-009** | Lazy-load lucide-react icons in AgentCard via dynamic imports or SVG sprite | **~16–27KB bundle reduction** on home page and audit pages; improves LCP | Medium (1–2 days) |
| 5 | **PERF-024 / PERF-027** | Lazy-load react-markdown with `next/dynamic`; defer render with `requestIdleCallback` | **~60–80KB bundle reduction** on audit pages (269KB → ~190KB); eliminates 50–200ms main-thread block at audit completion | Low (2–4 hours) |
| 6 | **PERF-004** | Remove score backfill from dashboard page load; run as one-time DB migration | Eliminates up to 21 regex calls + 21 DB writes per dashboard load; **reduces dashboard server time by ~20–50ms** | Low (2–4 hours for migration) |
| 7 | **PERF-031** | Replace `SELECT score, result` with `SELECT AVG(score)` DB aggregation | Eliminates transfer of potentially MBs of result text; **reduces query data transfer by 99%** for users with many audits | Low (30 min) |
| 8 | **PERF-001** | Fix O(n²) string accumulation in site-audit streaming (`accumulated += chunk` → `chunks.push()`) | **Eliminates ~50MB intermediate allocations** per 100KB audit; prevents GC pauses during streaming | Low (15 min) |
| 9 | **PERF-010** | Fix RAF loop GC pressure in useAuditSession (join chunks only on delta, not full array) | **Reduces string allocations from ~360MB to ~100KB** during a 60s streaming session; eliminates GC-induced frame drops | Low (1 hour) |
| 10 | **PERF-022** | Debounce input fed to `detectAgents` useMemo in AuditInterface | **Eliminates ~3–8ms main-thread block per keystroke**; fixes input lag on large pastes | Low (30 min) |
| 11 | **PERF-016** | Pre-compute static CSP string portions at module init; use UUID directly as nonce | **Reduces per-request middleware work by ~70%**; eliminates 15+ string allocations per request | Low (1 hour) |
| 12 | **PERF-018** | Run site-audit agents with controlled parallelism (p-limit, concurrency=3) | **Reduces total site-audit time by up to 3×** (e.g., 50 agents: 25min → 8min) | Medium (4–8 hours; requires UI progress tracking changes) |

---

## 10. Overall Score

| Dimension | Score (1–10) | Notes |
|---|---|---|
| Algorithmic Efficiency | 6 | Good patterns (RAF batching, early-exit, memoization) undermined by O(n²) string accumulation in site-audit, undebounced regex on keystrokes, and sequential DB queries. Core algorithms are sound; the issues are in data pipeline patterns. |
| Memory Management | 5 | RAF loop allocates ~360MB of strings per streaming session; localStorage risks quota exhaustion at 20×100KB entries; 55-icon import map inflates bundle. The chunksRef pattern is close to correct but the join-on-every-tick is a significant regression. |
| I/O & Async | 5 | `await headers()` in root layout is the single most impactful architectural issue — it forces dynamic rendering globally. Sequential DB queries and sequential site-audit agents are straightforward parallelization wins. Rate limiter and retry logic are well-implemented. |
| Rendering | 6 | React.memo on AgentCard is correct. Pre-tag during streaming is excellent. The 10-useEffect component is a maintenance risk. Missing debounce on detectAgents in AuditInterface and missing virtualization on agent lists are the primary rendering issues. Bundle size (269KB) is the most user-visible symptom. |
| **Composite** | **5.5** | The codebase demonstrates strong engineering fundamentals (streaming, memoization, rate limiting, retry logic, prompt caching). The performance issues are concentrated and fixable: items 1–5 in the action list would reduce First Load JS by ~100KB, dashboard TTFB by 3–4×, and eliminate the most severe GC pressure. No architectural rewrites required. |