import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import {
  audit,
  organizationTable,
  member,
  user as userTable,
  type AuditStatus,
  AUDIT_STATUSES,
} from '@/lib/auth-schema';
import { eq, desc, lt, count, avg, max, and, isNotNull, sql } from 'drizzle-orm';
import { unstable_cache } from 'next/cache';
import { scoreColorClass, relativeTime } from '@/lib/ui';
import { ScoreTrendChart } from '@/components/dashboard/ScoreTrendChart';

export const metadata: Metadata = {
  title: 'Team overview',
  description: 'Org-wide audit scores, member activity, and team trends.',
  openGraph: {
    title: 'Team overview \u2014 Claudit',
    description: 'Track team-wide code quality, member scores, and audit trends.',
    url: '/dashboard/team',
  },
};

const PAGE_SIZE = 20;
const ROLE_ORDER: Record<string, number> = { owner: 0, admin: 1, member: 2 };

export default async function TeamOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ cursor?: string; status?: string; member?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const activeOrgId =
    (session.session as Record<string, unknown>)?.activeOrganizationId as string | null ?? null;

  if (!activeOrgId) redirect('/dashboard?stay=1');

  const params = await searchParams;
  const cursor = params.cursor;
  const statusFilter = params.status;
  const memberFilter = params.member;

  // Verify caller is a member of this org
  const callerMember = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, activeOrgId), eq(member.userId, session.user.id)))
    .limit(1);

  if (!callerMember[0]) redirect('/dashboard?stay=1');

  const cacheTag = `team-${activeOrgId}`;

  // Cached org-wide aggregates
  const getCachedOrgStats = unstable_cache(
    async (orgId: string) => {
      const orgFilter = eq(audit.organizationId, orgId);
      const completedFilter = and(orgFilter, eq(audit.status, 'completed'), isNotNull(audit.score));

      const [totalResult, allScoredAudits, openCriticalResult, membersWithUsers, perMemberStats] =
        await Promise.all([
          db.select({ value: count() }).from(audit).where(orgFilter),
          db
            .select({ score: audit.score, createdAt: audit.createdAt })
            .from(audit)
            .where(completedFilter)
            .orderBy(desc(audit.createdAt))
            .limit(200),
          db
            .select({ value: count() })
            .from(audit)
            .where(and(completedFilter, sql`${audit.score} < 60`)),
          db
            .select({
              memberId: member.id,
              userId: member.userId,
              role: member.role,
              joinedAt: member.createdAt,
              name: userTable.name,
              email: userTable.email,
              image: userTable.image,
            })
            .from(member)
            .innerJoin(userTable, eq(member.userId, userTable.id))
            .where(eq(member.organizationId, orgId))
            .orderBy(member.createdAt),
          db
            .select({
              userId: audit.userId,
              auditCount: count(),
              avgScore: avg(audit.score),
              bestScore: max(audit.score),
            })
            .from(audit)
            .where(completedFilter)
            .groupBy(audit.userId),
        ]);

      return { totalResult, allScoredAudits, openCritical: openCriticalResult[0]?.value ?? 0, membersWithUsers, perMemberStats };
    },
    ['team-stats'],
    { revalidate: 60, tags: [cacheTag] },
  );

  // Paginated audit list (not cached)
  const cursorDate = cursor ? new Date(cursor) : null;
  const orgFilter = eq(audit.organizationId, activeOrgId);
  const listConditions = [orgFilter];
  if (cursorDate) listConditions.push(lt(audit.createdAt, cursorDate));
  if (statusFilter && (AUDIT_STATUSES as readonly string[]).includes(statusFilter)) {
    listConditions.push(eq(audit.status, statusFilter as AuditStatus));
  }
  if (memberFilter) listConditions.push(eq(audit.userId, memberFilter));
  const listWhere = listConditions.length === 1 ? listConditions[0] : and(...listConditions);

  const [{ totalResult, allScoredAudits, openCritical, membersWithUsers, perMemberStats }, rawAudits, orgResult] =
    await Promise.all([
      getCachedOrgStats(activeOrgId),
      db.select().from(audit).where(listWhere).orderBy(desc(audit.createdAt)).limit(PAGE_SIZE + 1),
      db.select({ name: organizationTable.name }).from(organizationTable).where(eq(organizationTable.id, activeOrgId)).limit(1),
    ]);

  const orgName = orgResult[0]?.name ?? 'Team';
  const totalCount = totalResult[0]?.value ?? 0;

  const allScores = allScoredAudits.map((a) => a.score!);
  const avgScore = allScores.length > 0 ? Math.round(allScores.reduce((s, v) => s + v, 0) / allScores.length) : null;
  const bestScore = allScores.length > 0 ? Math.max(...allScores) : null;
  const trendScores = allScoredAudits.slice(0, 10).map((a) => a.score!).reverse();
  const trendDelta = trendScores.length >= 2 ? trendScores[trendScores.length - 1] - trendScores[0] : null;

  // Member leaderboard
  const memberStatsMap = new Map(
    perMemberStats.map((s) => [s.userId, { auditCount: s.auditCount, avgScore: s.avgScore != null ? Math.round(Number(s.avgScore)) : null, bestScore: s.bestScore }]),
  );
  const members = membersWithUsers
    .map((m) => ({ ...m, stats: memberStatsMap.get(m.userId) ?? { auditCount: 0, avgScore: null, bestScore: null } }))
    .sort((a, b) => {
      const sa = a.stats.avgScore ?? -1;
      const sb = b.stats.avgScore ?? -1;
      if (sb !== sa) return sb - sa;
      return (ROLE_ORDER[a.role] ?? 9) - (ROLE_ORDER[b.role] ?? 9);
    });

  const hasMore = rawAudits.length > PAGE_SIZE;
  const audits = hasMore ? rawAudits.slice(0, PAGE_SIZE) : rawAudits;
  const nextCursor = hasMore ? audits[audits.length - 1].createdAt.toISOString() : null;
  const userNameMap = new Map(membersWithUsers.map((m) => [m.userId, m.name ?? m.email]));

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100">

      {/* ─── Header ──────────────────────────────────────────────── */}
      <div className="bg-white dark:bg-zinc-900 border-b border-gray-100 dark:border-zinc-800">
        <div className="max-w-5xl mx-auto px-6 pt-8 pb-0">
          <div className="flex items-start justify-between mb-1">
            <div className="flex items-center gap-2.5">
              <h1 className="text-2xl font-semibold tracking-tight">Team overview</h1>
              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-violet-50 dark:bg-violet-500/10 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/20">
                {orgName}
              </span>
            </div>
            <div className="flex items-center gap-3 mt-1">
              <span className="text-xs text-gray-400 dark:text-zinc-500">
                {members.length} member{members.length === 1 ? '' : 's'}
              </span>
              <Link href="/audit" className="px-3 py-1.5 text-xs font-medium text-white bg-violet-600 hover:bg-violet-500 rounded-lg transition-colors">
                New audit &rarr;
              </Link>
            </div>
          </div>

          <p className="text-sm text-gray-500 dark:text-zinc-400 mb-5">
            {trendDelta != null && trendDelta > 0
              ? `Team average is up ${trendDelta} pts over the last 10 audits.`
              : trendDelta != null && trendDelta < 0
                ? `Team average is down ${Math.abs(trendDelta)} pts over the last 10 audits \u2014 check the findings below.`
                : `Org-wide audit scores, member activity, and recent findings for ${orgName}.`}
          </p>

          {totalCount > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-4 border-t border-gray-100 dark:border-zinc-800 -mx-6">
              <StatCell label="Total audits" value={totalCount} />
              <StatCell
                label="Team avg score"
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
              <StatCell
                label="Open critical"
                value={openCritical}
                valueClass={openCritical > 0 ? 'text-red-500 dark:text-red-400' : ''}
              />
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
                Team score trend &mdash; last {trendScores.length} audits
              </p>
              <ScoreTrendChart scores={trendScores} />
              <div className="flex justify-between mt-2">
                <span className="text-[10px] text-gray-400 dark:text-zinc-600">Oldest</span>
                <span className="text-[10px] text-gray-400 dark:text-zinc-600">Latest</span>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl p-5 flex flex-col">
              <p className="text-xs font-medium text-gray-400 dark:text-zinc-500 uppercase tracking-widest mb-4">Last audit</p>
              {audits[0] ? (
                <>
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate mb-0.5">{audits[0].agentName}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500">{userNameMap.get(audits[0].userId) ?? 'Unknown'}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">{relativeTime(new Date(audits[0].createdAt))}</p>
                  {audits[0].score != null && (
                    <div className="mt-auto pt-3 border-t border-gray-100 dark:border-zinc-800">
                      <span className={`text-3xl font-semibold font-mono ${scoreColorClass(audits[0].score)}`}>{audits[0].score}</span>
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

        {/* Member leaderboard + audit list */}
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_260px] gap-5 items-start">

          {/* Audit list */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800">
              <h2 className="text-sm font-semibold">
                {memberFilter ? `Audits by ${userNameMap.get(memberFilter) ?? 'member'}` : 'Recent team audits'}
              </h2>
              <div className="flex items-center gap-2">
                {!memberFilter && (
                  <div className="flex items-center bg-gray-50 dark:bg-zinc-800 rounded-lg p-0.5 gap-0.5">
                    {[
                      { label: 'All', value: undefined },
                      { label: 'Completed', value: 'completed' },
                      { label: 'Failed', value: 'failed' },
                    ].map(({ label, value }) => {
                      const isActive = statusFilter === value || (!statusFilter && !value);
                      const href = value ? `/dashboard/team?status=${value}` : '/dashboard/team';
                      return (
                        <Link key={label} href={href} className={`px-2.5 py-1 rounded-md text-xs transition-colors ${isActive ? 'bg-white dark:bg-zinc-700 text-violet-700 dark:text-violet-300 font-medium shadow-sm' : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200'}`}>
                          {label}
                        </Link>
                      );
                    })}
                  </div>
                )}
                {memberFilter && (
                  <Link href="/dashboard/team" className="text-xs text-violet-600 dark:text-violet-400 hover:underline">&larr; All members</Link>
                )}
                <span className="text-xs text-gray-400 dark:text-zinc-500">{audits.length} of {totalCount}</span>
              </div>
            </div>

            {audits.length === 0 ? (
              <div className="py-16 px-6 text-center">
                <div className="w-12 h-12 rounded-2xl bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-5 h-5 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" />
                  </svg>
                </div>
                <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 mb-1.5">No team audits yet</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 max-w-xs mx-auto mb-5">
                  Invite your team and run your first audit to see org-wide scores and trends here.
                </p>
                <Link href="/audit" className="inline-block px-5 py-2 rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors">Run an audit</Link>
              </div>
            ) : (
              <>
                <ul className="divide-y divide-gray-50 dark:divide-zinc-800/80">
                  {audits.map((a) => (
                    <li key={a.id}>
                      <Link href={`/dashboard/audit/${a.id}`} className="group flex items-center gap-3 px-5 py-3.5 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                        <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-500/10 flex items-center justify-center flex-shrink-0">
                          <svg className="w-3.5 h-3.5 text-violet-500" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" aria-hidden="true"><rect x="2" y="1" width="12" height="14" rx="2" /><path d="M5 5h6M5 8h6M5 11h4" strokeLinecap="round" /></svg>
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">{a.agentName}</p>
                          <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
                            {userNameMap.get(a.userId) ?? 'Unknown'} &middot; {relativeTime(new Date(a.createdAt))}
                            {a.durationMs && ` \u00b7 ${(a.durationMs / 1000).toFixed(1)}s`}
                            {a.status === 'failed' && <span className="ml-1.5 text-red-400">&middot; {a.durationMs && a.durationMs > 120000 ? 'Timed out' : 'Error'}</span>}
                          </p>
                        </div>
                        {a.score != null && <span className={`text-sm font-semibold font-mono tabular-nums ${scoreColorClass(a.score)}`}>{a.score}/100</span>}
                        <span className={`inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full font-medium ${a.status === 'completed' ? 'bg-green-50 dark:bg-green-950/60 text-green-700 dark:text-green-400' : a.status === 'failed' ? 'bg-red-50 dark:bg-red-950/60 text-red-600 dark:text-red-400' : 'bg-amber-50 dark:bg-amber-950/60 text-amber-600 dark:text-amber-400'}`}>
                          {a.status === 'completed' && <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>}
                          {a.status === 'failed' && <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>}
                          {a.status === 'running' && <svg className="w-2.5 h-2.5 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true"><path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" /></svg>}
                          {a.status}
                        </span>
                        <svg className="w-3.5 h-3.5 text-gray-300 dark:text-zinc-600 group-hover:text-violet-500 transition-colors flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="9 18 15 12 9 6" /></svg>
                      </Link>
                    </li>
                  ))}
                </ul>
                {nextCursor && (
                  <div className="py-4 text-center border-t border-gray-50 dark:border-zinc-800">
                    <Link href={`/dashboard/team?cursor=${encodeURIComponent(nextCursor)}${statusFilter ? `&status=${statusFilter}` : ''}${memberFilter ? `&member=${memberFilter}` : ''}`} className="text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500 transition-colors">
                      Load more &rarr;
                    </Link>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Member leaderboard */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-100 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="px-5 py-3.5 border-b border-gray-100 dark:border-zinc-800 flex items-center justify-between">
              <h2 className="text-sm font-semibold">Members</h2>
              <Link href="/settings/team?section=members" className="text-xs text-violet-600 dark:text-violet-400 hover:underline">Manage &rarr;</Link>
            </div>
            <ul className="divide-y divide-gray-50 dark:divide-zinc-800/80">
              {members.map((m, i) => {
                const isFiltered = memberFilter === m.userId;
                const initials = (m.name ?? m.email ?? '?').split(' ').map((w: string) => w[0]).join('').toUpperCase().slice(0, 2);
                return (
                  <li key={m.memberId}>
                    <Link
                      href={isFiltered ? '/dashboard/team' : `/dashboard/team?member=${m.userId}`}
                      className={`flex items-center gap-3 px-5 py-3 hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors ${isFiltered ? 'bg-violet-50 dark:bg-violet-500/5' : ''}`}
                    >
                      <span className="text-xs font-mono text-gray-300 dark:text-zinc-700 w-4 text-right flex-shrink-0 tabular-nums">{i + 1}</span>
                      <div className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center text-[10px] font-semibold text-violet-700 dark:text-violet-300 flex-shrink-0 select-none">{initials}</div>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-medium text-gray-800 dark:text-zinc-200 truncate">
                          {m.name ?? m.email}
                          {m.userId === session.user.id && <span className="ml-1 text-gray-400 dark:text-zinc-600 font-normal">(you)</span>}
                        </p>
                        <p className="text-[10px] text-gray-400 dark:text-zinc-500 mt-0.5">
                          <RoleBadge role={m.role} />
                          {m.stats.auditCount > 0 && <span className="ml-1.5">{m.stats.auditCount} audit{m.stats.auditCount === 1 ? '' : 's'}</span>}
                        </p>
                      </div>
                      {m.stats.avgScore != null ? (
                        <span className={`text-xs font-semibold font-mono tabular-nums ${scoreColorClass(m.stats.avgScore)}`}>{m.stats.avgScore}</span>
                      ) : (
                        <span className="text-xs text-gray-300 dark:text-zinc-700">&mdash;</span>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, valueClass = '', sub }: { label: string; value: string | number; valueClass?: string; sub?: React.ReactNode }) {
  return (
    <div className="px-6 py-4 border-r border-gray-100 dark:border-zinc-800 last:border-r-0">
      <p className={`text-xl font-semibold tracking-tight ${valueClass || 'text-gray-900 dark:text-zinc-100'}`}>{value}</p>
      <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5 flex items-center gap-1">{label}{sub}</p>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = { owner: 'text-violet-600 dark:text-violet-400', admin: 'text-blue-600 dark:text-blue-400', member: '' };
  return <span className={styles[role] ?? ''}>{role.charAt(0).toUpperCase() + role.slice(1)}</span>;
}
