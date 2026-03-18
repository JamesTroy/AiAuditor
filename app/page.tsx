import Link from 'next/link';
import { agents } from '@/lib/agents/registry';
import HomeSearch from '@/components/HomeSearch';
import { JsonLd } from '@/components/JsonLd';

const FEATURED_IDS = [
  'security',
  'code-quality',
  'performance',
  'accessibility',
  'architecture',
  'privacy',
];

const CATEGORIES = [
  { name: 'Security & Privacy', color: 'bg-red-500', icon: '🛡', description: 'Injection flaws, auth bugs, exposed secrets' },
  { name: 'Code Quality', color: 'bg-blue-500', icon: '✨', description: 'Anti-patterns, dead code, architecture issues' },
  { name: 'Performance', color: 'bg-amber-500', icon: '⚡', description: 'Slow queries, render-blocking, bloated bundles' },
  { name: 'Infrastructure', color: 'bg-cyan-500', icon: '🏗', description: 'CI/CD, containers, database, observability' },
  { name: 'Design', color: 'bg-violet-500', icon: '🎨', description: 'Accessibility, responsive, i18n, dark mode' },
  { name: 'SEO', color: 'bg-emerald-500', icon: '🔍', description: 'Rankings, keywords, technical SEO' },
  { name: 'Marketing', color: 'bg-pink-500', icon: '📣', description: 'For developer-founders: positioning, CTAs, conversion optimization' },
];

// Count agents per category
const categoryCounts: Record<string, number> = {};
for (const a of agents) {
  categoryCounts[a.category] = (categoryCounts[a.category] ?? 0) + 1;
}

const featuredAgents = FEATURED_IDS.map((id) => agents.find((a) => a.id === id)!).filter(Boolean);

const FAQ_ITEMS = [
  {
    q: 'What happens to my code?',
    a: 'Your code is analyzed in memory and immediately discarded — it is never stored on our servers, never used for model training, and never shared with third parties. We use no advertising and no third-party tracking scripts.',
  },
  {
    q: 'How is Claudit different from SonarQube, Snyk, or a linter?',
    a: `Traditional tools cover one domain — SonarQube for code quality, Snyk for dependency security, axe for accessibility. Claudit runs ${agents.length}+ specialized auditors across security, performance, accessibility, SEO, infrastructure, design, and marketing in a single pass. One tool instead of five.`,
  },
  {
    q: 'Why is Claudit free?',
    a: 'Claudit is free during early access. We plan to offer a paid tier for teams with features like CI/CD integration, team dashboards, and custom audit agents. Your code is never monetized.',
  },
  {
    q: 'What languages and frameworks does it support?',
    a: 'Claudit analyzes any web-facing codebase — JavaScript, TypeScript, Python, Go, Ruby, PHP, and more. For site audits, enter any public URL and we fetch and analyze the page directly.',
  },
  {
    q: 'What does a finding look like?',
    a: 'Every finding includes a severity rating (Critical, High, Medium, Low), the exact file and line number, an explanation of the issue, and a copy-paste fix suggestion.',
  },
  {
    q: 'How long does an audit take?',
    a: `All ${agents.length}+ auditors run in parallel — most audits finish in under 60 seconds. Results stream in real time so you can start reading findings before the full audit completes.`,
  },
  {
    q: 'Do I need to create an account?',
    a: 'No. You can run audits immediately without signing up. Creating a free account lets you save audit history and track improvements over time.',
  },
  {
    q: 'Can I run Claudit on private repositories?',
    a: 'Yes. For code audits, paste your code directly — nothing is sent to third parties. For site audits, enter any URL accessible from the public internet.',
  },
];

