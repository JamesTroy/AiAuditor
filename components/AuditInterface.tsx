'use client';

import { useState, useRef, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';

import { AgentConfig } from '@/lib/types';
import SafeMarkdown from '@/components/markdownComponents';
import { agents } from '@/lib/agents/registry';
import { setChainInput, consumeChainInput } from '@/lib/session';
import { ALLOWED_URL_DESCRIPTION } from '@/lib/config/urlAllowlist';
import { useAuditSession } from '@/lib/hooks/useAuditSession';
import { detectAgents } from '@/lib/detectAgents';
import { detectSnippet } from '@/lib/detectSnippet';
import { parseAuditResult } from '@/lib/parseAuditResult';
import { friendlyError } from '@/lib/friendlyError';

const CATEGORIES = ['Code Quality', 'Security & Privacy', 'Performance', 'Infrastructure', 'Design', 'SEO', 'Marketing'] as const;

const ACCEPTED_EXTENSIONS = '.js,.ts,.tsx,.jsx,.html,.css,.py,.go,.java,.rb,.php,.md,.txt';
const MAX_CHARS = 60_000;

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
  const [chainOpen, setChainOpen] = useState(false);
  const [canPaste, setCanPaste] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [diffMode, setDiffMode] = useState(false);
  const [beforeCode, setBeforeCode] = useState('');

  // SM-002: Single enum replaces showUrl + showPr booleans. Only one panel open at a time.
  const [inputPanel, setInputPanel] = useState<'none' | 'url' | 'pr'>('none');
  // SM-020: Single loading + error for whichever input panel is active.
  const [inputFetching, setInputFetching] = useState(false);
  const [inputFetchError, setInputFetchError] = useState('');
  const [inputFetchValue, setInputFetchValue] = useState('');

  // SM-019: Cleanup timer ref for copied state.
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SM-001/SM-010: Chat state with abort controller and message status.
  type ChatMessage = { role: 'user' | 'assistant'; content: string; status: 'done' | 'pending' | 'streaming' | 'error' };
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const chatAbortRef = useRef<AbortController | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // PERF-023: Debounce input for detectAgents to avoid 55 regex tests on every keystroke.
  const [debouncedInput, setDebouncedInput] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);
  const chainRef = useRef<HTMLDivElement>(null);
  const resultEndRef = useRef<HTMLDivElement>(null);
  const userScrolledUp = useRef(false);

  // ARCH-002: Streaming audit state lives in the hook.
  const { result, status, loading, error, runAudit, handleStop } = useAuditSession(agent, onAuditSaved);

  // Detect clipboard API after mount — keeps SSR/client render identical
  useEffect(() => {
    setCanPaste(!!navigator.clipboard?.readText);
  }, []);

  // SM-019: Clear copied timer on unmount.
  // SM-003: Abort chat stream on unmount.
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      chatAbortRef.current?.abort();
    };
  }, []);

  // Elapsed timer while loading
  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    setElapsed(0);
    const id = setInterval(() => setElapsed((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [loading]);

  // Pre-fill input from cross-agent chain (ARCH-011: via lib/session.ts)
  useEffect(() => {
    const chained = consumeChainInput();
    if (chained) setInput(chained);
  }, []);

  // PERF-023: Debounce input for detectAgents (150ms).
  useEffect(() => {
    const id = setTimeout(() => setDebouncedInput(input), 150);
    return () => clearTimeout(id);
  }, [input]);

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

  // Auto-scroll to bottom while streaming. Pauses if user scrolls up.
  useEffect(() => {
    if (!loading) {
      userScrolledUp.current = false;
      return;
    }
    // Reset on new audit
    userScrolledUp.current = false;

    function onScroll() {
      const distFromBottom = document.documentElement.scrollHeight - window.scrollY - window.innerHeight;
      // If user scrolled more than 150px from bottom, they're reading — stop auto-scroll
      userScrolledUp.current = distFromBottom > 150;
    }
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [loading]);

  useEffect(() => {
    if (loading && result && !userScrolledUp.current) {
      resultEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [loading, result]);

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

  function buildAuditInput(): string {
    if (!diffMode || !beforeCode.trim()) return input;
    return `[DIFF MODE — Focus your audit on what changed between the BEFORE and AFTER versions. Flag new issues introduced in the AFTER code.]\n\n--- BEFORE ---\n${beforeCode}\n\n--- AFTER ---\n${input}`;
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      runAudit(buildAuditInput());
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

  // SM-002/SM-020: Unified input fetch handler for URL and PR panels.
  async function handleFetchInput() {
    const trimmed = inputFetchValue.trim();
    if (!trimmed || inputFetching) return;
    setInputFetching(true);
    setInputFetchError('');
    try {
      if (inputPanel === 'url') {
        const res = await fetch('/api/fetch-url', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        });
        if (!res.ok) { setInputFetchError(friendlyError(await res.text())); return; }
        const text = await res.text();
        setInput(text.slice(0, MAX_CHARS));
      } else if (inputPanel === 'pr') {
        const res = await fetch('/api/github-pr', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: trimmed }),
        });
        if (!res.ok) { setInputFetchError(friendlyError(await res.text())); return; }
        const data = await res.json();
        const header = `# PR: ${data.title}\n# Author: ${data.author}\n# Branch: ${data.branch} → ${data.baseBranch}\n# Changed files: ${data.changedFiles} (+${data.additions} -${data.deletions})\n${data.truncated ? '# Note: Diff truncated to 100KB\n' : ''}\n`;
        setInput((header + data.diff).slice(0, MAX_CHARS));
      }
      setFiles([]);
      setInputFetchValue('');
      setInputPanel('none');
    } catch (err) {
      setInputFetchError(err instanceof Error ? err.message : 'Failed to fetch');
    } finally {
      setInputFetching(false);
    }
  }

  async function handleCopy() {
    await navigator.clipboard.writeText(result);
    setCopied(true);
    // SM-019: Store timer ID for cleanup on unmount.
    if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
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

  // SM-001: Guard prevents chat while audit is loading.
  // SM-003: AbortController for chat stream; aborted on unmount or new chat.
  // SM-010: Explicit error recovery with retry affordance via message status.
  // SM-018: Optimistic messages tagged with status field.
  async function sendChat() {
    const trimmed = chatInput.trim();
    if (!trimmed || chatLoading || loading || !result) return;

    // Abort any previous chat stream.
    chatAbortRef.current?.abort();
    chatAbortRef.current = new AbortController();

    const userMsg: ChatMessage = { role: 'user', content: trimmed, status: 'done' };
    setChatMessages((prev) => [...prev, userMsg]);
    const savedInput = chatInput;
    setChatInput('');
    setChatLoading(true);

    try {
      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: [...chatMessages, { role: 'user', content: trimmed }].map((m) => ({ role: m.role, content: m.content })),
          context: `Code:\n${input}\n\nAudit Result:\n${result}`,
        }),
        signal: chatAbortRef.current.signal,
      });

      if (!res.ok || !res.body) {
        const errText = await res.text();
        setChatMessages((prev) => [...prev, { role: 'assistant', content: friendlyError(errText || `Error ${res.status}`), status: 'error' }]);
        setChatInput(savedInput);
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const chunks: string[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        if (chatAbortRef.current?.signal.aborted) return;
        chunks.push(decoder.decode(value, { stream: true }));
        const soFar = chunks.join('');
        setChatMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last?.role === 'assistant' && last.status === 'streaming') {
            return [...prev.slice(0, -1), { role: 'assistant', content: soFar, status: 'streaming' }];
          }
          return [...prev, { role: 'assistant', content: soFar, status: 'streaming' }];
        });
      }

      const final = chunks.join('');
      setChatMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last?.role === 'assistant') {
          return [...prev.slice(0, -1), { role: 'assistant', content: final, status: 'done' }];
        }
        return [...prev, { role: 'assistant', content: final, status: 'done' }];
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return;
      setChatMessages((prev) => {
        // SM-018: Mark the failed assistant message with error status for retry.
        return [...prev, { role: 'assistant', content: err instanceof Error ? err.message : 'Stream failed', status: 'error' }];
      });
    } finally {
      setChatLoading(false);
    }
  }

  // SM-010: Retry failed chat message.
  function retryChatMessage(failedIndex: number) {
    // Remove the failed assistant message and re-send from the last user message.
    setChatMessages((prev) => prev.filter((_, i) => i !== failedIndex));
    // Re-trigger will happen on next user action; or we can auto-retry:
    const lastUserMsg = chatMessages.filter((m) => m.role === 'user').at(-1);
    if (lastUserMsg) {
      setChatInput(lastUserMsg.content);
    }
  }

  // Scroll chat into view when new messages arrive
  useEffect(() => {
    if (chatMessages.length > 0) {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
    }
  }, [chatMessages]);

  // Auto-detect language/framework and recommend other agents
  // PERF-023: Use debounced input to avoid running 55 regex tests on every keystroke.
  const detection = useMemo(() => {
    if (debouncedInput.length < 50) return null;
    return detectAgents(debouncedInput);
  }, [debouncedInput]);

  const snippetDetection = useMemo(() => detectSnippet(debouncedInput), [debouncedInput]);

  const suggestedAgents = useMemo(() => {
    if (!detection || detection.recommendedAgents.length === 0) return [];
    return detection.recommendedAgents
      .filter((id) => id !== agent.id)
      .map((id) => agents.find((a) => a.id === id))
      .filter(Boolean)
      .slice(0, 5) as AgentConfig[];
  }, [detection, agent.id]);

  // PERF-003/004: Memoize derived values to avoid recalculation on every render.
  const wordCount = useMemo(
    () => (result.trim() ? result.trim().split(/\s+/).filter(Boolean).length : 0),
    [result],
  );
  const tokenEstimate = useMemo(() => Math.ceil(input.length / 4), [input]);
  const otherAgents = useMemo(() => agents.filter((a) => a.id !== agent.id), [agent.id]);
  const metrics = useMemo(() => {
    if (!result || loading) return null;
    return parseAuditResult(result);
  }, [result, loading]);

  return (
    <div className="flex flex-col gap-6">
      {/* VULN-003: localStorage plaintext disclosure */}
      <p className="text-xs text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-2.5">
        Audit history is stored in your browser&apos;s localStorage as unencrypted text. Do not submit proprietary credentials or sensitive data.
      </p>

      {/* SM-002: URL / PR import — single panel open at a time */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => { setInputPanel((v) => v === 'url' ? 'none' : 'url'); setInputFetchError(''); setInputFetchValue(''); }}
          className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 transition-colors"
          aria-expanded={inputPanel === 'url'}
          aria-label="Import from URL"
        >
          {inputPanel === 'url' ? '\u25BE' : '\u25B8'} Import from URL
        </button>
        <button
          onClick={() => { setInputPanel((v) => v === 'pr' ? 'none' : 'pr'); setInputFetchError(''); setInputFetchValue(''); }}
          className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 transition-colors"
          aria-expanded={inputPanel === 'pr'}
          aria-label="Import from GitHub PR"
        >
          {inputPanel === 'pr' ? '\u25BE' : '\u25B8'} Import from GitHub PR
        </button>
      </div>
      {inputPanel !== 'none' && (
        <div className="flex gap-2 mt-1">
          <input
            type="url"
            value={inputFetchValue}
            onChange={(e) => setInputFetchValue(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleFetchInput(); }}
            placeholder={inputPanel === 'url' ? `https:// — allowed: ${ALLOWED_URL_DESCRIPTION}` : 'https://github.com/owner/repo/pull/123'}
            className="flex-1 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500"
          />
          <button
            onClick={handleFetchInput}
            disabled={inputFetching || !inputFetchValue.trim()}
            className="px-4 py-2 rounded-lg text-sm bg-gray-200 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 hover:bg-gray-300 dark:hover:bg-zinc-700 disabled-muted-light transition-colors"
          >
            {inputFetching ? 'Fetching…' : inputPanel === 'url' ? 'Fetch' : 'Fetch PR'}
          </button>
        </div>
      )}
      {inputFetchError && <p className="mt-1 text-xs text-red-500">{inputFetchError}</p>}

      {/* SM-007: Diff mode toggle — disabled during loading */}
      <div className="flex items-center gap-2">
        <button
          onClick={() => setDiffMode((v) => !v)}
          disabled={loading}
          className={`text-xs px-3 py-1.5 rounded-lg transition-colors disabled-muted-light ${
            diffMode
              ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-600 dark:text-violet-300'
              : 'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 hover:bg-gray-200 dark:hover:bg-zinc-700'
          }`}
        >
          {diffMode ? '✓ Diff Mode' : 'Diff Mode'}
        </button>
        {diffMode && (
          <span className="text-xs text-gray-400 dark:text-zinc-500">
            Paste the old version below, new version in the main editor
          </span>
        )}
      </div>

      {/* Before code (diff mode) */}
      {diffMode && (
        <div className="relative">
          <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">Before (old code)</label>
          <textarea
            className="w-full h-40 bg-red-50/50 dark:bg-red-950/20 border border-red-200 dark:border-red-900/40 rounded-lg p-4 font-mono text-sm text-gray-900 dark:text-zinc-100 resize-y focus:outline-none focus:border-red-400 dark:focus:border-red-700 placeholder-gray-500 dark:placeholder-zinc-400"
            placeholder="Paste the original / old version of the code here…"
            value={beforeCode}
            onChange={(e) => setBeforeCode(e.target.value)}
            maxLength={MAX_CHARS}
            disabled={loading}
            aria-label="Before code for diff comparison"
          />
        </div>
      )}

      {/* Textarea */}
      <div className="relative">
        {diffMode && (
          <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1">After (new code)</label>
        )}
        <textarea
          className="w-full h-64 sm:h-80 bg-gray-50 dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg p-4 font-mono text-sm text-gray-900 dark:text-zinc-100 resize-y focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 focus-visible:ring-2 focus-visible:ring-violet-500 focus-visible:ring-offset-2 focus-visible:ring-offset-gray-50 dark:focus-visible:ring-offset-zinc-950 placeholder-gray-500 dark:placeholder-zinc-400"
          placeholder={`${agent.placeholder}\n\nTip: Press ⌘+Enter to run · Esc to stop`}
          value={input}
          onChange={(e) => { setInput(e.target.value); if (files.length > 0) setFiles([]); }}
          onKeyDown={handleKeyDown}
          maxLength={MAX_CHARS}
          disabled={loading}
          aria-label="Audit input"
        />
      </div>

      {/* Min input hint */}
      {input.length > 0 && input.length < 200 && !loading && !result && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
          Tip: Include more code for a more thorough audit. The best results come from complete files or modules.
        </p>
      )}

      {/* Snippet detection hint — shown when code looks like a fragment */}
      {snippetDetection.isSnippet && input.length >= 200 && !loading && !result && (
        <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
          Looks like a snippet ({snippetDetection.reason}). For the most accurate audit, include the full file with imports and surrounding context — findings based on fragments may not apply to your actual codebase.
        </p>
      )}

      {/* Smart suggestions */}
      {suggestedAgents.length > 0 && !loading && !result && (
        <div className="flex items-center gap-2 flex-wrap text-xs">
          <span className="text-gray-400 dark:text-zinc-500">
            {detection?.language && <span className="font-medium text-gray-500 dark:text-zinc-400">{detection.language}</span>}
            {detection?.framework && <span className="font-medium text-gray-500 dark:text-zinc-400"> + {detection.framework}</span>}
            {' '}detected — also try:
          </span>
          {suggestedAgents.map((a) => (
            <button
              key={a.id}
              onClick={() => handleChainTo(a.id)}
              className="px-2 py-1 rounded-md bg-violet-50 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
            >
              {a.name}
            </button>
          ))}
        </div>
      )}

      {/* Toolbar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={() => runAudit(buildAuditInput())}
          disabled={loading || !input.trim()}
          className={`inline-flex items-center gap-2 px-6 py-2.5 min-h-[44px] rounded-lg font-semibold text-sm text-white transition-colors disabled-muted focus-ring ${agent.buttonClass}`}
        >
          {loading && (
            <svg className="animate-spin h-4 w-4 text-white/80" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {loading ? `Auditing… ${elapsed}s` : 'Run Audit'}
        </button>

        {loading && (
          <button
            onClick={handleStop}
            className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors focus-ring"
          >
            Stop
          </button>
        )}

        {/* Paste button */}
        {canPaste && (
          <button
            onClick={handlePaste}
            disabled={loading}
            className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors disabled-muted-light focus-ring"
          >
            Paste
          </button>
        )}

        {/* File upload */}
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={loading}
          className="px-4 py-2.5 min-h-[44px] rounded-lg text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors disabled-muted-light focus-ring"
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
                className="text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 ml-1"
                aria-label={`Remove ${f.name}`}
              >✕</button>
            </span>
          ))}
          <span className="text-xs text-gray-400 dark:text-zinc-500" aria-live="polite" aria-atomic="true">
            {input.length.toLocaleString()} / {MAX_CHARS.toLocaleString()} · ~{tokenEstimate.toLocaleString()} tokens
          </span>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div role="alert" className="bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-800 rounded-lg p-4 text-red-600 dark:text-red-300 text-sm motion-safe:animate-fade-up">
          {error}
        </div>
      )}

      {/* Streaming indicator (no result yet) */}
      {loading && !result && (
        <div className="flex items-center gap-2 text-gray-500 dark:text-zinc-500 text-sm">
          <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
          <span>Analyzing...</span>
        </div>
      )}

      {/* Result panel */}
      {(result || loading) && (
        <div
          className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 border-t-2 border-t-violet-500/50 rounded-lg overflow-hidden animate-fade-up"
          aria-live="polite"
          aria-label="Audit result"
        >
          {/* Result header with export buttons */}
          <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2 border-b border-gray-200 dark:border-zinc-800">
            <span className="text-xs font-mono uppercase tracking-widest">
              {loading ? (
                <span className="flex items-center gap-1.5 text-violet-400">
                  <span className="w-2 h-2 rounded-full bg-violet-500 animate-pulse" />
                  Streaming
                  {wordCount > 0 && (
                    <span className="text-gray-400 dark:text-zinc-500 normal-case">· {wordCount.toLocaleString()} words</span>
                  )}
                </span>
              ) : 'Result'}
            </span>
            {!loading && result && (
              <div className="flex items-center gap-2 flex-wrap">
                <button
                  onClick={() => runAudit(buildAuditInput())}
                  aria-label="Re-run this audit"
                  className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 min-h-[44px] rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors focus-ring"
                >
                  Re-audit
                </button>
                <button
                  onClick={handleCopy}
                  aria-label="Copy result to clipboard"
                  className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 min-h-[44px] rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors focus-ring"
                >
                  {copied ? '✓ Copied' : 'Copy'}
                </button>
                <button
                  onClick={handleDownload}
                  aria-label="Download as Markdown"
                  className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 min-h-[44px] rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors focus-ring"
                >
                  Download .md
                </button>
                <button
                  onClick={handleDownloadJson}
                  aria-label="Download as JSON"
                  className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 min-h-[44px] rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors focus-ring"
                >
                  Download .json
                </button>
                {/* Try with... chain dropdown */}
                {input.trim() && otherAgents.length > 0 && (
                  <div ref={chainRef} className="relative">
                    <button
                      onClick={() => setChainOpen((v) => !v)}
                      className="text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-800 dark:hover:text-zinc-200 px-2 py-1 min-h-[44px] rounded hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors focus-ring"
                    >
                      Try with… ▾
                    </button>
                    {chainOpen && (
                      <div className="absolute right-0 top-full mt-1 w-56 max-w-[calc(100vw-2rem)] bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg shadow-lg z-10 overflow-hidden">
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
          {/* Metrics summary bar */}
          {metrics && metrics.totalFindings > 0 && (
            <div className="flex items-center gap-4 flex-wrap px-4 py-2.5 bg-gray-50 dark:bg-zinc-800/50 border-b border-gray-200 dark:border-zinc-800 text-xs">
              {metrics.score !== null && (
                <span className={`font-bold text-base ${metrics.score >= 80 ? 'text-green-600 dark:text-green-400' : metrics.score >= 60 ? 'text-amber-600 dark:text-amber-400' : 'text-red-600 dark:text-red-400'}`}>
                  {metrics.score}/100
                </span>
              )}
              {metrics.severityCounts.critical > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400 font-medium">
                  {metrics.severityCounts.critical} Critical
                </span>
              )}
              {metrics.severityCounts.high > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-orange-100 dark:bg-orange-950 text-orange-700 dark:text-orange-400 font-medium">
                  {metrics.severityCounts.high} High
                </span>
              )}
              {metrics.severityCounts.medium > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400 font-medium">
                  {metrics.severityCounts.medium} Medium
                </span>
              )}
              {metrics.severityCounts.low > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-slate-100 dark:bg-slate-900 text-slate-700 dark:text-slate-400 font-medium">
                  {metrics.severityCounts.low} Low
                </span>
              )}
              {metrics.severityCounts.informational > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-gray-100 dark:bg-zinc-700/40 text-gray-600 dark:text-zinc-400 font-medium">
                  {metrics.severityCounts.informational} Info
                </span>
              )}
              <span className="text-gray-400 dark:text-zinc-500 ml-auto">
                {metrics.filteredTotal < metrics.totalFindings
                  ? `${metrics.filteredTotal} actionable / ${metrics.totalFindings} total`
                  : `${metrics.totalFindings} finding${metrics.totalFindings !== 1 ? 's' : ''}`}
              </span>
              {metrics.suggestionCount > 0 && (
                <span className="text-gray-400 dark:text-zinc-500" title="Suggestions are improvement opportunities that don't indicate defects">
                  · {metrics.suggestionCount} suggestion{metrics.suggestionCount !== 1 ? 's' : ''}
                </span>
              )}
            </div>
          )}

          <div className="p-6 prose prose-sm max-w-prose dark:prose-invert">
            {/* PERF-011: Render plain text while streaming to avoid re-parsing
                markdown on every RAF tick. SafeMarkdown only on completion. */}
            {loading ? (
              <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-zinc-200 m-0 p-0 bg-transparent">{result}<span className="animate-blink"> ▍</span></pre>
            ) : (
              <SafeMarkdown>{result}</SafeMarkdown>
            )}
            <div ref={resultEndRef} />
          </div>
        </div>
      )}
      {/* Follow-up chat */}
      {!loading && result && (
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-lg overflow-hidden">
          <div className="px-4 py-2 border-b border-gray-200 dark:border-zinc-800">
            <span className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-zinc-400">
              Ask follow-up questions
            </span>
          </div>

          {/* Chat messages */}
          {chatMessages.length > 0 && (
            <div className="p-4 space-y-3 max-h-96 overflow-y-auto">
              {chatMessages.map((msg, i) => (
                <div
                  key={i}
                  className={`text-sm ${
                    msg.role === 'user'
                      ? 'text-gray-700 dark:text-zinc-300 bg-gray-50 dark:bg-zinc-800 rounded-lg px-3 py-2'
                      : msg.status === 'error'
                        ? 'text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 rounded-lg px-3 py-2'
                        : 'prose prose-sm max-w-prose dark:prose-invert'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <span className="font-medium">{msg.content}</span>
                  ) : (
                    <>
                      <SafeMarkdown>{msg.content}</SafeMarkdown>
                      {/* SM-010: Retry button for failed assistant messages */}
                      {msg.status === 'error' && (
                        <button
                          onClick={() => retryChatMessage(i)}
                          className="mt-1 text-xs text-red-500 hover:text-red-700 dark:hover:text-red-300 underline"
                        >
                          Retry
                        </button>
                      )}
                    </>
                  )}
                </div>
              ))}
              {chatLoading && chatMessages[chatMessages.length - 1]?.role === 'user' && (
                <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-zinc-500">
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500 animate-pulse" />
                  Thinking…
                </div>
              )}
              <div ref={chatEndRef} />
            </div>
          )}

          {/* Chat input */}
          <div className="flex gap-2 p-3 border-t border-gray-200 dark:border-zinc-800">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendChat(); } }}
              placeholder="How do I fix the critical findings?"
              disabled={chatLoading}
              className="flex-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 disabled-muted-light"
              aria-label="Follow-up question"
            />
            <button
              onClick={sendChat}
              disabled={chatLoading || !chatInput.trim()}
              aria-label="Send follow-up question"
              className="inline-flex items-center gap-1.5 px-4 py-2 min-h-[44px] rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors disabled-muted focus-ring"
            >
              {chatLoading ? (
                <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
              ) : 'Ask'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
