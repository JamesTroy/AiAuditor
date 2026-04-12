import Link from 'next/link';

// ── Pricing ─────────────────────────────────────────────────────────────────

export function Pricing() {
  return (
    <section id="pricing" className="py-28 border-b border-zinc-800/60">
      <div className="max-w-5xl mx-auto px-6">
        <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">Pricing</p>
        <h2 className="text-4xl font-bold text-white tracking-tight mb-3">Free while in early access</h2>
        <p className="text-zinc-400 text-lg font-light mb-16">Everything is free right now. No credit card, no limits, no catch.</p>

        <div className="max-w-md mx-auto">
          <div className="relative rounded-2xl bg-violet-600 border border-violet-500 shadow-2xl shadow-violet-900/30 p-8 text-center">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-violet-700 text-xs font-semibold px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
              Early Access
            </div>
            <span className="text-5xl font-bold text-white">$0</span>
            <p className="text-violet-200 text-sm mt-1 mb-6">Free for everyone during early access</p>
            <div className="border-t border-violet-500/40 mb-6" />
            <ul className="space-y-2.5 mb-8 text-left">
              {[
                'All 190 specialized auditors',
                'Unlimited audits',
                'Severity-ranked findings with fix guidance',
                'Score trend history',
                'Team features (orgs, shared history)',
                'No account required to try it',
              ].map((f) => (
                <li key={f} className="flex items-center gap-2.5 text-sm text-violet-100">
                  <svg className="w-4 h-4 flex-shrink-0 text-violet-200" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="2 8 6 12 14 4" />
                  </svg>
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="block text-center py-3 rounded-xl text-sm font-semibold bg-white text-violet-700 hover:bg-violet-50 transition-all"
            >
              Get started free &rarr;
            </Link>
          </div>
        </div>

        <p className="text-center text-xs text-zinc-600 mt-8">
          Paid plans coming later. Early access users will be grandfathered. Your code is never stored or trained on.
        </p>
      </div>
    </section>
  );
}

// ── CTA Section ─────────────────────────────────────────────────────────────

export function CtaSection() {
  return (
    <section className="py-28">
      <div className="max-w-2xl mx-auto px-6 text-center">
        <h2 className="text-5xl font-bold text-white tracking-tight mb-5">Ship code you&apos;re proud of</h2>
        <p className="text-lg text-zinc-400 font-light mb-10">190 AI auditors. Severity rankings. Exact fix guidance. Under 60 seconds.</p>
        <div className="flex items-center justify-center gap-3 flex-wrap mb-5">
          <Link href="/signup" className="px-8 py-3.5 text-base font-semibold text-white bg-violet-600 hover:bg-violet-500 rounded-xl transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-violet-900/40">
            Audit your code free &rarr;
          </Link>
          <Link href="/about" className="px-8 py-3.5 text-base text-zinc-300 hover:text-white border border-zinc-700 hover:border-zinc-500 rounded-xl transition-colors">
            Learn more
          </Link>
        </div>
        <p className="text-xs text-zinc-600">No credit card &middot; free during early access &middot; no limits</p>
      </div>
    </section>
  );
}

// ── Footer ──────────────────────────────────────────────────────────────────

export function LandingFooter() {
  return (
    <footer className="border-t border-zinc-800 bg-zinc-900/50">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-2.5 select-none">
          <div className="w-6 h-6 bg-violet-600 rounded-md flex items-center justify-center text-white text-xs">C</div>
          <span className="text-sm font-semibold text-zinc-300">Claudit</span>
        </div>
        <div className="flex items-center gap-6 text-xs text-zinc-500">
          <Link href="/about" className="hover:text-zinc-300 transition-colors">About</Link>
          <Link href="#pricing" className="hover:text-zinc-300 transition-colors">Pricing</Link>
          <Link href="/privacy" className="hover:text-zinc-300 transition-colors">Privacy</Link>
          <Link href="/terms" className="hover:text-zinc-300 transition-colors">Terms</Link>
          <Link href="/security" className="hover:text-zinc-300 transition-colors">Security</Link>
        </div>
        <p className="text-xs text-zinc-600">&copy; 2026 Claudit</p>
      </div>
    </footer>
  );
}
