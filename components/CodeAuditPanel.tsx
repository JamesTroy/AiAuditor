'use client';

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { agents as allAgents } from '@/lib/agents/registry';
import { recommendAgents } from '@/lib/agents/agentRecommender';
import SafeMarkdown from '@/components/markdownComponents';
import { saveAudit } from '@/lib/history';
import { friendlyError } from '@/lib/friendlyError';
import { useSession } from '@/lib/auth-client';
import { parseAuditResult, stripStructuredBlock } from '@/lib/parseAuditResult';
import { deduplicateFindings, type DeduplicationResult } from '@/lib/deduplicateFindings';
import { transitions, tapScale } from '@/lib/motion/variants';
import GitHubSourcePicker from '@/components/GitHubSourcePicker';
import { MAX_CONTEXT_FILES } from '@/lib/schemas/auditRequest';

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
 * recommendAgents() may add more based on what's in the paste (top-N by relevance).
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

// ---------- Helpers ----------

function buildCombinedPrepPrompt(agents: typeof allAgents): string {
  if (agents.length === 0) return '';
  if (agents.length === 1) return agents[0].prepPrompt ?? '';

  const agentList = agents.map((a) => `- **${a.name}** (${a.category})`).join('\n');

  // Extract each agent's file-gathering section
  const sections: string[] = [];
  for (const agent of agents) {
    if (!agent.prepPrompt) continue;
    // Handle both "What to include" and "Files to gather" section headings
    const sectionMatch = agent.prepPrompt.match(
      /##\s+(?:What to include|Files to gather)([\s\S]*?)(?=\n##\s+(?:Formatting|Format\s|Don't|Keep|Tip|Run)|$)/,
    );
    if (sectionMatch) {
      sections.push(`### ${agent.name}\n${sectionMatch[1].trim()}`);
    }
  }

  return `I'm preparing code for a multi-agent audit using ${agents.length} auditors:

${agentList}

Please gather the files below and format them for the audit tool.

## Files to gather

${sections.join('\n\n')}

## Formatting rules

Format each file with \`--- path ---\` separators:
\`\`\`
--- src/path/to/file.ts ---
[file contents]

--- src/path/to/other.ts ---
[file contents]
\`\`\`

Add a brief comment above any file whose role isn't obvious from its name.
If no test files exist, note "# No tests yet" in your response.

**Keep total under 30,000 characters.** When trimming for space, prioritise:
security/auth → business logic → validation schemas → tests → config.`;
}

// ---------- Panel ----------

