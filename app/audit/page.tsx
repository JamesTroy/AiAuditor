'use client';

import { useState, useEffect } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { agents } from '@/lib/agents/registry';

// Lazy-load panels so only the active one is bundled on first paint.
const CodeAuditPanel = dynamic(() => import('@/components/CodeAuditPanel'), {
  loading: () => <PanelSkeleton />,
});
const SiteAuditPanel = dynamic(() => import('@/components/SiteAuditPanel'), {
  loading: () => <PanelSkeleton />,
});

type Tab = 'code' | 'url';

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
            { step: '1', icon: '📋', title: 'Paste code or enter a URL', desc: 'Any language, any size. Auditors auto-select based on what you paste.' },
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
  const searchParams = useSearchParams();
  const initialTab = searchParams.get('tab') === 'url' ? 'url' : 'code';
  const [tab, setTab] = useState<Tab>(initialTab);
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

      {/* Tab toggle */}
      <div className="flex justify-center px-6 py-6">
        <div className="inline-flex items-center rounded-xl bg-gray-100 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 p-1" role="tablist" aria-label="Audit input method">
          <button
            role="tab"
            aria-selected={tab === 'code'}
            aria-controls="panel-code"
            onClick={() => setTab('code')}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'code'
                ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
              </svg>
              Paste Code
            </span>
          </button>
          <button
            role="tab"
            aria-selected={tab === 'url'}
            aria-controls="panel-url"
            onClick={() => setTab('url')}
            className={`px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${
              tab === 'url'
                ? 'bg-white dark:bg-zinc-800 text-gray-900 dark:text-zinc-100 shadow-sm'
                : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
            }`}
          >
            <span className="flex items-center gap-2">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 12c0 .778-.099 1.533-.284 2.253m0 0A17.919 17.919 0 0112 16.5c-3.162 0-6.133-.815-8.716-2.247m0 0A9.015 9.015 0 013 12c0-1.605.42-3.113 1.157-4.418" />
              </svg>
              Enter a URL
            </span>
          </button>
        </div>
      </div>

      {/* Panels — each panel provides its own px-6 and max-w-4xl wrapper */}
      <div id="panel-code" role="tabpanel" aria-labelledby="tab-code" hidden={tab !== 'code'}>
        {tab === 'code' && <CodeAuditPanel />}
      </div>
      <div id="panel-url" role="tabpanel" aria-labelledby="tab-url" hidden={tab !== 'url'}>
        {tab === 'url' && <SiteAuditPanel />}
      </div>
    </div>
  );
}
