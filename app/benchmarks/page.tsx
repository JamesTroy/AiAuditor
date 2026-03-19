import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Benchmarks & Evaluation',
  description: 'How to evaluate Claudit\'s accuracy. We don\'t have published benchmarks yet — here\'s our methodology and how you can test us yourself.',
  alternates: { canonical: '/benchmarks' },
  openGraph: {
    title: 'Benchmarks & Evaluation — Claudit',
    description: 'How to evaluate Claudit\'s accuracy, our evaluation methodology, and how to run your own tests.',
    url: '/benchmarks',
  },
};

export default function BenchmarksPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-3">Benchmarks & Evaluation</h1>
        <p className="text-lg text-gray-600 dark:text-zinc-400 mb-4 max-w-2xl">
          We don&apos;t have published benchmarks yet. Here&apos;s why, what honest benchmarks would look like, and how to evaluate Claudit on your own code right now.
        </p>
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border border-amber-200 dark:border-amber-800 mb-10">
          <span className="w-1.5 h-1.5 rounded-full bg-amber-500" aria-hidden="true" />
          Benchmarks in progress — this page will be updated when results are available
        </div>

        <div className="space-y-10 text-sm leading-relaxed text-gray-700 dark:text-zinc-300">

          {/* Why no benchmarks yet */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">Why we don&apos;t have published benchmarks yet</h2>
            <p className="mb-3">
              Publishing a number without context is worse than publishing nothing. Here&apos;s what honest benchmarking for a code auditing tool requires — and why it takes time to do right:
            </p>
            <ul className="list-disc pl-5 space-y-2">
              <li><strong>Ground truth is hard.</strong> To measure precision and recall, you need a labelled dataset of real codebases with known vulnerabilities — not synthetic examples. Synthetic benchmarks (like many LLM coding evals) don&apos;t predict real-world performance.</li>
              <li><strong>Domain specificity matters.</strong> A headline accuracy number across all 125+ auditors is misleading. Security accuracy, accessibility accuracy, and SEO accuracy are different measurements with different baselines.</li>
              <li><strong>False positive rate matters as much as detection rate.</strong> A tool that flags everything has a high detection rate and zero usefulness. We need to measure both.</li>
              <li><strong>Models change.</strong> Any benchmark taken today is a snapshot. We need a repeatable evaluation harness, not a one-time number.</li>
            </ul>
          </section>

          {/* What we're building */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">What we&apos;re building</h2>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
              {[
                {
                  title: 'Labelled vulnerability dataset',
                  detail: 'A set of real-world code samples with known issues — drawn from public CVE-referenced commits, deliberately introduced vulnerabilities, and manually reviewed codebases. Each sample is labelled with finding type, severity, and file/line location.',
                  status: 'In progress',
                },
                {
                  title: 'Per-auditor precision / recall metrics',
                  detail: 'Separate metrics for each domain: Security, Accessibility (WCAG), Performance, SEO. Reported with confidence intervals, not just point estimates.',
                  status: 'Planned',
                },
                {
                  title: 'False positive rate',
                  detail: 'Measured against known-clean code. The ratio of flagged issues that are not real problems — arguably the most important metric for developer trust.',
                  status: 'Planned',
                },
                {
                  title: 'Reproducible harness',
                  detail: 'An evaluation script runnable against any Claude model version so we can track performance as the underlying model changes.',
                  status: 'Planned',
                },
              ].map(({ title, detail, status }) => (
                <div key={title} className="flex items-start gap-4 px-5 py-4 bg-white dark:bg-zinc-900/80">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm">{title}</p>
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium border ${
                        status === 'In progress'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 border-amber-200 dark:border-amber-800'
                          : 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 border-blue-200 dark:border-blue-800'
                      }`}>{status}</span>
                    </div>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* How to evaluate yourself */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">How to evaluate Claudit on your own code</h2>
            <p className="mb-4">
              The most meaningful benchmark is performance on <em>your</em> codebase. Here&apos;s a structured approach:
            </p>
            <div className="space-y-4">
              {[
                {
                  step: '1',
                  title: 'Pick a codebase you know well',
                  detail: 'Use a project where you already know about existing issues — bugs you\'ve fixed, security issues that came up in a previous review, or WCAG failures you\'ve already confirmed.',
                },
                {
                  step: '2',
                  title: 'Run the relevant auditors',
                  detail: 'Use the Quick Scan preset for broad coverage, or target specific auditors (Security, Accessibility, Performance) against the relevant code. Paste the files most likely to contain issues.',
                },
                {
                  step: '3',
                  title: 'Score detection vs. false positives',
                  detail: 'Count: (a) known issues that were correctly flagged, (b) known issues that were missed, (c) findings that were wrong or inapplicable. That gives you precision and recall for your specific context.',
                },
                {
                  step: '4',
                  title: 'Try a known-vulnerable sample',
                  detail: 'Paste intentionally vulnerable code — SQL injection, missing alt text, render-blocking resources — and verify the auditor catches it with the correct severity and location.',
                },
              ].map(({ step, title, detail }) => (
                <div key={step} className="flex gap-4 p-4 rounded-xl bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800">
                  <span className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-900/40 text-violet-600 dark:text-violet-400 text-xs font-bold flex items-center justify-center shrink-0 mt-0.5">{step}</span>
                  <div>
                    <p className="font-semibold text-gray-900 dark:text-zinc-100 text-sm mb-1">{title}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">{detail}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* Known limitations */}
          <section>
            <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">Known limitations that affect accuracy</h2>
            <ul className="list-disc pl-5 space-y-2">
              <li>
                <strong>Runtime behavior.</strong> Race conditions, production load issues, and environment-specific failures can&apos;t be inferred from static code alone.
                You can narrow this gap by pasting a stack trace or error log into the <strong>runtime context</strong> field — auditors will factor confirmed failures into their findings rather than flagging theoretical risks.
              </li>
              <li>
                <strong>Deep business context.</strong> Auditors don&apos;t know your domain rules, compliance obligations, or internal conventions unless you tell them.
                Use the <strong>workspace context</strong> field in Settings to describe your stack, standards (OWASP, GDPR, HIPAA), and conventions — it&apos;s injected into every audit automatically.
              </li>
              <li>
                <strong>Input size.</strong> Auditors process up to 120,000 characters per submission. For large files, a structural skeleton (function and class signatures) is extracted first so auditors can navigate the full shape of the code — but very large monorepos still require splitting by module or layer.
              </li>
              <li><strong>Confidence tiers.</strong> Findings are tagged CERTAIN, LIKELY, or POSSIBLE. POSSIBLE findings have a higher false positive rate by design — they surface candidates for human review, not confirmed bugs.</li>
              <li><strong>Model variability.</strong> Like all LLM-based tools, output can vary between runs on identical input. Critical findings are generally stable; edge cases may not be.</li>
            </ul>
            <p className="mt-3">
              See our{' '}
              <Link href="/#faq" className="text-violet-600 dark:text-violet-400 underline">FAQ</Link>
              {' '}for a full breakdown of where Claudit works well and where it doesn&apos;t.
            </p>
          </section>

          {/* CTA */}
          <div className="bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-800 rounded-xl p-5">
            <p className="font-semibold text-gray-900 dark:text-zinc-100 mb-2">Run your own evaluation now</p>
            <p className="mb-4 text-gray-600 dark:text-zinc-400">
              No account required. Paste code you know has issues and see what Claudit finds.
            </p>
            <Link
              href="/audit"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold text-white bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 transition-all shadow-sm"
            >
              Run a free audit
            </Link>
          </div>

        </div>
      </div>
    </div>
  );
}
