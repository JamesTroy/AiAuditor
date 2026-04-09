'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { agents as allAgents } from '@/lib/agents/registry';
import { detectAgents } from '@/lib/detectAgents';
import SafeMarkdown from '@/components/markdownComponents';
import { saveAudit } from '@/lib/history';
import { friendlyError } from '@/lib/friendlyError';
import { useSession } from '@/lib/auth-client';
import { parseAuditResult } from '@/lib/parseAuditResult';
import { deduplicateFindings, type DeduplicationResult } from '@/lib/deduplicateFindings';

// ---------- Constants ----------

// A realistic snippet with several intentional issues across multiple categories.
// Used by the "Try a sample" button to give first-time users an immediate demo.
const SAMPLE_CODE = `// pages/api/users.js — Next.js API route
import db from '../lib/db';

const ADMIN_SECRET = 'sk-prod-8f72jd92kl0p3mn';  // ← hardcoded secret

export default async function handler(req, res) {
  const { id } = req.query;

  // Fetch user — SQL built by string concat
  const user = await db.query('SELECT * FROM users WHERE id = ' + id);

  if (req.method === 'POST') {
    const { name, email, password } = req.body;

    // Password stored in plain text, no validation
    await db.query(
      \`INSERT INTO users (name, email, password, role)
       VALUES ('\${name}', '\${email}', '\${password}', 'admin')\`
    );

    console.log('Created user:', req.body);   // leaks PII to logs
    res.status(200).json({ success: true, secret: ADMIN_SECRET });

  } else {
    // No auth check — anyone can read any user by ID
    res.status(200).json(user.rows[0]);
  }
}
`.trim();

/**
 * Default agent IDs — the most universally useful set for any code.
 * detectAgents() may add more based on what's in the paste.
 */
const SEED_IDS = new Set([
  'security',
  'code-quality',
  'performance',
  'error-handling',
  'auth-review',
  'data-security',
]);

const CATEGORIES = [
  'Security & Privacy',
  'Code Quality',
  'Performance',
  'Infrastructure',
  'Design',
  'SEO',
  'Marketing',
  'Monetization',
  'AI / LLM',
  'Testing',
  'Data Engineering',
  'Developer Experience',
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  'Security & Privacy': 'border-red-500/40',
  'Code Quality': 'border-blue-500/40',
  'Performance': 'border-amber-500/40',
  'Infrastructure': 'border-cyan-500/40',
  'Design': 'border-violet-500/40',
  'SEO': 'border-emerald-500/40',
  'Marketing': 'border-pink-500/40',
  'Monetization': 'border-yellow-500/40',
  'AI / LLM': 'border-purple-500/40',
  'Testing': 'border-lime-500/40',
  'Data Engineering': 'border-orange-500/40',
  'Developer Experience': 'border-teal-500/40',
};

const DOT_COLORS: Record<string, string> = {
  'text-red-400': 'bg-red-500',
  'text-blue-400': 'bg-blue-500',
  'text-yellow-400': 'bg-yellow-500',
  'text-green-400': 'bg-green-500',
  'text-orange-400': 'bg-orange-500',
  'text-cyan-400': 'bg-cyan-500',
  'text-slate-300': 'bg-slate-500',
  'text-amber-400': 'bg-amber-500',
  'text-pink-400': 'bg-pink-500',
  'text-teal-400': 'bg-teal-500',
  'text-violet-400': 'bg-violet-500',
  'text-indigo-400': 'bg-indigo-500',
  'text-emerald-400': 'bg-emerald-500',
  'text-lime-400': 'bg-lime-500',
  'text-rose-400': 'bg-rose-500',
  'text-fuchsia-400': 'bg-fuchsia-500',
  'text-purple-400': 'bg-purple-500',
  'text-sky-400': 'bg-sky-500',
};

function dotColor(accentClass: string): string {
  return (
    DOT_COLORS[accentClass.split(' ').find((cls) => cls in DOT_COLORS) ?? ''] ?? 'bg-zinc-500'
  );
}

// ---------- Panel ----------

