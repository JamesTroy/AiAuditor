import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Trust & Security',
  description: 'Security posture, data handling, certifications, and compliance status for Claudit. No sales call required.',
  alternates: { canonical: '/trust' },
  openGraph: {
    title: 'Trust & Security — Claudit',
    description: 'Security posture, data handling, certifications, and compliance status for Claudit.',
    url: '/trust',
  },
};

type StatusLevel = 'live' | 'in-progress' | 'planned' | 'na';

function StatusBadge({ status }: { status: StatusLevel }) {
  const styles: Record<StatusLevel, string> = {
    live:        'bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 border-emerald-200 dark:border-emerald-800',
    'in-progress': 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800',
    planned:     'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800',
    na:          'bg-gray-100 dark:bg-zinc-800 text-gray-500 dark:text-zinc-400 border-gray-200 dark:border-zinc-700',
  };
  const labels: Record<StatusLevel, string> = {
    live:        'Live',
    'in-progress': 'In Progress',
    planned:     'Planned',
    na:          'N/A',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold border ${styles[status]}`}>
      {status === 'live' && <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1.5" aria-hidden="true" />}
      {labels[status]}
    </span>
  );
}

const CERTIFICATIONS = [
  { name: 'SOC 2 Type 2', status: 'in-progress' as StatusLevel, note: 'Audit in preparation — target Q4 2026' },
  { name: 'GDPR compliance', status: 'live' as StatusLevel, note: 'EU data protection obligations met; DPA available on request' },
  { name: 'CCPA compliance', status: 'live' as StatusLevel, note: 'California Consumer Privacy Act requirements met' },
  { name: 'Penetration test', status: 'planned' as StatusLevel, note: 'External pentest scheduled; results summary will be published here' },
  { name: 'Bug bounty programme', status: 'planned' as StatusLevel, note: 'Responsible disclosure active at /security; formal bounty programme planned' },
  { name: 'ISO 42001 (AI management)', status: 'planned' as StatusLevel, note: 'Under evaluation for 2026' },
];

const SECURITY_CONTROLS = [
  { label: 'Encryption in transit', detail: 'TLS 1.3 on all connections. HSTS enforced with 2-year max-age.' },
  { label: 'Encryption at rest', detail: 'Database encrypted at rest with daily automated backups.' },
  { label: 'Content Security Policy', detail: 'Per-request CSP nonces eliminate unsafe-inline. strict-dynamic propagates trust.' },
  { label: 'Authentication', detail: 'Passwords hashed with bcrypt. TOTP-based 2FA available for all accounts.' },
  { label: 'Session management', detail: 'HttpOnly, Secure, SameSite=Lax session cookies. 30-day idle expiry.' },
  { label: 'Rate limiting', detail: 'Per-IP and per-user rate limits on all API endpoints. Audit endpoints have additional token-budget limits.' },
  { label: 'Input isolation', detail: 'User-submitted code is wrapped in XML delimiters and trust-boundary instructions before LLM processing. Prompt injection is treated as a security boundary.' },
  { label: 'Dependency scanning', detail: 'Automated CVE scanning on every build. Critical vulnerabilities block deploys.' },
  { label: 'IP anonymisation', detail: 'IP addresses are anonymised before logging. Raw IPs are never persisted.' },
  { label: 'No third-party tracking', detail: 'No analytics trackers, ad pixels, or third-party scripts loaded on any page.' },
];

export default function TrustPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <div className="mb-2">
          <span className="text-xs font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400">No sales call required</span>
        </div>
        <h1 className="text-3xl font-bold tracking-tight mb-3">Trust & Security</h1>
        <p className="text-lg text-gray-600 dark:text-zinc-400 mb-10 max-w-2xl">
          Everything you need to evaluate Claudit&apos;s security posture and data handling — all public, no NDA, no demo request.
        </p>

        <div className="space-y-12 text-sm leading-relaxed text-gray-700 dark:text-zinc-300">

          {/* Data handling */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-4">How your code is handled</h2>
            <div className="p-5 rounded-2xl bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 space-y-3">
              {[
                { label: 'Storage', value: 'Your submitted code is not stored on our servers. Only the audit report output is saved to your account history.' },
                { label: 'Training', value: 'Neither Claudit nor Anthropic trains on your submitted code. Anthropic\'s API terms explicitly prohibit use of API inputs for model training.' },
                { label: 'Third-party access', value: 'Your code is sent only to Anthropic\'s Claude API for analysis. No other third party receives it.' },
                { label: 'Retention', value: 'Audit reports are retained until you delete them. Account deletion removes all data within 30 days.' },
                { label: 'Verification', value: null },
              ].map(({ label, value }) =>
                label === 'Verification' ? (
                  <div key={label} className="flex gap-3 pt-1">
                    <span className="font-semibold text-gray-900 dark:text-zinc-100 w-32 shrink-0">{label}</span>
                    <span>
                      See{' '}
                      <a href="https://www.anthropic.com/legal/privacy" className="text-violet-600 dark:text-violet-400 underline" target="_blank" rel="noopener noreferrer">Anthropic&apos;s privacy policy</a>
                      {' '}and{' '}
                      <a href="https://www.anthropic.com/model-card" className="text-violet-600 dark:text-violet-400 underline" target="_blank" rel="noopener noreferrer">model card</a>
                      {' '}for upstream commitments. Read our full{' '}
                      <Link href="/privacy" className="text-violet-600 dark:text-violet-400 underline">Privacy Policy</Link>
                      {' '}for Claudit-specific details.
                    </span>
                  </div>
                ) : (
                  <div key={label} className="flex gap-3">
                    <span className="font-semibold text-gray-900 dark:text-zinc-100 w-32 shrink-0">{label}</span>
                    <span>{value}</span>
                  </div>
                )
              )}
            </div>
          </section>

          {/* Certifications */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-1">Certifications & compliance</h2>
            <p className="text-sm text-gray-500 dark:text-zinc-400 mb-4">Honest statuses — not marketing claims.</p>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
              {CERTIFICATIONS.map(({ name, status, note }) => (
                <div key={name} className="flex items-start justify-between gap-4 px-5 py-4 bg-white dark:bg-zinc-900/80">
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">{name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5">{note}</p>
                  </div>
                  <StatusBadge status={status} />
                </div>
              ))}
            </div>
          </section>

          {/* Security controls */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-4">Security controls</h2>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
              {SECURITY_CONTROLS.map(({ label, detail }) => (
                <div key={label} className="flex items-start gap-4 px-5 py-4 bg-white dark:bg-zinc-900/80">
                  <svg className="w-4 h-4 text-emerald-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5} aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">{label}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 mt-0.5 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Infrastructure */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-4">Infrastructure</h2>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {[
                { label: 'Application hosting', value: 'Railway (United States)' },
                { label: 'Database', value: 'Supabase — EU (Frankfurt, Germany)' },
                { label: 'LLM provider', value: 'Anthropic Claude API (United States)' },
              ].map(({ label, value }) => (
                <div key={label} className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800">
                  <p className="text-xs font-semibold text-gray-500 dark:text-zinc-400 uppercase tracking-wider mb-1">{label}</p>
                  <p className="text-sm font-medium text-gray-900 dark:text-zinc-100">{value}</p>
                </div>
              ))}
            </div>
            <p className="text-xs text-gray-500 dark:text-zinc-400 mt-3">
              US-based processors operate under EU Standard Contractual Clauses (SCCs) for GDPR compliance.
            </p>
          </section>

          {/* Responsible disclosure */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">Responsible disclosure</h2>
            <p>
              Found a vulnerability? See our{' '}
              <Link href="/security" className="text-violet-600 dark:text-violet-400 underline">Security & Disclosure Policy</Link>
              {' '}for scope, response timelines, and how to report. We respond to all valid reports within 5 business days.
            </p>
          </section>

          {/* Contact */}
          <div className="bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
            <p className="font-semibold text-gray-900 dark:text-zinc-100 mb-1">Questions about security or compliance?</p>
            <p>
              Contact{' '}
              <a href="mailto:security@claudit.consulting" className="text-violet-600 dark:text-violet-400 underline">
                security@claudit.consulting
              </a>
              {' '}— no sales call, no NDA required to ask questions.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
