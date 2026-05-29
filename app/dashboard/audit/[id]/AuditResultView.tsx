'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import SafeMarkdown from '@/components/markdownComponents';
import { setChainInput } from '@/lib/session';
import { parseAuditResult, stripStructuredBlock, type Finding } from '@/lib/parseAuditResult';
import { detectSnippet } from '@/lib/detectSnippet';
import { fadeUp, staggerContainer, transitions } from '@/lib/motion/variants';
import type { AgentFpRate } from '@/app/api/agents/fp-rates/route';
import type { BlastRadiusTier } from '@/lib/ai/findingSchema';
import { ExecutiveSummaryCard } from './ExecutiveSummaryCard';

// BLAST-001: When the audit has dependency-graph data, group findings by
// blast-radius tier so cross-cutting issues surface above local ones.
// Ordering: shared (4+ callers) > module (1-3 callers) > leaf (0) >
// findings with no resolvable graph location. Severity stays as the
// secondary sort within each tier because the upstream list is already
// severity-desc.
const TIER_ORDER: BlastRadiusTier[] = ['shared', 'module', 'leaf', 'unknown'];

const TIER_META: Record<BlastRadiusTier, {
  label: string;
  hint: string;
  dotClass: string;
  badgeClass: string;
}> = {
  shared: {
    label: 'Shared modules',
    hint: 'Imported by 4+ files in this audit — fixing here ripples to every caller.',
    dotClass: 'bg-red-500',
    badgeClass: 'bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300',
  },
  module: {
    label: 'Module scope',
    hint: 'Imported by 1–3 files — contained impact, but worth fixing soon.',
    dotClass: 'bg-amber-500',
    badgeClass: 'bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300',
  },
  leaf: {
    label: 'Leaf utilities',
    hint: 'No other file in the bundle imports this — local risk.',
    dotClass: 'bg-slate-400',
    badgeClass: 'bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-zinc-400',
  },
  unknown: {
    label: 'Other locations',
    hint: "Couldn't map this finding's file to the dependency graph — treat as unknown blast radius.",
    dotClass: 'bg-gray-300 dark:bg-zinc-600',
    badgeClass: 'bg-gray-100 dark:bg-zinc-900 text-gray-500 dark:text-zinc-500',
  },
};

function tierOf(f: Finding): BlastRadiusTier {
  return f.blastRadius?.tier ?? 'unknown';
}

// Reusable banner animation — fade + slight slide. Used by all three
// status banners (snippet detected, high-FP, cold-start) so they enter and
// exit consistently as conditions flip mid-stream.
const bannerVariants = {
  hidden: { opacity: 0, y: -6, height: 0, marginBottom: 0 },
  visible: { opacity: 1, y: 0, height: 'auto', marginBottom: 16, transition: transitions.soft },
  exit: { opacity: 0, y: -6, height: 0, marginBottom: 0, transition: transitions.snappy },
} as const;

interface Props {
  result: string | null;
  agentName: string;
  agentId: string;
  input: string;
  auditId?: string;
  status?: string;
  createdDate?: string;
}

// FP-UI: Store dismissed finding IDs per audit in localStorage
function getDismissedKey(auditId: string) {
  return `claudit:dismissed:${auditId}`;
}