export default function CodeAuditPanel() {
  const { data: session } = useSession();

  // --- Input ---
  const [code, setCode] = useState('');
  const [runtimeContext, setRuntimeContext] = useState('');
  const [runtimeContextOpen, setRuntimeContextOpen] = useState(false);

  // --- Auto-detection result ---
  const [autoDetectInfo, setAutoDetectInfo] = useState<{
    language: string | null;
    framework: string | null;
    addedIds: string[];
  } | null>(null);

  // --- Agent Selection ---
  const [selected, setSelected] = useState<Set<string>>(() => new Set(SEED_IDS));
  const [pickerOpen, setPickerOpen] = useState(false);
  // Tracks which category to highlight when the picker opens based on detection
  const [suggestedCategory, setSuggestedCategory] = useState<string | null>(null);

  // --- Run state ---
  const [result, setResult] = useState('');
  // Per-agent streaming text — rendered in separate divs so content from
  // early agents never inserts above the current scroll position.
  const [agentStreamingTexts, setAgentStreamingTexts] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [runningIndices, setRunningIndices] = useState<Set<number>>(new Set());
  const [completedIndices, setCompletedIndices] = useState<Set<number>>(new Set());

  // --- Synthesis ---
  type SynthStatus = 'idle' | 'loading' | 'done' | 'error';
  const [synthesis, setSynthesis] = useState('');
  const [synthStatus, setSynthStatus] = useState<SynthStatus>('idle');
  const [synthError, setSynthError] = useState('');

  // --- Deduplication ---
  const [dedupExpanded, setDedupExpanded] = useState(false);

  // AU-015: Session persistence for anonymous users
  const [restoredFromSession, setRestoredFromSession] = useState(false);
  // Badge list collapsed by default so it never blocks scroll
  const [badgesOpen, setBadgesOpen] = useState(false);

  const abortRef = useRef<AbortController | null>(null);
  const synthAbortRef = useRef<AbortController | null>(null);
  const resultEndRef = useRef<HTMLDivElement>(null);

  // Ordered list of currently-selected agents (stable across a run)
  const selectedAgents = useMemo(
    () => allAgents.filter((a) => selected.has(a.id)),
    [selected],
  );

  // Cross-agent deduplication — computed once all agents complete
  const dedupResult = useMemo<DeduplicationResult | null>(() => {
    if (loading || agentStreamingTexts.length === 0) return null;
    const agentSets = agentStreamingTexts
      .map((text, i) => {
        if (!text) return null;
        const agent = selectedAgents[i];
        if (!agent) return null;
        const metrics = parseAuditResult(text);
        return { agentId: agent.id, agentName: agent.name, findings: metrics.findings };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
    if (agentSets.length < 2) return null;
    return deduplicateFindings(agentSets);
  }, [loading, agentStreamingTexts, selectedAgents]);

  // Group all agents by category for the picker
  const grouped = useMemo(() => {
    const map = new Map<string, typeof allAgents>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const a of allAgents) {
      const list = map.get(a.category);
      if (list) list.push(a);
    }
    return map;
  }, []);

  // ---------- Auto-detect on paste ----------
  const handleCodeChange = useCallback(
    (value: string) => {
      setCode(value);
      if (loading) return;

      const detection = detectAgents(value);
      const newIds = detection.recommendedAgents.filter(
        (id) => allAgents.some((a) => a.id === id) && !selected.has(id),
      );

      if (newIds.length > 0) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of newIds) next.add(id);
          return next;
        });
      }

      if (detection.language || detection.framework || newIds.length > 0) {
        setAutoDetectInfo({
          language: detection.language,
          framework: detection.framework,
          addedIds: newIds,
        });
        // Pick the most relevant category to highlight in the picker
        const tag = detection.framework ?? detection.language;
        const cat =
          tag && ['react', 'nextjs', 'vue', 'angular', 'svelte', 'solidjs', 'astro', 'tailwind', 'remix'].includes(tag)
            ? 'Design'
            : tag && ['express', 'nestjs', 'fastify', 'hono', 'trpc', 'graphql', 'websocket'].includes(tag)
              ? 'Infrastructure'
              : detection.patterns.includes('auth') || detection.patterns.includes('sql')
                ? 'Security & Privacy'
                : detection.patterns.includes('testing')
                  ? 'Testing'
                  : 'Code Quality';
        setSuggestedCategory(cat);
      } else {
        setAutoDetectInfo(null);
        setSuggestedCategory(null);
      }
    },
    [loading, selected],
  );

  // ---------- Selection helpers ----------
  const toggleAgent = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectCategory = useCallback((cat: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = allAgents.filter((a) => a.category === cat).map((a) => a.id);
      for (const id of ids) on ? next.add(id) : next.delete(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelected(new Set(allAgents.map((a) => a.id))), []);
  const clearAll = useCallback(() => setSelected(new Set()), []);
  const resetDefaults = useCallback(() => setSelected(new Set(SEED_IDS)), []);

  // ---------- Timer ----------
  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  // Auto-scroll removed — the sticky progress bar shows run status without
  // fighting manual scrolling. scrollIntoView on every result chunk caused
  // scroll jumps and lock-up during full audits.

  // Abort on unmount
  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      synthAbortRef.current?.abort();
    };
  }, []);

  // AU-015: Restore last audit from sessionStorage for anonymous users
  useEffect(() => {
    if (session) return; // logged-in users have real history
    try {
      const saved = sessionStorage.getItem('aiaudit:last-code-audit');
      if (saved) {
        const { result: r } = JSON.parse(saved) as { result: string };
        if (r) { setResult(r); setRestoredFromSession(true); }
      }
    } catch { /* ignore */ }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // AU-015: Persist completed audit to sessionStorage for anonymous users
  useEffect(() => {
    if (loading || !result) return;
    try {
      sessionStorage.setItem('aiaudit:last-code-audit', JSON.stringify({ result }));
    } catch { /* ignore */ }
  }, [loading, result]);

  // ---------- Single-agent streaming ----------
  async function streamSingleAudit(
    agentId: string,
    input: string,
    signal: AbortSignal,
    onChunk: (text: string) => void,
    extraContext?: string,
  ): Promise<string> {
    const body: Record<string, unknown> = { agentType: agentId, input };
    if (extraContext) body.runtimeContext = extraContext;
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal,
    });

    if (res.status === 401 || res.status === 403) {
      throw new Error('Your session expired. Please sign in again to continue.');
    }
    if (!res.ok || !res.body) {
      const text = await res.text();
      throw new Error(friendlyError(text || `Error ${res.status}`));
    }

    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    const chunks: string[] = [];
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const text = decoder.decode(value, { stream: true });
        chunks.push(text);
        onChunk(text);
      }
    } finally {
      reader.releaseLock();
    }
    return chunks.join('');
  }

  // ---------- Run audit ----------
  const runCodeAudit = useCallback(async () => {
    const trimmed = code.trim();
    if (!trimmed || loading || selected.size === 0) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setResult('');
    setAgentStreamingTexts([]);
    setError('');
    setRunningIndices(new Set());
    setCompletedIndices(new Set());
    setSynthError('');
    setSynthStatus('idle');
    setSynthesis('');
    setDedupExpanded(false);
    setPickerOpen(false);
    setBadgesOpen(false);
    setRestoredFromSession(false);
    try { sessionStorage.removeItem('aiaudit:last-code-audit'); } catch { /* ignore */ }

    const agentsToRun = allAgents.filter((a) => selected.has(a.id));
    const CONCURRENCY = 10;
    const agentResults: string[] = new Array(agentsToRun.length).fill('');

    function rebuildResultNow() {
      // Update per-agent state for scroll-stable streaming display.
      setAgentStreamingTexts([...agentResults]);
      // Also keep the combined string for synthesis/copy/download/session storage.
      const parts: string[] = [];
      for (let i = 0; i < agentsToRun.length; i++) {
        if (agentResults[i]) {
          const header = `\n\n${'='.repeat(60)}\n## ${agentsToRun[i].name} Audit\n${'='.repeat(60)}\n\n`;
          parts.push(header + agentResults[i]);
        }
      }
      setResult(parts.join(''));
    }

    // PERF-003: Debounce result rebuilding during streaming to prevent 100+ renders/sec
    // with multiple concurrent agents. Flush immediately on agent completion.
    let rebuildTimer: ReturnType<typeof setTimeout> | null = null;
    function rebuildResult() {
      if (rebuildTimer) clearTimeout(rebuildTimer);
      rebuildTimer = setTimeout(rebuildResultNow, 50);
    }
    function rebuildResultImmediate() {
      if (rebuildTimer) clearTimeout(rebuildTimer);
      rebuildTimer = null;
      rebuildResultNow();
    }

    let activeCount = 0;
    let nextIndex = 0;

    async function runAgent(i: number) {
      const agent = agentsToRun[i];
      setRunningIndices((prev) => new Set(prev).add(i));

      try {
        const agentResult = await streamSingleAudit(
          agent.id,
          trimmed,
          abortRef.current!.signal,
          (chunk) => {
            agentResults[i] += chunk;
            rebuildResult();
          },
          runtimeContext.trim() || undefined,
        );
        agentResults[i] = agentResult;
        rebuildResultImmediate();

        saveAudit({
          agentId: agent.id,
          agentName: agent.name,
          inputSnippet: trimmed.slice(0, 100) + (trimmed.length > 100 ? '…' : ''),
          result: agentResult,
          timestamp: Date.now(),
        });
      } catch (err: unknown) {
        if (err instanceof Error && err.name === 'AbortError') return;
        const errMsg = err instanceof Error ? err.message : String(err);
        agentResults[i] += `\n\n[Error: ${errMsg}]\n`;
        rebuildResult();
      } finally {
        setRunningIndices((prev) => { const next = new Set(prev); next.delete(i); return next; });
        setCompletedIndices((prev) => new Set(prev).add(i));
        activeCount--;
      }
    }

    try {
      await new Promise<void>((resolveAll) => {
        function tryNext() {
          while (activeCount < CONCURRENCY && nextIndex < agentsToRun.length) {
            if (abortRef.current?.signal.aborted) break;
            const i = nextIndex++;
            activeCount++;
            runAgent(i).then(tryNext);
          }
          if (activeCount === 0 && nextIndex >= agentsToRun.length) resolveAll();
        }
        tryNext();
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') setError(err.message);
    } finally {
      setLoading(false);
      setRunningIndices(new Set());
    }
  }, [code, loading, selected, runtimeContext]);

  function handleStop() {
    abortRef.current?.abort();
    setResult((prev) => prev ? `${prev}\n\n---\n*Audit stopped by user.*` : prev);
    setLoading(false);
    setRunningIndices(new Set());
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([result], { type: 'text/markdown' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `code-audit-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  // ---------- Synthesis ----------
  const runSynthesis = useCallback(async () => {
    if (synthStatus === 'loading' || !result) return;
    synthAbortRef.current?.abort();
    synthAbortRef.current = new AbortController();
    setSynthStatus('loading');
    setSynthesis('');
    setSynthError('');

    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: result, expectedAgentCount: selected.size }),
        signal: synthAbortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        setSynthError(await res.text() || `Error ${res.status}`);
        setSynthStatus('error');
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (synthAbortRef.current?.signal.aborted) return;
        chunks.push(decoder.decode(value, { stream: true }));
        setSynthesis(chunks.join(''));
      }
      setSynthesis(chunks.join(''));
      setSynthStatus('done');
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setSynthStatus('error');
      if (err instanceof Error) setSynthError(err.message);
    }
  }, [result, synthStatus]);

  // ---------- Render ----------
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 pb-12">
      <div className="max-w-4xl mx-auto">

        {/* Code Input */}
        <div className="mb-3">
          <textarea
            id="code-input"
            value={code}
            onChange={(e) => handleCodeChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && !loading && selected.size > 0 && code.trim()) {
                runCodeAudit();
              }
            }}
            placeholder={`Paste your code here…\n\nAny language: TypeScript, Python, Go, SQL, Rust, Java…\nAny size: a single file, a module, or a whole feature.\n\nAuditors auto-select based on what you paste. Press ⌘↵ to run.`}
            disabled={loading}
            rows={12}
            className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-5 py-4 text-sm font-mono text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 resize-y min-h-[180px] disabled:opacity-50"
            aria-label="Code to audit"
          />
        </div>

        {/* Sample code button — only shown when textarea is empty */}
        {!code && !loading && !result && (
          <div className="mb-3 flex items-center gap-2">
            <button
              onClick={() => handleCodeChange(SAMPLE_CODE)}
              className="inline-flex items-center gap-1.5 text-xs px-3 py-1.5 rounded-full border border-dashed border-gray-300 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:border-violet-400 dark:hover:border-violet-500 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 010 1.972l-11.54 6.347a1.125 1.125 0 01-1.667-.986V5.653z" />
              </svg>
              Try a sample
            </button>
            <span className="text-xs text-gray-400 dark:text-zinc-600">— see what a real audit looks like</span>
          </div>
        )}

        {/* Auto-detect badge */}
        {autoDetectInfo && !loading && !result && (
          <div className="mb-3 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300">
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              {[
                autoDetectInfo.language,
                autoDetectInfo.framework,
              ].filter(Boolean).join(' + ') || 'Code'} detected
              {autoDetectInfo.addedIds.length > 0 && ` — ${autoDetectInfo.addedIds.length} auditors auto-added`}
            </span>
          </div>
        )}

        {/* Runtime context — collapsible */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setRuntimeContextOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
            aria-expanded={runtimeContextOpen}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${runtimeContextOpen ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Add runtime context
            {runtimeContext.trim() && !runtimeContextOpen && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] font-medium">
                active
              </span>
            )}
          </button>
          {runtimeContextOpen && (
            <div className="mt-2">
              <textarea
                value={runtimeContext}
                onChange={(e) => setRuntimeContext(e.target.value)}
                disabled={loading}
                rows={4}
                maxLength={15000}
                placeholder={`Optional: paste a stack trace, error log, or runtime env info.\n\nExamples:\n  - A TypeError with line numbers\n  - Relevant environment variables (redact secrets)\n  - A curl request / response pair that's misbehaving`}
                className="w-full bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-xs font-mono text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 resize-y disabled:opacity-50"
                aria-label="Runtime context (optional)"
              />
              <p className="mt-1 text-[11px] text-gray-400 dark:text-zinc-600 flex justify-between">
                <span>Stack traces and logs help auditors distinguish theoretical issues from confirmed runtime failures.</span>
                <span>{runtimeContext.length}/15000</span>
              </p>
            </div>
          )}
        </div>

        {/* Privacy note */}
        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          Your code is analyzed in memory and immediately discarded — never stored, never shared, never used for training.
        </p>

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <button
            id="run-audit-btn"
            onClick={runCodeAudit}
            disabled={loading || !code.trim() || selected.size === 0}
            className="flex-1 sm:flex-none px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-ring whitespace-nowrap"
          >
            {loading
              ? `Auditing… ${completedIndices.size}/${selectedAgents.length} complete`
              : selected.size === 1
                ? 'Run 1 Audit'
                : `Run ${selected.size} Audits`}
          </button>
          {loading && (
            <button
              onClick={handleStop}
              className="px-6 py-3.5 rounded-xl text-base text-gray-600 dark:text-zinc-400 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors focus-ring"
            >
              Stop
            </button>
          )}
        </div>

        {/* Agent Picker */}
        {!loading && !result && (
          <div className="mb-8">
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 transition-colors mb-3 group"
              aria-expanded={pickerOpen}
            >
              <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-300 min-w-0">
                <svg
                  className={`w-4 h-4 shrink-0 transition-transform text-gray-400 dark:text-zinc-500 ${pickerOpen ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium shrink-0">
                  {selected.size} auditor{selected.size !== 1 ? 's' : ''} selected
                </span>
                {!pickerOpen && selectedAgents.length > 0 && (
                  <span className="hidden sm:flex items-center gap-1 min-w-0 overflow-hidden">
                    {selectedAgents.slice(0, 4).map((a) => (
                      <span key={a.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400 shrink-0">
                        <span className={`w-1.5 h-1.5 rounded-full ${dotColor(a.accentClass)}`} />
                        {a.name}
                      </span>
                    ))}
                    {selectedAgents.length > 4 && (
                      <span className="text-xs text-gray-400 dark:text-zinc-500 shrink-0">+{selectedAgents.length - 4} more</span>
                    )}
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300 transition-colors shrink-0 ml-2">
                {pickerOpen ? 'Close' : 'Customize'}
              </span>
            </button>

            {pickerOpen && (
              <div className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4">
                {/* Global controls */}
                <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-zinc-800">
                  <button
                    onClick={selectAll}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Select All ({allAgents.length})
                  </button>
                  <button
                    onClick={resetDefaults}
                    className="text-xs px-3 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                  >
                    Defaults ({SEED_IDS.size})
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Clear
                  </button>
                  <span className="ml-auto text-xs text-gray-400 dark:text-zinc-500 self-center">
                    {allAgents.length} auditors available
                  </span>
                </div>

                {/* Smart suggestion tip */}
                {suggestedCategory && (
                  <div className="mb-3 flex items-center gap-2 px-3 py-2 rounded-lg bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800/60 text-xs text-violet-700 dark:text-violet-300">
                    <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                    </svg>
                    Based on your code, <strong className="font-semibold">{suggestedCategory}</strong> auditors are highlighted below.
                  </div>
                )}

                {/* Category sections */}
                <div className="space-y-4">
                  {Array.from(grouped.entries()).map(([cat, catAgents]) => {
                    if (catAgents.length === 0) return null;
                    const allSelected = catAgents.every((a) => selected.has(a.id));
                    const someSelected = catAgents.some((a) => selected.has(a.id));
                    const isHighlighted = suggestedCategory === cat;
                    return (
                      <div key={cat} className={isHighlighted ? 'rounded-lg ring-1 ring-violet-400/40 dark:ring-violet-600/40 bg-violet-50/40 dark:bg-violet-950/20 p-2 -mx-2' : ''}>
                        <div className="flex items-center justify-between mb-2">
                          <button
                            onClick={() => selectCategory(cat, !allSelected)}
                            className={`text-xs font-semibold uppercase tracking-widest pl-2 border-l-2 ${CATEGORY_COLORS[cat] ?? 'border-zinc-500/40'} text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors`}
                          >
                            {cat}
                            <span className="ml-1.5 text-gray-400 dark:text-zinc-500 font-normal normal-case tracking-normal">
                              ({catAgents.filter((a) => selected.has(a.id)).length}/{catAgents.length})
                            </span>
                          </button>
                          <button
                            onClick={() => selectCategory(cat, !allSelected)}
                            className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors"
                          >
                            {allSelected ? 'deselect all' : someSelected ? 'select all' : 'select all'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {catAgents.map((agent) => {
                            const isSelected = selected.has(agent.id);
                            return (
                              <label
                                key={agent.id}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-white dark:bg-zinc-800 shadow-sm' : 'hover:bg-white dark:hover:bg-zinc-800/50'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleAgent(agent.id)}
                                  className="sr-only"
                                />
                                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${isSelected ? 'bg-violet-600 border-violet-600' : 'border-gray-300 dark:border-zinc-600'}`}>
                                  {isSelected && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </span>
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(agent.accentClass)}`} />
                                <span className="text-sm text-gray-700 dark:text-zinc-300 truncate">{agent.name}</span>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Progress bar — sticky during run, always compact (progress bar only, no badge list) */}
        {loading && selectedAgents.length > 0 && (
          <div className="mb-3 sticky top-0 z-10 bg-gray-50/95 dark:bg-zinc-950/95 backdrop-blur-sm py-3 -mx-6 px-6">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                {completedIndices.size === selectedAgents.length
                  ? 'All audits complete'
                  : runningIndices.size > 0
                    ? `Running ${runningIndices.size} audits in parallel…`
                    : 'Preparing…'}
              </span>
              <span className="text-xs font-mono text-gray-500 dark:text-zinc-500">
                {completedIndices.size}/{selectedAgents.length} complete · {elapsed}s
              </span>
            </div>
            <div className="w-full h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                style={{ width: `${(completedIndices.size / selectedAgents.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Agent badge list — collapsible so it never blocks scroll */}
        {(loading || (!loading && result)) && (
          <div className="mb-6">
            {/* Summary toggle row */}
            <button
              type="button"
              onClick={() => setBadgesOpen((o) => !o)}
              className="flex items-center gap-2 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors mb-2"
              aria-expanded={badgesOpen}
            >
              <svg
                className={`w-3.5 h-3.5 transition-transform ${badgesOpen ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              {loading ? (
                <span>
                  <span className="font-medium text-violet-600 dark:text-violet-400">{runningIndices.size} running</span>
                  {completedIndices.size > 0 && <span className="text-gray-400 dark:text-zinc-500"> · {completedIndices.size} done</span>}
                  {selectedAgents.length - runningIndices.size - completedIndices.size > 0 && (
                    <span className="text-gray-400 dark:text-zinc-500"> · {selectedAgents.length - runningIndices.size - completedIndices.size} queued</span>
                  )}
                </span>
              ) : (
                <span><span className="font-medium">{selectedAgents.length} auditors complete</span> — click to jump to any section</span>
              )}
            </button>

            {/* Expanded badge list */}
            {badgesOpen && (
              <div className="flex flex-wrap gap-1.5 p-3 rounded-xl bg-gray-50 dark:bg-zinc-900/60 border border-gray-200 dark:border-zinc-800">
                {selectedAgents.map((agent, i) => {
                  const isActive = loading && runningIndices.has(i);
                  const isDone = completedIndices.has(i);
                  const isPending = loading && !isActive && !isDone;

                  if (!loading && result) {
                    const sectionId = `${agent.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-audit`;
                    return (
                      <button
                        key={agent.id}
                        onClick={() => document.getElementById(sectionId)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:ring-1 hover:ring-violet-500/40 hover:text-violet-600 dark:hover:text-violet-300"
                      >
                        <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                        {agent.name}
                      </button>
                    );
                  }

                  return (
                    <span
                      key={agent.id}
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all duration-300 ${
                        isActive
                          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30 shadow-sm'
                          : isDone
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : 'bg-gray-100/50 dark:bg-zinc-900 text-gray-400 dark:text-zinc-600'
                      }`}
                    >
                      {isActive && <span className={`w-2 h-2 rounded-full ${dotColor(agent.accentClass)} animate-pulse flex-shrink-0`} />}
                      {isDone && (
                        <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                        </svg>
                      )}
                      {isPending && <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-zinc-700 flex-shrink-0" />}
                      {agent.name}
                    </span>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Error */}
        {error && (
          <div role="alert" className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-300 text-sm mb-6 motion-safe:animate-fade-up">
            {error}
          </div>
        )}

        {/* Streaming indicator */}
        {loading && !result && (
          <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-500 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
            <span>Dispatching auditors… <span className="text-xs text-gray-400 dark:text-zinc-600">(usually under 30s)</span></span>
          </div>
        )}

        {/* AU-015: Session restore banner for anonymous users */}
        {restoredFromSession && !session && (
          <div className="mb-4 flex items-start gap-3 px-4 py-3 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 text-sm">
            <svg className="w-4 h-4 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z" /></svg>
            <span className="text-violet-800 dark:text-violet-300">
              Last audit restored from this browser session.{' '}
              <a href="/signup?callbackUrl=/audit" className="font-semibold underline underline-offset-2 hover:text-violet-600 dark:hover:text-violet-200 transition-colors">Create a free account</a>
              {' '}to save history permanently.
            </span>
          </div>
        )}

        {/* Results panel */}
        {(result || loading) && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 border-t-2 border-t-violet-500/50 rounded-lg overflow-hidden">
            <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2 border-b border-gray-200 dark:border-zinc-800">
              <span className="text-xs font-mono uppercase tracking-widest">
                {loading ? (
                  <span className="flex items-center gap-1.5 text-violet-400">
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                    {runningIndices.size > 0
                      ? `Auditing — ${completedIndices.size} of ${selectedAgents.length} complete`
                      : 'Starting…'}
                  </span>
                ) : (
                  `Code Audit Results — ${selectedAgents.length} auditors`
                )}
              </span>
              {!loading && result && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={runCodeAudit}
                    className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 min-h-[44px] rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors focus-ring"
                  >
                    Re-audit
                  </button>
                  <button
                    onClick={handleCopy}
                    className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 min-h-[44px] rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors focus-ring"
                  >
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                  <button
                    onClick={handleDownload}
                    className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 min-h-[44px] rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors focus-ring"
                  >
                    Download .md
                  </button>
                </div>
              )}
            </div>
            <div className="p-6 prose prose-sm max-w-prose dark:prose-invert">
              {loading ? (
                <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-zinc-200 m-0 p-0 bg-transparent">
                  {result}
                  <span className="animate-blink"> ▍</span>
                </pre>
              ) : (
                <SafeMarkdown>{result}</SafeMarkdown>
              )}
              <div ref={resultEndRef} />
            </div>
            {!loading && result && (
              <div className="px-4 py-2 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-1.5 text-[11px] text-gray-400 dark:text-zinc-500">
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
                </svg>
                AI-generated — findings may contain errors. Verify critical issues before acting.
              </div>
            )}
          </div>
        )}

        {/* Cross-agent deduplication summary */}
        {!loading && dedupResult && dedupResult.duplicateGroups.length > 0 && (
          <div className="mt-4 rounded-xl border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 overflow-hidden">
            <button
              onClick={() => setDedupExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 text-left focus-ring"
              aria-expanded={dedupExpanded}
            >
              <div className="flex items-center gap-2 text-sm font-medium text-amber-800 dark:text-amber-300">
                <span>⚠</span>
                <span>
                  {dedupResult.duplicateGroups.length === 1
                    ? '1 issue flagged by multiple auditors'
                    : `${dedupResult.duplicateGroups.length} issues flagged by multiple auditors`}
                  {' '}
                  <span className="font-normal text-amber-700 dark:text-amber-400">
                    — these are the same underlying problem, not separate issues
                  </span>
                </span>
              </div>
              <span className="text-amber-600 dark:text-amber-400 text-xs ml-4 shrink-0">
                {dedupExpanded ? 'Hide' : 'Show'}
              </span>
            </button>

            {dedupExpanded && (
              <div className="border-t border-amber-200 dark:border-amber-800 divide-y divide-amber-100 dark:divide-amber-900">
                {dedupResult.duplicateGroups.map((group, gi) => (
                  <div key={gi} className="px-4 py-3">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`w-2 h-2 rounded-full shrink-0 ${
                        group.highestSeverity === 'critical' ? 'bg-red-500' :
                        group.highestSeverity === 'high' ? 'bg-orange-500' :
                        group.highestSeverity === 'medium' ? 'bg-amber-500' :
                        'bg-slate-400'
                      }`} />
                      <span className="text-sm text-amber-900 dark:text-amber-200 font-medium">
                        {group.title}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 pl-4">
                      {group.entries.map((entry, ei) => (
                        <span
                          key={ei}
                          className="text-[11px] px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-400"
                        >
                          {entry.agentName}
                          {entry.finding.severity !== group.highestSeverity && (
                            <span className="opacity-60 ml-1">({entry.finding.severity})</span>
                          )}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
                <div className="px-4 py-2.5 text-xs text-amber-600 dark:text-amber-500">
                  {dedupResult.uniqueCount} unique issue{dedupResult.uniqueCount !== 1 ? 's' : ''} from {dedupResult.totalFindings} total findings across all auditors
                </div>
              </div>
            )}
          </div>
        )}

        {/* Synthesis / roadmap */}
        {!loading && result && (
          <div className="mt-6">
            {synthStatus === 'idle' && (
              <div>
                {!session && (
                  <div className="mb-4 p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 flex items-start gap-3">
                    <svg className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    <div>
                      <p className="font-medium text-violet-900 dark:text-violet-200 text-sm">Create a free account to unlock more</p>
                      <p className="text-xs text-violet-700 dark:text-violet-400 mt-1">Sign up to save audit results to your dashboard, track scores over time, and generate remediation roadmaps.</p>
                      <a href="/signup?callbackUrl=/audit" className="inline-block mt-2 text-xs font-semibold text-violet-600 dark:text-violet-300 hover:text-violet-500 underline underline-offset-2">Create free account →</a>
                    </div>
                  </div>
                )}
                {session && (
                  <>
                    <button
                      onClick={runSynthesis}
                      className="w-full py-3.5 rounded-xl font-semibold text-base text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all focus-ring flex items-center justify-center gap-2"
                    >
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                      </svg>
                      Generate Remediation Roadmap
                    </button>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-2 text-center">
                      Turn your findings into a step-by-step fix plan, prioritized by severity and effort.
                    </p>
                  </>
                )}
              </div>
            )}

            {synthError && (
              <div role="alert" className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-300 text-sm mt-3 motion-safe:animate-fade-up">
                {synthError}
              </div>
            )}

            {(synthesis || synthStatus === 'loading') && (
              <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 border-t-2 border-t-indigo-500/50 rounded-lg overflow-hidden mt-3">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-zinc-800">
                  <span className="text-xs font-mono uppercase tracking-widest">
                    {synthStatus === 'loading' ? (
                      <span className="flex items-center gap-1.5 text-indigo-400">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 animate-pulse" />
                        Synthesizing findings…
                      </span>
                    ) : 'Remediation Roadmap'}
                  </span>
                </div>
                <div className="p-6 prose prose-sm max-w-prose dark:prose-invert">
                  {synthStatus === 'loading' ? (
                    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-zinc-200 m-0 p-0 bg-transparent">
                      {synthesis}
                      <span className="animate-blink"> ▍</span>
                    </pre>
                  ) : (
                    <SafeMarkdown>{synthesis}</SafeMarkdown>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Idle state: what you get */}
        {!loading && !result && !error && !pickerOpen && selected.size > 0 && (
          <div className="space-y-6">
            <div className="flex flex-wrap gap-2">
              {selectedAgents.map((agent) => (
                <span
                  key={agent.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
                >
                  <span className={`w-2 h-2 rounded-full ${dotColor(agent.accentClass)}`} />
                  {agent.name}
                </span>
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              {[
                {
                  label: 'Severity-rated findings',
                  desc: 'Critical, High, Medium, Low',
                  icon: <svg className="w-5 h-5 text-red-500 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg>,
                },
                {
                  label: 'Line-level references',
                  desc: 'Exact file and line numbers',
                  icon: <svg className="w-5 h-5 text-blue-500 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>,
                },
                {
                  label: 'Fix suggestions',
                  desc: 'Copy-paste remediation steps',
                  icon: <svg className="w-5 h-5 text-green-500 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>,
                },
              ].map((item) => (
                <div key={item.label} className="px-4 py-4 rounded-xl bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800">
                  {item.icon}
                  <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{item.label}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
}
