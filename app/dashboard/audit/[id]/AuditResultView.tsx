'use client';

import { useMemo, useState, useCallback, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SafeMarkdown from '@/components/markdownComponents';
import { setChainInput } from '@/lib/session';
import { parseAuditResult } from '@/lib/parseAuditResult';
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

  const dismissedCount = dismissed.size;
  // FP-010: Use filteredTotal (excludes [POSSIBLE] and [SUGGESTION]) for active count
  // so users see actionable findings, not speculative or nice-to-have items.
  const activeFindingCount = metrics ? Math.max(0, metrics.filteredTotal - dismissedCount) : 0;

  // FP-007: Estimate adjusted score when findings are dismissed.
  // Each dismissed critical finding adds ~8 points, high adds ~5, medium adds ~3, low adds ~1.
  const adjustedScore = useMemo(() => {
    if (!metrics?.score || dismissedCount === 0) return null;
    let bonus = 0;
    for (const f of metrics.findings) {
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
          Re-audit
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

      {/* FP-UI: Findings triage panel — dismiss false positives */}
      {metrics && metrics.findings.length > 0 && (
        <div className="mb-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-zinc-400">
                Findings triage
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
                </span>
              )}
            </div>
          </div>
          <div className="divide-y divide-gray-100 dark:divide-zinc-800 max-h-80 overflow-y-auto">
            {metrics.findings.map((finding) => {
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
                        finding.confidence === 'likely' ? 'bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400' :
                        'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400'
                      }`}
                      title={
                        finding.confidence === 'certain' ? 'Confirmed in submitted code — still verify before applying any fix' :
                        finding.confidence === 'likely' ? 'Probable issue — verify this applies to your full codebase before changing anything' :
                        'Speculative — depends on code or context not in the submission'
                      }
                    >
                      {finding.confidence === 'likely' ? '⚠ likely' : finding.confidence}
                    </span>
                  )}
                  {finding.classification === 'suggestion' && (
                    <span className="flex-shrink-0 text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-950 text-blue-600 dark:text-blue-400">
                      suggestion
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

      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 prose prose-sm dark:prose-invert max-w-prose">
        <SafeMarkdown>{result}</SafeMarkdown>
      </div>
    </>
  );
}
