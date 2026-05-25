'use client';

import dynamic from 'next/dynamic';

const CodeAuditPanel = dynamic(() => import('@/components/CodeAuditPanel'), {
  loading: () => (
    <div className="space-y-4 motion-safe:animate-pulse px-6 pt-8 max-w-4xl mx-auto">
      <div className="h-48 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
      <div className="h-5 w-80 bg-gray-200 dark:bg-zinc-800 rounded" />
      <div className="h-12 w-40 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
    </div>
  ),
});

export default function AuditPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100">
      <CodeAuditPanel />
    </div>
  );
}
