import Link from 'next/link';

const FINDINGS = [
  { sev: 'Critical', label: 'SQL injection \u2014 line 142', conf: '98%', confColor: 'text-green-400', sevClass: 'bg-red-950/60 text-red-400 border-red-900/50' },
  { sev: 'High', label: 'Unsalted password hash', conf: '94%', confColor: 'text-green-400', sevClass: 'bg-amber-950/60 text-amber-400 border-amber-900/50' },
  { sev: 'Medium', label: 'Missing rate limiting', conf: '81%', confColor: 'text-amber-400', sevClass: 'bg-blue-950/60 text-blue-400 border-blue-900/50' },
  { sev: 'Low', label: 'Unused imports (4)', conf: '99%', confColor: 'text-green-400', sevClass: 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50' },
] as const;

export function HeroSection({ isLoggedIn }: { isLoggedIn: boolean }) {
  return (
    <section className="max-w-6xl mx-auto px-6 pt-20 pb-16 grid grid-cols-1 lg:grid-cols-[1fr_480px] gap-16 items-center">
      {/* Left: copy */}
      <div>
        <div className="inline-flex items-center gap-2 bg-violet-950/60 text-violet-300 text-xs font-medium px-3 py-1.5 rounded-full border border-violet-800/50 mb-8 select-none">
          <span className="w-1.5 h-1.5 bg-violet-400 rounded-full motion-safe:animate-pulse" />
          Early Access &mdash; Free
        </div>

        <h1 className="text-5xl lg:text-6xl font-bold leading-[1.07] tracking-tight text-white mb-6">
          Find what your{' '}
          <span className="text-violet-400">code review</span>
          {' '}missed
        </h1>

        <p className="text-lg text-zinc-400 leading-relaxed font-light mb-10 max-w-lg">
          Claudit runs <span className="text-zinc-200 font-medium">190 specialized auditors</span> in parallel &mdash;
          catching security holes, performance issues, and bad patterns with exact fix guidance.
          No setup. Results in under 60 seconds.
        </p>

        <div className="flex items-center gap-3 flex-wrap mb-5">
          <Link
            href={isLoggedIn ? '/audit' : '/signup'}
            className="px-7 py-3.5 text-base font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-lg hover:shadow-violet-900/40"
          >
            {isLoggedIn ? 'Run an audit \u2192' : 'Audit your code free \u2192'}
          </Link>
          <Link
            href="/how-it-works"
            className="px-7 py-3.5 text-base text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-xl transition-colors"
          >
            See how it works
          </Link>
        </div>

        <p className="text-xs text-zinc-500">
          No account required &middot; paste code &middot; results stream live &middot;{' '}
          <span className="text-zinc-400">Anthropic&apos;s Claude API &mdash; your code is never trained on</span>
        </p>
      </div>

      {/* Right: product mockup */}
      <div className="bg-zinc-900 rounded-2xl border border-zinc-800 overflow-hidden shadow-2xl shadow-black/40">
        <div className="bg-zinc-950 px-4 py-3 flex items-center gap-2 border-b border-zinc-800">
          <span className="w-2.5 h-2.5 bg-red-500/70 rounded-full" />
          <span className="w-2.5 h-2.5 bg-amber-500/70 rounded-full" />
          <span className="w-2.5 h-2.5 bg-green-500/70 rounded-full" />
          <span className="ml-3 text-xs text-zinc-500 font-mono">AuthService.ts</span>
          <span className="ml-auto text-xs text-zinc-600">14.2s</span>
        </div>

        <div className="px-5 pt-5 pb-3 flex items-center justify-between">
          <div>
            <div className="flex items-baseline gap-1">
              <span className="text-5xl font-bold text-white tabular-nums">87</span>
              <span className="text-xl text-zinc-500">/100</span>
            </div>
            <p className="text-xs text-zinc-500 mt-0.5">Audit score</p>
          </div>
          <div className="text-right">
            <span className="inline-block text-xs font-medium bg-green-950/60 text-green-400 border border-green-900/50 px-3 py-1 rounded-full">
              Strong
            </span>
            <p className="text-xs text-zinc-600 mt-1.5">190 auditors checked</p>
          </div>
        </div>

        <div className="px-5 pb-5 space-y-2">
          {FINDINGS.map((f) => (
            <div key={f.label} className="flex items-center gap-3 px-3 py-2.5 bg-zinc-950/60 rounded-xl border border-zinc-800/60">
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border min-w-[54px] text-center flex-shrink-0 ${f.sevClass}`}>
                {f.sev}
              </span>
              <span className="text-sm text-zinc-300 flex-1 truncate">{f.label}</span>
              <span className={`text-[11px] font-medium flex-shrink-0 ${f.confColor}`}>{f.conf}</span>
            </div>
          ))}
        </div>

        <div className="border-t border-zinc-800 px-5 py-3 flex items-center justify-between bg-zinc-950/40">
          <p className="text-xs text-zinc-500">10 findings across 4 categories</p>
          <span className="text-xs font-medium text-violet-400">View all fixes &rarr;</span>
        </div>
      </div>
    </section>
  );
}
