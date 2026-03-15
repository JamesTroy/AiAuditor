import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { audit } from '@/lib/auth-schema';
import { eq, and } from 'drizzle-orm';
import AuditResultView from './AuditResultView';

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

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-1 text-sm text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 mb-6 transition-colors"
        >
          ← Back to Dashboard
        </Link>

        <div className="flex items-start justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold">{auditRecord.agentName}</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
              {new Date(auditRecord.createdAt).toLocaleString()}
              {auditRecord.durationMs ? ` · ${(auditRecord.durationMs / 1000).toFixed(1)}s` : ''}
            </p>
          </div>
          <div className="flex items-center gap-3">
            {auditRecord.score != null && (
              <span className="text-lg font-mono font-bold">{auditRecord.score}/100</span>
            )}
            <span
              className={`text-xs px-2.5 py-1 rounded-full font-medium ${
                auditRecord.status === 'completed'
                  ? 'bg-green-100 dark:bg-green-950/30 text-green-700 dark:text-green-400'
                  : auditRecord.status === 'failed'
                    ? 'bg-red-100 dark:bg-red-950/30 text-red-700 dark:text-red-400'
                    : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
              }`}
            >
              {auditRecord.status}
            </span>
          </div>
        </div>

        <AuditResultView result={auditRecord.result} agentName={auditRecord.agentName} />
      </div>
    </div>
  );
}