export default function Home() {
  const faqSchema = {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    mainEntity: FAQ_ITEMS.map((item) => ({
      '@type': 'Question',
      name: item.q,
      acceptedAnswer: { '@type': 'Answer', text: item.a },
    })),
  };

  return (
    <div className="text-gray-900 dark:text-zinc-100 overflow-x-clip">
      <JsonLd data={faqSchema} />
      {/* ─── Hero ─── */}
      <section className="relative px-4 sm:px-6 pt-16 pb-20 sm:pt-20 sm:pb-28">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[min(288px,80vw)] h-72 bg-violet-500/20 blur-3xl rounded-full -z-10 motion-safe:animate-pulse-slow motion-safe:will-change-[opacity]" />
        <div className="absolute top-10 left-1/3 w-[min(384px,90vw)] h-[min(256px,40vh)] bg-indigo-500/15 blur-3xl rounded-full -z-10 motion-safe:animate-pulse-slow motion-safe:will-change-[opacity] [animation-delay:3s]" />
        <div className="absolute inset-0 bg-grid-pattern -z-10 opacity-50" />

        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-2 mb-6">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/25">
              Early Access — Free
            </span>
          </div>

          <h1 className="text-[clamp(1.75rem,4vw+0.5rem,3.5rem)] font-bold tracking-tight text-gray-900 dark:text-gradient max-w-3xl mx-auto mb-4 leading-[1.1]">
            Find what your code review missed — in under 60 seconds
          </h1>

          <p className="text-gray-600 dark:text-zinc-300 text-base sm:text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
            Stop juggling SonarQube, Snyk, axe, and Lighthouse. Claudit runs {agents.length} specialized auditors in parallel — covering security, performance, accessibility, SEO, and compliance in a single pass.
          </p>

          {/* Primary CTA */}
          <div className="flex flex-col items-center gap-3 mb-4">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Link
                href="/code-audit"
                className="px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 active:scale-[0.98] active:bg-violet-700 transition-colors focus-ring whitespace-nowrap shadow-lg shadow-violet-600/20"
              >
                Audit Your Code Free
              </Link>
              <Link
                href="/site-audit"
                className="px-8 py-3.5 rounded-xl font-semibold text-base text-gray-700 dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-[0.98] transition-colors focus-ring whitespace-nowrap"
              >
                Audit a Live Site
              </Link>
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              No account required — paste code or enter a URL and get results streaming in real time.
            </p>
          </div>

          {/* Privacy guarantee */}
          <p className="text-xs text-gray-500 dark:text-zinc-400 mb-10 flex items-center justify-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Your code is never stored, never used for training, and never shared with third parties.
          </p>

          {/* Trust stats */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-500 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold text-lg">{agents.length}</span>
              <span>specialized auditors</span>
            </div>
            <span className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-zinc-700" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold text-lg">&lt; 60s</span>
              <span>full audit</span>
            </div>
            <span className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-zinc-700" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold text-lg">OWASP · WCAG · SOC 2</span>
              <span>coverage</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-10 text-center">
            From code to fix in 3 steps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Paste code or enter a URL',
                desc: 'Drop in a code snippet, upload a file, or point us at a live site — no setup, no config files.',
              },
              {
                step: '2',
                title: `${agents.length} auditors run in parallel`,
                desc: 'Each auditor specializes in one domain — security, performance, accessibility, SEO, infrastructure, and compliance — finishing in under 60 seconds.',
              },
              {
                step: '3',
                title: 'Get a severity-rated report',
                desc: 'Every finding includes the exact file and line, an explanation, and a copy-paste fix. Export as Markdown or JSON.',
              },
            ].map((item) => (
              <div key={item.step} className="text-center">
                <div className="w-10 h-10 rounded-full bg-violet-100 dark:bg-violet-500/15 text-violet-600 dark:text-violet-400 font-bold text-sm flex items-center justify-center mx-auto mb-4">
                  {item.step}
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-zinc-100 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed max-w-xs mx-auto">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Example findings ─── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4 text-center">
            See what Claudit catches
          </h2>
          <div className="space-y-4">
            {/* Security — Critical */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/80">
                <span className="w-2 h-2 rounded-full bg-red-500" aria-hidden="true" />
                <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Critical</span>
                <span className="text-xs text-gray-400 dark:text-zinc-500 mx-1">&middot;</span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">Security Audit</span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">SQL Injection via unsanitized query parameter</h3>
                <div className="relative bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-mono text-xs leading-relaxed text-gray-700 dark:text-zinc-300 overflow-x-auto">
                  <span className="text-gray-400 dark:text-zinc-500 select-none">app/api/users/route.ts:42 &nbsp;</span>
                  <span className="text-red-600 dark:text-red-400">{"const query = \"SELECT * FROM users WHERE id = \" + req.params.id;"}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                  <strong className="text-gray-800 dark:text-zinc-200">Fix:</strong> Use parameterized queries instead of string concatenation: <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{"db.execute(\"SELECT * FROM users WHERE id = ?\", [req.params.id])"}</code>
                </p>
              </div>
            </div>

            {/* Performance — High */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/80">
                <span className="w-2 h-2 rounded-full bg-orange-500" aria-hidden="true" />
                <span className="text-xs font-semibold text-orange-600 dark:text-orange-400 uppercase tracking-wide">High</span>
                <span className="text-xs text-gray-400 dark:text-zinc-500 mx-1">&middot;</span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">Performance Audit</span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{"Render-blocking CSS loaded synchronously in <head>"}</h3>
                <div className="relative bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-mono text-xs leading-relaxed text-gray-700 dark:text-zinc-300 overflow-x-auto">
                  <span className="text-gray-400 dark:text-zinc-500 select-none">app/layout.tsx:8 &nbsp;</span>
                  <span className="text-orange-600 dark:text-orange-400">{"<link rel=\"stylesheet\" href=\"/styles/fonts.css\">"}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                  <strong className="text-gray-800 dark:text-zinc-200">Fix:</strong> Use <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{"media=\"print\" onload=\"this.media='all'\""}</code> or inline critical CSS and lazy-load the rest.
                </p>
              </div>
            </div>

            {/* Accessibility — Medium */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/80">
                <span className="w-2 h-2 rounded-full bg-yellow-500" aria-hidden="true" />
                <span className="text-xs font-semibold text-yellow-600 dark:text-yellow-400 uppercase tracking-wide">Medium</span>
                <span className="text-xs text-gray-400 dark:text-zinc-500 mx-1">&middot;</span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">Accessibility Audit</span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Image missing alt text — screen readers cannot describe content</h3>
                <div className="relative bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-mono text-xs leading-relaxed text-gray-700 dark:text-zinc-300 overflow-x-auto">
                  <span className="text-gray-400 dark:text-zinc-500 select-none">components/Hero.tsx:24 &nbsp;</span>
                  <span className="text-yellow-600 dark:text-yellow-400">{"<img src=\"/hero-banner.webp\" className=\"w-full\" />"}</span>
                </div>
                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                  <strong className="text-gray-800 dark:text-zinc-200">Fix:</strong> Add descriptive alt text: <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{"<img src=\"/hero-banner.webp\" alt=\"Dashboard showing audit results with severity ratings\" />"}</code>
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Mid-page CTA ─── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/code-audit"
              className="px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 active:scale-[0.98] active:bg-violet-700 transition-colors focus-ring shadow-lg shadow-violet-600/20"
            >
              Try It on Your Code
            </Link>
            <Link
              href="/site-audit"
              className="text-sm text-gray-500 dark:text-zinc-400 hover:text-violet-600 dark:hover:text-violet-400 transition-colors focus-ring underline underline-offset-4"
            >
              or audit a live site <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Categories ─── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-8 text-center">
            {agents.length} audits across {CATEGORIES.length} domains — one tool
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.name}
                className="flex items-start gap-3 p-4 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 hover:border-violet-500/40 hover:shadow-sm transition-[border-color,box-shadow]"
              >
                <span className="text-xl leading-none mt-0.5" aria-hidden="true">{cat.icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{cat.name}</span>
                    <span className="text-xs text-gray-400 dark:text-zinc-500">{categoryCounts[cat.name] ?? 0}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">{cat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Agent search + grid ─── */}
      <section id="agents" className="scroll-mt-20 px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-6 text-center">
            Find an audit
          </h2>
          <HomeSearch agents={agents} featuredAgents={featuredAgents} />
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-8 text-center">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className="group">
                <summary className="flex items-center justify-between cursor-pointer list-none py-3 text-sm font-semibold text-gray-900 dark:text-zinc-100 hover:text-violet-600 dark:hover:text-violet-400 transition-colors">
                  {item.q}
                  <svg className="w-4 h-4 text-gray-400 dark:text-zinc-500 group-open:rotate-180 transition-transform" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed pb-3">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-3">
            Your next deploy could be safer
          </h2>
          <p className="text-gray-500 dark:text-zinc-400 text-sm sm:text-base mb-6">
            Paste code or enter a URL — results stream in under 60 seconds. No account, no credit card.
          </p>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/code-audit"
              className="inline-block px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 active:scale-[0.98] active:bg-violet-700 transition-colors focus-ring shadow-lg shadow-violet-600/20"
            >
              Audit Your Code
            </Link>
            <Link
              href="/site-audit"
              className="inline-block px-8 py-3.5 rounded-xl font-semibold text-base text-gray-700 dark:text-zinc-200 bg-gray-100 dark:bg-zinc-800 hover:bg-gray-200 dark:hover:bg-zinc-700 active:scale-[0.98] transition-colors focus-ring"
            >
              Audit a Live Site
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
