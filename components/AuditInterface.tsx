'use client';

import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';

import { AgentConfig } from '@/lib/types';
import SafeMarkdown from '@/components/markdownComponents';
import { agents } from '@/lib/agents';
import { setChainInput, consumeChainInput } from '@/lib/session';
import { ALLOWED_URL_DESCRIPTION } from '@/lib/config/urlAllowlist';
import { useAuditSession } from '@/lib/hooks/useAuditSession';

const CATEGORIES = ['Code Quality', 'Security & Privacy', 'Performance', 'Infrastructure'] as const;

const ACCEPTED_EXTENSIONS = '.js,.ts,.tsx,.jsx,.html,.css,.py,.go,.java,.rb,.php,.md,.txt';
const MAX_CHARS = 30_000;

interface FileEntry {
  name: string;
  content: string;
}

interface Props {
  agent: AgentConfig;
  onAuditSaved?: () => void;
}

export default function AuditInterface({ agent, onAuditSaved }: Props) {
  const router = useRouter();
  const [input, setInput] = useState('');
  const [files, setFiles] = useState<FileEntry[]>([]);
  const [copied, setCopied] = useState(false);
  const [urlValue, setUrlValue] = useState('');
  const [urlLoading, setUrlLoading] = useState(false);
  const [urlError, setUrlError] = useState('');
  const [showUrl, setShowUrl] = useState(false);
  const [chainOpen, setChainOpen] = useState(false);
  const [canPaste, setCanPaste] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);

  // ARCH-002: Streaming audit state lives in the hook.
  const { result, loading, error, runAudit, handleStop } = useAuditSession(agent, onAuditSaved);

  // Detect clipboard API after mount — keeps SSR/client render identical
  useEffect(() => {
    setCanPaste(!!navigator.clipboard?.readText);
  }, []);

  // Pre-fill input from cross-agent chain (ARCH-011: via lib/session.ts)
  useEffect(() => {
    const chained = consumeChainInput();
    if (chained) setInput(chained);
  }, []);

  // Close chain dropdown on outside click
  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (chainRef.current && !chainRef.current.contains(e.target as Node)) {
        setChainOpen(false);
      }
    }
    if (chainOpen) document.addEventListener('mousedown', onClickOutside);
    return () => document.removeEventListener('mousedown', onClickOutside);
  }, [chainOpen]);

  // Esc to stop streaming
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && loading) {
        handleStop();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [loading, handleStop]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runAudit(input);
    }
  }

  function buildCombinedInput(existingInput: string, newFiles: FileEntry[]): string {
    if (newFiles.length === 0) return existingInput;
    const parts = newFiles.map((f) => `--- ${f.name} ---\n${f.content}`);
    return parts.join('\n\n').slice(0, MAX_CHARS);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = Array.from(e.target.files ?? []);
    if (fileList.length === 0) return;

    const readers = fileList.map(
      (file) =>
        new Promise<FileEntry>((resolve) => {
          const reader = new FileReader();
          reader.onload = (ev) => {
            resolve({ name: file.name, content: (ev.target?.result as string) ?? '' });
          };
          reader.readAsText(file);
        })
    );

    Promise.all(readers).then((newEntries) => {
      setFiles((prev) => {
        const merged = [...prev, ...newEntries];
        setInput(buildCombinedInput('', merged));
        return merged;
      });
    });

    e.target.value = '';
  }

  function removeFile(name: string) {
    setFiles((prev) => {
      const updated = prev.filter((f) => f.name !== name);
      setInput(buildCombinedInput('', updated));
      return updated;
    });
  }

  async function handleFetchUrl() {
    const trimmed = urlValue.trim();
    if (!trimmed) return;
    setUrlLoading(true);
    setUrlError('');
    try {
      const res = await fetch('/api/fetch-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: trimmed }),
      });
      if (!res.ok) {
        setUrlError(await res.text());
        return;
      }
      const text = await res.text();
      setInput(text.slice(0, MAX_CHARS));
      setFiles([]);
      setUrlValue('');
      setShowUrl(false);
    } catch (err) {
      setUrlError(err instanceof Error ? err.message : 'Failed to fetch URL');
    } finally {
      setUrlLoading(false);
    }
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

  function handleDownloadJson() {
    const payload = JSON.stringify(
      { agentId: agent.id, agentName: agent.name, timestamp: new Date().toISOString(), result },
      null,
      2,
    );
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agent.name.toLowerCase().replace(/\s+/g, '-')}-audit.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handlePaste() {
    try {
      const text = await navigator.clipboard.readText();
      if (text) {
        setInput(text.slice(0, MAX_CHARS));
        setFiles([]);
      }
    } catch {
      // Clipboard read denied or unavailable
    }
  }

  function handleChainTo(targetId: string) {
    setChainInput(input); // ARCH-011: via lib/session.ts
    setChainOpen(false);
    router.push(`/audit/${targetId}`);
  }

  const wordCount = result.trim() ? result.trim().split(/\s+/).filter(Boolean).length : 0;
  const tokenEstimate = Math.ceil(input.length / 4);
  const otherAgents = agents.filter((a) => a.id !== agent.id);

  return (
    <div className="flex flex-col gap-6">
      {/* VULN-003: localStorage plaintext disclosure */}
      <p className="text-xs text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-2.5">
        Audit history is stored in your browser&apos;s localStorage as unencrypted text. Do not submit proprietary credentials or sensitive data.
      </p>

      {/* URL import */}
      <div>
        <button
          onClick={() => setShowUrl((v) => !v)}
          className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 transition-colors mb-2"
        >
          {showUrl ? '▾' : '▸'} Import from URL
        </button>
        {showUrl && (
          <div className="flex gap-2 mt-1">
            <input
              type="url"
              value={urlValue}
              onChange={(e) => setUrlValue(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleFetchUrl(); }}
              placeholder={`https:// — allowed: ${ALLOWED_URL_DESCRIPTION}`}
              className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500"
            />
            <button
              onClick={handleFetchUrl}
              disabled={urlLoading || !urlValue.trim()}
              className="px-4 py-2 rounded-lg text-sm bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-700 disabled:opacity-40 transition-colors"
            >
              {urlLoading ? 'Fetching…' : 'Fetch'}
            </button>
          </div>
        )}
        {urlError && <p className="mt-1 text-xs text-red-500">{urlError}</p>}
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          className="w-full h-64 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg p-4 font-mono text-sm text-gray-900 dark:text-zinc-100 resize-y focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 placeholder-gray-400 dark:placeholder-zinc-600"
          placeholder={`${agent.placeholder}\n\nTip: Press ⌘+Enter to run · Esc to stop`}
          value={input}
          onChange={(e) => { setInput(e.target.value); if (files.length > 0) setFiles([]); }}
          onKeyDown={handleKeyDown}
          maxLength={MAX_CHARS}
          disabled={loading}
          aria-label="Audit input"
        />
      </div>

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => runAudit(input)}
          disabled={loading || !input.trim()}
          className={`px-6 py-2.5 rounded-lg font-semibold text-sm text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed ${agent.buttonClass}`}
        >
          {loading ? 'Auditing...' : 'Run Audit'}
        </button>

        {loading && (
          <button
            onClick={handleStop}
            className="px-4 py-2.5 rounded-lg text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors"
          >
            Stop
          </button>
        )}

        {/* Paste button */}
        {canPaste && (
          <button
            onClick={handlePaste}
            disabled={loading}
            className="px-4 py-2.5 rounded-lg text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            Paste
          </button>
        )}

        {/* File upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-4 py-2.5 rounded-lg text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Upload file{files.length > 1 ? 's' : ''}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ACCEPTED_EXTENSIONS}
          onChange={handleFileChange}
          className="hidden"
          aria-label="Upload files"
        />

        {/* Right-side metadata */}
        <div className="ml-auto flex items-center gap-3 flex-wrap justify-end">
          {/* Multi-file chips */}
          {files.map((f) => (
            <span key={f.name} className="text-xs text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-2 py-1 rounded font-mono flex items-center gap-1">
              {f.name}
              <button
                onClick={() => removeFile(f.name)}
                className="text-gray-400 dark:text-zinc-600 hover:text-gray-700 dark:hover:text-zinc-300 ml-1"
                aria-label={`Remove ${f.name}`}
              >✕</button>
            </span>
          ))}
          {input.length > 0 && (
            <span className="text-xs text-gray-400 dark:text-zinc-600">
              {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} · ~{tokenEstimate.toLocaleString()} tokens
            </span>
          )}
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-300 text-sm">
          {error}
        </div>
      )}

      {/* Streaming indicator (no result yet) */}
      {loading && !result && (
        <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-500 text-sm">
          <span className="animate-pulse">●</span>
          <span>Analyzing...</span>
        </div>
      )}

      {/* Result panel */}
      {(result || loading) && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden transition-opacity duration-300">
          {/* Result header with export buttons */}
          <div className="flex items-center justify-between px-4 py-2 border-b border-gray-200 dark:border-zinc-800">
            <span className="text-xs text-gray-500 dark:text-zinc-500 font-mono uppercase tracking-widest">
              {loading ? (
                <span className="flex items-center gap-1.5">
                  <span className="animate-pulse">●</span>
                  Streaming
                  {wordCount > 0 && (
                    <span className="text-gray-400 dark:text-zinc-600 normal-case">· {wordCount.toLocaleString()} words</span>
                  )}
                </span>
              ) : 'Result'}
            </span>
            {!loading && result && (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => runAudit(input)}
                  className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  Re-audit
                </button>
                <button
                  onClick={handleCopy}
                  className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleDownload}
                  className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  Download .md
                </button>
                <button
                  onClick={handleDownloadJson}
                  className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                >
                  Download .json
                </button>
                {/* Try with... chain dropdown */}
                {input.trim() && otherAgents.length > 0 && (
                  <div ref={chainRef} className="relative">
                    <button
                      onClick={() => setChainOpen((v) => !v)}
                      className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
                    >
                      Try with… ▾
                    </button>
                    {chainOpen && (
                      <div className="absolute right-0 top-full mt-1 w-56 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg z-10 overflow-hidden">
                        {CATEGORIES.map((cat) => {
                          const group = otherAgents.filter((a) => a.category === cat);
                          if (group.length === 0) return null;
                          return (
                            <div key={cat}>
                              <div className="px-3 py-1.5 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800/50">
                                {cat}
                              </div>
                              {group.map((a) => (
                                <button
                                  key={a.id}
                                  onClick={() => handleChainTo(a.id)}
                                  className="w-full text-left px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                                >
                                  {a.name}
                                </button>
                              ))}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div className="p-6 prose prose-sm max-w-none dark:prose-invert">
            <SafeMarkdown>
              {loading ? result + ' ▍' : result}
            </SafeMarkdown>
          </div>
        </div>
      )}
    </div>
  );
}
