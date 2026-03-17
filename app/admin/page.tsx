import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { user, audit, organizationTable, member, session as sessionTable } from '@/lib/auth-schema';
import { eq, desc, count, and, isNotNull, sql } from 'drizzle-orm';
import AdminActions from './AdminActions';

export const metadata: Metadata = {
  title: 'Admin',
  robots: { index: false, follow: false },
};

export default async function AdminPage() {
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s) redirect('/login');
  if (s.user.role !== 'admin') notFound();

  // Fetch stats and data in parallel
  const [
    usersResult,
    auditsResult,
    orgsResult,
    activeSessionsResult,
    recentUsers,
    recentAudits,
    allUsers,
  ] = await Promise.all([
    db.select({ value: count() }).from(user),
    db.select({ value: count() }).from(audit),
    db.select({ value: count() }).from(organizationTable),
    db.select({ value: count() }).from(sessionTable),
    db.select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
      banned: user.banned,
    })
      .from(user)
      .orderBy(desc(user.createdAt))
      .limit(5),
    db.select({
      id: audit.id,
      agentName: audit.agentName,
      status: audit.status,
      score: audit.score,
      createdAt: audit.createdAt,
      userId: audit.userId,
    })
      .from(audit)
      .orderBy(desc(audit.createdAt))
      .limit(10),
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
      .orderBy(desc(user.createdAt))
      .limit(100),
  ]);

  const totalUsers = usersResult[0]?.value ?? 0;
  const totalAudits = auditsResult[0]?.value ?? 0;
  const totalOrgs = orgsResult[0]?.value ?? 0;
  const activeSessions = activeSessionsResult[0]?.value ?? 0;

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-5xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            Manage users, view audits, and monitor platform activity.
          </p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Users', value: totalUsers, color: 'border-l-violet-500' },
            { label: 'Audits', value: totalAudits, color: 'border-l-emerald-500' },
            { label: 'Teams', value: totalOrgs, color: 'border-l-blue-500' },
            { label: 'Active Sessions', value: activeSessions, color: 'border-l-amber-500' },
          ].map((stat) => (
            <div
              key={stat.label}
              className={`bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-2 ${stat.color} rounded-xl p-5 shadow-sm`}
            >
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* User Management */}
        <AdminActions users={allUsers} />

        {/* Recent Audits */}
        <div className="mt-10">
          <h2 className="text-lg font-semibold mb-4">Recent Audits</h2>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/80">
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Agent</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Status</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Score</th>
                    <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  {recentAudits.map((a) => (
                    <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                      <td className="px-4 py-3 font-medium truncate max-w-[200px]">{a.agentName}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                          a.status === 'completed'
                            ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                            : a.status === 'failed'
                              ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                        }`}>
                          {a.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-mono text-xs">
                        {a.score != null ? `${a.score}/100` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 dark:text-zinc-500 text-xs">
                        {new Date(a.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
