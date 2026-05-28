'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import { useSession } from '@/lib/auth-client';
import { fadeUp, staggerContainer, transitions } from '@/lib/motion/variants';

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

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/integrations/github');
      if (!res.ok) throw new Error(`Couldn't load your integrations. Refresh to try again.`);
      const json = (await res.json()) as IntegrationsResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (session) void load();
  }, [session, load]);

  if (isPending) {
    return (
      <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="h-8 w-48 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
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
            <a
              href="/api/integrations/github/install"
              className="shrink-0 inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 text-white font-medium rounded-xl px-4 py-2 min-h-[40px] text-sm transition-colors focus-ring"
            >
              <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.7-1.3-1.7-1.1-.8.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2.9-.3 2-.4 3-.4s2.1.1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 0z" />
              </svg>
              Install on GitHub
            </a>
          </div>

          {/* Migration-missing hint —
              Operator (admin): full curl command for applying the migration.
              Everyone else:    user-facing "we're setting this up" message. */}
          {data?.migrationMissing && (
            isAdmin ? (
              <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
                <strong>Admin:</strong> the GitHub-App tables aren&apos;t created yet. Run migration 006 once:
                <code className="block mt-2 text-[11px] font-mono whitespace-pre">curl -X POST https://aiauditor-production.up.railway.app/api/admin/migrate-006 -H &quot;Authorization: Bearer $CRON_SECRET&quot;</code>
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
                        {inst.repositorySelection === 'selected' && inst.repositories.length > 0 && (
                          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1 truncate font-mono">
                            {inst.repositories.slice(0, 3).map((r) => r.full_name).join(', ')}
                            {inst.repositoryCount > 3 ? ` + ${inst.repositoryCount - 3} more` : ''}
                          </p>
                        )}
                      </div>
                      <div className="shrink-0">
                        <a
                          href={`https://github.com/settings/installations/${inst.installationId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-violet-600 dark:text-violet-400 hover:underline whitespace-nowrap"
                          title="Open this installation on GitHub to change repository access or uninstall"
                        >
                          Manage on GitHub →
                        </a>
                      </div>
                    </div>

                    {/* Warning: "all repositories" — easy to set, hard to un-do without thinking */}
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
          </div>
        </motion.section>

        {/* Recent PR audits */}
        {data && data.recentAudits.length > 0 && (
          <motion.section variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-1">Recent reviews</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
              The last 20 pull requests Claudit reviewed.
            </p>
            <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
              {data.recentAudits.map((a) => {
                const cr = checkRunUrl(a);
                return (
                  <li key={a.id} className="py-3 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">
                        <a
                          href={reviewUrl(a)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="hover:text-violet-600 dark:hover:text-violet-400 hover:underline"
                          title={a.postedReviewId ? "Open Claudit's review on this PR" : 'Open the PR on GitHub'}
                        >
                          {a.repoFullName} <span className="text-gray-400 dark:text-zinc-600">#{a.prNumber}</span>
                        </a>
                      </p>
                      <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
                        {new Date(a.createdAt).toLocaleString()}
                        {a.findingsTotal !== null
                          ? ` · ${a.findingsTotal} ${a.findingsTotal === 1 ? 'issue' : 'issues'}${(a.findingsCritical ?? 0) + (a.findingsHigh ?? 0) > 0 ? ` (${a.findingsCritical ?? 0} critical, ${a.findingsHigh ?? 0} high)` : ''}`
                          : ''}
                        {cr && a.status === 'posted' ? (
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
                      {a.score !== null && (
                        <span className="text-sm font-mono tabular-nums" title={`Score (pass-fail threshold is set per repository)`}>
                          {a.score}
                        </span>
                      )}
                      <span className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${STATUS_BADGE[a.status]}`}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    </div>
                  </li>
                );
              })}
            </ul>
          </motion.section>
        )}
      </motion.div>
    </div>
  );
}
