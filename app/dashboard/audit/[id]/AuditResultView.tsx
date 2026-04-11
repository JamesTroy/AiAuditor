'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SafeMarkdown from '@/components/markdownComponents';
import { setChainInput } from '@/lib/session';
import { parseAuditResult, type Finding } from '@/lib/parseAuditResult';
import { detectSnippet } from '@/lib/detectSnippet';
import type { AgentFpRate } from '@/app/api/agents/fp-rates/route';

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

  // FP-RATE: Fetch per-agent [LIKELY] false-positive rates and downgrade
  // [LIKELY] findings to [POSSIBLE] for agents that cross the threshold.
  useEffect(() => {
    fetch('/api/agents/fp-rates')
      .then((r) => r.ok ? r.json() : { rates: [] })
      .then(({ rates }: { rates: AgentFpRate[] }) => {
        const match = rates.find((r) => r.agentId === agentId);
        if (match?.highLikelyFpRate) setHighFpLikely(true);
      })
      .catch(() => { /* degrade gracefully — don't affect the render */ });
  }, [agentId]);

  const metrics = useMemo(() => {
    if (!result) return null;
    return parseAuditResult(result, { downgradeHighFpLikely: highFpLikely });
  }, [result, highFpLikely]);

  const snippetDetection = useMemo(() => detectSnippet(input), [input]);

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

      {/* Snippet scope warning — shown when the audited input looks like a fragment */}
      {snippetDetection.isSnippet && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 px-4 py-3 text-xs text-blue-800 dark:text-blue-300">
          <span className="mt-0.5 flex-shrink-0">ℹ️</span>
          <span>
            <strong>Partial context detected</strong> — this audit was run on a code snippet ({snippetDetection.reason}). Findings that depend on imports, surrounding types, or module-level state may not apply to your actual codebase. Re-run with the full file for higher confidence results.
          </span>
        </div>
      )}

      {/* FP-RATE-UI: Banner shown when [LIKELY] findings are auto-hidden for a high-FP agent */}
      {highFpLikely && (
        <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
          <span className="mt-0.5 flex-shrink-0">⚠️</span>
          <span>
            <strong>Some findings were filtered out</strong> — this auditor has a higher-than-usual false positive rate on &ldquo;likely&rdquo; findings, so those were automatically hidden to reduce noise. You&rsquo;re seeing only high-confidence results.
          </span>
        </div>
      )}

      {/* FP-UI: Review findings panel — dismiss false positives */}
      {metrics && metrics.findings.length > 0 && (
        <div className="mb-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
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
          <div className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-80 overflow-y-auto">
            {metrics.filteredFindings.map((finding: Finding) => {
              const isDismissed = dismissed.has(finding.id);
              if (isDismissed && !showDismissed) return null;
              return (
                <div
                  key={finding.id}
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
                  <button
                    onClick={() => isDismissed ? restoreFinding(finding.id) : dismissFinding(finding.id)}
                    className="flex-shrink-0 text-xs text-gray-400 dark:text-zinc-500 hover:text-red-500 dark:hover:text-red-400 transition-colors focus-ring rounded px-1 min-h-[44px]"
                    aria-label={isDismissed ? `Restore finding: ${finding.title}` : `Dismiss finding as false positive: ${finding.title}`}
                  >
                    {isDismissed ? 'Restore' : 'Dismiss'}
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="mb-3 flex items-start gap-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/40 px-4 py-3 text-xs text-amber-800 dark:text-amber-300">
        <span className="mt-0.5 flex-shrink-0">⚠️</span>
        <span>
          <strong>Review before applying.</strong> Code snippets in this report are illustrative — they are based only on the code you submitted and cannot account for your full codebase. Verify every finding in context before making any changes.
        </span>
      </div>

      {/* Severity legend — helps vibe coders decode the report without Googling */}
      <div className="mb-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-gray-500 dark:text-zinc-500 px-1">
        <span className="font-medium text-gray-600 dark:text-zinc-400">Severity:</span>
        <span><span className="text-red-500 font-medium">Critical</span> = fix now</span>
        <span><span className="text-orange-500 font-medium">High</span> = fix soon</span>
        <span><span className="text-amber-500 font-medium">Medium</span> = plan to fix</span>
        <span><span className="text-slate-500 font-medium">Low</span> = minor</span>
        <span className="hidden sm:inline text-gray-300 dark:text-zinc-700">·</span>
        <span><span className="font-medium">Vulnerability</span> = exploitable bug</span>
        <span><span className="font-medium">Deficiency</span> = gap from best practice</span>
        <span><span className="font-medium">Suggestion</span> = optional improvement</span>
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 prose prose-sm dark:prose-invert max-w-prose">
        <SafeMarkdown>{result}</SafeMarkdown>
      </div>
    </>
  );
}
