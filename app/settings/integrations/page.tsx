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
  createdAt: string;
}

interface IntegrationsResponse {
  installations: Installation[];
  recentAudits: RecentAudit[];
  migrationMissing?: boolean;
}

const ERROR_LABELS: Record<string, string> = {
  missing_installation_id: 'GitHub did not return an installation ID. Try again.',
  invalid_or_expired_state: 'The install request expired or was tampered with. Try again.',
  state_user_mismatch: 'The install was started by a different account. Sign in with the original account or restart.',
  github_fetch_failed: 'Could not reach GitHub to confirm the installation. Try again in a moment.',
  db_write_failed: 'The installation succeeded on GitHub but could not be saved here. Contact support — your install_id is on GitHub.',
};

const STATUS_BADGE: Record<RecentAudit['status'], string> = {
  posted:  'bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  running: 'bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  queued:  'bg-gray-100 text-gray-600 dark:bg-zinc-800 dark:text-zinc-400',
  failed:  'bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-300',
  skipped: 'bg-gray-100 text-gray-500 dark:bg-zinc-800 dark:text-zinc-500',
};

export default function IntegrationsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session, isPending } = useSession();

  const [data, setData] = useState<IntegrationsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [flashError, setFlashError] = useState<string | null>(null);
  const [flashSuccess, setFlashSuccess] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);

  // Surface error/installed query params as flash banners, then strip them.
  useEffect(() => {
    const errCode = searchParams.get('error');
    const installed = searchParams.get('installed');
    if (errCode) {
      setFlashError(ERROR_LABELS[errCode] ?? `Install failed: ${errCode}`);
      router.replace('/settings/integrations');
    } else if (installed) {
      setFlashSuccess('GitHub App installed. PR reviews will run on opened/updated PRs in the selected repos.');
      router.replace('/settings/integrations');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/integrations/github');
      if (!res.ok) throw new Error(`Request failed: ${res.status}`);
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

  async function handleRemove(installationId: number) {
    if (!confirm('Remove this installation from Claudit? This does NOT uninstall the App from GitHub — visit github.com/settings/installations to do that.')) {
      return;
    }
    setRemovingId(installationId);
    try {
      const res = await fetch(`/api/integrations/github?id=${installationId}`, { method: 'DELETE' });
      if (!res.ok) throw new Error(`Delete failed: ${res.status}`);
      await load();
    } catch (e) {
      setFlashError(e instanceof Error ? e.message : String(e));
    } finally {
      setRemovingId(null);
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
            Connect GitHub so Claudit can auto-review pull requests with inline comments and a PASS/FAIL check run.
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
              <h2 className="text-lg font-semibold">GitHub App</h2>
              <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
                Auto-reviews every PR with inline comments on [CERTAIN] + [LIKELY] findings, plus a PASS/FAIL check run.
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

          {/* Migration-missing hint — surfaced when the DB tables aren't there yet. */}
          {data?.migrationMissing && (
            <div className="mt-4 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900 text-amber-800 dark:text-amber-300 text-xs">
              The GitHub-App tables haven&apos;t been created yet. Run migration 006 once on production:
              <code className="block mt-2 text-[11px] font-mono whitespace-pre">curl -X POST https://aiauditor-production.up.railway.app/api/admin/migrate-006 -H &quot;Authorization: Bearer $CRON_SECRET&quot;</code>
            </div>
          )}

          {error && (
            <div className="mt-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-300 text-sm">
              Failed to load installations: {error}
            </div>
          )}

          <div className="mt-4">
            {loading ? (
              <p className="text-sm text-gray-400 dark:text-zinc-600 py-2">Loading…</p>
            ) : data && data.installations.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 dark:border-zinc-700 px-4 py-6 text-center">
                <p className="text-sm text-gray-500 dark:text-zinc-500">
                  No GitHub installations yet. Click <span className="font-medium">Install on GitHub</span> to add the App to your account or an organization.
                </p>
              </div>
            ) : (
              <ul className="space-y-3">
                {data?.installations.map((inst) => (
                  <li
                    key={inst.installationId}
                    className="border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-3"
                  >
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
                            ? 'All repositories in this account'
                            : `${inst.repositoryCount} selected ${inst.repositoryCount === 1 ? 'repository' : 'repositories'}`}
                          {' · installed '}
                          {new Date(inst.installedAt).toLocaleDateString()}
                        </p>
                        {inst.repositorySelection === 'selected' && inst.repositories.length > 0 && (
                          <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1 truncate font-mono">
                            {inst.repositories.slice(0, 3).map((r) => r.full_name).join(', ')}
                            {inst.repositoryCount > 3 ? ` + ${inst.repositoryCount - 3} more` : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <a
                          href={`https://github.com/settings/installations/${inst.installationId}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-xs text-gray-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 underline-offset-2 hover:underline"
                        >
                          Manage on GitHub →
                        </a>
                        <button
                          onClick={() => handleRemove(inst.installationId)}
                          disabled={removingId === inst.installationId}
                          className="text-xs text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 disabled-muted transition-colors"
                          aria-label="Remove from Claudit"
                        >
                          {removingId === inst.installationId ? 'Removing…' : 'Remove'}
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </motion.section>

        {/* Recent PR audits */}
        {data && data.recentAudits.length > 0 && (
          <motion.section variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-lg font-semibold mb-1">Recent PR audits</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
              Latest 20 audit runs triggered by GitHub webhook events.
            </p>
            <ul className="divide-y divide-gray-100 dark:divide-zinc-800">
              {data.recentAudits.map((a) => (
                <li key={a.id} className="py-3 flex items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">
                      <a
                        href={`https://github.com/${a.repoFullName}/pull/${a.prNumber}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-violet-600 dark:hover:text-violet-400 hover:underline"
                      >
                        {a.repoFullName} <span className="text-gray-400 dark:text-zinc-600">#{a.prNumber}</span>
                      </a>
                    </p>
                    <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
                      {new Date(a.createdAt).toLocaleString()}
                      {a.findingsTotal !== null
                        ? ` · ${a.findingsTotal} findings (${a.findingsCritical ?? 0} crit, ${a.findingsHigh ?? 0} high)`
                        : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    {a.score !== null && (
                      <span className="text-sm font-mono tabular-nums">{a.score}/100</span>
                    )}
                    <span className={`text-[10px] uppercase tracking-wider rounded px-1.5 py-0.5 ${STATUS_BADGE[a.status]}`}>
                      {a.status}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          </motion.section>
        )}
      </motion.div>
    </div>
  );
}
