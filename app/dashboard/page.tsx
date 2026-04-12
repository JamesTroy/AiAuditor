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
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect('/login');

  const activeOrgId = (session.session as Record<string, unknown>)?.activeOrganizationId as string | null ?? null;

  const params = await searchParams;
  const cursor = params.cursor;
  const statusFilter = params.status; // 'completed' | 'failed' | undefined (all)
  const stayParam = params.stay;

  // PERF-016: Run all dashboard queries in parallel instead of sequentially.
  // Merges score stats + trend into one query to reduce from 4 → 3 queries.
  const cursorDate = cursor ? new Date(cursor) : null;
  // When an org is active, show all org audits; otherwise show personal audits.
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
  // Paginated list is NOT cached since it depends on cursor.
  const cacheTag = activeOrgId ? `dashboard-org-${activeOrgId}` : `dashboard-${session.user.id}`;
  const getCachedStats = unstable_cache(
    async (ownerId: string, isOrg: boolean) => {
      const ownerFilter = isOrg
        ? eq(audit.organizationId, ownerId)
        : eq(audit.userId, ownerId);
      const [totalResult, allScoredAudits] = await Promise.all([
        db.select({ value: count() })
          .from(audit)
          .where(ownerFilter),
        db.select({ score: audit.score, createdAt: audit.createdAt })
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
    // PERF-030: Paginated list runs fresh (cursor-dependent).
    db.select()
      .from(audit)
      .where(paginationWhere)
      .orderBy(desc(audit.createdAt))
      .limit(PAGE_SIZE + 1),
    activeOrgId
      ? db.select({ name: organizationTable.name })
          .from(organizationTable)
          .where(eq(organizationTable.id, activeOrgId))
          .limit(1)
      : Promise.resolve([]),
  ]);

  const totalCount = totalResult[0]?.value ?? 0;

  // ONB-004: Redirect first-time users to site-audit page.
  if (totalCount === 0 && !cursor && !statusFilter && stayParam !== '1') {
    redirect('/audit?welcome=1');
  }

  const allScores = allScoredAudits.map((a) => a.score!);
  const avgScore = allScores.length > 0
    ? Math.round(allScores.reduce((sum, s) => sum + s, 0) / allScores.length)
    : null;

  // TREND-001: Last 10 scored audits for sparkline (already ordered by createdAt DESC).
  const trendScores = allScoredAudits
    .slice(0, 10)
    .map((a) => a.score!)
    .reverse(); // oldest first for left-to-right chart

  const hasMore = rawAudits.length > PAGE_SIZE;
  const pageAudits = hasMore ? rawAudits.slice(0, PAGE_SIZE) : rawAudits;

  const audits = pageAudits;

  const nextCursor = hasMore
    ? pageAudits[pageAudits.length - 1].createdAt.toISOString()
    : null;

  // Count completed audits from current page (for display)
  const pageCompleted = audits.filter((a) => a.status === 'completed').length;

  const activeOrgName = orgNameResult[0]?.name ?? null;

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">Dashboard</h1>
            {activeOrgName && (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/25">
                {activeOrgName}
              </span>
            )}
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            {activeOrgName
              ? `Team audit history for ${activeOrgName}.`
              : totalCount === 0
                ? `Welcome, ${session.user.name}. Run your first audit to see findings, scores, and trends here.`
                : `Welcome back, ${session.user.name}. Here's an overview of your audit history and scores.`}
          </p>
        </div>

        {totalCount > 0 && <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-900/50 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-violet-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-2xl font-bold">{totalCount}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Total audits</p>
          </div>
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-900/50 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-emerald-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <p className="text-2xl font-bold">{pageCompleted}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Completed</p>
          </div>
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-900/50 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-blue-500 rounded-xl p-5 shadow-sm hover:shadow-md transition-shadow">
            <div className="flex items-center justify-between">
              <div>
                <p className={`text-2xl font-bold ${avgScore != null ? scoreColorClass(avgScore) : ''}`}>
                  {avgScore ?? '—'}
                </p>
                <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">
                  Average score
                  {trendScores.length >= 2 && (() => {
                    const delta = trendScores[trendScores.length - 1] - trendScores[0];
                    if (delta === 0) return null;
                    return (
                      <span className={`ml-1.5 ${delta > 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                        {delta > 0 ? '+' : ''}{delta} pts
                      </span>
                    );
                  })()}
                </p>
              </div>
              {trendScores.length >= 2 && (
                <ScoreSparkline scores={trendScores} />
              )}
            </div>
          </div>
        </div>}

        <div id="dashboard-history" className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
          <h2 className="text-lg font-semibold">Recent audits</h2>
          <div className="flex items-center gap-2">
            {totalCount > 0 && (
              <div className="flex items-center gap-1 text-xs">
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
                      className={`px-2.5 py-1 rounded-lg transition-colors ${
                        isActive
                          ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300 font-medium'
                          : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-800'
                      }`}
                    >
                      {label}
                    </Link>
                  );
                })}
              </div>
            )}
            {totalCount > 0 && (
              <p className="text-xs text-gray-400 dark:text-zinc-500 ml-2">
                {audits.length} of {totalCount}
              </p>
            )}
          </div>
        </div>

        {audits.length === 0 && !cursor ? (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-10 text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
            <p className="text-gray-900 dark:text-zinc-100 font-medium mb-1">No audits yet</p>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mb-5 max-w-xs mx-auto">
              {(() => {
                const daysSinceSignup = Math.floor((Date.now() - new Date(session.user.createdAt).getTime()) / 86400000);
                if (daysSinceSignup === 0) return 'Run your first audit to see severity-rated findings, scores, and trends here.';
                if (daysSinceSignup <= 3) return 'You signed up a few days ago \u2014 your first audit takes under 60 seconds.';
                return 'You haven\u2019t run an audit yet. Paste any code to get started \u2014 it takes under 60 seconds.';
              })()}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <Link
                href="/audit"
                className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring"
              >
                Run an Audit
              </Link>
            </div>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {audits.map((a) => (
                <Link
                  key={a.id}
                  href={`/dashboard/audit/${a.id}`}
                  className="group block bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-5 py-4 flex items-center justify-between hover:border-violet-500/30 hover:shadow-md hover:-translate-y-px transition-[box-shadow,border-color,transform]"
                >
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{a.agentName}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                      {relativeTime(new Date(a.createdAt))} &middot;{' '}
                      {a.durationMs ? `${(a.durationMs / 1000).toFixed(1)}s` : '—'}
                      {a.status === 'failed' && (
                        <span className="ml-1.5 text-red-500 dark:text-red-400">
                          {a.durationMs && a.durationMs > 120000 ? '· Timed out' : '· Error encountered'}
                        </span>
                      )}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0 ml-4">
                    {a.score != null && (
                      <span className={`text-sm font-mono font-bold ${scoreColorClass(a.score)}`}>
                        {a.score}/100
                      </span>
                    )}
                    <span
                      className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                        a.status === 'completed'
                          ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                          : a.status === 'failed'
                            ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                      }`}
                    >
                      {a.status === 'completed' && (
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
                      )}
                      {a.status === 'failed' && (
                        <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
                      )}
                      {a.status === 'running' && (
                        <svg className="w-3 h-3 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>
                      )}
                      {a.status}
                    </span>
                    <svg className="w-4 h-4 text-gray-300 dark:text-zinc-600 group-hover:text-violet-500 transition-colors" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                  </div>
                </Link>
              ))}
            </div>

            {nextCursor && (
              <div className="mt-6 text-center">
                <Link
                  href={`/dashboard?cursor=${encodeURIComponent(nextCursor)}${statusFilter ? `&status=${statusFilter}` : ''}`}
                  className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 transition-colors"
                >
                  Load more audits &rarr;
                </Link>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// TREND-001: SVG sparkline with area fill for score trend visualization.
function ScoreSparkline({ scores }: { scores: number[] }) {
  const w = 120;
  const h = 48;
  const pad = 2;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const coords = scores.map((s, i) => ({
    x: pad + (i / (scores.length - 1)) * (w - pad * 2),
    y: pad + (1 - (s - min) / range) * (h - pad * 2),
  }));

  const linePoints = coords.map((c) => `${c.x},${c.y}`).join(' ');
  const areaPoints = `${pad},${h - pad} ${linePoints} ${w - pad},${h - pad}`;

  const last = scores[scores.length - 1];
  const prev = scores[scores.length - 2];
  const improving = last >= prev;
  const strokeColor = improving ? '#22c55e' : '#ef4444';
  const fillColor = improving ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)';
  const trending = improving ? 'text-green-500' : 'text-red-500';
  const trendLabel = improving ? 'Trend: improving' : 'Trend: declining';

  return (
    <span className={`inline-flex items-center gap-1 ${trending}`} title="Higher score = fewer issues found. 80+ is a strong score.">
      <svg width={w} height={h} aria-hidden="true">
        <polygon fill={fillColor} points={areaPoints} />
        <polyline
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={linePoints}
        />
        <circle cx={coords[coords.length - 1].x} cy={coords[coords.length - 1].y} r="3" fill={strokeColor} />
      </svg>
      <span aria-hidden="true" className="text-sm">{improving ? '↑' : '↓'}</span>
      <span className="sr-only">{trendLabel}</span>
    </span>
  );
}
