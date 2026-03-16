import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { audit } from '@/lib/auth-schema';
import { eq, and, desc, lt, gt } from 'drizzle-orm';
import AuditResultView from './AuditResultView';
import { scoreColorClass } from '@/lib/ui';

export const metadata: Metadata = {
  title: 'Audit Result',
};

export default async function AuditDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  const session = await auth.api.getSession({
    headers: await headers(),
  });

  if (!session) redirect('/login');

  const rows = await db
    .select()
    .from(audit)
    .where(and(eq(audit.id, id), eq(audit.userId, session.user.id)))
    .limit(1);

  const auditRecord = rows[0];
  if (!auditRecord) notFound();

  // Fetch prev/next audit IDs for navigation
  const [prevRows, nextRows] = await Promise.all([
    db.select({ id: audit.id })
      .from(audit)
      .where(and(eq(audit.userId, session.user.id), gt(audit.createdAt, auditRecord.createdAt)))
      .orderBy(audit.createdAt)
      .limit(1),
    db.select({ id: audit.id })
      .from(audit)
      .where(and(eq(audit.userId, session.user.id), lt(audit.createdAt, auditRecord.createdAt)))
      .orderBy(desc(audit.createdAt))
      .limit(1),
  ]);

  const prevId = prevRows[0]?.id ?? null;
  const nextId = nextRows[0]?.id ?? null;

  const createdDate = new Date(auditRecord.createdAt).toISOString().split('T')[0];

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumbs */}
        <nav aria-label="Breadcrumb" className="mb-6">
          <ol className="flex items-center gap-1.5 text-sm text-gray-500 dark:text-zinc-500">
            <li>
              <Link href="/dashboard" className="hover:text-gray-700 dark:hover:text-zinc-300 transition-colors">
                Dashboard
              </Link>
            </li>
            <li aria-hidden="true">
              <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            </li>
            <li className="text-gray-900 dark:text-zinc-100 font-medium truncate max-w-[200px]">
              {auditRecord.agentName}
            </li>
          </ol>
        </nav>

        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold">{auditRecord.agentName}</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
              {new Date(auditRecord.createdAt).toLocaleString()}
              {auditRecord.durationMs ? ` · ${(auditRecord.durationMs / 1000).toFixed(1)}s` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {auditRecord.score != null && (
              <span className={`text-lg font-mono font-bold ${scoreColorClass(auditRecord.score)}`}>
                {auditRecord.score}/100
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full font-medium ${
                auditRecord.status === 'completed'
                  ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                  : auditRecord.status === 'failed'
                    ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
              }`}
            >
              {auditRecord.status === 'completed' && (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><polyline points="20 6 9 17 4 12" /></svg>
              )}
              {auditRecord.status === 'failed' && (
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></svg>
              )}
              {auditRecord.status}
            </span>
          </div>
        </div>

        <AuditResultView
          result={auditRecord.result}
          agentName={auditRecord.agentName}
          agentId={auditRecord.agentId}
          input={auditRecord.input}
          status={auditRecord.status}
          createdDate={createdDate}
        />

        {/* Prev/Next navigation */}
        {(prevId || nextId) && (
          <div className="flex items-center justify-between mt-8 pt-6 border-t border-gray-200 dark:border-zinc-800">
            {prevId ? (
              <Link
                href={`/dashboard/audit/${prevId}`}
                className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                ← Newer audit
              </Link>
            ) : <span />}
            {nextId ? (
              <Link
                href={`/dashboard/audit/${nextId}`}
                className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-500 hover:text-violet-600 dark:hover:text-violet-400 transition-colors"
              >
                Older audit →
              </Link>
            ) : <span />}
          </div>
        )}
      </div>
    </div>
  );
}
