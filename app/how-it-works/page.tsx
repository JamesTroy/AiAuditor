import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'How Claudit works — specialized code audits with real-time streaming results and severity-rated findings.',
  alternates: { canonical: '/how-it-works' },
  openGraph: {
    title: 'How It Works — Claudit',
    description: 'Paste code or enter a URL, choose your audits, and get severity-rated findings in real time.',
    url: '/how-it-works',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How It Works — Claudit',
    description: 'Paste code or enter a URL, choose your audits, and get severity-rated findings in real time.',
  },
};

const CHECK = '✓';

export default function HowItWorksPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            From URL to full audit in under a minute
          </h1>
          <p className="text-lg text-gray-600 dark:text-zinc-400 max-w-2xl">
            Here&apos;s how it works — three steps, no setup, no credit card.
          </p>
        </div>

        {/* Steps */}
        <section className="mb-12">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StepCard
              step={1}
              title="Paste code or enter a URL"
              description="Drop in source files, paste code snippets, or point us at a live website. Each audit includes a prep prompt to help you gather the right files."
            />
            <StepCard
              step={2}
              title="Pick your audits"
              description="Choose from specialized audits — each focused on a specific domain like security, accessibility, or performance. Results stream back in real time."
            />
            <StepCard
              step={3}
              title="Get a structured report"
              description="Every audit produces severity-rated findings with line references, remediation steps, and a composite score. Export as Markdown."
            />
          </div>
        </section>

        {/* What you get */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">What You Get</h2>
          <div className="space-y-4">
            <FeatureRow
              title="Severity-rated findings"
              items={[
                'Critical, High, Medium, Low severity ratings',
                'Specific line references and code examples',
                'Step-by-step remediation instructions',
                'Composite score out of 100',
              ]}
            />
            <FeatureRow
              title="Real-time streaming"
              items={[
                'Results appear as findings are identified',
                'Site audit runs multiple audits sequentially',
                'Stop anytime and keep partial results',
                'Copy or download reports as Markdown',
              ]}
            />
            <FeatureRow
              title="Dashboard & history"
              items={[
                'Personal dashboard with all past audits',
                'Score trends across runs',
                'Click any audit to view the full report',
              ]}
            />
          </div>
        </section>

        {/* CTA */}
        <div className="text-center">
          <Link
            href="/site-audit"
            className="inline-block px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring"
          >
            Run your first audit
          </Link>
        </div>
      </div>
    </div>
  );
}

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 relative hover:shadow-md hover:border-violet-500/20 transition-all motion-safe:animate-fade-up" style={{ animationDelay: `${(step - 1) * 100}ms`, animationFillMode: 'both' }}>
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-full bg-violet-600 text-white text-sm font-bold flex items-center justify-center shrink-0">
          {step}
        </div>
        <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">{title}</p>
      </div>
      <p className="text-sm text-gray-600 dark:text-zinc-400">{description}</p>
    </div>
  );
}

function FeatureRow({ title, items }: { title: string; items: string[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 hover:shadow-md hover:border-violet-500/20 transition-all">
      <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-2">{title}</p>
      <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1.5">
        {items.map((item) => (
          <li key={item} className="text-sm text-gray-600 dark:text-zinc-400 flex items-start gap-2">
            <span className="text-green-500 dark:text-green-400 mt-0.5 shrink-0">{CHECK}</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}
