'use client';

import { useEffect, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { fadeUp, transitions } from '@/lib/motion/variants';

// Mirrors lib/ai/executiveSummary.ts ExecutiveSummary — kept local so this
// component has no server-side imports. The shape is stable; if the engine
// adds fields, mirror them here.
export interface ExecutiveSummary {
  headline: string;
  topRisks: string[];
  productionImpact: string;
  fixEffort: string;
  recommendedAction: string;
}

interface Props {
  auditId: string;
  /** When true, the card is hidden — used while the audit is still streaming. */
  hidden?: boolean;
}

type FetchState =
  | { kind: 'idle' }
  | { kind: 'loading' }
  | { kind: 'ready'; summary: ExecutiveSummary; generatedAt: string | null; cached: boolean }
  | { kind: 'error'; message: string };

/**
 * Lazy executive summary card. On mount, asks the API whether a cached
 * summary exists for this audit. If yes, renders immediately. If no, shows
 * a "Generate" button — first click triggers the synth call, caches on the
 * audit row, and renders the result.
 *
 * The whole card stays out of the developer's way when collapsed — the
 * "Generate" CTA is a single button and the result fades in only when the
 * user opts in.
 */
export function ExecutiveSummaryCard({ auditId, hidden }: Props) {
  const [state, setState] = useState<FetchState>({ kind: 'idle' });
  const [copied, setCopied] = useState(false);

  // Probe for a cached summary on mount. Returns instantly if cache miss.
  useEffect(() => {
    if (hidden) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`/api/audit/${auditId}/exec-summary`, { method: 'GET' });
        if (!res.ok) return;
        const data = await res.json();
        if (cancelled) return;
        if (data.summary) {
          setState({
            kind: 'ready',
            summary: data.summary,
            generatedAt: data.generatedAt ?? null,
            cached: !!data.cached,
          });
        }
      } catch { /* keep idle — user can retry with Generate */ }
    })();
    return () => { cancelled = true; };
  }, [auditId, hidden]);

  const generate = useCallback(async (regenerate: boolean) => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch(`/api/audit/${auditId}/exec-summary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ regenerate }),
      });
      const data = await res.json();
      if (!res.ok) {
        setState({ kind: 'error', message: data.error ?? `HTTP ${res.status}` });
        return;
      }
      setState({
        kind: 'ready',
        summary: data.summary,
        generatedAt: data.generatedAt ?? null,
        cached: !!data.cached,
      });
    } catch (err) {
      setState({ kind: 'error', message: err instanceof Error ? err.message : 'Network error' });
    }
  }, [auditId]);

  const copyToClipboard = useCallback(async () => {
    if (state.kind !== 'ready') return;
    const text = formatForClipboard(state.summary);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard blocked — degrade silently */ }
  }, [state]);

  if (hidden) return null;

  return (
    <motion.section
      variants={fadeUp}
      initial="hidden"
      animate="visible"
      transition={transitions.soft}
      className="mb-4 bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden"
      aria-labelledby="exec-summary-heading"
    >
      <div className="px-4 py-3 border-b border-gray-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-violet-500" aria-hidden="true" />
          <h2 id="exec-summary-heading" className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-zinc-400">
            Executive summary
          </h2>
          <span className="text-[10px] text-gray-400 dark:text-zinc-600">for PMs / security / execs</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          {state.kind === 'ready' && (
            <>
              <button
                onClick={copyToClipboard}
                className="text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 transition-colors focus-ring"
                aria-label="Copy summary to clipboard for sharing"
              >
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={() => generate(true)}
                className="text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 transition-colors focus-ring"
                aria-label="Regenerate executive summary"
              >
                Regenerate
              </button>
            </>
          )}
        </div>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait" initial={false}>
          {state.kind === 'idle' && (
            <motion.div
              key="idle"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <p className="text-sm text-gray-600 dark:text-zinc-400">
                Generate a plain-English summary aimed at non-engineer stakeholders.
                Five bullets: headline, top risks, production impact, fix effort, recommended action.
              </p>
              <button
                onClick={() => generate(false)}
                className="flex-shrink-0 text-xs font-medium text-white bg-violet-600 hover:bg-violet-700 rounded-lg px-4 py-2 transition-colors focus-ring"
              >
                Generate executive summary
              </button>
            </motion.div>
          )}

          {state.kind === 'loading' && (
            <motion.div
              key="loading"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="flex items-center gap-3 text-sm text-gray-500 dark:text-zinc-400"
            >
              <span className="inline-block w-3 h-3 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" aria-hidden="true" />
              Synthesising… (~3 seconds)
            </motion.div>
          )}

          {state.kind === 'error' && (
            <motion.div
              key="error"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
            >
              <p className="text-sm text-red-600 dark:text-red-400">{state.message}</p>
              <button
                onClick={() => generate(false)}
                className="flex-shrink-0 text-xs font-medium text-violet-600 dark:text-violet-400 border border-violet-300 dark:border-violet-700 rounded-lg px-3 py-1.5 transition-colors focus-ring"
              >
                Try again
              </button>
            </motion.div>
          )}

          {state.kind === 'ready' && (
            <motion.dl
              key="ready"
              variants={fadeUp}
              initial="hidden"
              animate="visible"
              exit={{ opacity: 0 }}
              className="space-y-3 text-sm leading-relaxed text-gray-700 dark:text-zinc-300"
            >
              <Bullet label="Headline" body={state.summary.headline} emphasis />
              <Bullet
                label="Top risks"
                body={
                  state.summary.topRisks.length === 0
                    ? 'No critical or high-severity risks raised in this audit.'
                    : (
                      <ul className="list-disc list-inside space-y-0.5 marker:text-violet-500">
                        {state.summary.topRisks.map((risk, i) => (
                          <li key={i}>{risk}</li>
                        ))}
                      </ul>
                    )
                }
              />
              <Bullet label="Production impact" body={state.summary.productionImpact || '—'} />
              <Bullet label="Fix effort" body={state.summary.fixEffort || '—'} />
              <Bullet label="Recommended action" body={state.summary.recommendedAction || '—'} emphasis />
              {state.generatedAt && (
                <p className="pt-2 text-[10px] text-gray-400 dark:text-zinc-600">
                  Generated {new Date(state.generatedAt).toLocaleString()} {state.cached ? '· cached' : ''}
                </p>
              )}
            </motion.dl>
          )}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

function Bullet({
  label,
  body,
  emphasis,
}: {
  label: string;
  body: React.ReactNode;
  emphasis?: boolean;
}) {
  return (
    <div className="flex flex-col sm:flex-row gap-1 sm:gap-4">
      <dt className="flex-shrink-0 sm:w-40 text-[11px] uppercase tracking-wide text-gray-500 dark:text-zinc-500">
        {label}
      </dt>
      <dd className={`flex-1 ${emphasis ? 'font-medium text-gray-900 dark:text-zinc-100' : ''}`}>
        {body}
      </dd>
    </div>
  );
}

function formatForClipboard(s: ExecutiveSummary): string {
  const risks = s.topRisks.length > 0
    ? s.topRisks.map((r) => `• ${r}`).join('\n')
    : '• (no top risks raised)';
  return [
    `Headline: ${s.headline}`,
    '',
    `Top risks:`,
    risks,
    '',
    `Production impact: ${s.productionImpact}`,
    `Fix effort: ${s.fixEffort}`,
    `Recommended action: ${s.recommendedAction}`,
  ].join('\n');
}
