'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from '@/lib/auth-client';
import { fadeUp, staggerContainer, transitions } from '@/lib/motion/variants';
import { useCountUp } from '@/lib/hooks/useCountUp';

interface InstallationRepo {
  id: number;
  full_name: string;
}

interface Installation {
  installationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  repositorySelection: 'all' | 'selected';
  repositoryCount: number;
  repositories: InstallationRepo[];
  installedAt: string;
  suspendedAt: string | null;
  threshold: number;
}

interface RecentAudit {
  id: string;
  installationId: number;
  repoFullName: string;
  prNumber: number;
  status: 'queued' | 'running' | 'posted' | 'failed' | 'skipped';
  score: number | null;
  findingsTotal: number | null;
  findingsCritical: number | null;
  findingsHigh: number | null;
  postedReviewId: number | null;
  postedCheckRunId: number | null;
  createdAt: string;
}

interface IntegrationsResponse {
  installations: Installation[];
  recentAudits: RecentAudit[];
  migrationMissing?: boolean;
}

// Friendly, jargon-free error text. The internal error codes (state_user_mismatch,
// invalid_or_expired_state, etc.) are kept on the server-side for debugging but
// never surfaced to the user — they only ever see the right-hand mapping.
const ERROR_LABELS: Record<string, string> = {
  missing_installation_id: "GitHub didn't return an installation. Click Install on GitHub to try again.",
  invalid_or_expired_state: 'Your install link expired (links are good for 10 minutes). Click Install on GitHub to try again.',
  state_user_mismatch:      'This install was started by a different Claudit account. Sign out and sign in with that account, or click Install on GitHub to start over.',
  github_fetch_failed:      "We couldn't reach GitHub to confirm the install. Try again in a moment.",
  db_write_failed:          "We saved the install on GitHub but couldn't link it to your account. Contact support.",
};

// User-readable status labels for the Recent PR audits table.
const STATUS_LABEL: Record<RecentAudit['status'], string> = {
  posted:  'Reviewed',
  running: 'Reviewing…',
  queued:  'Waiting',
  failed:  'Failed',
  skipped: 'Nothing to review',
};

const STATUS_BADGE: Record<RecentAudit['status'], string> = {
  posted:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  running: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  queued:  'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
  failed:  'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  skipped: 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500',
};

// Statuses still in motion — used for the live-polling decision and for
// the "Watching" breathing dot in the section header.
const ACTIVE_STATUSES: ReadonlySet<RecentAudit['status']> = new Set(['queued', 'running']);
const TERMINAL_STATUSES: ReadonlySet<RecentAudit['status']> = new Set(['posted', 'failed', 'skipped']);

function reviewUrl(audit: RecentAudit): string {
  if (audit.postedReviewId) {
    return `https://github.com/${audit.repoFullName}/pull/${audit.prNumber}#pullrequestreview-${audit.postedReviewId}`;
  }
  return `https://github.com/${audit.repoFullName}/pull/${audit.prNumber}`;
}

function checkRunUrl(audit: RecentAudit): string | null {
  if (!audit.postedCheckRunId) return null;
  return `https://github.com/${audit.repoFullName}/runs/${audit.postedCheckRunId}`;
}

/**
 * Single Recent-reviews row. Pulled out of the page component so we can
 * own per-row animation state (score count-up, status-transition flash,
 * badge shimmer) without ballooning the parent.
 */
