import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { audit } from '@/lib/auth-schema';
import { eq, desc } from 'drizzle-orm';

export const metadata: Metadata = {
  title: 'Dashboard',
  description: 'View your audit history, scores, and trends.',
};

export default async function DashboardPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect('/login');

  const audits = await db
    .select()
    .from(audit)
    .where(eq(audit.userId, session.user.id))
    .orderBy(desc(audit.createdAt))
    .limit(20);

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            Welcome back, {session.user.name}. Your server-side audit history is tracked here — powered by Claude Sonnet 4.6 and stored in PostgreSQL via Drizzle ORM.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-900/50 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-violet-500 rounded-xl p-5">
            <p className="text-2xl font-bold">{audits.length}</p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Total audits</p>
          </div>
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-900/50 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-emerald-500 rounded-xl p-5">
            <p className="text-2xl font-bold">
              {audits.filter((a) => a.status === 'completed').length}
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Completed</p>
          </div>
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-zinc-900 dark:to-zinc-900/50 border border-gray-200 dark:border-zinc-800 border-l-2 border-l-blue-500 rounded-xl p-5">
            <p className="text-2xl font-bold">
              {audits.filter((a) => a.score != null).length > 0
                ? Math.round(
                    audits
                      .filter((a) => a.score != null)
                      .reduce((sum, a) => sum + (a.score ?? 0), 0) /
                      audits.filter((a) => a.score != null).length,
                  )
                : '—'}
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">Avg score</p>
          </div>
        </div>

        <h2 className="text-lg font-semibold mb-4">Recent audits</h2>

        {audits.length === 0 ? (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-8 text-center">
            <p className="text-gray-500 dark:text-zinc-500 mb-4">No audits yet</p>
            <Link
              href="/"
              className="inline-flex items-center gap-1 text-sm font-medium text-violet-600 dark:text-violet-400 hover:text-violet-500"
            >
              Run your first audit →
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {audits.map((a) => (
              <div
                key={a.id}
                className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-5 py-4 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm font-medium">{a.agentName}</p>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">
                    {new Date(a.createdAt).toLocaleDateString()} ·{' '}
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
                        ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                        : a.status === 'failed'
                          ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                          : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                    }`}
                  >
                    {a.status}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
