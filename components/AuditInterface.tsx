'use client';

import { useState, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import { AgentConfig } from '@/lib/types';

export default function AuditInterface({ agent }: { agent: AgentConfig }) {
  const [input, setInput] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const abortRef = useRef<AbortController | null>(null);

  async function runAudit() {
    if (!input.trim() || loading) return;

    abortRef.current?.abort();
    abortRef.current = new AbortController();

    setLoading(true);
    setResult('');
    setError('');

    try {
      const res = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentType: agent.id, input }),
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
        setResult((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }

  function handleStop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  return (
    <div className="flex flex-col gap-6">
      <textarea
        className="w-full h-64 bg-zinc-900 border border-zinc-700 rounded-lg p-4 font-mono text-sm text-zinc-100 resize-y focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
        placeholder={agent.placeholder}
        value={input}
        onChange={(e) => setInput(e.target.value)}
        maxLength={30000}
        disabled={loading}
      />

      <div className="flex items-center gap-3">
        <button
          onClick={runAudit}
          disabled={loading || !input.trim()}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${agent.buttonClass}`}
        >
          {loading ? 'Auditing...' : 'Run Audit'}
        </button>
        {loading && (
          <button
            onClick={handleStop}
            className="px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 transition-colors"
          >
            Stop
          </button>
        )}
        {input.length > 0 && (
          <span className="text-xs text-zinc-600 ml-auto">
            {input.length.toLocaleString()} / 30,000
          </span>
        )}
      </div>

      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {result && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg p-6 prose prose-invert prose-sm max-w-none">
          <ReactMarkdown>{result}</ReactMarkdown>
        </div>
      )}

      {loading && !result && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <span className="animate-pulse">●</span>
          <span>Analyzing...</span>
        </div>
      )}
    </div>
  );
}