export default function CodeAuditPanel() {
  const { data: session } = useSession();

  // --- Input ---
  const [code, setCode] = useState('');
  const [runtimeContext, setRuntimeContext] = useState('');
  const [runtimeContextOpen, setRuntimeContextOpen] = useState(false);
  // Single "Add context" wrapper — replaces the previous three stacked toggles.
  const [contextOpen, setContextOpen] = useState(false);

  // --- Context files ---
  interface ContextFile { name: string; content: string; }
  const [contextFiles, setContextFiles] = useState<ContextFile[]>([]);
  const contextFileInputRef = useRef<HTMLInputElement>(null);

  function handleContextFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const fileList = Array.from(e.target.files ?? []);
    if (fileList.length === 0) return;
    const readers = fileList.map(
      (file) => new Promise<ContextFile>((resolve) => {
        const reader = new FileReader();
        reader.onload = (ev) => resolve({ name: file.name, content: (ev.target?.result as string) ?? '' });
        reader.readAsText(file);
      }),
    );
    Promise.all(readers).then((newFiles) => {
      setContextFiles((prev) => [...prev, ...newFiles].slice(0, MAX_CONTEXT_FILES));
    });
    e.target.value = '';
  }

  function removeContextFile(name: string) {
    setContextFiles((prev) => prev.filter((f) => f.name !== name));
  }

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
  const [prepCopied, setPrepCopied] = useState(false);
  const [prepOpen, setPrepOpen] = useState(false);
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
        return { agentId: agent.id, agentName: agent.name, agentCategory: agent.category, findings: metrics.findings };
      })
      .filter((s): s is NonNullable<typeof s> => s !== null);
    if (agentSets.length < 2) return null;
    return deduplicateFindings(agentSets);
  }, [loading, agentStreamingTexts, selectedAgents]);

  // Combined prep prompt for all selected agents
  const combinedPrepPrompt = useMemo(
    () => buildCombinedPrepPrompt(selectedAgents),
    [selectedAgents],
  );

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
  // Use the ranked recommender (not the raw recommendedAgents list) so we only
  // add agents that scored above a relevance threshold. The previous version
  // added EVERY agent for EVERY matched tag, so a normal Next.js paste could
  // dump 10+ agents into the selection (auth, concurrency, error-handling,
  // forms, etc. all triggered by ubiquitous patterns like async/await, try/catch).
  const AUTO_ADD_RELEVANCE_THRESHOLD = 40;
  const AUTO_ADD_MAX = 3;

  const handleCodeChange = useCallback(
    (value: string) => {
      setCode(value);
      if (loading) return;

      const ranked = recommendAgents(value, AUTO_ADD_MAX);
      const newIds = ranked.recommendations
        .filter((r) => r.relevance >= AUTO_ADD_RELEVANCE_THRESHOLD)
        .map((r) => r.agentId)
        .filter((id) => allAgents.some((a) => a.id === id) && !selected.has(id));

      if (newIds.length > 0) {
        setSelected((prev) => {
          const next = new Set(prev);
          for (const id of newIds) next.add(id);
          return next;
        });
      }

      if (ranked.language || ranked.framework || newIds.length > 0) {
        setAutoDetectInfo({
          language: ranked.language,
          framework: ranked.framework,
          addedIds: newIds,
        });
        // Pick the most relevant category to highlight in the picker
        const tag = ranked.framework ?? ranked.language;
        const cat =
          tag && ['react', 'nextjs', 'vue', 'angular', 'svelte', 'solidjs', 'astro', 'tailwind', 'remix'].includes(tag)
            ? 'Design'
            : tag && ['express', 'nestjs', 'fastify', 'hono', 'trpc', 'graphql', 'websocket'].includes(tag)
              ? 'Infrastructure'
              : ranked.detectedTags.includes('auth') || ranked.detectedTags.includes('sql')
                ? 'Security & Privacy'
                : ranked.detectedTags.includes('testing')
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
    ctxFiles?: { name: string; content: string }[],
  ): Promise<string> {
    const body: Record<string, unknown> = { agentType: agentId, input };
    if (extraContext) body.runtimeContext = extraContext;
    if (ctxFiles && ctxFiles.length > 0) body.contextFiles = ctxFiles;
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
          contextFiles.length > 0 ? contextFiles : undefined,
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
  // Receives source content fetched from GitHub via GitHubSourcePicker.
  // Replaces the textarea contents so the audit flow stays identical to a paste.
  const handleGitHubSource = useCallback(
    (result: { content: string; summary: string }) => {
      if (loading) return;
      handleCodeChange(result.content);
    },
    [loading, handleCodeChange],
  );

  return (
    <div className="relative text-gray-900 dark:text-zinc-100 px-6 pb-16">
      {/* PERF: Ambient glow orb. Was h-400 × w-700 with blur-[100px] +
          opacity animation — a 100px CSS filter blur on a half-screen
          area is one of the most expensive operations a browser can do,
          and the looping animation forced the compositor to either
          repaint the blurred region every frame or hold a huge GPU
          layer. That capped effective refresh rate on /audit (the most-
          used page) and is the root cause of "site feels low Hz."

          Replaced with a radial-gradient background which is zero
          paint cost (composited as a flat layer) and a slow opacity-
          only pulse so the soul of the effect is preserved. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute left-1/2 top-[-120px] -translate-x-1/2 -z-10 h-[400px] w-[700px] motion-safe:animate-[aurora_10s_ease-in-out_infinite]"
        style={{
          background: 'radial-gradient(closest-side, rgba(139,92,246,0.16), rgba(139,92,246,0.06) 45%, transparent 75%)',
        }}
      />
      <div className="max-w-4xl mx-auto">

        {/* Hero heading — visible only in idle state */}
        {!loading && !result && !code && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0, transition: transitions.soft }}
            className="text-center pt-8 mb-8"
          >
            <div className="inline-flex items-center gap-2 bg-violet-950/60 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full border border-violet-800/50 mb-6 select-none">
              <span className="w-1.5 h-1.5 bg-violet-400 rounded-full motion-safe:animate-pulse" />
              {allAgents.length} specialized auditors ready
            </div>
            <h1 className="text-4xl sm:text-5xl font-bold tracking-tight text-white mb-3">
              Audit your{' '}
              <span className="text-violet-400">code</span>
            </h1>
            <p className="text-base text-zinc-400 font-light max-w-md mx-auto">
              Paste any language. Auditors auto-select. Results stream live.
            </p>
          </motion.div>
        )}

        {/* Code Input */}
        <div className="mb-1.5">
          <div className="relative group">
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-violet-600/30 via-violet-600/5 to-indigo-600/20 opacity-0 group-focus-within:opacity-100 pointer-events-none transition-opacity duration-500" />
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
            className="w-full bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-2xl px-5 py-4 text-sm font-mono text-gray-900 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-violet-500/60 dark:focus:border-violet-500/60 focus-visible:ring-2 focus-visible:ring-violet-500/40 focus-visible:ring-offset-0 resize-y min-h-[210px] transition-[border-color,box-shadow] duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
            aria-label="Code to audit"
          />
          </div>
          {/* Privacy line — inline footer instead of its own row. */}
          <p className="mt-1 text-[11px] text-gray-400 dark:text-zinc-500 flex items-center gap-1">
            <svg className="w-3 h-3 text-green-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
            </svg>
            Analyzed in memory and immediately discarded — never stored, never used for training.
          </p>
        </div>

        {/* Sample code button — only shown when textarea is empty */}
        {!code && !loading && !result && (
          <div className="mb-2 flex items-center gap-2">
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
          <div className="mb-2 flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-medium bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300">
              <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
              </svg>
              {[autoDetectInfo.language, autoDetectInfo.framework].filter(Boolean).join(' + ') || 'Code'} detected
              {autoDetectInfo.addedIds.length > 0 && ` — ${autoDetectInfo.addedIds.length} auditors auto-added`}
            </span>
          </div>
        )}

        {/* Feature benefit cards — shown in idle state before code is pasted */}
        {!loading && !result && !code && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-5">
            {[
              {
                iconBg: 'bg-red-950/60 border-red-900/40 text-red-400',
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                  </svg>
                ),
                title: 'Severity-rated findings',
                desc: 'Critical to Low — fix what matters first',
              },
              {
                iconBg: 'bg-blue-950/60 border-blue-900/40 text-blue-400',
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                ),
                title: 'Line-level references',
                desc: 'Exact file and line numbers cited',
              },
              {
                iconBg: 'bg-emerald-950/60 border-emerald-900/40 text-emerald-400',
                icon: (
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                ),
                title: 'Fix suggestions',
                desc: 'Concrete code changes, not vague advice',
              },
            ].map((card) => (
              <div key={card.title} className="flex items-start gap-3 p-4 rounded-xl bg-zinc-900/60 dark:bg-zinc-900/60 border border-zinc-800/60 dark:border-zinc-800">
                <div className={`w-8 h-8 rounded-lg border flex items-center justify-center shrink-0 ${card.iconBg}`}>
                  {card.icon}
                </div>
                <div>
                  <p className="text-sm font-medium dark:text-zinc-200 text-gray-700">{card.title}</p>
                  <p className="text-xs dark:text-zinc-500 text-gray-400 mt-0.5 leading-relaxed">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Consolidated "Add context" — single toggle holding Files, Runtime, and GitHub. */}
        <div className="mb-3">
          <button
            type="button"
            onClick={() => setContextOpen((o) => !o)}
            className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors"
            aria-expanded={contextOpen}
          >
            <svg
              className={`w-3.5 h-3.5 transition-transform ${contextOpen ? 'rotate-90' : ''}`}
              fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
            Add context
            {/* Indicator chips for what's currently attached. */}
            {contextFiles.length > 0 && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-900/40 text-blue-700 dark:text-blue-300 text-[10px] font-medium">
                {contextFiles.length} file{contextFiles.length === 1 ? '' : 's'}
              </span>
            )}
            {runtimeContext.trim() && (
              <span className="ml-1 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-900/40 text-violet-700 dark:text-violet-300 text-[10px] font-medium">
                runtime
              </span>
            )}
            <span className="ml-1 text-gray-400 dark:text-zinc-600">
              · GitHub · files · runtime
            </span>
          </button>

          <AnimatePresence initial={false}>
            {contextOpen && (
              <motion.div
                key="context-panel"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', transition: transitions.soft }}
                exit={{ opacity: 0, height: 0, transition: transitions.snappy }}
                style={{ overflow: 'hidden' }}
              >
                <div className="mt-2 p-3 rounded-xl bg-gray-50 dark:bg-zinc-950/90 border border-gray-200 dark:border-zinc-800 space-y-3">

                  {/* GitHub source — its own nested toggle (PR / repo / compare / commit). */}
                  <GitHubSourcePicker onSource={handleGitHubSource} disabled={loading} />

                  {/* Attach files */}
                  <div>
                    <div className="inline-flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => contextFileInputRef.current?.click()}
                        disabled={loading || contextFiles.length >= MAX_CONTEXT_FILES}
                        title="Attach related files (middleware, auth config, shared utilities) so auditors know what the primary code depends on — these files are not audited themselves"
                        className="inline-flex items-center gap-1.5 text-xs text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13" />
                        </svg>
                        Attach context files{contextFiles.length > 0 ? ` (${contextFiles.length}/${MAX_CONTEXT_FILES})` : ''}
                      </button>
                      <input
                        ref={contextFileInputRef}
                        type="file"
                        multiple
                        accept=".js,.ts,.tsx,.jsx,.html,.css,.py,.go,.java,.rb,.php,.md,.txt,.json,.yaml,.yml,.toml,.env.example"
                        onChange={handleContextFileChange}
                        className="hidden"
                        aria-label="Attach context files"
                      />
                      {contextFiles.map((f) => (
                        <span
                          key={f.name}
                          title="Context file — sent alongside your code but not audited itself"
                          className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/40 px-2 py-0.5 rounded font-mono flex items-center gap-1"
                        >
                          {f.name}
                          <button
                            onClick={() => removeContextFile(f.name)}
                            className="text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 ml-1"
                            aria-label={`Remove ${f.name}`}
                          >✕</button>
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Runtime context — sub-toggle */}
                  <div>
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
                          className="w-full bg-white dark:bg-zinc-950 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-xs font-mono text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 focus-visible:ring-2 focus-visible:ring-violet-500 resize-y disabled:opacity-50 disabled:cursor-not-allowed"
                          aria-label="Runtime context (optional)"
                        />
                        <p className="mt-1 text-[11px] text-gray-400 dark:text-zinc-600 flex justify-between">
                          <span>Stack traces and logs help auditors distinguish theoretical issues from confirmed runtime failures.</span>
                          <span>{runtimeContext.length}/15000</span>
                        </p>
                      </div>
                    )}
                  </div>

                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Action Row */}
        <div className="flex flex-col sm:flex-row gap-3 mb-5">
          <motion.button
            id="run-audit-btn"
            onClick={runCodeAudit}
            disabled={loading || !code.trim() || selected.size === 0}
            whileTap={tapScale}
            className="flex-1 sm:flex-none px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-900/40 active:translate-y-0 transition-all duration-150 disabled:bg-gradient-to-r disabled:from-zinc-700 disabled:to-zinc-700 dark:disabled:from-zinc-800 dark:disabled:to-zinc-800 disabled:text-zinc-400 dark:disabled:text-zinc-500 disabled:shadow-none disabled:translate-y-0 disabled:cursor-not-allowed focus-ring whitespace-nowrap"
          >
            {loading
              ? `Auditing… ${completedIndices.size}/${selectedAgents.length} complete`
              : selected.size === 1
                ? 'Run 1 Audit'
                : `Run ${selected.size} Audits`}
          </motion.button>
          <AnimatePresence>
            {loading && (
              <motion.button
                onClick={handleStop}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0, transition: transitions.springGentle }}
                exit={{ opacity: 0, x: -8, transition: transitions.snappy }}
                whileTap={tapScale}
                className="px-6 py-3.5 rounded-xl text-base text-gray-600 dark:text-zinc-400 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors focus-ring"
              >
                Stop
              </motion.button>
            )}
          </AnimatePresence>
        </div>

        {/* Agent Picker + Prep Prompt */}
        {!loading && !result && (
          <>
          <div id="agent-picker" className="mb-5">
            <button
              onClick={() => setPickerOpen(!pickerOpen)}
              className="flex items-center justify-between w-full px-4 py-2.5 rounded-xl bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 hover:border-gray-300 dark:hover:border-zinc-700 dark:hover:bg-zinc-900 transition-colors mb-2 group"
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
                    <AnimatePresence initial={false} mode="popLayout">
                      {selectedAgents.slice(0, 4).map((a) => (
                        <motion.span
                          key={a.id}
                          layout
                          initial={{ opacity: 0, scale: 0.85 }}
                          animate={{ opacity: 1, scale: 1, transition: transitions.springGentle }}
                          exit={{ opacity: 0, scale: 0.85, transition: transitions.snappy }}
                          className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-gray-200 dark:bg-zinc-700 text-gray-500 dark:text-zinc-400 shrink-0"
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor(a.accentClass)}`} />
                          {a.name}
                        </motion.span>
                      ))}
                      {selectedAgents.length > 4 && (
                        <motion.span
                          key="more-count"
                          layout
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          exit={{ opacity: 0 }}
                          className="text-xs text-gray-400 dark:text-zinc-500 shrink-0"
                        >
                          +{selectedAgents.length - 4} more
                        </motion.span>
                      )}
                    </AnimatePresence>
                  </span>
                )}
              </span>
              <span className="text-xs text-gray-400 dark:text-zinc-500 group-hover:text-gray-600 dark:group-hover:text-zinc-300 transition-colors shrink-0 ml-2">
                {pickerOpen ? 'Close' : 'Customize'}
              </span>
            </button>

            <AnimatePresence initial={false}>
            {pickerOpen && (
              <motion.div
                key="picker-content"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto', transition: transitions.soft }}
                exit={{ opacity: 0, height: 0, transition: transitions.snappy }}
                style={{ overflow: 'hidden' }}
              >
              <div className="bg-gray-50 dark:bg-zinc-950/90 border border-gray-200 dark:border-zinc-800 rounded-xl p-4">
                {/* Global controls */}
                <div className="flex flex-wrap gap-2 mb-3 pb-2.5 border-b border-gray-200 dark:border-zinc-800">
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
                    Recommended ({SEED_IDS.size})
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

                {/* Category sections — `layout` on each block so re-ordering by
                    smart-suggestion highlight animates smoothly. */}
                <div className="space-y-4">
                  {Array.from(grouped.entries()).map(([cat, catAgents]) => {
                    if (catAgents.length === 0) return null;
                    const allSelected = catAgents.every((a) => selected.has(a.id));
                    const someSelected = catAgents.some((a) => selected.has(a.id));
                    const isHighlighted = suggestedCategory === cat;
                    return (
                      <motion.div
                        key={cat}
                        layout
                        transition={transitions.springGentle}
                        className={isHighlighted ? 'rounded-lg ring-1 ring-violet-400/40 dark:ring-violet-600/40 bg-violet-50/40 dark:bg-violet-950/20 p-2 -mx-2' : ''}
                      >
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
                                className={`flex items-start gap-2.5 px-3 py-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-white dark:bg-zinc-800 shadow-sm' : 'hover:bg-white dark:hover:bg-zinc-800/50'}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isSelected}
                                  onChange={() => toggleAgent(agent.id)}
                                  className="sr-only"
                                />
                                <span className={`w-4 h-4 rounded border-2 flex items-center justify-center flex-shrink-0 transition-colors mt-0.5 ${isSelected ? 'bg-violet-600 border-violet-600' : 'border-gray-300 dark:border-zinc-600'}`}>
                                  {isSelected && (
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="4">
                                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                    </svg>
                                  )}
                                </span>
                                <span className={`w-2 h-2 rounded-full flex-shrink-0 mt-1 ${dotColor(agent.accentClass)}`} />
                                <div className="flex flex-col min-w-0">
                                  <span className="text-sm text-gray-700 dark:text-zinc-300">{agent.name}</span>
                                  {agent.description && (
                                    <span className="text-[11px] text-gray-400 dark:text-zinc-500 leading-tight mt-0.5 block">
                                      {agent.description.length > 80 ? agent.description.slice(0, 80) + '…' : agent.description}
                                    </span>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
              </motion.div>
            )}
            </AnimatePresence>
          </div>

          {/* Prep Prompt — appears after agent picker when agents are selected */}
          {selectedAgents.length > 0 && combinedPrepPrompt && (
            <div className="mt-3 rounded-xl border border-violet-200 dark:border-violet-900/60 bg-violet-50 dark:bg-violet-950/30 overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <svg className="w-4 h-4 shrink-0 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-violet-700 dark:text-violet-300 leading-tight">
                      Code prep prompt
                    </p>
                    <p className="text-xs text-violet-500 dark:text-violet-400 leading-tight mt-0.5 hidden sm:block">
                      {selectedAgents.length === 1
                        ? `Paste into Claude or Cursor — tells it exactly what files ${selectedAgents[0].name} needs`
                        : `Paste into Claude or Cursor to gather the right files for all ${selectedAgents.length} auditors`}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={async () => {
                      await navigator.clipboard.writeText(combinedPrepPrompt);
                      setPrepCopied(true);
                      setTimeout(() => setPrepCopied(false), 2000);
                    }}
                    className="text-xs font-medium px-3 py-1.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white transition-colors focus-ring"
                  >
                    {prepCopied ? '✓ Copied' : 'Copy prompt'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setPrepOpen((o) => !o)}
                    className="text-xs text-violet-500 dark:text-violet-400 hover:text-violet-700 dark:hover:text-violet-300 transition-colors focus-ring px-1"
                    aria-label={prepOpen ? 'Hide preview' : 'Preview prompt'}
                  >
                    <svg className={`w-4 h-4 transition-transform ${prepOpen ? 'rotate-90' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </button>
                </div>
              </div>
              <AnimatePresence initial={false}>
                {prepOpen && (
                  <motion.div
                    key="prep-preview"
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto', transition: transitions.soft }}
                    exit={{ opacity: 0, height: 0, transition: transitions.snappy }}
                    style={{ overflow: 'hidden' }}
                  >
                    <pre className="px-4 py-3 text-xs font-mono text-violet-700 dark:text-violet-300 whitespace-pre-wrap leading-relaxed border-t border-violet-200 dark:border-violet-900/60 bg-violet-50/50 dark:bg-violet-950/20 max-h-96 overflow-y-auto">
                      {combinedPrepPrompt}
                    </pre>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}
          </>
        )}

        {/* Progress bar — sticky during run, always compact (progress bar only, no badge list) */}
        {loading && selectedAgents.length > 0 && (
          <div className="mb-3 sticky top-0 z-10 bg-white dark:bg-zinc-950 border-b border-transparent dark:border-zinc-900 py-3 -mx-6 px-6">
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
                className="h-full bg-gradient-to-r from-violet-500 to-indigo-500 rounded-full transition-[width] duration-500 ease-out"
                style={{ width: `${(completedIndices.size / selectedAgents.length) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Agent badge list — collapsible so it never blocks scroll */}
        {(loading || (!loading && result)) && (
          <div className="mb-4">
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
                        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-300 hover:ring-1 hover:ring-violet-500/40 hover:text-violet-600 dark:hover:text-violet-300"
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
                      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-colors duration-300 ${
                        isActive
                          ? 'bg-violet-100 dark:bg-violet-900/30 text-violet-700 dark:text-violet-300 ring-1 ring-violet-500/30 shadow-sm'
                          : isDone
                            ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400'
                            : 'bg-gray-100/50 dark:bg-zinc-900 text-gray-400 dark:text-zinc-600'
                      }`}
                    >
                      {isActive && <span className={`w-2 h-2 rounded-full ${dotColor(agent.accentClass)} motion-safe:animate-pulse flex-shrink-0`} />}
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
            <span className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-pulse" />
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
          <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 border-t-2 border-t-violet-500/60 rounded-xl overflow-hidden shadow-xl dark:shadow-black/30">
            <div className="flex items-center justify-between flex-wrap gap-2 px-4 py-2 border-b border-gray-200 dark:border-zinc-800">
              <span className="text-xs font-mono uppercase tracking-widest">
                {loading ? (
                  <span className="flex items-center gap-1.5 text-violet-400">
                    <span className="w-2 h-2 rounded-full bg-violet-500 motion-safe:animate-pulse" />
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
                  <span className="motion-safe:animate-blink"> ▍</span>
                </pre>
              ) : (
                <SafeMarkdown>{stripStructuredBlock(result)}</SafeMarkdown>
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
                      className="w-full py-3.5 rounded-xl font-semibold text-base text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-colors focus-ring flex items-center justify-center gap-2"
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
              <div className="bg-white dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 border-t-2 border-t-indigo-500/60 rounded-xl overflow-hidden mt-3 shadow-xl dark:shadow-black/30">
                <div className="px-4 py-2 border-b border-gray-200 dark:border-zinc-800">
                  <span className="text-xs font-mono uppercase tracking-widest">
                    {synthStatus === 'loading' ? (
                      <span className="flex items-center gap-1.5 text-indigo-400">
                        <span className="w-2 h-2 rounded-full bg-indigo-500 motion-safe:animate-pulse" />
                        Synthesizing findings…
                      </span>
                    ) : 'Remediation Roadmap & Analysis'}
                  </span>
                </div>
                <div className="p-6 prose prose-sm max-w-prose dark:prose-invert">
                  {synthStatus === 'loading' ? (
                    <pre className="whitespace-pre-wrap font-mono text-sm text-gray-800 dark:text-zinc-200 m-0 p-0 bg-transparent">
                      {synthesis}
                      <span className="motion-safe:animate-blink"> ▍</span>
                    </pre>
                  ) : (
                    <SafeMarkdown>{synthesis}</SafeMarkdown>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

      </div>
    </div>
  );
}
