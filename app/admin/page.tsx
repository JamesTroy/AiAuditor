import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { user, audit, organizationTable, member, session as sessionTable } from '@/lib/auth-schema';
import { eq, desc, count, gte, sql } from 'drizzle-orm';
import AdminDashboard from './AdminDashboard';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect('/login');
  if (s.user.role !== 'admin') notFound();

  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const startOfWeek = new Date(startOfToday);
  startOfWeek.setDate(startOfWeek.getDate() - startOfWeek.getDay());
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

  const [
    usersResult,
    auditsResult,
    orgsResult,
    activeSessionsResult,
    auditsToday,
    auditsThisWeek,
    auditsThisMonth,
    completedCount,
    failedCount,
    recentAudits,
    allUsers,
    orgsWithMembers,
    topUsers,
  ] = await Promise.all([
    db.select({ value: count() }).from(user),
    db.select({ value: count() }).from(audit),
    db.select({ value: count() }).from(organizationTable),
    db.select({ value: count() }).from(sessionTable),
    db.select({ value: count() }).from(audit).where(gte(audit.createdAt, startOfToday)),
    db.select({ value: count() }).from(audit).where(gte(audit.createdAt, startOfWeek)),
    db.select({ value: count() }).from(audit).where(gte(audit.createdAt, startOfMonth)),
    db.select({ value: count() }).from(audit).where(eq(audit.status, 'completed')),
    db.select({ value: count() }).from(audit).where(eq(audit.status, 'failed')),
    db.select({
      id: audit.id,
      agentName: audit.agentName,
      status: audit.status,
      score: audit.score,
      createdAt: audit.createdAt,
      userId: audit.userId,
      userName: user.name,
      userEmail: user.email,
    })
      .from(audit)
      .leftJoin(user, eq(audit.userId, user.id))
      .orderBy(desc(audit.createdAt))
      .limit(50),
    db.select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      banned: user.banned,
      banReason: user.banReason,
    })
      .from(user)
      .orderBy(desc(user.createdAt)),
    db.select({
      id: organizationTable.id,
      name: organizationTable.name,
      slug: organizationTable.slug,
      createdAt: organizationTable.createdAt,
      memberCount: count(member.id),
    })
      .from(organizationTable)
      .leftJoin(member, eq(member.organizationId, organizationTable.id))
      .groupBy(organizationTable.id, organizationTable.name, organizationTable.slug, organizationTable.createdAt)
      .orderBy(desc(organizationTable.createdAt)),
    db.select({
      userId: audit.userId,
      userName: user.name,
      userEmail: user.email,
      auditCount: count(audit.id),
    })
      .from(audit)
      .innerJoin(user, eq(audit.userId, user.id))
      .groupBy(audit.userId, user.name, user.email)
      .orderBy(desc(count(audit.id)))
      .limit(10),
  ]);

  const totalUsers = usersResult[0]?.value ?? 0;
  const totalAudits = auditsResult[0]?.value ?? 0;
  const totalOrgs = orgsResult[0]?.value ?? 0;
  const activeSessions = activeSessionsResult[0]?.value ?? 0;
  const completed = completedCount[0]?.value ?? 0;
  const failed = failedCount[0]?.value ?? 0;
  const successRate = totalAudits > 0 ? Math.round((completed / totalAudits) * 100) : 0;

  return (
    <AdminDashboard
      stats={{
        totalUsers,
        totalAudits,
        totalOrgs,
        activeSessions,
        auditsToday: auditsToday[0]?.value ?? 0,
        auditsThisWeek: auditsThisWeek[0]?.value ?? 0,
        auditsThisMonth: auditsThisMonth[0]?.value ?? 0,
        completedAudits: completed,
        failedAudits: failed,
        successRate,
      }}
      users={allUsers}
      audits={recentAudits}
      orgs={orgsWithMembers}
      topUsers={topUsers}
      currentUserId={s.user.id}
    />
  );
}
