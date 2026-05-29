import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { audit, organizationTable, type AuditStatus, AUDIT_STATUSES } from '@/lib/auth-schema';
import { eq, desc, lt, count, and, isNotNull, gte, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import DashboardView from './DashboardView';
import { groupAuditSessions, sessionTrendDelta } from '@/lib/sessionTrend';

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
// Heatmap renders 13 weeks × 7 days = 91 cells. Fetch matching window so the
// oldest cell shows real data instead of always rendering as 0 (off-by-one
// bug). The user-visible label still says "last 90 days" because the
// difference is invisible in the heatmap aesthetic.
const HEATMAP_DAYS = 91;

// PERF-031: Hoisted out of the request handler so the unstable_cache
// wrapper is constructed ONCE at module load — not on every dashboard
// load. The previous in-handler closure was creating a fresh wrapper
// per request, defeating Next.js's cache key matching and turning every
// page load into a full cold miss against the md5(substring(input))
// SELECT below.
//
// Cache keys are derived from the static `['dashboard-stats-v4']` parts
// PLUS the function args (`ownerId`, `isOrg`), so different users get
// independent entries automatically. Invalidation via the shared tag
// nukes all users' entries on demand (`revalidateTag('dashboard-stats')`).
const getCachedStats = unstable_cache(
  async (ownerId: string, isOrg: boolean) => {
    const ownerFilter = isOrg
      ? eq(audit.organizationId, ownerId)
      : eq(audit.userId, ownerId);

    const heatmapStart = new Date();
    heatmapStart.setHours(0, 0, 0, 0);
    heatmapStart.setDate(heatmapStart.getDate() - (HEATMAP_DAYS - 1));

    const [totalResult, allScoredAudits, dailyActivityRows] = await Promise.all([
      db.select({ value: count() }).from(audit).where(ownerFilter),
      // TREND-002: include a SQL-computed input hash so we can group multi-agent
      // sessions into a single trend point client-side without shipping full
      // input text. md5 of the first 4KB is collision-safe at this volume.
      db
        .select({
          score: audit.score,
          createdAt: audit.createdAt,
          sessionKey: sql<string>`md5(substring(${audit.input} from 1 for 4000))`.as('session_key'),
        })
        .from(audit)
        .where(and(ownerFilter, eq(audit.status, 'completed'), isNotNull(audit.score)))
        .orderBy(desc(audit.createdAt))
        .limit(200),
      // Daily audit counts for the activity heatmap. We bucket in SQL so
      // the response payload stays small even for heavy users (max 90 rows).
      db
        .select({
          date: sql<string>`to_char(${audit.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`.as('date'),
          count: count(audit.id),
        })
        .from(audit)
        .where(and(ownerFilter, gte(audit.createdAt, heatmapStart)))
        .groupBy(sql`to_char(${audit.createdAt} AT TIME ZONE 'UTC', 'YYYY-MM-DD')`),
    ]);
    return { totalResult, allScoredAudits, dailyActivityRows };
  },
  ['dashboard-stats-v4'],
  { revalidate: 60, tags: ['dashboard-stats'] },
);

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

  const statsOwnerId = activeOrgId ?? session.user.id;
  // PERF-005: Parallelize org name fetch with stats + pagination queries.
  const [{ totalResult, allScoredAudits, dailyActivityRows }, rawAudits, orgNameResult] = await Promise.all([
    getCachedStats(statsOwnerId, !!activeOrgId),
    // Explicit column list — drizzle's `select()` with no args reads every
    // column declared in the schema, which makes the page brittle to schema
    // additions whose migration hasn't been applied yet. Only fetch what
    // DashboardView actually uses (mirrored in the map() below).
    db
      .select({
        id:         audit.id,
        agentId:    audit.agentId,
        agentName:  audit.agentName,
        status:     audit.status,
        score:      audit.score,
        durationMs: audit.durationMs,
        createdAt:  audit.createdAt,
      })
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

  // TREND-002: Group audit rows into sessions so the trend chart shows one
  // point per user action (multi-agent runs collapse to a single averaged
  // point) rather than per-agent variance within a single click.
  const trendSessions = groupAuditSessions(
    allScoredAudits.map((a) => ({ score: a.score!, createdAt: a.createdAt, sessionKey: a.sessionKey })),
    10,
  );
  const trendScores = trendSessions.map((s) => s.score);
  const trendDelta = sessionTrendDelta(trendSessions);

  const hasMore = rawAudits.length > PAGE_SIZE;
  const audits = hasMore ? rawAudits.slice(0, PAGE_SIZE) : rawAudits;
  const nextCursor = hasMore
    ? audits[audits.length - 1].createdAt.toISOString()
    : null;

  const activeOrgName = orgNameResult[0]?.name ?? null;
  const firstName = session.user.name?.split(' ')[0] ?? session.user.name;
  const daysSinceSignup = Math.floor(
    (Date.now() - new Date(session.user.createdAt).getTime()) / 86400000,
  );

  return (
    <DashboardView
      firstName={firstName}
      activeOrgName={activeOrgName}
      totalCount={totalCount}
      avgScore={avgScore}
      bestScore={bestScore}
      trendScores={trendScores}
      trendDelta={trendDelta}
      audits={audits.map((a) => ({
        id: a.id,
        agentId: a.agentId,
        agentName: a.agentName,
        status: a.status,
        score: a.score,
        durationMs: a.durationMs,
        createdAt: a.createdAt,
      }))}
      nextCursor={nextCursor}
      statusFilter={statusFilter ?? null}
      daysSinceSignup={daysSinceSignup}
      dailyActivity={dailyActivityRows.map((r) => ({ date: r.date, count: r.count }))}
    />
  );
}
