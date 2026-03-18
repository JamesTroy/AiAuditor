'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { agents as allAgents } from '@/lib/agents/registry';
import SafeMarkdown from '@/components/markdownComponents';
import { saveAudit } from '@/lib/history';
import { friendlyError } from '@/lib/friendlyError';
import { useSession } from '@/lib/auth-client';
import {
  SITE_AUDIT_CONCURRENCY,
  MIN_CONCURRENCY,
  ERROR_RATE_THRESHOLD,
  CONCURRENCY_BACKOFF_FACTOR,
  CONCURRENCY_RECOVERY_MS,
  MAX_TOKENS_PER_RUN,
  EST_TOKENS_PER_AGENT,
  FULL_RUN_COOLDOWN_SECS,
  FULL_RUN_AGENT_THRESHOLD,
  LAUNCH_STAGGER_MS,
  INITIAL_CONCURRENCY,
  RAMP_UP_AFTER,
  RAMP_STEPS,
} from '@/lib/config/constants';

const DEFAULT_IDS = new Set([
  'security',
  'seo-performance',
  'accessibility',
  'frontend-performance',
  'responsive-design',
  'code-quality',
]);

// SAFE-005: Curated presets so users don't blindly select all 125 agents.
const PRESETS: { label: string; description: string; ids: string[] }[] = [
  {
    label: 'Quick Scan',
    description: '6 core checks — fast overview',
    ids: ['security', 'seo-performance', 'accessibility', 'frontend-performance', 'responsive-design', 'code-quality'],
  },
  {
    label: 'Security Deep Dive',
    description: '20 security & privacy auditors',
    ids: allAgents.filter(a => a.category === 'Security & Privacy').map(a => a.id),
  },
  {
    label: 'SEO & Marketing',
    description: 'Full SEO + marketing audit',
    ids: allAgents.filter(a => a.category === 'SEO' || a.category === 'Marketing').map(a => a.id),
  },
  {
    label: 'Performance Sweep',
    description: 'All performance + infrastructure',
    ids: allAgents.filter(a => a.category === 'Performance' || a.category === 'Infrastructure').map(a => a.id),
  },
  {
    label: 'Design & UX',
    description: 'Full design + accessibility review',
    ids: allAgents.filter(a => a.category === 'Design').map(a => a.id),
  },
  {
    label: 'Full Audit',
    description: `All ${allAgents.length} auditors — takes longer`,
    ids: allAgents.map(a => a.id),
  },
];

const CATEGORIES = ['Security & Privacy', 'Code Quality', 'Performance', 'Infrastructure', 'Design', 'SEO', 'Marketing'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  'Security & Privacy': 'border-red-500/40',
  'Code Quality': 'border-blue-500/40',
  'Performance': 'border-amber-500/40',
  'Infrastructure': 'border-cyan-500/40',
  'Design': 'border-violet-500/40',
  'SEO': 'border-emerald-500/40',
  'Marketing': 'border-pink-500/40',
};

/** Map accent text color to a bg dot color. Uses a static map so Tailwind can tree-shake safely. */
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

// PERF-014: Direct key lookup instead of O(18) iteration with .includes().
function dotColor(accentClass: string): string {
  return DOT_COLORS[accentClass.split(' ').find(cls => cls in DOT_COLORS) ?? ''] ?? 'bg-zinc-500';
}