function RecentReviewRow({ audit }: { audit: RecentAudit }) {
  const cr = checkRunUrl(audit);
  // Snap rows that were already terminal at mount — they're just history,
  // counting up from 0 there serves no purpose and 20 parallel rAF loops
  // at mount saturate the main thread (≈840 setStates in 700ms). Reserve
  // the animation for rows the user will actually see transition from
  // running → posted in the live polling case.
  const initialWasTerminal = useRef(TERMINAL_STATUSES.has(audit.status));
  const animatedScore = useCountUp(audit.score, initialWasTerminal.current ? 0 : 700);

  // Watch for terminal-state transitions so we can fire a one-shot row
  // flash + badge pulse without re-firing on every re-render.
  const prevStatus = useRef<RecentAudit['status']>(audit.status);
  const [transitionKey, setTransitionKey] = useState(0);
  const [justFinished, setJustFinished] = useState(false);
  useEffect(() => {
    const wasActive = ACTIVE_STATUSES.has(prevStatus.current);
    const isTerminal = TERMINAL_STATUSES.has(audit.status);
    if (wasActive && isTerminal) {
      setJustFinished(true);
      setTransitionKey((k) => k + 1);
      const t = setTimeout(() => setJustFinished(false), 1500);
      prevStatus.current = audit.status;
      return () => clearTimeout(t);
    }
    prevStatus.current = audit.status;
  }, [audit.status]);

  return (
    <li
      key={transitionKey}
      className={`py-3 flex items-center justify-between gap-3 rounded-md px-2 -mx-2 ${justFinished ? 'animate-row-flash' : ''}`}
    >
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium truncate">
          <a
            href={reviewUrl(audit)}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-violet-600 dark:hover:text-violet-400 hover:underline"
            title={audit.postedReviewId ? "Open Claudit's review on this PR" : 'Open the PR on GitHub'}
          >
            {audit.repoFullName} <span className="text-gray-400 dark:text-zinc-600">#{audit.prNumber}</span>
          </a>
        </p>
        <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
          {new Date(audit.createdAt).toLocaleString()}
          {audit.findingsTotal !== null
            ? ` · ${audit.findingsTotal} ${audit.findingsTotal === 1 ? 'issue' : 'issues'}${(audit.findingsCritical ?? 0) + (audit.findingsHigh ?? 0) > 0 ? ` (${audit.findingsCritical ?? 0} critical, ${audit.findingsHigh ?? 0} high)` : ''}`
            : ''}
          {cr && audit.status === 'posted' ? (
            <>
              {' · '}
              <a
                href={cr}
                target="_blank"
                rel="noopener noreferrer"
                className="hover:text-violet-600 dark:hover:text-violet-400 hover:underline"
              >
                check
              </a>
            </>
          ) : null}
        </p>
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {audit.score !== null && (
          <span className="text-sm font-mono tabular-nums" title="Score (pass-fail threshold is set per repository)">
            {animatedScore}
          </span>
        )}
        <span
          className={
            `relative overflow-hidden text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ` +
            STATUS_BADGE[audit.status] +
            (justFinished ? ' animate-pulse-once' : '')
          }
        >
          {STATUS_LABEL[audit.status]}
          {/* Shimmer band runs only while the audit is actively running.
              Sits as a non-interactive absolute layer so the text stays put. */}
          {audit.status === 'running' && (
            <span aria-hidden="true" className="absolute inset-0 badge-shimmer pointer-events-none" />
          )}
        </span>
      </div>
    </li>
  );
}

