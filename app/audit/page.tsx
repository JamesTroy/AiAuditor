'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { agents } from '@/lib/agents/registry';

// Lazy-load panel so only the active one is bundled on first paint.
const CodeAuditPanel = dynamic(() => import('@/components/CodeAuditPanel'), {
  loading: () => <PanelSkeleton />,
});

function PanelSkeleton() {
  return (
    <div className="space-y-4 motion-safe:animate-pulse">
      <div className="h-48 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
      <div className="h-5 w-80 bg-gray-200 dark:bg-zinc-800 rounded" />
      <div className="h-12 w-40 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
    </div>
  );
}

function FirstRunBanner({ onDismiss }: { onDismiss: () => void }) {
  return (
    <div className="mx-auto max-w-4xl px-6 pt-6">
      <div className="relative rounded-2xl bg-gradient-to-br from-violet-50 to-indigo-50 dark:from-violet-950/40 dark:to-indigo-950/40 border border-violet-200 dark:border-violet-800/60 p-5">
        <button
          onClick={onDismiss}
          aria-label="Dismiss guide"
          className="absolute top-3 right-3 p-1 rounded-lg text-violet-400 hover:text-violet-600 dark:hover:text-violet-200 hover:bg-violet-100 dark:hover:bg-violet-900/40 transition-colors"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5"><path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" /></svg>
        </button>
        <p className="text-xs font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-3">How it works</p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { step: '1', icon: '📋', title: 'Paste your code', desc: 'Any language, any size. Auditors auto-select based on what you paste.' },
            { step: '2', icon: '⚡', title: 'Auditors run in parallel', desc: `Up to ${agents.length} specialized auditors check security, performance, accessibility, and more.` },
            { step: '3', icon: '🎯', title: 'Get severity-rated findings', desc: 'Critical → Low findings with exact line numbers and copy-paste fixes.' },
          ].map(({ step, icon, title, desc }) => (
            <div key={step} className="flex gap-3 items-start">
              <span className="w-7 h-7 rounded-full bg-violet-100 dark:bg-violet-900/50 text-violet-600 dark:text-violet-300 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{step}</span>
              <div>
                <p className="text-sm font-semibold text-gray-800 dark:text-zinc-100">{icon} {title}</p>
                <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default function AuditPage() {
  const [showGuide, setShowGuide] = useState(false);

  useEffect(() => {
    if (!localStorage.getItem('audit-onboarded')) {
      setShowGuide(true);
    }
  }, []);

  function dismissGuide() {
    localStorage.setItem('audit-onboarded', '1');
    setShowGuide(false);
  }

  return (
    <div className="text-gray-900 dark:text-zinc-100">
      {showGuide && <FirstRunBanner onDismiss={dismissGuide} />}

      {/* Header */}
      <div className="text-center px-6 pt-12 pb-2">
        <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
          Run an Audit
        </h1>
        <p className="text-gray-500 dark:text-zinc-400 text-base sm:text-lg max-w-2xl mx-auto">
          Get a severity-rated report from {agents.length}+ specialized auditors covering
          security, performance, accessibility, SEO, and compliance.
        </p>
      </div>

      {/* Panel */}
      <CodeAuditPanel />
    </div>
  );
}
