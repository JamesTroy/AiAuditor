'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { agents as allAgents } from '@/lib/agents';
import SafeMarkdown from '@/components/markdownComponents';
import { saveAudit } from '@/lib/history';

const DEFAULT_IDS = new Set([
  'security',
  'seo-performance',
  'accessibility',
  'frontend-performance',
  'responsive-design',
  'code-quality',
]);

const CATEGORIES = ['Security & Privacy', 'Code Quality', 'Performance', 'Infrastructure', 'Design'] as const;

const CATEGORY_COLORS: Record<string, string> = {
  'Security & Privacy': 'border-red-500/40',
  'Code Quality': 'border-blue-500/40',
  'Performance': 'border-amber-500/40',
  'Infrastructure': 'border-cyan-500/40',
  'Design': 'border-violet-500/40',
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

function dotColor(accentClass: string): string {
  for (const [key, val] of Object.entries(DOT_COLORS)) {
    if (accentClass.includes(key)) return val;
  }
  return 'bg-zinc-500';
}

export default function SiteAuditPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(() => new Set(DEFAULT_IDS));
  const [pickerOpen, setPickerOpen] = useState(false);
  // SM-005: Discriminated union for synthesis state.
  type SynthStatus = 'idle' | 'loading' | 'done' | 'error';
  const [synthesis, setSynthesis] = useState('');
  const [synthStatus, setSynthStatus] = useState<SynthStatus>('idle');
  const [synthError, setSynthError] = useState('');
  const abortRef = useRef<AbortController | null>(null);
  // SM-011: AbortController for synthesis stream.
  const synthAbortRef = useRef<AbortController | null>(null);
  const chunksRef = useRef<string[]>([]);
  const rafRef = useRef<number | null>(null);
  const resultEndRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

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

  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      abortRef.current?.abort();
      synthAbortRef.current?.abort();
    };
  }, []);

  // Parse streamed result into per-agent sections and save each to localStorage
  const savePerAgentResults = useCallback((fullResult: string, auditUrl: string) => {
    // Split on section headers: ====...====\n## Agent Name Audit\n====...====
    const sectionPattern = /={10,}\n## (.+?) Audit\n={10,}/g;
    const matches = [...fullResult.matchAll(sectionPattern)];

    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const agentName = match[1];
      const sectionStart = match.index! + match[0].length;
      const sectionEnd = i + 1 < matches.length ? matches[i + 1].index! : fullResult.length;
      let sectionText = fullResult.slice(sectionStart, sectionEnd).trim();

      // Strip the metadata comment if present
      sectionText = sectionText.replace(/\n<!--AGENT_META:.*?-->\n?/g, '').trim();

      // Find the matching agent by name
      const agent = allAgents.find((a) => a.name === agentName);
      if (!agent || !sectionText) continue;

      saveAudit({
        agentId: agent.id,
        agentName: agent.name,
        inputSnippet: auditUrl.slice(0, 100) + (auditUrl.length > 100 ? '…' : ''),
        result: sectionText,
        timestamp: Date.now(),
      });
    }
  }, []);

  const runSiteAudit = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || loading || selected.size === 0) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    chunksRef.current = [];
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    setLoading(true);
    setResult('');
    setError('');
    // SM-013: Clear synthesis errors from previous run.
    setSynthError('');
    setSynthStatus('idle');
    setSynthesis('');
    // SM-016: Close picker so results are visible.
    setPickerOpen(false);

    try {
      const res = await fetch('/api/site-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: trimmed,
          agents: Array.from(selected),
        }),
        signal: abortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const text = await res.text();
        setError(text || `Error ${res.status}`);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunksRef.current.push(decoder.decode(value, { stream: true }));

        if (rafRef.current === null) {
          rafRef.current = requestAnimationFrame(() => {
            setResult(chunksRef.current.join(''));
            rafRef.current = null;
          });
        }
      }

      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
      const fullResult = chunksRef.current.join('');
      setResult(fullResult);

      // Save each agent's section to localStorage for history tracking
      savePerAgentResults(fullResult, trimmed);
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [url, loading, selected, savePerAgentResults]);

  function handleStop() {
    abortRef.current?.abort();
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (chunksRef.current.length > 0) {
      setResult(chunksRef.current.join(''));
    }
    setLoading(false);
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

  // Detect which agent section is currently streaming
  const currentAgentIndex = selectedAgents.findIndex((agent, i) => {
    const nextAgent = selectedAgents[i + 1];
    const hasSection = result.includes(`## ${agent.name} Audit`);
    const nextHasSection = nextAgent ? result.includes(`## ${nextAgent.name} Audit`) : false;
    return hasSection && !nextHasSection;
  });

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Full Site Audit
          </h1>
          <p className="text-gray-500 dark:text-zinc-400 text-lg max-w-2xl mx-auto">
            Enter any website URL and choose which AI agents analyze it.
          </p>
        </div>

        {/* URL Input */}
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !loading && selected.size > 0) runSiteAudit(); }}
            placeholder="https://example.com"
            disabled={loading}
            className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-5 py-3.5 text-base text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 disabled:opacity-50"
            aria-label="Website URL"
          />
          <button
            onClick={runSiteAudit}
            disabled={loading || !url.trim() || selected.size === 0}
            className="px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring whitespace-nowrap"
          >
            {loading ? `Auditing… ${elapsed}s` : `Run Audit (${selected.size})`}
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
              className="flex items-center gap-2 text-sm text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors mb-3"
            >
              <svg
                className={`w-4 h-4 transition-transform ${pickerOpen ? 'rotate-90' : ''}`}
                fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
              <span className="font-medium">
                {selected.size} of {allAgents.length} agents selected
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
                    onClick={selectDefaults}
                    className="text-xs px-3 py-1.5 rounded-lg bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300 hover:bg-violet-200 dark:hover:bg-violet-900/50 transition-colors"
                  >
                    Defaults (6)
                  </button>
                  <button
                    onClick={clearAll}
                    className="text-xs px-3 py-1.5 rounded-lg bg-gray-200 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-700 transition-colors"
                  >
                    Clear
                  </button>
                  <span className="ml-auto text-xs text-gray-400 dark:text-zinc-600 self-center">
                    Max 20 per audit
                  </span>
                </div>

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
                            <span className="ml-1.5 text-gray-400 dark:text-zinc-600 font-normal normal-case tracking-normal">
                              ({catAgents.filter((a) => selected.has(a.id)).length}/{catAgents.length})
                            </span>
                          </button>
                          <button
                            onClick={() => selectCategory(cat, !allSelected)}
                            className="text-[10px] text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors"
                          >
                            {allSelected ? 'deselect all' : someSelected ? 'select all' : 'select all'}
                          </button>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                          {catAgents.map((agent) => {
                            const isSelected = selected.has(agent.id);
                            const wouldExceedMax = !isSelected && selected.size >= 20;
                            return (
                              <label
                                key={agent.id}
                                className={`flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${
                                  isSelected
                                    ? 'bg-white dark:bg-zinc-800 shadow-sm'
                                    : wouldExceedMax
                                      ? 'opacity-40 cursor-not-allowed'
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

        {/* Agent badges — progress while loading, clickable links when done */}
        {(loading || (!loading && result)) && (
          <div className="flex flex-wrap gap-2 mb-6">
            {selectedAgents.map((agent, i) => {
              const hasSection = result.includes(`## ${agent.name} Audit`);
              const isActive = loading && i === currentAgentIndex;
              const isDone = hasSection && (!loading || i < currentAgentIndex);

              // After audit completes, badges become links to the individual agent page
              if (!loading && result) {
                return (
                  <Link
                    key={agent.id}
                    href={`/audit/${agent.id}`}
                    className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:ring-1 hover:ring-violet-500/40 hover:text-violet-600 dark:hover:text-violet-300`}
                  >
                    <span className={`w-2 h-2 rounded-full ${dotColor(agent.accentClass)}`} />
                    {agent.name}
                    <svg className="w-3 h-3 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 19.5l15-15m0 0H8.25m11.25 0v11.25" />
                    </svg>
                  </Link>
                );
              }

              // While loading, show progress status
              return (
                <span
                  key={agent.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30'
                      : isDone
                        ? 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500'
                        : 'bg-gray-50 dark:bg-zinc-900 text-gray-400 dark:text-zinc-600'
                  }`}
                >
                  {isActive && (
                    <span className={`w-2 h-2 rounded-full ${dotColor(agent.accentClass)} animate-pulse`} />
                  )}
                  {isDone && (
                    <svg className="w-3 h-3 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {agent.name}
                </span>
              );
            })}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-300 text-sm mb-6">
            {error}
          </div>
        )}

        {/* Streaming indicator */}
        {loading && !result && (
          <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-500 text-sm mb-6">
            <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
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
                    <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                    Streaming · {selectedAgents[currentAgentIndex]?.name ?? 'Starting'}
                  </span>
                ) : (
                  'Site Audit Results'
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
            <div className="p-6 prose prose-sm max-w-none dark:prose-invert">
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
              <button
                onClick={runSynthesis}
                className="w-full py-3.5 rounded-xl font-semibold text-base text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all focus-ring flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                </svg>
                Generate Remediation Roadmap
              </button>
            )}

            {synthError && (
              <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-300 text-sm mt-3">
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
                    ) : (
                      'Remediation Roadmap'
                    )}
                  </span>
                </div>
                <div className="p-6 prose prose-sm max-w-none dark:prose-invert">
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

        {/* Selected agents preview when idle and picker is closed */}
        {!loading && !result && !error && !pickerOpen && selected.size > 0 && (
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
        )}
      </div>
    </div>
  );
}
