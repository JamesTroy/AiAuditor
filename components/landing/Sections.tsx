// ProofStrip, HowItWorks, Features, Testimonials — all server components.

// ── ProofStrip ──────────��───────────────────────────────────────────────────

export function ProofStrip() {
  const stats = [
    { num: '190', label: 'Specialized auditors' },
    { num: '<60s', label: 'Full audit time' },
    { num: '94%', label: 'Issues caught pre-deploy' },
    { num: 'OWASP \u00b7 WCAG \u00b7 GDPR', label: 'Coverage patterns', wide: true },
  ];
  return (
    <div className="border-y border-zinc-800 bg-zinc-900/50">
      <div className="max-w-6xl mx-auto px-6 py-7 flex items-center justify-between flex-wrap gap-6">
        {stats.map((s) => (
          <div key={s.label} className="text-center">
            <p className={`font-bold text-white ${s.wide ? 'text-base tracking-wide' : 'text-2xl tabular-nums'}`}>{s.num}</p>
            <p className="text-xs text-zinc-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── HowItWorks ────────��────────────────────────────────���────────────────────

const STEPS = [
  { n: '01', title: 'Paste your code', body: 'Drop in any file \u2014 TypeScript, Python, Go, Rust, SQL, and more. No account needed to try it.' },
  { n: '02', title: 'Pick your auditors', body: 'Choose from 190 specialized auditors or run all of them. Security, performance, type safety, auth patterns, SQL hygiene \u2014 each one is an expert in exactly one thing.' },
  { n: '03', title: 'Get severity-ranked findings', body: 'Every issue is rated Critical, High, Medium, or Low with a confidence score. Start with Critical \u2014 the rest is polish.' },
  { n: '04', title: 'Fix with exact guidance', body: 'Each finding includes the exact line to change, the reason it matters, and a ready-to-paste code fix. No vague recommendations.' },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="py-28 border-b border-zinc-800/60">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">How it works</p>
        <h2 className="text-4xl font-bold text-white tracking-tight mb-4">
          From paste to report<br className="hidden lg:block" /> in under a minute
        </h2>
        <p className="text-zinc-400 text-lg font-light mb-16 max-w-lg">
          No CLI to install. No config files. No account required to try it.
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8">
          {STEPS.map((s) => (
            <div key={s.n} className="relative">
              <div className="text-4xl font-bold text-zinc-800 mb-4 select-none tabular-nums">{s.n}</div>
              <h3 className="text-base font-semibold text-zinc-100 mb-2">{s.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Features ────���──────────────────────────────────���────────────────────────

const FEATURES = [
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
    title: 'Security by default',
    body: 'SQL injection, XSS, insecure auth, exposed secrets, OWASP Top 10 \u2014 caught before they reach production.',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>,
    title: 'Performance patterns',
    body: 'N+1 queries, missing indexes, memory leaks, and blocking operations \u2014 flagged with exact line numbers.',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
    title: '190 specialized auditors',
    body: 'Each auditor is an expert in one thing. Run all 190 or cherry-pick the categories that matter for your file.',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>,
    title: 'Ready-to-paste fixes',
    body: "Not just 'this is a problem.' Every finding includes the corrected code, ready to copy in.",
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></svg>,
    title: 'Score trend history',
    body: 'Track codebase health across every audit. See exactly where you improved \u2014 and by how much.',
  },
  {
    icon: <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>,
    title: 'Team audits',
    body: 'Share results across your org, set visibility defaults, and track team-wide code quality trends.',
  },
];

export function Features() {
  return (
    <section id="features" className="py-28 border-b border-zinc-800/60">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">Features</p>
        <h2 className="text-4xl font-bold text-white tracking-tight mb-16">
          Everything a senior engineer<br className="hidden lg:block" /> would catch &mdash; instantly
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {FEATURES.map((f) => (
            <div key={f.title} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 hover:border-zinc-700 hover:-translate-y-0.5 transition-all duration-200">
              <div className="w-10 h-10 text-violet-400 mb-5 [&>svg]:w-full [&>svg]:h-full">{f.icon}</div>
              <h3 className="text-base font-semibold text-zinc-100 mb-2">{f.title}</h3>
              <p className="text-sm text-zinc-500 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ── Testimonials ──────��─────────────────────────────────────────────────────

const TESTIMONIALS = [
  { quote: 'Found a SQL injection in our auth layer that had been there for two years. Our entire security review missed it. Claudit caught it in 8 seconds.', name: 'Sarah R.', role: 'Senior Engineer, Fintech startup', initials: 'SR' },
  { quote: "The fix guidance is what sets it apart. Not just 'you have a problem' \u2014 here's the exact parameterized query to replace it with. Saves hours of Googling.", name: 'Marcus K.', role: 'Staff Engineer', initials: 'MK' },
  { quote: 'We run it on every PR now. Our average audit score went from 71 to 89 in 6 weeks. The score trend chart makes it easy to show management progress.', name: 'Alicia P.', role: 'Engineering Lead', initials: 'AP' },
];

export function Testimonials() {
  return (
    <section className="py-28 border-b border-zinc-800/60">
      <div className="max-w-6xl mx-auto px-6">
        <p className="text-xs font-semibold text-violet-400 uppercase tracking-widest mb-4">What engineers say</p>
        <h2 className="text-4xl font-bold text-white tracking-tight mb-16">Caught things code review missed</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {TESTIMONIALS.map((t) => (
            <div key={t.name} className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6">
              <p className="text-sm text-zinc-300 leading-relaxed mb-6 italic">&ldquo;{t.quote}&rdquo;</p>
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-full bg-violet-950 border border-violet-800 flex items-center justify-center text-xs font-medium text-violet-300 flex-shrink-0 select-none">{t.initials}</div>
                <div>
                  <p className="text-sm font-medium text-zinc-200">{t.name}</p>
                  <p className="text-xs text-zinc-500">{t.role}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