export default function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();

  // Admin-gated UI — only operators (= the Claudit team) see the
  // migration-instructions card. Regular users see a friendly "coming soon"
  // message instead of curl commands.
  const isAdmin = (session?.user as Record<string, unknown> | undefined)?.role === 'admin';

  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashError, setFlashError] = useState<string | null>(null);
  const [flashSuccess, setFlashSuccess] = useState<string | null>(null);

  // Per-install threshold editor: the install whose slider is currently open,
  // plus the working value while the user drags.
  const [editingThresholdId, setEditingThresholdId] = useState<number | null>(null);
  const [thresholdDraft, setThresholdDraft] = useState<number>(70);
  const [savingThreshold, setSavingThreshold] = useState<boolean>(false);

  // Backfill: link installations the user already created on GitHub (e.g.,
  // installed before our table existed, or via direct github.com install).
  const [linkingExisting, setLinkingExisting] = useState(false);
  const [backfillDiagnostic, setBackfillDiagnostic] = useState<{
    ghStatus: number | null;
    hint: string | null;
    ghBody: string;
    error: string;
  } | null>(null);
  // When no auto-match succeeds, the server returns the list of installations
  // visible to our App and the user picks which one to link.
  const [availableInstalls, setAvailableInstalls] = useState<Array<{
    installationId: number;
    accountLogin: string;
    accountType: 'User' | 'Organization';
  }> | null>(null);
  const [claimingId, setClaimingId] = useState<number | null>(null);
  // Per-install "Sync" — re-fetches repositorySelection + repo list from
  // GitHub. Needed when the user changes selection on github.com and our
  // webhook missed the update.
  const [syncingId, setSyncingId] = useState<number | null>(null);

  // Surface error/installed query params as flash banners, then strip them.
  useEffect(() => {
    const errCode = searchParams.get('error');
    const installed = searchParams.get('installed');
    if (errCode) {
      setFlashError(ERROR_LABELS[errCode] ?? "Something went wrong with the install. Click Install on GitHub to try again.");
      router.replace('/settings/integrations');
    } else if (installed) {
      setFlashSuccess('GitHub connected. New pull requests will get reviewed automatically.');
      router.replace('/settings/integrations');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // `silent=true` is for background poll cycles — skip the loading-skeleton
  // flip so the whole page doesn't repaint every 5s while audits are in
  // flight. The initial mount and explicit user-triggered reloads pass false
  // (the default) so the skeleton still shows on first paint.
  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/integrations/github');
      if (!res.ok) throw new Error(`Couldn't load your integrations. Refresh to try again.`);
      const json = (await res.json()) as IntegrationsResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  // Live polling — while any recent audit is still in queued/running state,
  // refetch every 5s so the UI can flip rows to "Reviewed" without the user
  // hitting refresh. Stops as soon as nothing's in motion.
  const hasActiveAudit = !!data?.recentAudits.some((a) => ACTIVE_STATUSES.has(a.status));
  useEffect(() => {
    if (!session || !hasActiveAudit) return;
    const id = setInterval(() => { void load(true); }, 5_000);
    return () => clearInterval(id);
  }, [session, hasActiveAudit, load]);

  if (isPending) {
    return (
      <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="h-8 w-48 rounded skeleton" />
        </div>
      </div>
    );
  }

  if (!session) {
    router.push('/login?callbackUrl=/settings/integrations');
    return null;
  }

  function openThresholdEditor(inst: Installation) {
    setEditingThresholdId(inst.installationId);
    setThresholdDraft(inst.threshold);
  }

  async function linkExistingInstall(installationId?: number) {
    if (installationId) setClaimingId(installationId);
    else setLinkingExisting(true);
    setFlashError(null);
    setFlashSuccess(null);
    setBackfillDiagnostic(null);
    setAvailableInstalls(null);
    try {
      const res = await fetch('/api/integrations/github/backfill', {
        method: 'POST',
        headers: installationId ? { 'Content-Type': 'application/json' } : undefined,
        body: installationId ? JSON.stringify({ installationId }) : undefined,
      });
      const json = (await res.json()) as {
        linked?: number;
        message?: string;
        diagnostic?: { ghStatus: number | null; hint: string | null; ghBody: string; error: string };
        installations?: Array<{ installationId: number; accountLogin: string; accountType: 'User' | 'Organization' }>;
      };
      if (!res.ok) {
        setFlashError(json.message ?? "Couldn't link your existing GitHub installs. Try again.");
        if (json.diagnostic) setBackfillDiagnostic(json.diagnostic);
        return;
      }
      if ((json.linked ?? 0) === 0) {
        setFlashError(json.message ?? 'No matching GitHub installations found for your account.');
        if (json.diagnostic) setBackfillDiagnostic(json.diagnostic);
        if (json.installations && json.installations.length > 0) setAvailableInstalls(json.installations);
        return;
      }
      setFlashSuccess(
        json.linked === 1
          ? 'Linked your existing GitHub install. Pull requests will get reviewed automatically.'
          : `Linked ${json.linked} existing GitHub installs.`,
      );
      await load();
    } catch (e) {
      setFlashError(e instanceof Error ? e.message : String(e));
    } finally {
      setLinkingExisting(false);
      setClaimingId(null);
    }
  }

  async function syncInstall(installationId: number) {
    setSyncingId(installationId);
    setFlashError(null);
    setFlashSuccess(null);
    try {
      const res = await fetch('/api/integrations/github/backfill', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ installationId }),
      });
      const json = (await res.json()) as { linked?: number; message?: string };
      if (!res.ok || (json.linked ?? 0) === 0) {
        setFlashError(json.message ?? "Couldn't refresh from GitHub. Try again in a moment.");
        return;
      }
      setFlashSuccess('Refreshed from GitHub.');
      await load();
    } catch (e) {
      setFlashError(e instanceof Error ? e.message : String(e));
    } finally {
      setSyncingId(null);
    }
  }

  async function saveThreshold(installationId: number) {
    setSavingThreshold(true);
    try {
      const res = await fetch(`/api/integrations/github?id=${installationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ threshold: thresholdDraft }),
      });
      if (!res.ok) throw new Error("Couldn't save — try again.");
      // Optimistic update so the card reflects the new value immediately.
      setData((prev) => prev ? {
        ...prev,
        installations: prev.installations.map((i) =>
          i.installationId === installationId ? { ...i, threshold: thresholdDraft } : i,
        ),
      } : prev);
      setEditingThresholdId(null);
    } catch (e) {
      setFlashError(e instanceof Error ? e.message : String(e));
    } finally {
      setSavingThreshold(false);
    }
  }

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="max-w-2xl mx-auto"
      >
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-bold">Integrations</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            Connect GitHub so Claudit reviews every pull request automatically — inline comments plus a pass/fail check.
          </p>
        </motion.div>

        <AnimatePresence>
          {flashError && (
            <motion.div
              key="flash-error"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transitions.snappy}
              role="alert"
              className="mb-4 p-3 rounded-xl bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm flex items-start justify-between gap-3"
            >
              <span>{flashError}</span>
              <button onClick={() => setFlashError(null)} className="text-xs hover:underline shrink-0">Dismiss</button>
            </motion.div>
          )}
          {availableInstalls && availableInstalls.length > 0 && (
            <motion.div
              key="available-installs"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transitions.snappy}
              className="mb-4 p-4 rounded-xl bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 text-sm"
            >
              <p className="font-semibold mb-1">Pick the installation to link</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mb-3">
                We found these GitHub App installations. Click the one that belongs to you.
              </p>
              <ul className="space-y-2">
                {availableInstalls.map((inst) => (
                  <li key={inst.installationId} className="flex items-center justify-between gap-3 border border-gray-100 dark:border-zinc-800 rounded-lg px-3 py-2">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{inst.accountLogin}</p>
                      <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-zinc-500">
                        {inst.accountType} · install #{inst.installationId}
                      </p>
                    </div>
                    <button
                      onClick={() => linkExistingInstall(inst.installationId)}
                      disabled={claimingId !== null}
                      className="shrink-0 text-xs bg-violet-600 hover:bg-violet-500 disabled-muted text-white rounded-lg px-3 py-1.5 transition-colors"
                    >
                      {claimingId === inst.installationId ? 'Linking…' : 'Link this one'}
                    </button>
                  </li>
                ))}
              </ul>
            </motion.div>
          )}
          {backfillDiagnostic && (
            <motion.div
              key="backfill-diagnostic"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transitions.snappy}
              className="mb-4 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs space-y-2"
            >
              <p className="font-semibold">Diagnostic — backfill failed</p>
              <p><span className="opacity-70">GitHub status:</span> <span className="font-mono">{backfillDiagnostic.ghStatus ?? 'n/a'}</span></p>
              {backfillDiagnostic.hint && <p><span className="opacity-70">Likely cause:</span> {backfillDiagnostic.hint}</p>}
              <details>
                <summary className="cursor-pointer opacity-70 hover:opacity-100">Raw error</summary>
                <pre className="mt-2 whitespace-pre-wrap break-words text-[11px] font-mono">{backfillDiagnostic.error}</pre>
                {backfillDiagnostic.ghBody && (
                  <>
                    <p className="opacity-70 mt-2">GitHub response body:</p>
                    <pre className="mt-1 whitespace-pre-wrap break-words text-[11px] font-mono">{backfillDiagnostic.ghBody}</pre>
                  </>
                )}
              </details>
              <button onClick={() => setBackfillDiagnostic(null)} className="text-xs hover:underline">Dismiss</button>
            </motion.div>
          )}
          {flashSuccess && (
            <motion.div
              key="flash-success"
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={transitions.snappy}
              role="status"
              className="mb-4 p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950 border border-emerald-200 dark:border-emerald-900 text-emerald-700 dark:text-emerald-300 text-sm flex items-start justify-between gap-3"
            >
              <span>{flashSuccess}</span>
              <button onClick={() => setFlashSuccess(null)} className="text-xs hover:underline shrink-0">Dismiss</button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* GitHub App section */}
        <motion.section variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-start justify-between gap-4 mb-1">
            <div>
              <h2 className="text-lg font-semibold">GitHub</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
                Claudit reviews every pull request as it&apos;s opened or updated. High-confidence issues become inline comments; a pass/fail check shows at the top of the PR.
              </p>
            </div>
            {/* Only show the primary install CTA when nothing is connected yet.
                Users who already have an install see "Add another installation"
                as a small link below the list (rare use case: installing on a
                second GitHub account or org). */}
            {data && data.installations.length === 0 && (
              <a
                href="/api/integrations/github/install"
                className="shrink-0 inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl px-4 py-2 min-h-[40px] text-sm transition-colors focus-ring"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                  <path d="M12 0a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.7-1.3-1.7-1.1-.8.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2.9-.3 2-.4 3-.4s2.1.1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 0z" />
                </svg>
                Install on GitHub
              </a>
            )}
          </div>

          {/* Migration-missing hint —
              Operator (admin): full curl command for applying the migration.
              Everyone else:    user-facing "we're setting this up" message. */}
          {data?.migrationMissing && (
            isAdmin ? (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
                <strong>Admin:</strong> the GitHub-App tables aren&apos;t created yet. Run migration 006 once:
                <code className="block mt-2 text-[11px] font-mono whitespace-pre">curl -X POST {typeof window !== 'undefined' ? window.location.origin : ''}/api/admin/migrate-006 -H &quot;Authorization: Bearer $CRON_SECRET&quot;</code>
              </div>
            ) : (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-sm">
                The GitHub integration is being set up. Check back in a few minutes — Claudit support has been notified.
              </div>
            )
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm">
              {error}
            </div>
          )}

          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-gray-400 dark:text-zinc-600 py-2">Loading…</p>
            ) : data && data.installations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-zinc-700 px-4 py-6 text-center space-y-3">
                <p className="text-sm text-gray-500 dark:text-zinc-500">
                  No GitHub connections yet. Click <span className="font-medium">Install on GitHub</span> above to pick which repositories Claudit should review.
                </p>
                <div className="text-xs text-gray-400 dark:text-zinc-600">
                  Already installed Claudit on GitHub but it isn&apos;t showing here?{' '}
                  <button
                    onClick={() => linkExistingInstall()}
                    disabled={linkingExisting}
                    className="text-violet-600 dark:text-violet-400 hover:underline disabled-muted"
                  >
                    {linkingExisting ? 'Linking…' : 'Link an existing install'}
                  </button>
                </div>
              </div>
            ) : (
              <ul className="space-y-3">
                {data?.installations.map((inst) => (
                  <li
                    key={inst.installationId}
                    className="border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-3 space-y-3"
                  >
                    {/* Header row */}
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium">{inst.accountLogin}</p>
                          <span className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 rounded px-1.5 py-0.5">
                            {inst.accountType}
                          </span>
                          {inst.suspendedAt && (
                            <span className="text-[10px] uppercase tracking-wider text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-950/50 rounded px-1.5 py-0.5">
                              Suspended
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                          {inst.repositorySelection === 'all'
                            ? 'Reviewing every repository in this account'
                            : `Reviewing ${inst.repositoryCount} selected ${inst.repositoryCount === 1 ? 'repository' : 'repositories'}`}
                          {' · connected '}
                          {new Date(inst.installedAt).toLocaleDateString()}
                        </p>
                      </div>
                      <div className="shrink-0 flex flex-col items-end gap-1">
                        <a
                          href={`https://github.com/settings/installations/${inst.installationId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap"
                          title="Open this installation on GitHub to change repository access or uninstall"
                        >
                          Manage on GitHub →
                        </a>
                        <button
                          onClick={() => syncInstall(inst.installationId)}
                          disabled={syncingId !== null}
                          className="text-xs text-gray-500 dark:text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 hover:underline disabled:opacity-60 disabled:cursor-not-allowed"
                          title="Re-pull repository access from GitHub if you changed it there recently"
                        >
                          {syncingId === inst.installationId ? 'Syncing…' : 'Sync from GitHub'}
                        </button>
                      </div>
                    </div>

                    {/* Warning: "all repositories" — only show when GitHub
                        actually reports the install as all-repos. If the
                        user changed it on github.com but our webhook missed
                        the update, the Sync button above re-pulls truth. */}
                    {inst.repositorySelection === 'all' && !inst.suspendedAt && (
                      <div className="rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/60 px-3 py-2 text-xs text-amber-800 dark:text-amber-300">
                        <strong>Reviewing every repository in this account.</strong> Every PR you (or anyone in this account) opens will use Claudit credit.
                        {' '}
                        <a
                          href={`https://github.com/settings/installations/${inst.installationId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="underline hover:no-underline"
                        >
                          Switch to specific repositories →
                        </a>
                        {' '}
                        Already switched on GitHub?{' '}
                        <button
                          onClick={() => syncInstall(inst.installationId)}
                          disabled={syncingId !== null}
                          className="underline hover:no-underline disabled:opacity-60"
                        >
                          {syncingId === inst.installationId ? 'Syncing…' : 'Click to sync'}
                        </button>
                      </div>
                    )}

                    {/* Repo list — shown when selection mode is 'selected'.
                        Caps at 20 to keep the card compact; full list is on
                        GitHub via Manage. */}
                    {inst.repositorySelection === 'selected' && inst.repositories.length > 0 && (
                      <div className="rounded-lg bg-gray-50 dark:bg-zinc-800/50 border border-gray-100 dark:border-zinc-800 px-3 py-2">
                        <p className="text-[10px] uppercase tracking-wider text-gray-500 dark:text-zinc-500 mb-1.5">
                          Repositories Claudit can review
                        </p>
                        <ul className="text-xs font-mono text-gray-700 dark:text-zinc-300 space-y-0.5">
                          {inst.repositories.slice(0, 20).map((r) => (
                            <li key={r.id} className="truncate" title={r.full_name}>{r.full_name}</li>
                          ))}
                        </ul>
                        {inst.repositoryCount > 20 && (
                          <p className="text-[11px] text-gray-400 dark:text-zinc-600 mt-1.5">
                            + {inst.repositoryCount - 20} more
                          </p>
                        )}
                      </div>
                    )}

                    {/* Threshold editor */}
                    {editingThresholdId === inst.installationId ? (
                      <div className="flex items-center gap-3 pt-1">
                        <span className="text-xs text-gray-500 dark:text-zinc-500 shrink-0 w-32">Pass-fail score</span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          value={thresholdDraft}
                          onChange={(e) => setThresholdDraft(Number(e.target.value))}
                          className="flex-1"
                          aria-label="Score threshold for the PR check"
                        />
                        <span className="w-10 text-right text-sm font-mono tabular-nums">{thresholdDraft}</span>
                        <button
                          onClick={() => saveThreshold(inst.installationId)}
                          disabled={savingThreshold}
                          className="text-xs bg-violet-600 hover:bg-violet-500 disabled-muted text-white rounded-lg px-2.5 py-1 transition-colors"
                        >
                          {savingThreshold ? 'Saving…' : 'Save'}
                        </button>
                        <button
                          onClick={() => setEditingThresholdId(null)}
                          className="text-xs text-gray-500 dark:text-zinc-500 hover:underline"
                        >
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-xs text-gray-500 dark:text-zinc-500">
                          PR passes the Claudit check when the score is{' '}
                          <span className="font-medium text-gray-700 dark:text-zinc-300 tabular-nums">{inst.threshold} or higher</span>.
                        </span>
                        <button
                          onClick={() => openThresholdEditor(inst)}
                          className="text-xs text-violet-600 dark:text-violet-400 hover:underline"
                        >
                          Change
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {/* Secondary path for users who want to install on another GitHub
                account or org. Kept subtle so it doesn't compete with the
                actual install card content above. */}
            {data && data.installations.length > 0 && (
              <div className="mt-4 text-xs text-gray-400 dark:text-zinc-600 text-center">
                Need to install on another GitHub account or org?{' '}
                <a
                  href="/api/integrations/github/install"
                  className="text-violet-600 dark:text-violet-400 hover:underline"
                >
                  Add another installation
                </a>
              </div>
            )}
          </div>
        </motion.section>

        {/* Recent PR audits */}
        {data && data.recentAudits.length > 0 && (
          <motion.section variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
            <div className="flex items-center justify-between gap-3 mb-1">
              <h2 className="text-lg font-semibold">Recent reviews</h2>
              {hasActiveAudit && (
                <span className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300" title="Auto-refreshing while an audit is in flight">
                  <span aria-hidden="true" className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-breathe" />
                  Watching
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
              The last 20 pull requests Claudit reviewed.
            </p>
            <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
              {data.recentAudits.map((a) => (
                <RecentReviewRow key={a.id} audit={a} />
              ))}
            </ul>
          </motion.section>
        )}
      </motion.div>
    </div>
  );
}
