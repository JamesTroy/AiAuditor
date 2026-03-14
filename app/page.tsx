import { agents } from '@/lib/agents';
import Logo from '@/components/Logo';
import HomeClient from '@/components/HomeClient';

export default function Home() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12 overflow-x-clip">
      <div className="max-w-5xl mx-auto">
        {/* Hero — server-rendered for SEO */}
        <div className="text-center mb-12 relative">
          {/* Gradient orbs */}
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 w-[min(288px,80vw)] h-72 bg-violet-500/20 blur-3xl rounded-full -z-10 motion-safe:animate-pulse-slow" />
          <div className="absolute top-10 left-1/3 w-[min(384px,90vw)] h-64 bg-indigo-500/15 blur-3xl rounded-full -z-10 motion-safe:animate-pulse-slow" style={{ animationDelay: '3s' }} />
          {/* Grid pattern */}
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
          <p className="text-gray-600 dark:text-zinc-400 text-lg max-w-xl mx-auto">
            Instant AI-powered audits for code quality, security, and performance.
          </p>
          <p className="text-gray-500 dark:text-zinc-500 text-sm mt-3 max-w-lg mx-auto">
            50 specialized agents powered by Claude Sonnet 4.6. Paste your code, get a severity-rated report with line references and remediation steps.
          </p>
        </div>

        {/* How it works — server-rendered for SEO */}
        <section className="mb-10 max-w-3xl mx-auto">
          <h2 className="sr-only">How it works</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-center">
            <div className="px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-1">1. Paste your code</h3>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Drop in files, paste code, or import from a URL</p>
            </div>
            <div className="px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-1">2. AI analyzes it</h3>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Claude streams a structured report in real-time</p>
            </div>
            <div className="px-4 py-3">
              <h3 className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-1">3. Get your report</h3>
              <p className="text-xs text-gray-500 dark:text-zinc-500">Severity-rated findings with scores — export as MD or JSON</p>
            </div>
          </div>
        </section>

        {/* Interactive client island: search, favorites, agent grid */}
        <HomeClient agents={agents} />
      </div>
    </div>
  );
}
