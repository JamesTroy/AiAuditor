import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'About',
  description: 'About Claudit — AI-powered code auditing for developers and teams.',
  alternates: { canonical: '/about' },
  openGraph: {
    title: 'About — Claudit',
    description: 'About Claudit — AI-powered code auditing for developers and teams.',
    url: '/about',
  },
};

export default function AboutPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-3">About Claudit</h1>
        <p className="text-lg text-gray-600 dark:text-zinc-400 mb-10 max-w-2xl">
          AI-powered code auditing that gives developers actionable feedback in seconds, not days.
        </p>

        <div className="space-y-10 text-sm leading-relaxed text-gray-700 dark:text-zinc-300">
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">What we do</h2>
            <p>
              Claudit analyzes your code and websites across 50+ specialized audit categories — from
              security vulnerabilities and accessibility compliance to performance optimization and
              code quality. Each audit produces a structured report with severity-rated findings,
              specific line references, and step-by-step remediation guidance.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">How it works</h2>
            <div className="space-y-2">
              <p>
                Paste your code, upload files, or enter a URL. Choose one or more audit types, and
                our AI analyzes your submission in real-time. Results stream back as they are generated —
                no waiting for batch jobs to finish.
              </p>
              <p>
                Every audit result includes a composite score out of 100, making it easy to track
                improvement over time. All results are saved to your personal dashboard for reference.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">Privacy first</h2>
            <p>
              Your code is sent directly to our AI provider for analysis and is not stored on our
              servers beyond the truncated snippet saved with your audit record. We use no analytics
              trackers, no advertising, and no third-party scripts. Read our full{' '}
              <Link href="/privacy" className="text-violet-600 dark:text-violet-400 underline">
                Privacy Policy
              </Link>{' '}
              for details.
            </p>
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
