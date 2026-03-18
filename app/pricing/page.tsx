import type { Metadata } from 'next';
import Link from 'next/link';
import { agents } from '@/lib/agents/registry';

export const metadata: Metadata = {
  title: 'Pricing',
  description: `Run ${agents.length} specialized code audits for free, or upgrade to Teams for shared dashboards, team management, and priority support.`,
  alternates: { canonical: '/pricing' },
  openGraph: {
    title: 'Pricing — Claudit',
    description: `Run ${agents.length} specialized code audits for free, or upgrade to Teams for shared dashboards and team management.`,
    url: '/pricing',
  },
};

const FREE_FEATURES = [
  `${agents.length} specialized audit agents`,
  'Code audit & live site audit',
  'Real-time streaming results',
  'Severity-rated findings with fix suggestions',
  'Export as Markdown or JSON',
  'Audit history & dashboard',
  'OWASP, WCAG, GDPR, SOC 2 coverage',
  'No usage limits during early access',
];

const TEAMS_FEATURES = [
  'Everything in Free, plus:',
  'Team workspaces with shared audit history',
  'Invite members & assign roles (owner, admin, member)',
  'Team dashboard with org-wide audit scores',
  'CI/CD integration (GitHub Actions, GitLab CI)',
  'Priority support',
  'SSO / SAML authentication',
  'Audit API access',
];

export default function PricingPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            Simple, transparent pricing
          </h1>
          <p className="text-lg text-gray-600 dark:text-zinc-400 max-w-2xl mx-auto">
            Start free and upgrade when your team needs shared dashboards and collaboration.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-3xl mx-auto mb-16">
          {/* Free tier */}
          <div className="relative bg-white dark:bg-zinc-900 border-2 border-violet-500 rounded-2xl p-6 shadow-sm">
            <span className="absolute -top-3 left-6 px-3 py-0.5 rounded-full text-xs font-semibold bg-violet-600 text-white">
              Current plan
            </span>
            <h2 className="text-xl font-bold mb-1">Free</h2>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold tracking-tight">$0</span>
              <span className="text-sm text-gray-500 dark:text-zinc-400">/ forever during early access</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
              Full access to every feature. No limits.
            </p>
            <Link
              href="/audit"
              className="flex items-center justify-center w-full px-6 py-3 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring shadow-sm shadow-violet-600/20"
            >
              Start Auditing
            </Link>
            <ul className="mt-6 space-y-3">
              {FREE_FEATURES.map((feature) => (
                <li key={feature} className="flex items-start gap-2 text-sm text-gray-700 dark:text-zinc-300">
                  <svg className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                  {feature}
                </li>
              ))}
            </ul>
          </div>

          {/* Teams tier */}
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-xl font-bold mb-1">Teams</h2>
            <div className="flex items-baseline gap-1 mb-1">
              <span className="text-4xl font-bold tracking-tight">$0</span>
              <span className="text-sm text-gray-500 dark:text-zinc-400">/ free during early access</span>
            </div>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
              For engineering teams who audit together.
            </p>
            <Link
              href="/settings/team"
              className="flex items-center justify-center w-full px-6 py-3 rounded-xl font-semibold text-base text-gray-900 dark:text-zinc-100 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors focus-ring"
            >
              Create a Team
            </Link>
            <ul className="mt-6 space-y-3">
              {TEAMS_FEATURES.map((feature, i) => (
                <li key={feature} className={`flex items-start gap-2 text-sm ${i === 0 ? 'text-gray-500 dark:text-zinc-400 font-medium' : 'text-gray-700 dark:text-zinc-300'}`}>
                  {i > 0 && (
                    <svg className="w-4 h-4 text-gray-400 dark:text-zinc-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {feature}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* FAQ-style section */}
        <div className="max-w-2xl mx-auto space-y-8 text-sm leading-relaxed text-gray-700 dark:text-zinc-300">
          <div className="text-center">
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-6">Frequently asked</h2>
          </div>

          <div className="space-y-6">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-zinc-100 mb-1">Will the free tier go away?</h3>
              <p>No. When we launch paid plans, the free tier will remain with generous limits. Early access users who sign up now will be grandfathered into any free-tier benefits.</p>
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
              <p>No. Run audits instantly without signing up. A free account lets you save history and track improvements over time.</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
