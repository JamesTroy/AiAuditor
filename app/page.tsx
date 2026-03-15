import Link from 'next/link';
import { agents } from '@/lib/agents';
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
  { name: 'Security & Privacy', color: 'bg-red-500', description: 'Injection flaws, auth bugs, exposed secrets' },
  { name: 'Code Quality', color: 'bg-blue-500', description: 'Anti-patterns, dead code, architecture issues' },
  { name: 'Performance', color: 'bg-amber-500', description: 'Slow queries, render-blocking, bloated bundles' },
  { name: 'Infrastructure', color: 'bg-cyan-500', description: 'CI/CD, containers, database, observability' },
  { name: 'Design', color: 'bg-violet-500', description: 'Accessibility, responsive, i18n, dark mode' },
  { name: 'SEO', color: 'bg-emerald-500', description: 'Rankings, keywords, technical SEO' },
  { name: 'Marketing', color: 'bg-pink-500', description: 'Positioning, CTAs, conversion friction' },
];

// Count agents per category
const categoryCounts: Record<string, number> = {};
for (const a of agents) {
  categoryCounts[a.category] = (categoryCounts[a.category] ?? 0) + 1;
}

const featuredAgents = FEATURED_IDS.map((id) => agents.find((a) => a.id === id)!).filter(Boolean);

export default function Home() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-4 sm:px-6 py-12 overflow-x-clip">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-16 relative">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[min(288px,80vw)] h-72 bg-violet-500/20 blur-3xl rounded-full -z-10 motion-safe:animate-pulse-slow" />
          <div className="absolute top-10 left-1/3 w-[min(384px,90vw)] h-64 bg-indigo-500/15 blur-3xl rounded-full -z-10 motion-safe:animate-pulse-slow" style={{ animationDelay: '3s' }} />
          <div className="absolute inset-0 bg-grid-pattern -z-10 opacity-50" />

          <div className="flex items-center justify-center gap-3 mb-4">
            <Logo size={48} />
            <h1 className="text-[clamp(1.875rem,4vw+0.5rem,3.5rem)] font-bold tracking-tight dark:text-gradient">
              Claudit
            </h1>
          </div>
          <p className="text-gray-800 dark:text-zinc-200 text-xl sm:text-2xl font-semibold max-w-2xl mx-auto mb-3">
            Find what your code review missed.
          </p>
          <p className="text-gray-500 dark:text-zinc-400 text-sm sm:text-base max-w-xl mx-auto mb-8">
            Severity-rated security, performance, and accessibility reports in 60 seconds.
          </p>

          {/* Primary CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/site-audit"
              className="px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring whitespace-nowrap"
            >
              Run a Site Audit
            </Link>
            <Link
              href="#agents"
              className="px-8 py-3.5 rounded-xl font-semibold text-base text-gray-600 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 transition-colors focus-ring whitespace-nowrap"
            >
              Browse Audits
            </Link>
          </div>
        </div>

        {/* Example finding */}
        <section className="mb-16 max-w-3xl mx-auto">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4 text-center">Example finding from a real audit</h2>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
            <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/80">
              <span className="w-2 h-2 rounded-full bg-red-500" />
              <span className="text-xs font-semibold text-red-600 dark:text-red-400 uppercase tracking-wide">Critical</span>
              <span className="text-xs text-gray-400 dark:text-zinc-600 mx-1">&middot;</span>
              <span className="text-xs text-gray-500 dark:text-zinc-400">Security Audit</span>
            </div>
            <div className="px-5 py-4 space-y-3">
              <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">SQL Injection via unsanitized query parameter</h3>
              <div className="bg-gray-50 dark:bg-zinc-950 border border-gray-200 dark:border-zinc-800 rounded-lg px-4 py-3 font-mono text-xs text-gray-700 dark:text-zinc-300 overflow-x-auto">
                <span className="text-gray-400 dark:text-zinc-600 select-none">app/api/users/route.ts:42 &nbsp;</span>
                <span className="text-red-600 dark:text-red-400">const result = await db.execute(</span><br />
                <span className="text-gray-400 dark:text-zinc-600 select-none">&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;</span>
                <span className="text-red-600 dark:text-red-400">{"`SELECT * FROM users WHERE id = ${id}`"}</span>
                <span className="text-red-600 dark:text-red-400">);</span>
              </div>
              <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                <strong className="text-gray-800 dark:text-zinc-200">Fix:</strong> Use parameterized queries. Replace string interpolation with <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs">{"db.execute(sql`SELECT * FROM users WHERE id = ${id}`)"}</code> to prevent injection attacks.
              </p>
            </div>
          </div>
        </section>

        {/* Categories — compact chips */}
        <section className="mb-16">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4 text-center">
            {agents.length} audits across {CATEGORIES.length} categories
          </h2>
          <div className="flex flex-wrap justify-center gap-2">
            {CATEGORIES.map((cat) => (
              <span
                key={cat.name}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 text-xs text-gray-600 dark:text-zinc-400"
              >
                <span className={`w-2 h-2 rounded-full ${cat.color}`} />
                {cat.name}
                <span className="text-gray-400 dark:text-zinc-600">{categoryCounts[cat.name] ?? 0}</span>
              </span>
            ))}
          </div>
        </section>

        {/* Agent search + grid — collapsed by default, search reveals */}
        <section id="agents" className="scroll-mt-20">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-6 text-center">Find an audit</h2>
          <HomeSearch agents={agents} featuredAgents={featuredAgents} />
        </section>
      </div>
    </div>
  );
}