export default function SiteAuditPage() {
  const { data: session } = useSession();
  const router = useRouter();
  const searchParams = useSearchParams();
  // ONB-030: Restore URL from sessionStorage or query param (ONB-002/021: ?url= pre-fill)
  const [url, setUrl] = useState(() => {
    const qUrl = typeof window !== 'undefined' ? new URLSearchParams(window.location.search).get('url') : null;
    if (qUrl) return qUrl;
    if (typeof window !== 'undefined') return sessionStorage.getItem('claudit-audit-url') ?? '';
    return '';
  });
  const isWelcome = searchParams.get('welcome') === '1';
  // ONB-016: Track whether this is the user's first audit (for completion banner)
  const [isFirstAudit, setIsFirstAudit] = useState(false);
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(DEFAULT_IDS));
  const [pickerOpen, setPickerOpen] = useState(false);
  // PERF-002: Track running/completed per-agent for concurrent execution.
  const [runningIndices, setRunningIndices] = useState<Set<number>>(new Set());
  const [completedIndices, setCompletedIndices] = useState<Set<number>>(new Set());
  // For backwards-compat with progress display, derive currentAgentIndex from running set.
  const currentAgentIndex = runningIndices.size > 0 ? Math.min(...runningIndices) : -1;
  // SM-005: Discriminated union for synthesis state.
  type SynthStatus = 'idle' | 'loading' | 'done' | 'error';
  const [synthesis, setSynthesis] = useState('');
  const [synthStatus, setSynthStatus] = useState<SynthStatus>('idle');
  const [synthError, setSynthError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  // SM-011: AbortController for synthesis stream.
  const synthAbortRef = useRef<AbortController | null>(null);
  const resultEndRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);
  // SAFE-007: Cooldown tracking for full runs.
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownRemaining, setCooldownRemaining] = useState(0);
  // SAFE-001/003: Adaptive concurrency + error tracking for display.
  const [currentConcurrency, setCurrentConcurrency] = useState(SITE_AUDIT_CONCURRENCY);
  const [errorCount, setErrorCount] = useState(0);
  // SAFE-002: Token budget tracking.
  const [estimatedTokensUsed, setEstimatedTokensUsed] = useState(0);
  const [budgetExhausted, setBudgetExhausted] = useState(false);
  // UI: Collapse agent badges after audit completes so they don't cover the synthesis prompt.
  const [badgesCollapsed, setBadgesCollapsed] = useState(false);

  // Derive ordered list of selected agents for progress tracking
  const selectedAgents = useMemo(
    () => allAgents.filter((a) => selected.has(a.id)),
    [selected],
  );

  // Group all agents by category
  const grouped = useMemo(() => {
    const map = new Map<string, typeof allAgents>();
    for (const cat of CATEGORIES) map.set(cat, []);
    for (const a of allAgents) {
      const list = map.get(a.category);
      if (list) list.push(a);
    }
    return map;
  }, []);

  // Selection helpers
  const toggleAgent = useCallback((id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectCategory = useCallback((cat: string, on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const ids = allAgents.filter((a) => a.category === cat).map((a) => a.id);
      for (const id of ids) {
        if (on) next.add(id); else next.delete(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelected(new Set(allAgents.map((a) => a.id)));
  }, []);

  const selectDefaults = useCallback(() => {
    setSelected(new Set(DEFAULT_IDS));
  }, []);

  const clearAll = useCallback(() => {
    setSelected(new Set());
  }, []);

  const applyPreset = useCallback((ids: string[]) => {
    setSelected(new Set(ids));
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  // Auto-scroll while streaming
  useEffect(() => {
    if (!loading) { userScrolledUp.current = false; return; }
    userScrolledUp.current = false;
    function onScroll() {
      const dist = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      userScrolledUp.current = dist > 150;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loading]);

  useEffect(() => {
    if (loading && result && !userScrolledUp.current) {
      resultEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [loading, result]);

  // ONB-030: Persist URL to sessionStorage so it survives navigation
  useEffect(() => {
    if (url) sessionStorage.setItem('claudit-audit-url', url);
  }, [url]);

  useEffect(() => {
    return () => {
      abortRef.current?.abort();
      synthAbortRef.current?.abort();
    };
  }, []);

  // SAFE-007: Cooldown countdown timer.
  useEffect(() => {
    if (cooldownUntil <= Date.now()) { setCooldownRemaining(0); return; }
    const tick = () => {
      const rem = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
      setCooldownRemaining(rem);
      if (rem <= 0) clearInterval(id);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [cooldownUntil]);

  /** Stream a single audit and return the result text. */
  async function streamSingleAudit(
    agentId: string,
    siteContent: string,
    signal: AbortSignal,
    onChunk: (text: string) => void,
  ): Promise<string> {
    const res = await fetch('/api/audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentType: agentId,
        input: siteContent,
        siteAudit: true,
      }),
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

  const runSiteAudit = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || loading || selected.size === 0) return;

    // SAFE-007: Enforce cooldown for full runs.
    const agentsToRun = allAgents.filter((a) => selected.has(a.id));
    if (agentsToRun.length >= FULL_RUN_AGENT_THRESHOLD && cooldownUntil > Date.now()) {
      const secs = Math.ceil((cooldownUntil - Date.now()) / 1000);
      setError(`Please wait ${secs}s before running another full audit (${FULL_RUN_AGENT_THRESHOLD}+ agents).`);
      return;
    }

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    // ONB-016: Detect first audit by checking if any audits exist in localStorage history
    const historyKey = 'claudit-history';
    const hasHistory = typeof window !== 'undefined' && (localStorage.getItem(historyKey) ?? '[]') !== '[]';
    setIsFirstAudit(!hasHistory);

    setLoading(true);
    setResult('');
    setError('');
    setRunningIndices(new Set());
    setCompletedIndices(new Set());
    setErrorCount(0);
    setEstimatedTokensUsed(0);
    setBudgetExhausted(false);
    setCurrentConcurrency(SITE_AUDIT_CONCURRENCY);
    // SM-013: Clear synthesis errors from previous run.
    setSynthError('');
    setSynthStatus('idle');
    setSynthesis('');
    // SM-016: Close picker so results are visible.
    setPickerOpen(false);

    try {
      // Step 1: Fetch site content once
      const fetchRes = await fetch('/api/site-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
        signal: abortRef.current.signal,
      });

      if (fetchRes.status === 401 || fetchRes.status === 403) {
        setError('Your session expired. Please sign in again to continue.');
        setLoading(false);
        return;
      }
      if (!fetchRes.ok) {
        const text = await fetchRes.text();
        setError(friendlyError(text || `Error ${fetchRes.status}`));
        setLoading(false);
        return;
      }

      const siteContent = await fetchRes.text();

      // SAFE-001/002/003/006: Adaptive concurrency queue with backoff, token budget, and fairness.
      const agentResults: string[] = new Array(agentsToRun.length).fill('');
      let activeCount = 0;
      let nextIndex = 0;
      // Start at lower concurrency and ramp up gradually after agents succeed.
      let rampStep = 0;
      let concurrency = agentsToRun.length > INITIAL_CONCURRENCY ? INITIAL_CONCURRENCY : SITE_AUDIT_CONCURRENCY;
      let totalErrors = 0;
      let totalCompleted = 0;
      let tokensUsed = 0;
      let budgetHit = false;
      let backoffUntil = 0; // timestamp — pause queue until this time

      function rebuildResult() {
        const parts: string[] = [];
        for (let i = 0; i < agentsToRun.length; i++) {
          if (agentResults[i]) {
            const header = `\n\n${'='.repeat(60)}\n## ${agentsToRun[i].name} Audit\n${'='.repeat(60)}\n\n`;
            parts.push(header + agentResults[i]);
          }
        }
        setResult(parts.join(''));
      }

      // SAFE-003: Adjust concurrency based on error rate.
      function adaptConcurrency() {
        const total = totalCompleted + totalErrors;
        if (total < 3) return; // need a minimum sample
        const errorRate = totalErrors / total;
        if (errorRate > ERROR_RATE_THRESHOLD && concurrency > MIN_CONCURRENCY) {
          concurrency = Math.max(MIN_CONCURRENCY, Math.floor(concurrency * CONCURRENCY_BACKOFF_FACTOR));
          setCurrentConcurrency(concurrency);
        }
      }

      // SAFE-003: Schedule concurrency recovery.
      function scheduleRecovery() {
        setTimeout(() => {
          if (concurrency < SITE_AUDIT_CONCURRENCY) {
            concurrency = Math.min(SITE_AUDIT_CONCURRENCY, concurrency * 2);
            setCurrentConcurrency(concurrency);
            tryNext(); // fill newly available slots
          }
        }, CONCURRENCY_RECOVERY_MS);
      }

      async function runAgent(i: number) {
        const agent = agentsToRun[i];
        setRunningIndices((prev) => new Set(prev).add(i));

        try {
          const agentResult = await streamSingleAudit(
            agent.id,
            siteContent,
            abortRef.current!.signal,
            (chunk) => {
              agentResults[i] += chunk;
              rebuildResult();
            },
          );

          agentResults[i] = agentResult;
          rebuildResult();
          totalCompleted++;

          // Gradually ramp up concurrency through steps after agents succeed without errors.
          if (rampStep < RAMP_STEPS.length - 1 && totalCompleted >= RAMP_UP_AFTER * (rampStep + 1) && totalErrors === 0) {
            rampStep++;
            concurrency = RAMP_STEPS[rampStep];
            setCurrentConcurrency(concurrency);
          }

          // SAFE-002: Track estimated token usage.
          const estimatedTokens = Math.ceil(agentResult.length / 4); // rough char→token
          tokensUsed += estimatedTokens;
          setEstimatedTokensUsed(tokensUsed);
          if (tokensUsed >= MAX_TOKENS_PER_RUN) {
            budgetHit = true;
            setBudgetExhausted(true);
          }

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
          totalErrors++;
          setErrorCount(totalErrors);

          // SAFE-001: Progressive backoff on 429 / rate limit errors.
          const is429 = errMsg.includes('429') || errMsg.toLowerCase().includes('rate') || errMsg.toLowerCase().includes('too many');
          if (is429) {
            // Pause the queue for exponential backoff: 2s, 4s, 8s…
            const backoffMs = Math.min(30_000, 2_000 * 2 ** (Math.min(totalErrors, 5) - 1));
            backoffUntil = Date.now() + backoffMs;
          }

          // SAFE-003: Adapt concurrency after each error.
          adaptConcurrency();
          scheduleRecovery();
        } finally {
          setRunningIndices((prev) => { const next = new Set(prev); next.delete(i); return next; });
          setCompletedIndices((prev) => new Set(prev).add(i));
          activeCount--;
          tryNext();
        }
      }

      let resolveAll: () => void;
      const allDone = new Promise<void>((r) => { resolveAll = r; });

      let lastLaunchTime = 0;

      function tryNext() {
        // SAFE-001: Respect backoff pause.
        if (backoffUntil > Date.now()) {
          setTimeout(tryNext, backoffUntil - Date.now());
          return;
        }
        // SAFE-002: Stop queuing if token budget exhausted.
        if (budgetHit && nextIndex < agentsToRun.length) {
          // Let active agents finish but don't start new ones.
          if (activeCount === 0) resolveAll!();
          return;
        }
        // Stagger: ensure minimum gap between launches to avoid API burst.
        const elapsed = Date.now() - lastLaunchTime;
        if (elapsed < LAUNCH_STAGGER_MS && activeCount > 0) {
          setTimeout(tryNext, LAUNCH_STAGGER_MS - elapsed);
          return;
        }
        if (activeCount < concurrency && nextIndex < agentsToRun.length) {
          if (abortRef.current?.signal.aborted) return;
          if (budgetHit) return;
          const i = nextIndex++;
          activeCount++;
          lastLaunchTime = Date.now();
          runAgent(i);
          // Schedule next launch with stagger delay
          if (activeCount < concurrency && nextIndex < agentsToRun.length) {
            setTimeout(tryNext, LAUNCH_STAGGER_MS);
          }
        }
        if (activeCount === 0 && (nextIndex >= agentsToRun.length || budgetHit)) {
          resolveAll!();
        }
      }
      tryNext();
      await allDone;

      // SAFE-007: Set cooldown if this was a full run.
      if (agentsToRun.length >= FULL_RUN_AGENT_THRESHOLD) {
        setCooldownUntil(Date.now() + FULL_RUN_COOLDOWN_SECS * 1000);
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
      // ONB-030: Clear persisted URL after successful audit
      sessionStorage.removeItem('claudit-audit-url');
      setRunningIndices(new Set());
      // Auto-collapse badges so they don't cover the synthesis prompt.
      setBadgesCollapsed(true);
    }
  }, [url, loading, selected, cooldownUntil]);

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
    a.download = `site-audit-${new Date().toISOString().slice(0, 10)}.md`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const runSynthesis = useCallback(async () => {
    if (synthStatus === 'loading' || !result) return;

    // SM-011: Abort previous synthesis stream if any.
    synthAbortRef.current?.abort();
    synthAbortRef.current = new AbortController();

    setSynthStatus('loading');
    setSynthesis('');
    setSynthError('');

    try {
      const res = await fetch('/api/synthesize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ results: result }),
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
      if (err instanceof Error) setSynthError(err.message);
      setSynthStatus('error');
    }
  }, [result, synthStatus]);

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Full Site Audit
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto">
            Enter any public URL — get a severity-rated report across security, performance, accessibility, SEO, and compliance. Results stream in real time.
          </p>
          {/* ONB-025: Light personalization hint about what defaults cover */}
          {!loading && !result && (
            <p className="text-xs text-gray-400 dark:text-zinc-600 mt-2">
              Defaults cover security, SEO, accessibility, performance, responsive design, and code quality.
            </p>
          )}
        </div>

        {/* SAFE-007: Cooldown notice */}
        {cooldownRemaining > 0 && !loading && (
          <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300 flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
            Full audit cooldown: <strong>{cooldownRemaining}s</strong> remaining. You can run a smaller audit ({`<`}{FULL_RUN_AGENT_THRESHOLD} agents) now, or wait.
          </div>
        )}

        {/* URL Input */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <label htmlFor="site-url-input" className="sr-only">Website URL</label>
          <input
            id="site-url-input"
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !loading && selected.size > 0) runSiteAudit(); }}
            placeholder="https://example.com"
            required
            aria-required="true"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'site-audit-error' : undefined}
            pattern="https?://.+"
            autoComplete="url"
            disabled={loading}
            className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-5 py-3.5 text-base text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 disabled-muted-light"
          />
          <button
            onClick={runSiteAudit}
            disabled={loading || !url.trim() || selected.size === 0}
            className="px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled-muted focus-ring whitespace-nowrap"
          >
            {loading ? `Auditing… ${completedIndices.size}/${selectedAgents.length} complete` : selected.size === 1 ? 'Run 1 Audit' : `Run ${selected.size} Audits`}
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

        <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4 flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
          Your code is analyzed and immediately discarded — never stored, never shared, never used for training.
        </p>

        {/* Audit Picker */}
        {!loading && !result && (
          <div className="mb-8">
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              aria-expanded={pickerOpen}
              aria-controls="audit-picker"
              className="flex items-center justify-between w-full px-4 py-3 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 transition-colors mb-3 group"
            >
              <span className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-300">
                <svg
                  className={`w-4 h-4 transition-transform text-gray-400 dark:text-zinc-500 ${pickerOpen ? 'rotate-90' : ''}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
                  aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                <span className="font-medium">
                  {selected.size === DEFAULT_IDS.size && [...DEFAULT_IDS].every(id => selected.has(id))
                    ? `${selected.size} recommended audits selected`
                    : `${selected.size} of ${allAgents.length} audits selected`}
                </span>
              </span>
              <span className="text-xs text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300 transition-colors">
                {pickerOpen ? 'Close' : 'Customize'}
              </span>
            </button>

              <div id="audit-picker" className={`bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 ${pickerOpen ? '' : 'hidden'}`}>
                {/* SAFE-005: Curated presets */}
                <div className="flex flex-wrap gap-2 mb-4 pb-3 border-b border-gray-200 dark:border-zinc-800">
                  {PRESETS.map((preset) => {
                    const isActive = preset.ids.length === selected.size && preset.ids.every(id => selected.has(id));
                    return (
                      <button
                        key={preset.label}
                        onClick={() => applyPreset(preset.ids)}
                        title={preset.description}
                        className={`text-xs px-3 py-1.5 rounded-lg transition-colors ${
                          isActive
                            ? 'bg-violet-600 text-white'
                            : preset.label === 'Full Audit'
                              ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
                              : 'bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-700'
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
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

                {/* SAFE-002/005: Warning when selecting many agents */}
                {selected.size >= FULL_RUN_AGENT_THRESHOLD && (
                  <div className="mb-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-xs text-amber-700 dark:text-amber-300">
                    <strong>{selected.size} agents selected.</strong> This run will use significant API quota (~{Math.round(selected.size * EST_TOKENS_PER_AGENT / 1000)}K tokens estimated). Results may take several minutes.
                  </div>
                )}

                {/* Categories */}
                <div className="space-y-4">
                  {Array.from(grouped.entries()).map(([cat, catAgents]) => {
                    if (catAgents.length === 0) return null;
                    const allSelected = catAgents.every((a) => selected.has(a.id));
                    const someSelected = catAgents.some((a) => selected.has(a.id));
                    return (
                      <div key={cat}>
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
                            const wouldExceedMax = false;
                            return (
                              <label
                                key={agent.id}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-white dark:bg-zinc-800 shadow-sm'
                                    : wouldExceedMax
                                      ? 'text-gray-400 dark:text-zinc-500 cursor-not-allowed'
                                      : 'hover:bg-white dark:hover:bg-zinc-800/50'
                                }`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  disabled={wouldExceedMax}
                                  onChange={() => toggleAgent(agent.id)}
                                  className="sr-only"
                                />
                                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                                  isSelected
                                    ? 'bg-violet-600 border-violet-600'
                                    : 'border-gray-300 dark:border-zinc-600'
                                }`}>
                                  {isSelected && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </span>
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 ${dotColor(agent.accentClass)}`} aria-hidden="true" />
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
          </div>
        )}

        {/* Audit progress tracker — sticky while loading, static when done */}
        {(loading || (!loading && result)) && (
          <div className={`mb-6 py-3 -mx-6 px-6 ${loading ? 'sticky top-0 z-10 bg-gray-50/95 dark:bg-zinc-950/95 backdrop-blur-sm' : ''}`}>
            {/* Progress summary bar */}
            {loading && selectedAgents.length > 0 && (
              <div className="mb-3" role="status" aria-live="polite">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-xs font-medium text-gray-600 dark:text-zinc-400">
                    {budgetExhausted
                      ? 'Token budget reached — finishing active audits'
                      : completedIndices.size === selectedAgents.length
                        ? 'All audits complete'
                        : runningIndices.size > 0
                          ? `Running ${runningIndices.size} of ${selectedAgents.length} audits (concurrency: ${currentConcurrency})…`
                          : 'Preparing audits…'}
                  </span>
                  <span className="text-xs font-mono text-gray-500 dark:text-zinc-500 flex items-center gap-2">
                    {errorCount > 0 && (
                      <span className="text-amber-500" title={`${errorCount} agent(s) failed — concurrency auto-adjusted`}>
                        {errorCount} err
                      </span>
                    )}
                    {completedIndices.size}/{selectedAgents.length} complete
                  </span>
                </div>
                <div className="w-full h-2 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-all duration-500 ease-out"
                    style={{ width: `${(completedIndices.size / selectedAgents.length) * 100}%` }}
                  />
                </div>
                {/* SAFE-002: Token budget bar */}
                {selectedAgents.length >= FULL_RUN_AGENT_THRESHOLD && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="flex-1 h-1 bg-gray-200 dark:bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all duration-500 ${budgetExhausted ? 'bg-red-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, (estimatedTokensUsed / MAX_TOKENS_PER_RUN) * 100)}%` }}
                      />
                    </div>
                    <span className="text-[10px] font-mono text-gray-400 dark:text-zinc-600 whitespace-nowrap">
                      ~{Math.round(estimatedTokensUsed / 1000)}K / {Math.round(MAX_TOKENS_PER_RUN / 1000)}K tokens
                    </span>
                  </div>
                )}
              </div>
            )}

            {/* ONB-019: First-time tooltip explaining agent badges */}
            {isFirstAudit && loading && completedIndices.size === 0 && (
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-2">
                Each agent runs a specialized check — results stream in as they complete.
              </p>
            )}

            {/* Agent badges — collapsible after audit completes */}
            {!loading && result && (
              <button
                onClick={() => setBadgesCollapsed(!badgesCollapsed)}
                className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors mb-1.5"
                aria-expanded={!badgesCollapsed}
              >
                <svg
                  className={`w-3.5 h-3.5 transition-transform ${badgesCollapsed ? '' : 'rotate-90'}`}
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                </svg>
                {badgesCollapsed ? `Show ${selectedAgents.length} audit badges` : 'Hide audit badges'}
              </button>
            )}
            {(!badgesCollapsed || loading) && (
            <div className="flex flex-wrap gap-1.5">
              {selectedAgents.map((agent, i) => {
                const isActive = loading && runningIndices.has(i);
                const isDone = completedIndices.has(i);
                const isPending = loading && !isActive && !isDone;

                // After audit completes, badges scroll to the corresponding section
                if (!loading && result) {
                  const sectionId = `${agent.name.toLowerCase().replace(/[^\w\s-]/g, '').replace(/\s+/g, '-')}-audit`;
                  return (
                    <button
                      key={agent.id}
                      onClick={() => {
                        const el = document.getElementById(sectionId);
                        el?.scrollIntoView({ behavior: 'smooth', block: 'start' });
                      }}
                      className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:ring-1 hover:ring-violet-500/40 hover:text-violet-600 dark:hover:text-violet-300"
                    >
                      <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      {agent.name}
                    </button>
                  );
                }

                // While loading, show progress status per agent
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
                    {isActive && (
                      <span className={`w-2 h-2 rounded-full ${dotColor(agent.accentClass)} motion-safe:animate-pulse flex-shrink-0`} aria-hidden="true" />
                    )}
                    {isDone && (
                      <svg className="w-3 h-3 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                    {isPending && (
                      <span className="w-2 h-2 rounded-full bg-gray-300 dark:bg-zinc-700 flex-shrink-0" aria-hidden="true" />
                    )}
                    {agent.name}
                  </span>
                );
              })}
            </div>
            )}
          </div>
        )}

        {/* Error — always-rendered container so screen readers announce dynamically */}
        <div id="site-audit-error" role="alert" aria-live="assertive" aria-atomic="true">
          {error && (
            <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-300 text-sm mb-6 motion-safe:animate-fade-up">
              {error}
            </div>
          )}
        </div>

        {/* Streaming indicator */}
        {loading && !result && (
          <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-500 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-pulse" aria-hidden="true" />
            <span>Fetching and analyzing website…</span>
          </div>
        )}

        {/* Results */}
        {(result || loading) && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 border-t-2 border-t-violet-500/50 rounded-lg overflow-hidden">
            {/* Result header */}
            <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2 border-b border-gray-200 dark:border-zinc-800">
              <span className="text-xs font-mono uppercase tracking-widest">
                {loading ? (
                  <span className="flex items-center gap-1.5 text-violet-400">
                    <span className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-pulse" aria-hidden="true" />
                    {runningIndices.size > 0
                      ? `Auditing — ${completedIndices.size} of ${selectedAgents.length} complete`
                      : 'Fetching site…'}
                  </span>
                ) : (
                  `Site Audit Results — ${selectedAgents.length} audits`
                )}
              </span>
              {!loading && result && (
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => runSiteAudit()}
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

            {/* Result content */}
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
          </div>
        )}

        {/* Synthesis — Generate Roadmap */}
        {!loading && result && (
          <div className="mt-6">
            {synthStatus === 'idle' && (
              <div>
                {/* ONB-016: First audit completion banner */}
                {isFirstAudit && (
                  <div className="mb-4 p-4 rounded-xl bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-800 flex items-start gap-3">
                    <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <div>
                      <p className="font-medium text-green-900 dark:text-green-200 text-sm">First audit complete</p>
                      <p className="text-xs text-green-700 dark:text-green-400 mt-1">Your findings are saved to your dashboard. Generate a remediation roadmap below, or run another audit.</p>
                    </div>
                  </div>
                )}
                {!session && (
                  <div className="mb-4 p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 flex items-start gap-3">
                    <svg className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <div>
                      <p className="font-medium text-violet-900 dark:text-violet-200 text-sm">Create a free account to unlock more</p>
                      <p className="text-xs text-violet-700 dark:text-violet-400 mt-1">Sign up to save audit results to your dashboard, track scores over time, and generate remediation roadmaps.</p>
                      <a href="/signup?callbackUrl=/site-audit" className="inline-block mt-2 text-xs font-semibold text-violet-600 dark:text-violet-300 hover:text-violet-500 underline underline-offset-2">Create free account <span aria-hidden="true">→</span></a>
                    </div>
                  </div>
                )}
                {session && (<>
                <button
                  onClick={runSynthesis}
                  className="w-full py-3.5 rounded-xl font-semibold text-base text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all focus-ring flex items-center justify-center gap-2"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                  </svg>
                  Generate Remediation Roadmap
                </button>
                {/* ONB-017: Explain what the synthesis does */}
                <p className="text-xs text-gray-500 dark:text-zinc-500 mt-2 text-center">
                  Turn your findings into a step-by-step fix plan, prioritized by severity and effort. Know exactly what to fix first.
                </p>
                </>)}
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
                        <span className="w-2 h-2 rounded-full bg-indigo-500 motion-safe:animate-pulse" aria-hidden="true" />
                        Synthesizing findings…
                      </span>
                    ) : (
                      'Remediation Roadmap'
                    )}
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

        {/* Selected audits preview + what you'll get — idle state */}
        {!loading && !result && !error && !pickerOpen && selected.size > 0 && (
          <div className="space-y-6">
            {/* ONB-002/004: Welcome banner for new users redirected from dashboard */}
            {isWelcome && (
              <div className="p-4 rounded-xl bg-violet-50 dark:bg-violet-950/30 border border-violet-200 dark:border-violet-800 flex items-start gap-3">
                <svg className="w-5 h-5 text-violet-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>
                <div>
                  <p className="font-medium text-violet-900 dark:text-violet-200 text-sm">Welcome to Claudit — let&apos;s run your first audit</p>
                  <p className="text-xs text-violet-700 dark:text-violet-400 mt-1">Enter any public URL below. Results stream in real time with severity-rated findings and fix suggestions.</p>
                </div>
              </div>
            )}

            <div className="flex flex-wrap gap-2">
              {selectedAgents.map((agent) => (
                <span
                  key={agent.id}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400"
                >
                  <span className={`w-2 h-2 rounded-full ${dotColor(agent.accentClass)}`} aria-hidden="true" />
                  {agent.name}
                </span>
              ))}
            </div>

            {/* ONB-022: What you'll get — with icons */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-center">
              {[
                { label: 'Severity-rated findings', desc: 'Critical, High, Medium, Low', icon: <svg className="w-5 h-5 text-red-500 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" /></svg> },
                { label: 'Line-level references', desc: 'Exact file and line numbers', icon: <svg className="w-5 h-5 text-blue-500 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg> },
                { label: 'Fix suggestions', desc: 'Copy-paste remediation steps', icon: <svg className="w-5 h-5 text-green-500 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg> },
              ].map((item) => (
                <div key={item.label} className="px-4 py-4 rounded-xl bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800">
                  {item.icon}
                  <p className="text-xs font-semibold text-gray-700 dark:text-zinc-300">{item.label}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{item.desc}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500 text-center mt-4">
              For teams: track audit scores over time, assign findings, and generate compliance reports — all from your dashboard.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
