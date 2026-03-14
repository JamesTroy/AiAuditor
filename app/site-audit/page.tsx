'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import SafeMarkdown from '@/components/markdownComponents';

const AGENTS = [
  { id: 'security', name: 'Security', color: 'bg-red-500' },
  { id: 'seo-performance', name: 'SEO / Performance', color: 'bg-amber-500' },
  { id: 'accessibility', name: 'Accessibility', color: 'bg-blue-500' },
  { id: 'frontend-performance', name: 'Frontend Performance', color: 'bg-emerald-500' },
  { id: 'responsive-design', name: 'Responsive Design', color: 'bg-violet-500' },
  { id: 'code-quality', name: 'Code Quality', color: 'bg-cyan-500' },
];

export default function SiteAuditPage() {
  const [url, setUrl] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [elapsed, setElapsed] = useState(0);
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const chunksRef = useRef<string[]>([]);
  const rafRef = useRef<number | null>(null);
  const resultEndRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

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

  // Cleanup RAF on unmount
  useEffect(() => {
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const runSiteAudit = useCallback(async () => {
    const trimmed = url.trim();
    if (!trimmed || loading) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();
    chunksRef.current = [];
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    setLoading(true);
    setResult('');
    setError('');

    try {
      const res = await fetch('/api/site-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
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
      setResult(chunksRef.current.join(''));
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [url, loading]);

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

  // Detect which agent section is currently streaming
  const currentAgentIndex = AGENTS.findIndex((agent, i) => {
    const nextAgent = AGENTS[i + 1];
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
            Enter any website URL and our AI agents will analyze it across security, SEO, accessibility, performance, responsive design, and code quality.
          </p>
        </div>

        {/* URL Input */}
        <div className="flex flex-col sm:flex-row gap-3 mb-6">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter' && !loading) runSiteAudit(); }}
            placeholder="https://example.com"
            disabled={loading}
            className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl px-5 py-3.5 text-base text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:focus-visible:ring-offset-zinc-950 disabled:opacity-50"
            aria-label="Website URL"
          />
          <button
            onClick={runSiteAudit}
            disabled={loading || !url.trim()}
            className="px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-ring whitespace-nowrap"
          >
            {loading ? `Auditing… ${elapsed}s` : 'Run Full Audit'}
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

        {/* Agent Progress Indicator */}
        {loading && (
          <div className="flex flex-wrap gap-2 mb-6">
            {AGENTS.map((agent, i) => {
              const hasSection = result.includes(`## ${agent.name} Audit`);
              const isActive = i === currentAgentIndex && loading;
              const isDone = hasSection && i < currentAgentIndex;
              return (
                <span
                  key={agent.id}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    isActive
                      ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30'
                      : isDone || (hasSection && !isActive)
                        ? 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-500'
                        : 'bg-gray-50 dark:bg-zinc-900 text-gray-400 dark:text-zinc-600'
                  }`}
                >
                  {isActive && (
                    <span className={`w-2 h-2 rounded-full ${agent.color} animate-pulse`} />
                  )}
                  {(isDone || (hasSection && !isActive)) && (
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
                    Streaming · {AGENTS[currentAgentIndex]?.name ?? 'Starting'}
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

        {/* Info section when idle */}
        {!loading && !result && !error && (
          <div className="mt-8">
            <h2 className="text-lg font-semibold mb-4 text-center">6 agents will analyze your site</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {AGENTS.map((agent) => (
                <div
                  key={agent.id}
                  className="bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`w-2.5 h-2.5 rounded-full ${agent.color}`} />
                    <span className="font-medium text-sm">{agent.name}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-500">
                    {agent.id === 'security' && 'Identifies vulnerabilities, XSS, CSRF, and insecure patterns in your site\'s source.'}
                    {agent.id === 'seo-performance' && 'Checks meta tags, heading structure, Open Graph, schema markup, and page speed indicators.'}
                    {agent.id === 'accessibility' && 'Reviews WCAG compliance, ARIA usage, color contrast, keyboard navigation, and screen reader support.'}
                    {agent.id === 'frontend-performance' && 'Analyzes render-blocking resources, image optimization, script loading, and Core Web Vitals signals.'}
                    {agent.id === 'responsive-design' && 'Evaluates mobile viewport, touch targets, breakpoint coverage, and fluid layouts.'}
                    {agent.id === 'code-quality' && 'Reviews HTML structure, CSS patterns, JavaScript quality, and general code hygiene.'}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
