import type { Metadata } from 'next';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'How It Works',
  description: 'How Claudit works — AI-powered code audits with 50 specialized audits, real-time streaming results, and enterprise-grade security.',
  alternates: { canonical: '/how-it-works' },
  openGraph: {
    title: 'How It Works — Claudit',
    description: 'Paste code or enter a URL, choose from 50 AI audits, and get severity-rated findings in seconds.',
    url: '/how-it-works',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'How It Works — Claudit',
    description: 'Paste code or enter a URL, choose from 50 AI audits, and get severity-rated findings in seconds.',
  },
};

const CHECK = '✓';

export default function StackPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            How Claudit Works
          </h1>
          <p className="text-lg text-gray-600 dark:text-zinc-400 max-w-2xl">
            AI-powered code audits that give you actionable, severity-rated findings in seconds — not hours.
          </p>
        </div>

        {/* How it works */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Three Steps to Better Code</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StepCard
              step={1}
              title="Paste your code or enter a URL"
              description="Drop in source files, paste code snippets, or point us at any live website. Each audit includes a prep prompt to help you gather the right files."
            />
            <StepCard
              step={2}
              title="AI analyzes it"
              description="Your code is analyzed by specialized AI audits — each focused on a specific domain like security, accessibility, or performance. Results stream back in real-time."
            />
            <StepCard
              step={3}
              title="Get a structured report"
              description="Every audit produces severity-rated findings with specific line references, remediation steps, and a composite score. Export as Markdown or JSON."
            />
          </div>
        </section>

        {/* What you get */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">What You Get</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <FeatureCard
              title="50 Specialized Audits"
              description="Each audit is an expert in a specific domain — from OWASP security to React patterns, from GDPR compliance to bundle size optimization."
              items={[
                'Security & Privacy (OWASP, GDPR, HIPAA, PCI DSS, SOC 2)',
                'Code Quality (bugs, anti-patterns, architecture, testing)',
                'Performance (Core Web Vitals, caching, concurrency)',
                'Infrastructure (DevOps, CI/CD, cloud, observability)',
                'Design (UX, accessibility, responsive, i18n, dark mode)',
              ]}
            />
            <FeatureCard
              title="Real-Time Streaming"
              description="Results appear as the AI works — no waiting for a batch job to finish. Watch findings arrive live, or run a full site audit with multiple audits at once."
              items={[
                'Results stream in real-time as they are generated',
                'Full site audit runs multiple audits sequentially',
                'Stop anytime and keep partial results',
                'Copy or download complete reports as Markdown',
              ]}
            />
            <FeatureCard
              title="Severity-Rated Findings"
              description="Every finding is categorized by severity so you know what to fix first. No vague suggestions — each issue includes specific remediation steps."
              items={[
                'Critical, High, Medium, Low severity ratings',
                'Specific line references and code examples',
                'Step-by-step remediation instructions',
                'Composite score out of 100',
              ]}
            />
            <FeatureCard
              title="Dashboard & History"
              description="Track your audits over time. See scores improve as you fix issues. All audit results are saved to your account automatically."
              items={[
                'Personal dashboard with audit history',
                'Score trends across audits',
                'Click any audit to view the full report',
                'Download reports as Markdown',
              ]}
            />
          </div>
        </section>

        {/* Security & trust */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Security & Trust</h2>
          <p className="text-gray-600 dark:text-zinc-400 mb-6">
            We take security seriously — the same standards we audit your code against are the ones we hold ourselves to.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <TrustCard
              title="Your Code Stays Private"
              description="Code is sent directly to the AI for analysis and is not stored beyond the audit session. Audit results are saved to your account — your source code is not."
            />
            <TrustCard
              title="Encrypted in Transit"
              description="All data is transmitted over HTTPS with TLS 1.3. Strict Content Security Policy headers with per-request nonces prevent XSS attacks."
            />
            <TrustCard
              title="EU-Hosted Database"
              description="User data is stored in a PostgreSQL database hosted in the EU, with daily backups and encryption at rest."
            />
            <TrustCard
              title="Two-Factor Authentication"
              description="Protect your account with TOTP-based 2FA via any authenticator app. Backup recovery codes included."
            />
            <TrustCard
              title="Rate Limited"
              description="API endpoints are rate-limited per IP and globally capped daily to prevent abuse and ensure fair usage for everyone."
            />
            <TrustCard
              title="No Tracking, No Ads"
              description="No analytics trackers, no ad networks, no third-party scripts. The only external call is to the AI API for your audit."
            />
          </div>
        </section>

        {/* Powered by */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Built With</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <BuiltWithCard name="Claude by Anthropic" description="AI engine powering all 50 audits" />
            <BuiltWithCard name="Next.js 15" description="React framework with server-side rendering" />
            <BuiltWithCard name="PostgreSQL" description="Reliable, EU-hosted relational database" />
            <BuiltWithCard name="TypeScript" description="End-to-end type safety" />
            <BuiltWithCard name="Tailwind CSS" description="Responsive design with dark mode" />
            <BuiltWithCard name="2FA & OAuth" description="GitHub and Google sign-in, TOTP 2FA" />
          </div>
        </section>
      </div>
    </div>
  );
}

// ─── Components ─────────────────────────────────────────────────

function StepCard({ step, title, description }: { step: number; title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 relative">
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

function FeatureCard({ title, description, items }: { title: string; description: string; items: string[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
      <p className="text-base font-bold text-gray-900 dark:text-zinc-100 mb-2">{title}</p>
      <p className="text-sm text-gray-600 dark:text-zinc-400 mb-3">{description}</p>
      <ul className="space-y-1.5">
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

function TrustCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
      <p className="text-sm font-bold text-gray-900 dark:text-zinc-100 mb-1">{title}</p>
      <p className="text-sm text-gray-600 dark:text-zinc-400">{description}</p>
    </div>
  );
}

function BuiltWithCard({ name, description }: { name: string; description: string }) {
  return (
    <div className="bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-4 py-3">
      <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{name}</p>
      <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5">{description}</p>
    </div>
  );
}
