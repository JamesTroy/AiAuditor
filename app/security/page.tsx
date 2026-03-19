import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Security & Responsible Disclosure',
  description: 'Claudit\'s responsible disclosure policy, security contact, and scope for vulnerability reports.',
  alternates: { canonical: '/security' },
  openGraph: {
    title: 'Security & Responsible Disclosure — Claudit',
    description: 'How to report a vulnerability, what\'s in scope, and what to expect from us.',
    url: '/security',
  },
};

export default function SecurityPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Security & Responsible Disclosure</h1>
        <p className="text-lg text-gray-600 dark:text-zinc-400 mb-10 max-w-2xl">
          We take security seriously. If you find a vulnerability, we want to hear from you — no bug bounty programme yet, but we acknowledge every valid report and fix issues promptly.
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-gray-700 dark:text-zinc-300">

          {/* How to report */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">How to report</h2>
            <p className="mb-3">
              Email{' '}
              <a href="mailto:security@claudit.consulting" className="text-violet-600 dark:text-violet-400 underline font-medium">
                security@claudit.consulting
              </a>{' '}
              with a description of the issue. Please include:
            </p>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>A description of the vulnerability and its potential impact</li>
              <li>Steps to reproduce, or a proof-of-concept (URL, screenshot, or request/response)</li>
              <li>The URL or component affected</li>
              <li>Your name or handle if you&apos;d like credit (optional)</li>
            </ul>
            <p className="mt-3">
              You can also use{' '}
              <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono">/.well-known/security.txt</code>
              {' '}to find our contact details programmatically.
            </p>
          </section>

          {/* Response process */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">What to expect</h2>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
              {[
                { step: '1', label: 'Acknowledgement', timeline: 'Within 2 business days', detail: 'We confirm receipt of your report and assign a tracking ID.' },
                { step: '2', label: 'Triage', timeline: 'Within 5 business days', detail: 'We assess severity, reproduce the issue, and determine impact scope.' },
                { step: '3', label: 'Fix & verification', timeline: 'Depends on severity', detail: 'Critical issues target a patch within 7 days. High within 30 days. We\'ll keep you updated.' },
                { step: '4', label: 'Disclosure', timeline: 'Coordinated with you', detail: 'We coordinate public disclosure timing with you. We don\'t disclose without your knowledge.' },
              ].map(({ step, label, timeline, detail }) => (
                <div key={step} className="flex gap-4 px-5 py-4 bg-white dark:bg-zinc-900/80">
                  <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{step}</span>
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">{label}</p>
                      <span className="text-xs text-gray-400 dark:text-zinc-500">{timeline}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Scope */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">Scope</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
                <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">In scope</p>
                <ul className="space-y-1.5 text-sm text-gray-700 dark:text-zinc-300">
                  <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>claudit.consulting and all subdomains</li>
                  <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>Authentication and session handling</li>
                  <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>API endpoints and rate limiting</li>
                  <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>Prompt injection and LLM output manipulation</li>
                  <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>XSS, CSRF, and injection vulnerabilities</li>
                  <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>Insecure direct object references (IDOR)</li>
                  <li className="flex gap-2"><span className="text-emerald-500 shrink-0">✓</span>Data exposure or privacy leaks</li>
                </ul>
              </div>
              <div className="p-4 rounded-xl bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800">
                <p className="text-xs font-bold uppercase tracking-widest text-gray-500 dark:text-zinc-400 mb-3">Out of scope</p>
                <ul className="space-y-1.5 text-sm text-gray-700 dark:text-zinc-300">
                  <li className="flex gap-2"><span className="text-gray-400 shrink-0">–</span>Denial of service attacks</li>
                  <li className="flex gap-2"><span className="text-gray-400 shrink-0">–</span>Social engineering of Claudit staff</li>
                  <li className="flex gap-2"><span className="text-gray-400 shrink-0">–</span>Physical security</li>
                  <li className="flex gap-2"><span className="text-gray-400 shrink-0">–</span>Vulnerabilities in third-party services (Anthropic, Supabase, Railway) — report those to them directly</li>
                  <li className="flex gap-2"><span className="text-gray-400 shrink-0">–</span>Issues requiring unlikely user interaction or social engineering</li>
                </ul>
              </div>
            </div>
          </section>

          {/* Rules of engagement */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">Rules of engagement</h2>
            <ul className="list-disc pl-5 space-y-1.5">
              <li>Only test against accounts you own or have explicit permission to test.</li>
              <li>Do not access, modify, or delete data belonging to other users.</li>
              <li>Do not perform automated scanning at a rate that degrades service for other users.</li>
              <li>Give us reasonable time to fix before public disclosure.</li>
            </ul>
            <p className="mt-3">
              Researchers who follow these guidelines will not face legal action from us for their security research.
            </p>
          </section>

          {/* Bug bounty */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">Bug bounty</h2>
            <p>
              We don&apos;t currently run a formal paid bug bounty programme. We do publicly acknowledge researchers (with permission) in our{' '}
              <Link href="/trust" className="text-violet-600 dark:text-violet-400 underline">Trust & Security page</Link>
              {' '}and aim to add a formal programme once we reach sufficient scale. A formal programme is planned — check back.
            </p>
          </section>

          {/* Contact */}
          <div className="bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
            <p className="font-semibold text-gray-900 dark:text-zinc-100 mb-1">Security contact</p>
            <p>
              <a href="mailto:security@claudit.consulting" className="text-violet-600 dark:text-violet-400 underline">
                security@claudit.consulting
              </a>
              {' '}— PGP key available on request.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