function loadDismissed(auditId: string | undefined): Set<string> {
  if (!auditId) return new Set();
  try {
    const raw = localStorage.getItem(getDismissedKey(auditId));
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch {
    return new Set();
  }
}

function saveDismissed(auditId: string | undefined, ids: Set<string>) {
  if (!auditId) return;
  try {
    localStorage.setItem(getDismissedKey(auditId), JSON.stringify([...ids]));
  } catch { /* quota exceeded — ignore */ }
}

export default function AuditResultView({ result, agentName, agentId, input, auditId, status, createdDate }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);
  const [dismissed, setDismissed] = useState<Set<string>>(() => loadDismissed(auditId));
  const [showDismissed, setShowDismissed] = useState(false);
  const [highFpLikely, setHighFpLikely] = useState(false);
  // FP-COLD-START: agent has too few audits run for the FP signal to be
  // trustworthy yet. Same effect on filteredFindings as highFpLikely, but a
  // different banner so the user knows why findings are hidden.
  const [coldStart, setColdStart] = useState(false);

  // FP-RATE: Fetch per-agent [LIKELY] false-positive rates and downgrade
  // [LIKELY] findings to [POSSIBLE] for agents that cross the threshold.
  // Also flag cold-start agents (no usage data yet) for the same treatment.
  useEffect(() => {
    fetch('/api/agents/fp-rates')
      .then((r) => r.ok ? r.json() : { rates: [], coldStartAgentIds: [] })
      .then(({ rates, coldStartAgentIds }: { rates: AgentFpRate[]; coldStartAgentIds?: string[] }) => {
        const match = rates.find((r) => r.agentId === agentId);
        if (match?.highLikelyFpRate) setHighFpLikely(true);
        if (coldStartAgentIds?.includes(agentId)) setColdStart(true);
      })
      .catch(() => { /* degrade gracefully — don't affect the render */ });
  }, [agentId]);

  const metrics = useMemo(() => {
    if (!result) return null;
    return parseAuditResult(result, {
      downgradeHighFpLikely: highFpLikely,
      coldStart,
    });
  }, [result, highFpLikely, coldStart]);

  const snippetDetection = useMemo(() => detectSnippet(input), [input]);

  // BLAST-001: Build a tier-grouped view of findings when blast radius data
  // is present. Returns null when no finding has a resolved tier — single-
  // file audits, or audits where every finding's location couldn't be mapped
  // back to the graph. In that case we render the flat list unchanged.
  const tieredFindings = useMemo(() => {
    if (!metrics) return null;
    const hasBlastData = metrics.filteredFindings.some((f) => f.blastRadius);
    if (!hasBlastData) return null;
    const groups = new Map<BlastRadiusTier, Finding[]>();
    for (const tier of TIER_ORDER) groups.set(tier, []);
    for (const f of metrics.filteredFindings) groups.get(tierOf(f))!.push(f);
    return TIER_ORDER
      .map((tier) => ({ tier, findings: groups.get(tier)! }))
      .filter((g) => g.findings.length > 0);
  }, [metrics]);

  const fireDismissalEvent = useCallback((
    finding: { severity: string; confidence?: string },
    action: 'dismiss' | 'restore',
  ) => {
    // Fire-and-forget — never await, never block the dismiss action
    fetch('/api/analytics/dismissal', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        agentId,
        agentName,
        severity: finding.severity,
        confidence: finding.confidence ?? null,
        action,
      }),
    }).catch(() => { /* analytics must never affect the dismiss UX */ });
  }, [agentId, agentName]);

  const dismissFinding = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      saveDismissed(auditId, next);
      return next;
    });
    const finding = metrics?.findings.find((f) => f.id === id);
    if (finding) fireDismissalEvent(finding, 'dismiss');
  }, [auditId, metrics, fireDismissalEvent]);

  const restoreFinding = useCallback((id: string) => {
    setDismissed((prev) => {
      const next = new Set(prev);
      next.delete(id);
      saveDismissed(auditId, next);
      return next;
    });
    const finding = metrics?.findings.find((f) => f.id === id);
    if (finding) fireDismissalEvent(finding, 'restore');
  }, [auditId, metrics, fireDismissalEvent]);

  if (!result) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-8 text-center">
        {status === 'failed' ? (
          <>
            <p className="text-gray-900 dark:text-zinc-100 font-medium mb-1">This audit did not complete</p>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
              The analysis may have timed out or encountered an error. Try running it again.
            </p>
            <Link
              href="/audit"
              className="inline-block px-5 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring"
            >
              Run a new audit
            </Link>
          </>
        ) : (
          <p className="text-gray-500 dark:text-zinc-500">No result available for this audit.</p>
        )}
      </div>
    );
  }

  // FP-010: Count only dismissed findings that are in filteredFindings (i.e. [CERTAIN]/[LIKELY]
  // vulnerabilities/deficiencies). Dismissed [POSSIBLE] or [SUGGESTION] IDs in localStorage
  // must not affect the active count — those findings aren't scored to begin with.
  const dismissedCount = metrics
    ? metrics.filteredFindings.filter((f) => dismissed.has(f.id)).length
    : 0;
  const activeFindingCount = Math.max(0, (metrics?.filteredTotal ?? 0) - dismissedCount);

  // FP-007: Estimate adjusted score when findings are dismissed.
  // Each dismissed critical finding adds ~8 points, high adds ~5, medium adds ~3, low adds ~1.
  // Only count dismissed findings from filteredFindings — [POSSIBLE] and [SUGGESTION] are
  // already excluded from scoring, so dismissing them should not add a bonus.
  const adjustedScore = useMemo(() => {
    if (!metrics?.score || dismissedCount === 0) return null;
    let bonus = 0;
    for (const f of metrics.filteredFindings) {
      if (!dismissed.has(f.id)) continue;
      if (f.severity === 'critical') bonus += 8;
      else if (f.severity === 'high') bonus += 5;
      else if (f.severity === 'medium') bonus += 3;
      else if (f.severity === 'low') bonus += 1;
    }
    return Math.min(100, metrics.score + bonus);
  }, [metrics, dismissed, dismissedCount]);

  function handleDownload() {
    const blob = new Blob([result!], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateSuffix = createdDate ? `-${createdDate}` : '';
    a.download = `${agentName.toLowerCase().replace(/\s+/g, '-')}${dateSuffix}-audit.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result!);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: clipboard API may be unavailable in insecure contexts
    }
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2 mb-4">
        <button
          onClick={() => {
            setChainInput(input);
            router.push(`/audit/${agentId}`);
          }}
          className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-500 border border-violet-300 dark:border-violet-700 rounded-lg px-3 py-1.5 min-h-[44px] transition-colors focus-ring font-medium"
        >
          Re-run on this code
        </button>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 min-h-[44px] transition-colors focus-ring"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={handleDownload}
          className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 min-h-[44px] transition-colors focus-ring"
        >
          Download .md
        </button>
      </div>

      {/* Executive summary — plain-English, PM-friendly, lazy-generated.
          Hidden while streaming because the synth needs the final findings. */}
      {auditId && status === 'completed' && (
        <ExecutiveSummaryCard auditId={auditId} />
      )}

      {/* Conditional banners — wrapped in AnimatePresence so they slide in/out
          smoothly as conditions flip mid-stream (e.g. FP-rates fetch resolves
          after initial render). `mode="popLayout"` lets siblings shift up when
          a banner exits without waiting for the exit animation to finish. */}
      <AnimatePresence mode="popLayout">
        {snippetDetection.isSnippet && (
          <motion.div
            key="snippet-banner"
            variants={bannerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 overflow-hidden"
          >
            <span className="mt-0.5 flex-shrink-0">ℹ️</span>
            <span>
              <strong>Partial context detected</strong> — this audit was run on a code snippet ({snippetDetection.reason}). Findings that depend on imports, surrounding types, or module-level state may not apply to your actual codebase. Re-run with the full file for higher confidence results.
            </span>
          </motion.div>
        )}

        {/* FP-RATE-UI: [LIKELY] findings auto-hidden for a high-FP agent */}
        {highFpLikely && (
          <motion.div
            key="high-fp-banner"
            variants={bannerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300 overflow-hidden"
          >
            <span className="mt-0.5 flex-shrink-0">⚠️</span>
            <span>
              <strong>Some findings were filtered out</strong> — this auditor has a higher-than-usual false positive rate on &ldquo;likely&rdquo; findings, so those were automatically hidden to reduce noise. You&rsquo;re seeing only high-confidence results.
            </span>
          </motion.div>
        )}

        {/* FP-COLD-START-UI: [LIKELY] findings hidden because the agent is too new */}
        {coldStart && !highFpLikely && (
          <motion.div
            key="cold-start-banner"
            variants={bannerVariants}
            initial="hidden"
            animate="visible"
            exit="exit"
            className="flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-xs text-blue-800 dark:text-blue-300 overflow-hidden"
          >
            <span className="mt-0.5 flex-shrink-0">🆕</span>
            <span>
              <strong>New auditor — &ldquo;likely&rdquo; findings hidden</strong> — this auditor hasn&rsquo;t run enough audits yet for us to gauge its accuracy, so lower-confidence findings are hidden by default to reduce noise. As more audits accumulate, this filter will lift automatically.
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* FP-UI: Review findings panel — dismiss false positives */}
      {metrics && metrics.findings.length > 0 && (
        <div id="findings-triage" className="mb-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                Review Findings
              </span>
              {metrics.suggestionCount > 0 && (
                <span className="text-xs text-gray-400 dark:text-zinc-500">
                  {metrics.suggestionCount} suggestion{metrics.suggestionCount !== 1 ? 's' : ''} (not scored)
                </span>
              )}
            </div>
            <div className="flex items-center gap-2 text-xs">
              {metrics.learningState && metrics.learningState.learnedPatternCount > 0 && (
                <span
                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-50 dark:bg-violet-950/30 text-violet-700 dark:text-violet-300 border border-violet-100 dark:border-violet-900/40"
                  title={`Claudit auto-demoted ${metrics.learningState.demotedCount} finding${metrics.learningState.demotedCount === 1 ? '' : 's'} in this audit based on ${metrics.learningState.scope === 'organization' ? "your team's" : 'your'} past dismissals. Each demoted finding shows its original severity in its details.`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-violet-500" />
                  Learned {metrics.learningState.learnedPatternCount} pattern{metrics.learningState.learnedPatternCount === 1 ? '' : 's'}
                  {metrics.learningState.demotedCount > 0 && (
                    <span className="text-violet-500 dark:text-violet-400/80">· {metrics.learningState.demotedCount} demoted here</span>
                  )}
                </span>
              )}
              {dismissedCount > 0 && (
                <button
                  onClick={() => setShowDismissed(!showDismissed)}
                  className="text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors focus-ring rounded px-1 min-h-[44px]"
                  aria-label={showDismissed ? `Hide ${dismissedCount} dismissed findings` : `Show ${dismissedCount} dismissed findings`}
                >
                  {showDismissed ? 'Hide' : 'Show'} {dismissedCount} dismissed
                </button>
              )}
              <span className="text-gray-400 dark:text-zinc-600">
                {activeFindingCount > 0 ? `${activeFindingCount} active` : 'All findings dismissed as false positives'}
              </span>
              {adjustedScore !== null && adjustedScore !== metrics?.score && (
                <span className="text-green-600 dark:text-green-400 font-medium" title="Estimated score after dismissing false positives">
                  ~{adjustedScore}/100
                  <span className="ml-1 font-normal text-green-500 dark:text-green-500"> est. after removing false positives</span>
                </span>
              )}
            </div>
          </div>
          {/* Confidence legend — helps vibe coders understand what the badges mean */}
          <div className="px-4 py-2 border-b border-gray-100 dark:border-zinc-800 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-zinc-500">
            <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-red-500 mr-1 align-middle" />Critical / High — fix soon</span>
            <span><span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 mr-1 align-middle" />Medium / Low — plan to fix</span>
            <span className="text-green-700 dark:text-green-400 font-medium">certain</span><span>= confirmed in your code</span>
            <span className="text-amber-700 dark:text-amber-400 font-medium">⚠ likely</span><span>= probable — verify before fixing</span>
            <span className="italic">Dismiss = not a real issue in your case (you can restore it)</span>
          </div>
          {/* Blast-radius cluster summary — visible only when graph data was
              computed for this audit. Gives PMs/leads a glanceable "impact
              shape" before they read the individual findings. */}
          {tieredFindings && tieredFindings.length > 0 && (
            <div className="px-4 py-2 border-b border-gray-100 dark:border-zinc-800 flex flex-wrap items-center gap-3 text-[11px] text-gray-500 dark:text-zinc-500">
              <span className="font-medium text-gray-600 dark:text-zinc-400">Blast radius:</span>
              {tieredFindings.map(({ tier, findings }) => {
                const meta = TIER_META[tier];
                return (
                  <span key={tier} className="inline-flex items-center gap-1.5" title={meta.hint}>
                    <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
                    {findings.length} in {meta.label.toLowerCase()}
                  </span>
                );
              })}
            </div>
          )}

          {/* Findings list — stagger on initial render; AnimatePresence + layout
              for smooth dismissal (the dismissed row fades out and survivors
              slide up to fill the gap). When blast radius data exists, group
              by tier with sub-headers; otherwise render flat. */}
          <motion.div
            variants={staggerContainer}
            initial="hidden"
            animate="visible"
            className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-80 overflow-y-auto"
          >
            <AnimatePresence initial={false}>
              {tieredFindings
                ? tieredFindings.map(({ tier, findings }) => (
                    <FindingsTierSection
                      key={tier}
                      tier={tier}
                      findings={findings}
                      dismissed={dismissed}
                      showDismissed={showDismissed}
                      onToggle={(f, isDismissed) => isDismissed ? restoreFinding(f.id) : dismissFinding(f.id)}
                    />
                  ))
                : metrics.filteredFindings.map((finding: Finding) => {
                    const isDismissed = dismissed.has(finding.id);
                    if (isDismissed && !showDismissed) return null;
                    return (
                      <FindingRow
                        key={finding.id}
                        finding={finding}
                        isDismissed={isDismissed}
                        onToggle={() => isDismissed ? restoreFinding(finding.id) : dismissFinding(finding.id)}
                      />
                    );
                  })}
            </AnimatePresence>
          </motion.div>
        </div>
      )}

      {/* Persistent warning — always shown; fades up with the rest of the
          page content. Distinct from the three conditional banners above
          (snippet/high-FP/cold-start) which use AnimatePresence to
          enter/exit as conditions change. */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300"
      >
        <span className="mt-0.5 flex-shrink-0">⚠️</span>
        <span>
          <strong>Review before applying.</strong> Code snippets in this report are illustrative — they are based only on the code you submitted and cannot account for your full codebase. Verify every finding in context before making any changes.
        </span>
      </motion.div>

      {/* Severity legend — helps vibe coders decode the report without Googling */}
      <motion.div
        variants={fadeUp}
        initial="hidden"
        animate="visible"
        transition={{ delay: 0.05 }}
        className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-zinc-500 px-1"
      >
        <span className="font-medium text-gray-600 dark:text-zinc-400">Severity:</span>
        <span><span className="text-red-500 font-medium">Critical</span> = fix now</span>
        <span><span className="text-orange-500 font-medium">High</span> = fix soon</span>
        <span><span className="text-amber-500 font-medium">Medium</span> = plan to fix</span>
        <span><span className="text-slate-500 font-medium">Low</span> = minor</span>
        <span className="hidden sm:inline text-gray-300 dark:text-zinc-700">·</span>
        <span><span className="font-medium">Vulnerability</span> = exploitable bug</span>
        <span><span className="font-medium">Deficiency</span> = gap from best practice</span>
        <span><span className="font-medium">Suggestion</span> = optional improvement</span>
      </motion.div>

      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 prose prose-sm dark:prose-invert max-w-prose">
        <SafeMarkdown>{stripStructuredBlock(result)}</SafeMarkdown>
      </div>
    </>
  );
}

// BLAST-001: A single finding row. Extracted so the flat (no graph) and
// tier-grouped (graph present) render paths share one source of truth for
// the row markup, badges, and dismiss/restore handler.
function FindingRow({
  finding,
  isDismissed,
  onToggle,
}: {
  finding: Finding;
  isDismissed: boolean;
  onToggle: () => void;
}) {
  return (
    <motion.div
      layout
      variants={fadeUp}
      exit={{ opacity: 0, x: 12, transition: transitions.snappy }}
      transition={transitions.springGentle}
      className={`flex items-center gap-3 px-4 py-2.5 text-sm ${isDismissed ? 'opacity-40' : ''}`}
    >
      <span
        className={`flex-shrink-0 w-2 h-2 rounded-full ${
          finding.severity === 'critical' ? 'bg-red-500' :
          finding.severity === 'high' ? 'bg-orange-500' :
          finding.severity === 'medium' ? 'bg-amber-500' :
          finding.severity === 'low' ? 'bg-slate-400' :
          'bg-gray-300 dark:bg-zinc-600'
        }`}
      />
      <span className="flex-1 text-gray-700 dark:text-zinc-300 truncate" title={finding.title}>
        {finding.title}
      </span>
      {finding.confidence && (
        <span
          className={`flex-shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${
            finding.confidence === 'certain' ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400' :
            'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400'
          }`}
          title={
            finding.confidence === 'certain' ? 'Confirmed in submitted code — still verify before applying any fix' :
            'Probable issue — verify this applies to your full codebase before changing anything'
          }
        >
          {finding.confidence === 'likely' ? '⚠ likely' : finding.confidence}
        </span>
      )}
      {finding.blastRadius && finding.blastRadius.tier !== 'unknown' && (
        <span
          className={`flex-shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${TIER_META[finding.blastRadius.tier].badgeClass}`}
          title={`${TIER_META[finding.blastRadius.tier].hint} ${finding.blastRadius.importerCount} caller${finding.blastRadius.importerCount === 1 ? '' : 's'} in this audit.`}
        >
          {finding.blastRadius.tier === 'leaf'
            ? 'leaf'
            : `↗ ${finding.blastRadius.importerCount} caller${finding.blastRadius.importerCount === 1 ? '' : 's'}`}
        </span>
      )}
      {finding.demotion && (
        <span
          className="flex-shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300"
          title={`Demoted from ${finding.demotion.originalSeverity} → ${finding.severity} (and ${finding.demotion.originalConfidence} → ${finding.confidence}) because ${finding.demotion.scope === 'organization' ? 'your team has' : 'you have'} dismissed this pattern ${finding.demotion.netDismissals} time${finding.demotion.netDismissals === 1 ? '' : 's'}. Restore once to undo the learning.`}
        >
          learned
        </span>
      )}
      <button
        onClick={onToggle}
        className="flex-shrink-0 text-xs text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors focus-ring rounded px-1 min-h-[44px]"
        aria-label={isDismissed ? `Restore finding: ${finding.title}` : `Dismiss finding as false positive: ${finding.title}`}
      >
        {isDismissed ? 'Restore' : 'Dismiss'}
      </button>
    </motion.div>
  );
}

// BLAST-001: One tier's sub-section: header with label + count, then the
// finding rows. Renders nothing when every finding in the tier is dismissed
// and showDismissed is false — keeps the visual tidy.
function FindingsTierSection({
  tier,
  findings,
  dismissed,
  showDismissed,
  onToggle,
}: {
  tier: BlastRadiusTier;
  findings: Finding[];
  dismissed: Set<string>;
  showDismissed: boolean;
  onToggle: (finding: Finding, isDismissed: boolean) => void;
}) {
  const visible = findings.filter((f) => showDismissed || !dismissed.has(f.id));
  if (visible.length === 0) return null;
  const meta = TIER_META[tier];
  return (
    <>
      <div
        className="flex items-center gap-2 px-4 py-1.5 text-[10px] uppercase tracking-widest text-gray-500 dark:text-zinc-500 bg-gray-50/60 dark:bg-zinc-950/40"
        title={meta.hint}
      >
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${meta.dotClass}`} />
        <span className="font-medium">{meta.label}</span>
        <span className="text-gray-400 dark:text-zinc-600">· {findings.length}</span>
      </div>
      {findings.map((finding) => {
        const isDismissed = dismissed.has(finding.id);
        if (isDismissed && !showDismissed) return null;
        return (
          <FindingRow
            key={finding.id}
            finding={finding}
            isDismissed={isDismissed}
            onToggle={() => onToggle(finding, isDismissed)}
          />
        );
      })}
    </>
  );
}
