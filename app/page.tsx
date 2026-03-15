import Link from 'next/link';
import { agents } from '@/lib/agents';
import Logo from '@/components/Logo';
import HomeSearch from '@/components/HomeSearch';

const CATEGORIES = [
  { name: 'Security & Privacy', count: 0, color: 'bg-red-500', description: 'OWASP, GDPR, HIPAA, PCI DSS, SOC 2 compliance' },
  { name: 'Code Quality', count: 0, color: 'bg-blue-500', description: 'Bugs, anti-patterns, architecture, testing' },
  { name: 'Performance', count: 0, color: 'bg-amber-500', description: 'Core Web Vitals, bundle size, caching, concurrency' },
  { name: 'Infrastructure', count: 0, color: 'bg-cyan-500', description: 'DevOps, CI/CD, cloud, observability, databases' },
  { name: 'Design', count: 0, color: 'bg-violet-500', description: 'UX, accessibility, responsive, i18n, dark mode' },
];

// Count agents per category
for (const cat of CATEGORIES) {
  cat.count = agents.filter((a) => a.category === cat.name).length;
}

export default function Home() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-4 sm:px-6 py-12 overflow-x-clip">
      <div className="max-w-5xl mx-auto">
        {/* Hero */}
        <div className="text-center mb-16 relative">
          {/* Gradient orbs */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[min(288px,80vw)] h-72 bg-violet-500/20 blur-3xl rounded-full -z-10 motion-safe:animate-pulse-slow" />
          <div className="absolute top-10 left-1/3 w-[min(384px,90vw)] h-64 bg-indigo-500/15 blur-3xl rounded-full -z-10 motion-safe:animate-pulse-slow" style={{ animationDelay: '3s' }} />
          <div className="absolute inset-0 bg-grid-pattern -z-10 opacity-50" />

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-violet-500/10 text-violet-400 mb-4">
            Powered by Claude
          </span>
          <div className="flex items-center justify-center gap-3 mb-4">
            <Logo size={48} />
            <h1 className="text-[clamp(1.875rem,4vw+0.5rem,3.5rem)] font-bold tracking-tight dark:text-gradient">
              <span aria-hidden="true">Claudit</span>
              <span className="sr-only">Claudit — AI Code Audit Tool</span>
            </h1>
          </div>
          <p className="text-gray-600 dark:text-zinc-400 text-lg max-w-xl mx-auto mb-2">
            Instant AI-powered audits for code quality, security, and compliance.
          </p>
          <p className="text-gray-500 dark:text-zinc-500 text-sm max-w-lg mx-auto mb-8">
            50 specialized agents powered by Claude Sonnet 4.6 — covering OWASP, GDPR, HIPAA, SOC 2, PCI DSS, and more.
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
              Browse Agents
            </Link>
          </div>
        </div>

        {/* How it works */}
        <section className="mb-16 max-w-3xl mx-auto">
          <h2 className="sr-only">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 text-center">
            <div className="bg-white/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-5 py-6">
              <div className="text-2xl mb-2">1</div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-1">Enter a URL or paste code</h3>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Point us at any website, or paste files directly</p>
            </div>
            <div className="bg-white/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-5 py-6">
              <div className="text-2xl mb-2">2</div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-1">Pick your agents</h3>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Choose from 50 specialized audits — or run them all</p>
            </div>
            <div className="bg-white/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl px-5 py-6">
              <div className="text-2xl mb-2">3</div>
              <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-1">Get your report</h3>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Severity-rated findings with remediation steps — export as MD or JSON</p>
            </div>
          </div>
        </section>

        {/* Category overview */}
        <section className="mb-16">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-6 text-center">50 agents across 5 categories</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {CATEGORIES.map((cat) => (
              <Link
                key={cat.name}
                href={`/site-audit`}
                className="group bg-white/50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 hover:border-violet-500/30 transition-colors"
              >
                <div className="flex items-center gap-2.5 mb-2">
                  <span className={`w-2.5 h-2.5 rounded-full ${cat.color}`} />
                  <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100">{cat.name}</span>
                  <span className="text-xs text-gray-400 dark:text-zinc-600 ml-auto">{cat.count} agents</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-zinc-500">{cat.description}</p>
              </Link>
            ))}
          </div>
        </section>

        {/* Agent search + grid — for users who want a specific single agent */}
        <section id="agents" className="scroll-mt-20">
          <h2 className="text-sm font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-6 text-center">Or run a single agent audit</h2>
          <HomeSearch agents={agents} />
        </section>
      </div>
    </div>
  );
}
