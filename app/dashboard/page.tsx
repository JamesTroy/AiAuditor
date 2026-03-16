import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { audit } from '@/lib/auth-schema';
import { eq, desc, lt, count, and, isNotNull } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';

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
  searchParams: Promise<{ cursor?: string }>;
}) {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect('/login');

  const params = await searchParams;
  const cursor = params.cursor;

  // PERF-016: Run all dashboard queries in parallel instead of sequentially.
  // Merges score stats + trend into one query to reduce from 4 → 3 queries.
  const cursorDate = cursor ? new Date(cursor) : null;
  const paginationWhere = cursorDate
    ? and(eq(audit.userId, session.user.id), lt(audit.createdAt, cursorDate))
    : eq(audit.userId, session.user.id);

  // PERF-031: Cache aggregate stats (count + scores) with 60s TTL.
  // Paginated list is NOT cached since it depends on cursor.
  const getCachedStats = unstable_cache(
    async (userId: string) => {
      const [totalResult, allScoredAudits] = await Promise.all([
        db.select({ value: count() })
          .from(audit)
          .where(eq(audit.userId, userId)),
        db.select({ score: audit.score, createdAt: audit.createdAt })
          .from(audit)
          .where(and(eq(audit.userId, userId), eq(audit.status, 'completed'), isNotNull(audit.score)))
          .orderBy(desc(audit.createdAt))
          .limit(200),
      ]);
      return { totalResult, allScoredAudits };
    },
    ['dashboard-stats'],
    { revalidate: 60, tags: [`dashboard-${session.user.id}`] },
  );

  const [{ totalResult, allScoredAudits }, rawAudits] = await Promise.all([
    getCachedStats(session.user.id),
    // PERF-030: Paginated list runs fresh (cursor-dependent).
    db.select()
      .from(audit)
      .where(paginationWhere)
      .orderBy(desc(audit.createdAt))
      .limit(PAGE_SIZE + 1),
  ]);

  const totalCount = totalResult[0]?.value ?? 0;

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

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            Welcome back, {session.user.name}. Here&apos;s an overview of your audit history and scores.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-900/50 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-violet-500 rounded-xl p-5">
            <p className="text-2xl font-bold">{totalCount}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Total audits</p>
          </div>
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-900/50 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-emerald-500 rounded-xl p-5">
            <p className="text-2xl font-bold">{pageCompleted}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Completed</p>
          </div>
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-900/50 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-blue-500 rounded-xl p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-2xl font-bold">{avgScore ?? '—'}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Avg score</p>
              </div>
              {trendScores.length >= 2 && (
                <ScoreSparkline scores={trendScores} />
              )}
            </div>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-4">Recent audits</h2>

        {audits.length === 0 && !cursor ? (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-10 text-center">
            <svg className="w-12 h-12 mx-auto mb-4 text-gray-300 dark:text-zinc-700" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2" />
              <rect x="9" y="3" width="6" height="4" rx="1" />
              <path d="M9 14l2 2 4-4" />
            </svg>
            <p className="text-gray-900 dark:text-zinc-100 font-medium mb-1">No audits yet</p>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mb-5 max-w-xs mx-auto">
              Run your first code audit to see severity-rated findings, scores, and trends here.
            </p>
            <Link
              href="/site-audit"
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring"
            >
              Run a Site Audit
            </Link>
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {audits.map((a) => (
                <Link
                  key={a.id}
                  href={`/dashboard/audit/${a.id}`}
                  className="block bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-5 py-4 flex items-center justify-between hover:border-violet-500/30 transition-colors"
                >
                  <div>
                    <p className="text-sm font-medium">{a.agentName}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                      {new Date(a.createdAt).toLocaleDateString()} &middot;{' '}
                      {a.durationMs ? `${(a.durationMs / 1000).toFixed(1)}s` : '—'}
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    {a.score != null && (
                      <span className="text-sm font-mono font-bold">{a.score}/100</span>
                    )}
                    <span
                      className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                        a.status === 'completed'
                          ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                          : a.status === 'failed'
                            ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                            : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                      }`}
                    >
                      {a.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>

            {nextCursor && (
              <div className="mt-6 text-center">
                <Link
                  href={`/dashboard?cursor=${encodeURIComponent(nextCursor)}`}
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

// TREND-001: Minimal SVG sparkline for score trend visualization.
function ScoreSparkline({ scores }: { scores: number[] }) {
  const w = 80;
  const h = 32;
  const pad = 2;
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;

  const points = scores.map((s, i) => {
    const x = pad + (i / (scores.length - 1)) * (w - pad * 2);
    const y = pad + (1 - (s - min) / range) * (h - pad * 2);
    return `${x},${y}`;
  });

  const last = scores[scores.length - 1];
  const prev = scores[scores.length - 2];
  const improving = last >= prev;
  const trending = improving ? 'text-green-500' : 'text-red-500';
  const trendLabel = improving ? 'Trend: improving' : 'Trend: declining';

  return (
    <span className={`inline-flex items-center gap-1 ${trending}`}>
      <svg width={w} height={h} aria-hidden="true">
        <polyline
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={points.join(' ')}
        />
      </svg>
      <span aria-hidden="true" className="text-sm">{improving ? '↑' : '↓'}</span>
      <span className="sr-only">{trendLabel}</span>
    </span>
  );
}
