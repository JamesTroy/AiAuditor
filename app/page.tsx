import Link from 'next/link';
import { agents } from '@/lib/agents/registry';
import Logo from '@/components/Logo';
import HomeSearch from '@/components/HomeSearch';

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
  { name: 'Marketing', color: 'bg-pink-500', icon: '📣', description: 'Positioning, CTAs, conversion friction' },
];

// Count agents per category
const categoryCounts: Record<string, number> = {};
for (const a of agents) {
  categoryCounts[a.category] = (categoryCounts[a.category] ?? 0) + 1;
}

const featuredAgents = FEATURED_IDS.map((id) => agents.find((a) => a.id === id)!).filter(Boolean);

export default function Home() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 overflow-x-clip">
      {/* ─── Hero ─── */}
      <section className="relative px-4 sm:px-6 pt-16 pb-20 sm:pt-20 sm:pb-28">
        <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[min(288px,80vw)] h-72 bg-violet-500/20 blur-3xl rounded-full -z-10 motion-safe:animate-pulse-slow will-change-[opacity]" />
        <div className="absolute top-10 left-1/3 w-[min(384px,90vw)] h-[min(256px,40vh)] bg-indigo-500/15 blur-3xl rounded-full -z-10 motion-safe:animate-pulse-slow will-change-[opacity] [animation-delay:3s]" />
        <div className="absolute inset-0 bg-grid-pattern -z-10 opacity-50" />

        <div className="max-w-4xl mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-6">
            <Logo size={48} />
            <h1 className="text-[clamp(1.5rem,4vw+0.5rem,3.5rem)] font-bold tracking-tight dark:text-gradient">
              Claudit
            </h1>
          </div>

          <p className="text-gray-800 dark:text-zinc-200 text-[clamp(1.25rem,2.5vw+0.5rem,2rem)] font-semibold max-w-2xl mx-auto mb-3 leading-tight">
            Find what your code review missed.
          </p>
          <p className="text-gray-500 dark:text-zinc-400 text-base sm:text-lg max-w-xl mx-auto mb-10">
            Paste your code or drop in a URL. Get a severity-rated report covering security, performance, and accessibility — with results streaming in real time.
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-12">
            <Link
              href="/site-audit"
              className="px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring whitespace-nowrap shadow-lg shadow-violet-600/20"
            >
              Run a Free Audit
            </Link>
            <Link
              href="#agents"
              className="px-8 py-3.5 rounded-xl font-semibold text-base text-gray-600 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors focus-ring whitespace-nowrap"
            >
              Browse {agents.length} Audits
            </Link>
          </div>

          {/* Trust stats */}
          <div className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-500 dark:text-zinc-400">
            <div className="flex items-center gap-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold text-lg">{agents.length}+</span>
              <span>specialized audits</span>
            </div>
            <span className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-zinc-700" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold text-lg">{CATEGORIES.length}</span>
              <span>categories</span>
            </div>
            <span className="hidden sm:block w-px h-4 bg-gray-300 dark:bg-zinc-700" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold text-lg">Real-time</span>
              <span>streaming results</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-10 text-center">
            How it works
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Submit your code',
                desc: 'Paste a code snippet, upload a file, or enter a live URL for a full site audit.',
              },
              {
                step: '2',
                title: 'We scan it deeply',
                desc: 'Specialized auditors check for security flaws, performance issues, accessibility gaps, and more — all at once.',
              },
              {
                step: '3',
                title: 'Get actionable results',
                desc: 'Receive a severity-rated report with specific line references, explanations, and fix suggestions.',
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

      {/* ─── Example finding ─── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4 text-center">
            Example finding from a real audit
          </h2>
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
                <span className="text-red-600 dark:text-red-400">const result = await db.execute(</span><br />
                <span className="text-gray-400 dark:text-zinc-500 select-none">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                <span className="text-red-600 dark:text-red-400">{"`SELECT * FROM users WHERE id = ${id}`"}</span>
                <span className="text-red-600 dark:text-red-400">);</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                <strong className="text-gray-800 dark:text-zinc-200">Fix:</strong> Use parameterized queries. Replace string interpolation with <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{"db.execute(sql`SELECT * FROM users WHERE id = ${id}`)"}</code> to prevent injection attacks.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Categories ─── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-5xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-8 text-center">
            {agents.length} audits across {CATEGORIES.length} categories
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl mx-auto">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.name}
                className="flex items-start gap-3 p-4 rounded-xl bg-white/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 hover:border-violet-500/40 hover:shadow-sm transition-all"
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

      {/* ─── Final CTA ─── */}
      <section className="px-4 sm:px-6 pb-20">
        <div className="max-w-2xl mx-auto text-center">
          <h2 className="text-xl sm:text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-3">
            Ready to find what you&apos;re missing?
          </h2>
          <p className="text-gray-500 dark:text-zinc-400 text-sm sm:text-base mb-6">
            Run your first audit in under a minute. No credit card required.
          </p>
          <Link
            href="/site-audit"
            className="inline-block px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring shadow-lg shadow-violet-600/20"
          >
            Start Your Free Audit
          </Link>
        </div>
      </section>
    </div>
  );
}
