import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { audit, organizationTable, type AuditStatus, AUDIT_STATUSES } from '@/lib/auth-schema';
import { eq, desc, lt, count, and, isNotNull } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { scoreColorClass, relativeTime } from '@/lib/ui';
import { DashboardHeader } from '@/components/dashboard/DashboardHeader';
import { ScoreTrendChart } from '@/components/dashboard/ScoreTrendChart';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'View your audit history, scores, and trends.',
  openGraph: {
    title: 'Dashboard — Claudit',
    description: 'Track your code audit results, scores, and improvement trends.',
    url: '/dashboard',
  },
};

const PAGE_SIZE = 20;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; status?: string; stay?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const activeOrgId =
    (session.session as Record<string, unknown>)?.activeOrganizationId as string | null ?? null;

  const params = await searchParams;
  const cursor = params.cursor;
  const statusFilter = params.status;
  const stayParam = params.stay;

  const cursorDate = cursor ? new Date(cursor) : null;
  const ownershipCondition = activeOrgId
    ? eq(audit.organizationId, activeOrgId)
    : eq(audit.userId, session.user.id);

  const conditions = [ownershipCondition];
  if (cursorDate) conditions.push(lt(audit.createdAt, cursorDate));
  if (statusFilter && (AUDIT_STATUSES as readonly string[]).includes(statusFilter)) {
    conditions.push(eq(audit.status, statusFilter as AuditStatus));
  }
  const paginationWhere = conditions.length === 1 ? conditions[0] : and(...conditions);

  // PERF-031: Cache aggregate stats (count + scores) with 60s TTL.
  const cacheTag = activeOrgId ? `dashboard-org-${activeOrgId}` : `dashboard-${session.user.id}`;
  const getCachedStats = unstable_cache(
    async (ownerId: string, isOrg: boolean) => {
      const ownerFilter = isOrg
        ? eq(audit.organizationId, ownerId)
        : eq(audit.userId, ownerId);
      const [totalResult, allScoredAudits] = await Promise.all([
        db.select({ value: count() }).from(audit).where(ownerFilter),
        db
          .select({ score: audit.score, createdAt: audit.createdAt })
          .from(audit)
          .where(and(ownerFilter, eq(audit.status, 'completed'), isNotNull(audit.score)))
          .orderBy(desc(audit.createdAt))
          .limit(200),
      ]);
      return { totalResult, allScoredAudits };
    },
    ['dashboard-stats'],
    { revalidate: 60, tags: [cacheTag] },
  );

  const statsOwnerId = activeOrgId ?? session.user.id;
  // PERF-005: Parallelize org name fetch with stats + pagination queries.
  const [{ totalResult, allScoredAudits }, rawAudits, orgNameResult] = await Promise.all([
    getCachedStats(statsOwnerId, !!activeOrgId),
    db
      .select()
      .from(audit)
      .where(paginationWhere)
      .orderBy(desc(audit.createdAt))
      .limit(PAGE_SIZE + 1),
    activeOrgId
      ? db
          .select({ name: organizationTable.name })
          .from(organizationTable)
          .where(eq(organizationTable.id, activeOrgId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const totalCount = totalResult[0]?.value ?? 0;

  // ONB-004: Redirect first-time users to audit page.
  if (totalCount === 0 && !cursor && !statusFilter && stayParam !== '1') {
    redirect('/audit?welcome=1');
  }

  const allScores = allScoredAudits.map((a) => a.score!);
  const avgScore =
    allScores.length > 0
      ? Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length)
      : null;
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : null;

  // TREND-001: Last 10 scored audits for chart.
  const trendScores = allScoredAudits
    .slice(0, 10)
    .map((a) => a.score!)
    .reverse();

  const trendDelta =
    trendScores.length >= 2
      ? trendScores[trendScores.length - 1] - trendScores[0]
      : null;

  const hasMore = rawAudits.length > PAGE_SIZE;
  const audits = hasMore ? rawAudits.slice(0, PAGE_SIZE) : rawAudits;
  const nextCursor = hasMore
    ? audits[audits.length - 1].createdAt.toISOString()
    : null;
  const completedCount = allScoredAudits.length;

  const activeOrgName = orgNameResult[0]?.name ?? null;
  const firstName = session.user.name?.split(' ')[0] ?? session.user.name;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 pt-8 pb-0">

          {/* Title row */}
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>
              {activeOrgName && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/20">
                  {activeOrgName}
                </span>
              )}
            </div>
            <span className="text-xs text-gray-400 dark:text-zinc-500 mt-1.5">
              {totalCount > 0 && `${totalCount} audit${totalCount === 1 ? '' : 's'}`}
            </span>
          </div>

          {/* Greeting */}
          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-5">
            {totalCount === 0
              ? `Welcome, ${firstName}. Run your first audit to see findings, scores, and trends here.`
              : trendDelta != null && trendDelta > 0
                ? `Welcome back, ${firstName}. Your average score is up ${trendDelta} pts over your last 10 audits.`
                : `Welcome back, ${firstName}. Here's an overview of your audit history and scores.`}
          </p>

          {/* Quick-run bar */}
          <DashboardHeader />

          {/* Stat strip */}
          {totalCount > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-gray-100 dark:border-zinc-800 -mx-6">
              <StatCell label="Total audits" value={totalCount} />
              <StatCell
                label="Avg score"
                value={avgScore != null ? `${avgScore}/100` : '\u2014'}
                valueClass={avgScore != null ? scoreColorClass(avgScore) : ''}
                sub={trendDelta != null ? (
                  <span className={trendDelta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-500'}>
                    {trendDelta > 0 ? '+' : ''}{trendDelta} pts
                  </span>
                ) : undefined}
              />
              <StatCell
                label="Best score"
                value={bestScore != null ? `${bestScore}/100` : '\u2014'}
                valueClass={bestScore != null ? scoreColorClass(bestScore) : ''}
              />
              <StatCell label="Completed" value={completedCount} />
            </div>
          )}
        </div>
      </div>

      {/* ─── Body ────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-6 py-6 space-y-5">

        {/* Chart + last audit */}
        {trendScores.length >= 2 && (
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_200px] gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5">
              <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-4">
                Score trend — last {trendScores.length} audits
              </p>
              <ScoreTrendChart scores={trendScores} />
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-gray-400 dark:text-zinc-600">Oldest</span>
                <span className="text-[10px] text-gray-400 dark:text-zinc-600">Latest</span>
              </div>
            </div>

            {/* Last audit card */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 flex flex-col">
              <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-4">
                Last audit
              </p>
              {audits[0] ? (
                <>
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate mb-0.5">
                    {audits[0].agentName}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
                    {relativeTime(new Date(audits[0].createdAt))}
                  </p>
                  {audits[0].score != null && (
                    <div className="mt-auto pt-3 border-t border-gray-100 dark:border-zinc-800">
                      <span className={`text-3xl font-semibold font-mono ${scoreColorClass(audits[0].score)}`}>
                        {audits[0].score}
                      </span>
                      <span className="text-sm text-gray-400 dark:text-zinc-500">/100</span>
                    </div>
                  )}
                </>
              ) : (
                <p className="text-sm text-gray-400 dark:text-zinc-500">No audits yet</p>
              )}
            </div>
          </div>
        )}

        {/* Audit list */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">

          {/* List header */}
          <div
            id="dashboard-history"
            className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800"
          >
            <h2 className="text-sm font-semibold">Recent audits</h2>
            <div className="flex items-center gap-3">
              {totalCount > 0 && (
                <div className="flex items-center bg-gray-50 dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5">
                  {[
                    { label: 'All', value: undefined },
                    { label: 'Completed', value: 'completed' },
                    { label: 'Failed', value: 'failed' },
                  ].map(({ label, value }) => {
                    const isActive = statusFilter === value || (!statusFilter && !value);
                    const href = value ? `/dashboard?status=${value}` : '/dashboard';
                    return (
                      <Link
                        key={label}
                        href={href}
                        className={`px-2.5 py-1 rounded-md text-xs transition-colors ${
                          isActive
                            ? 'bg-white dark:bg-zinc-700 text-violet-700 dark:text-violet-300 font-medium shadow-sm'
                            : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'
                        }`}
                      >
                        {label}
                      </Link>
                    );
                  })}
                </div>
              )}
              {totalCount > 0 && (
                <span className="text-xs text-gray-400 dark:text-zinc-500">
                  {audits.length} of {totalCount}
                </span>
              )}
            </div>
          </div>

          {/* Empty state */}
          {audits.length === 0 && !cursor ? (
            <div className="py-16 px-6 text-center">
              <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                <svg className="w-5 h-5 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
                  <rect x="9" y="3" width="6" height="4" rx="1" />
                  <path d="M9 14l2 2 4-4" />
                </svg>
              </div>
              <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 mb-1.5">No audits yet</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-xs mx-auto mb-5">
                {(() => {
                  const days = Math.floor(
                    (Date.now() - new Date(session.user.createdAt).getTime()) / 86400000,
                  );
                  if (days === 0) return 'Run your first audit to see severity-rated findings, scores, and trends.';
                  if (days <= 3) return 'You signed up a few days ago \u2014 your first audit takes under 60 seconds.';
                  return 'You haven\u2019t run an audit yet. Paste any code to get started \u2014 it takes under 60 seconds.';
                })()}
              </p>
              <Link
                href="/audit"
                className="inline-block px-5 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring"
              >
                Run an audit
              </Link>
            </div>
          ) : (
            <>
              <ul className="divide-y divide-gray-50 dark:divide-zinc-800/80">
                {audits.map((a) => (
                  <li key={a.id}>
                    <Link
                      href={`/dashboard/audit/${a.id}`}
                      className="group flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                    >
                      {/* File icon */}
                      <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                        <svg className="w-3.5 h-3.5 text-violet-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true">
                          <rect x="2" y="1" width="12" height="14" rx="2" />
                          <path d="M5 5h6M5 8h6M5 11h4" strokeLinecap="round" />
                        </svg>
                      </div>

                      {/* Name + meta */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">
                          {a.agentName}
                        </p>
                        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                          {relativeTime(new Date(a.createdAt))}
                          {a.durationMs && ` \u00b7 ${(a.durationMs / 1000).toFixed(1)}s`}
                          {a.status === 'failed' && (
                            <span className="ml-1.5 text-red-400">
                              {'\u00b7'} {a.durationMs && a.durationMs > 120000 ? 'Timed out' : 'Error encountered'}
                            </span>
                          )}
                        </p>
                      </div>

                      {/* Score */}
                      {a.score != null && (
                        <span className={`text-sm font-semibold font-mono tabular-nums ${scoreColorClass(a.score)}`}>
                          {a.score}/100
                        </span>
                      )}

                      {/* Status badge */}
                      <span
                        className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${
                          a.status === 'completed'
                            ? 'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-400'
                            : a.status === 'failed'
                              ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400'
                              : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'
                        }`}
                      >
                        {a.status === 'completed' && (
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                        )}
                        {a.status === 'failed' && (
                          <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                        )}
                        {a.status === 'running' && (
                          <svg className="w-2.5 h-2.5 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                        )}
                        {a.status}
                      </span>

                      {/* Chevron */}
                      <svg
                        className="w-3.5 h-3.5 text-gray-300 dark:text-zinc-600 group-hover:text-violet-500 transition-colors flex-shrink-0"
                        viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
                      >
                        <polyline points="9 18 15 12 9 6" />
                      </svg>
                    </Link>
                  </li>
                ))}
              </ul>

              {nextCursor && (
                <div className="py-4 text-center border-t border-gray-50 dark:border-zinc-800">
                  <Link
                    href={`/dashboard?cursor=${encodeURIComponent(nextCursor)}${statusFilter ? `&status=${statusFilter}` : ''}`}
                    className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 transition-colors"
                  >
                    Load more &rarr;
                  </Link>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Stat cell ──────────────────────────────────────────────────────────────

function StatCell({
  label,
  value,
  valueClass = '',
  sub,
}: {
  label: string;
  value: string | number;
  valueClass?: string;
  sub?: React.ReactNode;
}) {
  return (
    <div className="px-6 py-4 border-r border-gray-100 dark:border-zinc-800 last:border-r-0">
      <p className={`text-xl font-semibold tracking-tight ${valueClass || 'text-gray-900 dark:text-zinc-100'}`}>
        {value}
      </p>
      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1">
        {label}
        {sub}
      </p>
    </div>
  );
}
