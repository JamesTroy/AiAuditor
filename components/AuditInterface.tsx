'use client';

import { useState, useRef, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { AgentConfig } from '@/lib/types';
import { saveAudit } from '@/lib/history';

const ACCEPTED_EXTENSIONS = '.js,.ts,.tsx,.jsx,.html,.css,.py,.go,.java,.rb,.php,.md,.txt';

interface Props {
  agent: AgentConfig;
  onAuditSaved?: () => void;
}

export default function AuditInterface({ agent, onAuditSaved }: Props) {
  const [input, setInput] = useState('');
  const [fileName, setFileName] = useState('');
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const runAudit = useCallback(async () => {
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
      let fullResult = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        const chunk = decoder.decode(value, { stream: true });
        fullResult += chunk;
        setResult(fullResult);
      }

      // Save to history
      saveAudit({
        agentId: agent.id,
        agentName: agent.name,
        inputSnippet: input.slice(0, 100) + (input.length > 100 ? '…' : ''),
        result: fullResult,
        timestamp: Date.now(),
      });
      onAuditSaved?.();
    } catch (err: unknown) {
      if (err instanceof Error && err.name !== 'AbortError') {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  }, [input, loading, agent, onAuditSaved]);

  function handleStop() {
    abortRef.current?.abort();
    setLoading(false);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runAudit();
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = (ev.target?.result as string) ?? '';
      setInput(text.slice(0, 30000));
      setFileName(file.name);
    };
    reader.readAsText(file);
    // Reset so same file can be re-uploaded
    e.target.value = '';
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function handleDownload() {
    const blob = new Blob([result], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.name.toLowerCase().replace(/\s+/g, '-')}-audit.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Textarea */}
      <div className="relative">
        <textarea
          className="w-full h-64 bg-zinc-900 border border-zinc-700 rounded-lg p-4 font-mono text-sm text-zinc-100 resize-y focus:outline-none focus:border-zinc-500 placeholder-zinc-600"
          placeholder={`${agent.placeholder}\n\nTip: Press ⌘+Enter to run`}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          maxLength={30000}
          disabled={loading}
          aria-label="Audit input"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
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

        {/* File upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg text-sm text-zinc-400 hover:text-zinc-200 border border-zinc-700 hover:border-zinc-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Upload file
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload file"
        />

        {/* Right-side metadata */}
        <div className="ml-auto flex items-center gap-3">
          {fileName && (
            <span className="text-xs text-zinc-500 bg-zinc-800 px-2 py-1 rounded font-mono">
              {fileName}
              <button
                onClick={() => { setFileName(''); setInput(''); }}
                className="ml-2 text-zinc-600 hover:text-zinc-300"
                aria-label="Clear file"
              >✕</button>
            </span>
          )}
          {input.length > 0 && (
            <span className="text-xs text-zinc-600">
              {input.length.toLocaleString()} / 30,000
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-950 border border-red-800 rounded-lg p-4 text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Streaming indicator (no result yet) */}
      {loading && !result && (
        <div className="flex items-center gap-2 text-zinc-500 text-sm">
          <span className="animate-pulse">●</span>
          <span>Analyzing...</span>
        </div>
      )}

      {/* Result panel */}
      {(result || loading) && (
        <div className="bg-zinc-900 border border-zinc-700 rounded-lg overflow-hidden transition-opacity duration-300">
          {/* Result header with export buttons */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-zinc-800">
            <span className="text-xs text-zinc-500 font-mono uppercase tracking-widest">
              {loading ? (
                <span className="flex items-center gap-1">
                  <span className="animate-pulse">●</span> Streaming
                </span>
              ) : 'Result'}
            </span>
            {!loading && result && (
              <div className="flex items-center gap-2">
                <button
                  onClick={handleCopy}
                  className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleDownload}
                  className="text-xs text-zinc-400 hover:text-zinc-200 px-2 py-1 rounded hover:bg-zinc-700 transition-colors"
                >
                  Download .md
                </button>
              </div>
            )}
          </div>
          <div className="p-6 prose prose-invert prose-sm max-w-none">
            <ReactMarkdown>
              {loading ? result + ' ▍' : result}
            </ReactMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
