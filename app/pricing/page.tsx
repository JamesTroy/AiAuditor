import type { Metadata } from 'next';
import Link from 'next/link';
import { agents } from '@/lib/agents/registry';

export const metadata: Metadata = {
  title: 'Pricing',
  description: `Run ${agents.length} specialized code audits free during early access. No tiers, no upgrades, no credit card.`,
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — Claudit',
    description: `${agents.length} specialized code audits, free during early access. No tiers, no credit card.`,
    url: '/pricing',
  },
};

const FEATURES = [
  `All ${agents.length} specialized audit agents`,
  'Code audit and live site audit',
  'Real-time streaming results',
  'Severity-rated findings with fix guidance',
  'Audit history and dashboard',
  'Team workspaces with shared audit history',
  'GitHub PR review integration',
  'Export as Markdown or JSON',
  'OWASP, WCAG, GDPR, SOC 2 coverage',
];

export default function PricingPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Free during early access
          </h1>
          <p className="text-lg text-gray-600 dark:text-zinc-400 max-w-xl mx-auto">
            Every feature, every agent, every audit — free for everyone while we&apos;re in early access.
            No credit card, no limits, no catch.
          </p>
        </div>

        <div className="max-w-md mx-auto mb-16">
          <div className="relative bg-white dark:bg-zinc-900 border-2 border-violet-500 rounded-2xl p-8 shadow-sm">
            <span className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-0.5 rounded-full text-xs font-semibold bg-violet-600 text-white whitespace-nowrap">
              Early access
            </span>
            <div className="text-center mb-6">
              <div className="flex items-baseline justify-center gap-1">
                <span className="text-5xl font-bold tracking-tight">$0</span>
              </div>
              <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
                Free for everyone, no account required to try
              </p>
            </div>
            <Link
              href="/audit"
              className="flex items-center justify-center w-full px-6 py-3 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring shadow-sm shadow-violet-600/20 mb-6"
            >
              Start auditing →
            </Link>
            <ul className="space-y-3">
              {FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-700 dark:text-zinc-300">
                  <svg className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="max-w-2xl mx-auto space-y-8 text-sm leading-relaxed text-gray-700 dark:text-zinc-300">
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-6">Frequently asked</h2>
          </div>
          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-zinc-100 mb-1">Is everything really free?</h3>
              <p>Yes. Every agent, every audit, every team feature — free while in early access. When we launch paid plans later, early access users will be grandfathered into any free-tier benefits.</p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-zinc-100 mb-1">What happens to my data?</h3>
              <p>
                Your code is analyzed in memory and immediately discarded — never stored, never used for training, never shared.
                Read our{' '}
                <Link href="/privacy" className="text-violet-600 dark:text-violet-400 underline">Privacy Policy</Link> for details.
              </p>
            </div>
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-zinc-100 mb-1">Do I need an account?</h3>
              <p>No. Run audits instantly without signing up. A free account lets you save history, track improvements over time, and use team features.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
