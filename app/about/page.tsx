import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'About',
  description: 'About Claudit — automated code auditing for security, performance, and compliance.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About — Claudit',
    description: 'About Claudit — automated code auditing for security, performance, and compliance.',
    url: '/about',
  },
};

export default function AboutPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-3">About Claudit</h1>
        <p className="text-lg text-gray-600 dark:text-zinc-400 mb-10 max-w-2xl">
          Automated code auditing that finds security vulnerabilities, performance issues, and compliance gaps — so you can ship with confidence.
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-gray-700 dark:text-zinc-300">
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">What we do</h2>
            <p>
              Claudit runs your code through 50+ specialized audits — checking for injection flaws,
              auth bugs, accessibility violations, slow queries, compliance gaps, and hundreds of other
              patterns that manual code review often misses. Each audit produces a structured report with
              severity ratings, exact file/line references, and copy-paste fixes.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">How it works</h2>
            <div className="space-y-2">
              <p>
                Paste your code or enter a URL. Pick which audits to run — security, performance,
                accessibility, or all of them. Results stream back in real-time as findings are
                identified. No waiting for batch jobs, no manual setup.
              </p>
              <p>
                Every report includes a composite score out of 100, so you can measure improvement
                over time. All results are saved to your dashboard for reference and export.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">Privacy first</h2>
            <p>
              Your code is analyzed and discarded — it is not stored on our servers beyond the
              truncated snippet saved with your audit record. We use no advertising and no
              third-party tracking scripts. Read our full{' '}
              <Link href="/privacy" className="text-violet-600 dark:text-violet-400 underline">
                Privacy Policy
              </Link>{' '}
              for details.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">Security &amp; trust</h2>
            <ul className="space-y-2">
              <li><strong className="text-gray-900 dark:text-zinc-100">Your code stays private.</strong> Code is sent directly for analysis and is not stored beyond the audit session.</li>
              <li><strong className="text-gray-900 dark:text-zinc-100">Encrypted in transit.</strong> All data over HTTPS with TLS 1.3. Per-request CSP nonces prevent XSS.</li>
              <li><strong className="text-gray-900 dark:text-zinc-100">Two-factor authentication.</strong> TOTP-based 2FA via any authenticator app, with backup codes.</li>
              <li><strong className="text-gray-900 dark:text-zinc-100">Rate limited.</strong> All endpoints are rate-limited per IP and per user to prevent abuse.</li>
              <li><strong className="text-gray-900 dark:text-zinc-100">No tracking, no ads.</strong> No analytics trackers or third-party scripts.</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">Contact</h2>
            <div className="bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="space-y-2">
                <p>
                  <strong className="text-gray-900 dark:text-zinc-100">General inquiries:</strong>{' '}
                  <a href="mailto:support@claudit.consulting" className="text-violet-600 dark:text-violet-400 underline">
                    support@claudit.consulting
                  </a>
                </p>
                <p>
                  <strong className="text-gray-900 dark:text-zinc-100">Privacy:</strong>{' '}
                  <a href="mailto:privacy@claudit.consulting" className="text-violet-600 dark:text-violet-400 underline">
                    privacy@claudit.consulting
                  </a>
                </p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
