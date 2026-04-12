import Link from 'next/link';

// ── Pricing ─────────────────────────────────────────────────────────────────

const PLANS = [
  { name: 'Free', price: '$0', period: 'forever', features: ['5 audits per month', 'All 190 auditors', 'Severity-ranked findings', 'Fix guidance included'], cta: 'Start free', href: '/signup', featured: false },
  { name: 'Pro', price: '$29', period: 'per month', features: ['100 audits per month', 'Score trend history', 'API access', 'Priority processing'], cta: 'Get Pro', href: '/signup?plan=pro', featured: true, badge: 'Most popular' },
  { name: 'Team', price: '$79', period: 'per month \u00b7 up to 10 seats', features: ['500 audits per month', 'Team dashboard', 'Shared audit history', 'Org-wide defaults'], cta: 'Start team trial', href: '/signup?plan=team', featured: false },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-28 border-b border-zinc-800/60">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">Pricing</p>
        <h2 className="text-4xl font-bold text-white tracking-tight mb-3">Simple, honest pricing</h2>
        <p className="text-zinc-400 text-lg font-light mb-16">Start free. Upgrade when your team needs it.</p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {PLANS.map((p) => (
            <div
              key={p.name}
              className={`relative rounded-2xl border p-7 flex flex-col ${
                p.featured
                  ? 'bg-violet-600 border-violet-500 shadow-2xl shadow-violet-900/30'
                  : 'bg-zinc-900 border-zinc-800'
              }`}
            >
              {p.badge && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-white text-violet-700 text-xs font-semibold px-3 py-1 rounded-full shadow-sm whitespace-nowrap">
                  {p.badge}
                </div>
              )}
              <p className={`text-sm font-medium mb-3 ${p.featured ? 'text-violet-200' : 'text-zinc-400'}`}>{p.name}</p>
              <span className="text-4xl font-bold text-white mb-1">{p.price}</span>
              <p className={`text-xs mb-6 ${p.featured ? 'text-violet-300' : 'text-zinc-500'}`}>{p.period}</p>
              <div className={`border-t mb-6 ${p.featured ? 'border-violet-500/40' : 'border-zinc-800'}`} />
              <ul className="space-y-2.5 mb-8 flex-1">
                {p.features.map((f) => (
                  <li key={f} className={`flex items-center gap-2.5 text-sm ${p.featured ? 'text-violet-100' : 'text-zinc-400'}`}>
                    <svg className={`w-4 h-4 flex-shrink-0 ${p.featured ? 'text-violet-200' : 'text-violet-500'}`} viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="2 8 6 12 14 4" />
                    </svg>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={p.href}
                className={`block text-center py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  p.featured
                    ? 'bg-white text-violet-700 hover:bg-violet-50'
                    : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 border border-zinc-700'
                }`}
              >
                {p.cta} &rarr;
              </Link>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-zinc-600 mt-8">
          All plans include: OWASP &middot; WCAG &middot; GDPR coverage &middot; your code is never stored or trained on
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
        <p className="text-xs text-zinc-600">No credit card &middot; 5 free audits &middot; Cancel anytime</p>
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
