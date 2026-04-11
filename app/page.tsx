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
  { name: 'Security & Privacy', color: 'bg-red-500', border: 'border-l-red-500', glow: 'group-hover:shadow-red-500/10', icon: '🛡', description: 'Injection flaws, auth bugs, exposed secrets' },
  { name: 'Code Quality', color: 'bg-blue-500', border: 'border-l-blue-500', glow: 'group-hover:shadow-blue-500/10', icon: '✨', description: 'Anti-patterns, dead code, architecture issues' },
  { name: 'Performance', color: 'bg-amber-500', border: 'border-l-amber-500', glow: 'group-hover:shadow-amber-500/10', icon: '⚡', description: 'Slow queries, render-blocking, bloated bundles' },
  { name: 'Infrastructure', color: 'bg-cyan-500', border: 'border-l-cyan-500', glow: 'group-hover:shadow-cyan-500/10', icon: '🏗', description: 'CI/CD, containers, database, observability' },
  { name: 'Design', color: 'bg-violet-500', border: 'border-l-violet-500', glow: 'group-hover:shadow-violet-500/10', icon: '🎨', description: 'Accessibility, responsive, i18n, dark mode' },
  { name: 'SEO', color: 'bg-emerald-500', border: 'border-l-emerald-500', glow: 'group-hover:shadow-emerald-500/10', icon: '🔍', description: 'Rankings, keywords, technical SEO' },
  { name: 'Marketing', color: 'bg-pink-500', border: 'border-l-pink-500', glow: 'group-hover:shadow-pink-500/10', icon: '📣', description: 'For developer-founders: positioning, CTAs, conversion optimization' },
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
    a: 'Your code is sent to Anthropic\'s Claude API for analysis, then immediately discarded — it is never stored on our servers and never used for model training. Anthropic does not retain API inputs for training. We use no advertising and no third-party tracking scripts.',
  },
  {
    q: 'Is this just ChatGPT in a trench coat?',
    a: `No — and it's a fair question. Claudit uses Claude (Anthropic's model), but the work is in the prompts, not the model. Each of the ${agents.length}+ auditors is a carefully engineered prompt that encodes a specific domain — OWASP Top 10 (the most common security mistakes), WCAG 2.2 AA (accessibility standards), Core Web Vitals (Google's page speed metrics), SQL injection patterns, and more. The model supplies language understanding; the auditor supplies the expertise. Think of it like the difference between hiring a generalist and hiring someone who has read every security advisory twice.`,
  },
  {
    q: 'What does Claudit miss or get wrong?',
    a: 'A few known limitations worth knowing upfront: (1) We analyze code statically — runtime behavior, production load patterns, and environment-specific bugs are outside scope. (2) Findings marked POSSIBLE or LIKELY require human judgment; not everything flagged is a real issue. (3) Very large codebases (500k+ characters) should be split by module for best results. (4) Our PCI DSS, HIPAA, and SOC 2 agents help you prepare for compliance — but they don\u2019t replace a certified auditor for formal certification. Treat every finding as a candidate for your review — not a final verdict.',
  },
  {
    q: 'How is Claudit different from SonarQube, Snyk, or a linter?',
    a: `Traditional tools each cover one domain — SonarQube for code quality, Snyk for dependency security, axe for accessibility. Claudit runs ${agents.length}+ specialized auditors across all of those domains in a single pass, without the setup. It complements your existing tools rather than replacing them — think of it as a fast first-pass review before you invest in deeper tooling.`,
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
      <section className="relative px-4 sm:px-6 pt-16 pb-24 sm:pt-24 sm:pb-32">
        {/* Aurora background blobs */}
        <div className="absolute -top-24 left-1/2 -translate-x-1/2 w-[min(520px,90vw)] h-80 bg-violet-600/25 dark:bg-violet-500/30 blur-[100px] rounded-full -z-10 motion-safe:animate-aurora will-change-transform" />
        <div className="absolute top-0 left-1/4 w-[min(400px,70vw)] h-64 bg-indigo-500/20 dark:bg-indigo-400/20 blur-[80px] rounded-full -z-10 motion-safe:animate-aurora will-change-transform [animation-delay:2s] [animation-duration:10s]" />
        <div className="absolute top-16 right-1/4 w-[min(320px,60vw)] h-48 bg-fuchsia-500/15 dark:bg-fuchsia-500/20 blur-[80px] rounded-full -z-10 motion-safe:animate-aurora will-change-transform [animation-delay:4s] [animation-duration:12s]" />
        {/* Grid + fade-out at bottom */}
        <div className="absolute inset-0 bg-grid-pattern -z-10 opacity-60" />
        <div className="absolute bottom-0 inset-x-0 h-32 bg-gradient-to-t from-gray-50 dark:from-zinc-950 to-transparent -z-10" />

        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="flex items-center justify-center gap-2 mb-7 motion-safe:animate-fade-up">
            <span className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full text-xs font-semibold bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 border border-violet-200 dark:border-violet-500/30 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-violet-500 motion-safe:animate-pulse" aria-hidden="true" />
              Early Access — Free
            </span>
          </div>

          {/* Headline */}
          <h1 className="text-[clamp(2rem,5vw+0.5rem,4rem)] font-bold tracking-tight max-w-3xl mx-auto mb-5 leading-[1.08] motion-safe:animate-fade-up [animation-delay:0.05s]">
            <span className="text-gray-900 dark:text-gradient-animated">Find what your code review missed</span>
            <span className="block text-gray-900 dark:text-transparent dark:bg-clip-text dark:bg-gradient-to-r dark:from-violet-300 dark:via-indigo-300 dark:to-violet-400">— most audits under 60 seconds</span>
          </h1>

          {/* Sub-headline */}
          <p className="text-gray-600 dark:text-zinc-300 text-base sm:text-lg max-w-2xl mx-auto mb-9 leading-relaxed motion-safe:animate-fade-up [animation-delay:0.1s]">
            Get the findings from SonarQube, Snyk, axe, and Lighthouse — without the setup. Claudit runs{' '}
            <strong className="text-gray-900 dark:text-white font-semibold">{agents.length} specialized auditors</strong>{' '}
            in parallel — covering security, performance, accessibility, SEO, and compliance in a single pass.
          </p>

          {/* CTAs */}
          <div className="flex flex-col items-center gap-3 mb-5 motion-safe:animate-fade-up [animation-delay:0.15s]">
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <Link
                href="/audit"
                className="relative px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 active:scale-[0.98] transition-[color,background-color,transform] focus-ring whitespace-nowrap glow-violet-sm hover:glow-violet shadow-lg shadow-violet-600/30"
              >
                Audit Your Code Free
              </Link>
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              No account required · paste code · results stream live
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-500">
              Results are AI-generated — always verify critical findings before acting.
            </p>
          </div>

          {/* Privacy badge */}
          <p className="text-xs text-gray-500 dark:text-zinc-400 mb-12 flex items-center justify-center gap-1.5 motion-safe:animate-fade-up [animation-delay:0.2s]">
            <svg className="w-3.5 h-3.5 text-emerald-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" /></svg>
            Processed via Anthropic&apos;s Claude API — neither Claudit nor Anthropic trains on your code.
          </p>

          {/* Trust stats */}
          <div className="inline-flex flex-wrap items-center justify-center gap-x-8 gap-y-3 text-sm text-gray-500 dark:text-zinc-400 px-8 py-4 rounded-2xl bg-white/60 dark:bg-zinc-900/60 border border-gray-200/60 dark:border-zinc-800/60 backdrop-blur-sm shadow-sm motion-safe:animate-fade-up [animation-delay:0.25s]">
            <div className="flex items-center gap-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold text-xl tabular-nums">{agents.length}</span>
              <span>specialized auditors</span>
            </div>
            <span className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-zinc-700" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold text-xl">&lt; 60s</span>
              <span>full audit</span>
            </div>
            <span className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-zinc-700" aria-hidden="true" />
            <div className="flex items-center gap-2">
              <span className="text-violet-600 dark:text-violet-400 font-bold text-sm">OWASP · WCAG · GDPR</span>
              <span>patterns</span>
            </div>
          </div>
        </div>
      </section>

      {/* ─── How it works ─── */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-4xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-3 text-center">How it works</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center text-gray-900 dark:text-zinc-100 mb-12">
            From code to fix in 3 steps
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
            {/* Connector lines (desktop only) */}
            <div className="hidden md:block absolute top-8 left-[calc(33%+1rem)] right-[calc(33%+1rem)] h-px bg-gradient-to-r from-violet-500/40 via-indigo-500/40 to-violet-500/40" aria-hidden="true" />
            {[
              {
                step: '01',
                title: 'Paste code or enter a URL',
                desc: 'Drop in a snippet, or point us at a live site — no setup, no config files, no CI/CD required.',
                icon: (
                  <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" /></svg>
                ),
              },
              {
                step: '02',
                title: `${agents.length} auditors run in parallel`,
                desc: 'Each checks for specific failure patterns — SQL injection and exposed secrets for security, render-blocking resources for performance, missing alt text for accessibility.',
                icon: (
                  <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" /></svg>
                ),
              },
              {
                step: '03',
                title: 'Get a severity-rated report',
                desc: 'Every finding includes exact file and line, explanation, and a copy-paste fix. Export as Markdown.',
                icon: (
                  <svg className="w-5 h-5 text-violet-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                ),
              },
            ].map((item) => (
              <div key={item.step} className="relative flex flex-col items-center text-center p-6 rounded-2xl bg-white dark:bg-zinc-900/80 border border-gray-200 dark:border-zinc-800 shadow-sm hover:shadow-md hover:border-violet-500/30 transition-[box-shadow,border-color] group">
                {/* Step number */}
                <div className="relative mb-4">
                  <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-violet-100 to-indigo-100 dark:from-violet-900/40 dark:to-indigo-900/40 border border-violet-200 dark:border-violet-800/60 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <span className="absolute -top-2 -right-2 w-5 h-5 rounded-full bg-violet-600 text-white text-[10px] font-bold flex items-center justify-center shadow-sm">{item.step.slice(-1)}</span>
                </div>
                <h3 className="font-semibold text-gray-900 dark:text-zinc-100 mb-2">{item.title}</h3>
                <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Example findings ─── */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-3 text-center">Example findings</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center text-gray-900 dark:text-zinc-100 mb-10">
            What findings look like
          </h2>
          <div className="space-y-3">
            {/* Security — Critical */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-4 border-l-red-500 rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:shadow-red-500/5 transition-shadow">
              <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-100 dark:border-zinc-800/80">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-wider">Critical</span>
                <span className="text-xs text-gray-300 dark:text-zinc-600 mx-0.5">·</span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">Security Audit</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400">certain</span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500">vulnerability</span>
                </span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">SQL Injection via unsanitized query parameter</h3>
                <div className="relative bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 font-mono text-xs leading-relaxed overflow-x-auto">
                  <span className="text-zinc-500 select-none">app/api/users/route.ts:42 &nbsp;</span>
                  <span className="text-red-400">{"const query = \"SELECT * FROM users WHERE id = \" + req.params.id;"}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-zinc-500 leading-relaxed space-y-1">
                  <p><span className="text-gray-600 dark:text-zinc-400 font-medium">Attack vector:</span> Attacker sends <code className="bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[11px]">?id=1 OR 1=1--</code> via GET /api/users</p>
                  <p><span className="text-gray-600 dark:text-zinc-400 font-medium">Data flow:</span> <span className="font-mono text-[11px]">req.params.id → query string → db.query()</span> — no sanitization found</p>
                </div>
                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                  <strong className="text-gray-800 dark:text-zinc-200">Fix:</strong> Use parameterized queries: <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono">{"db.execute(\"SELECT * FROM users WHERE id = ?\", [req.params.id])"}</code>
                </p>
              </div>
            </div>

            {/* Performance — High */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-4 border-l-orange-500 rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:shadow-orange-500/5 transition-shadow">
              <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-100 dark:border-zinc-800/80">
                <span className="w-2 h-2 rounded-full bg-orange-500 shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold text-orange-600 dark:text-orange-400 uppercase tracking-wider">High</span>
                <span className="text-xs text-gray-300 dark:text-zinc-600 mx-0.5">·</span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">Performance Audit</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-amber-100 dark:bg-amber-950 text-amber-700 dark:text-amber-400">⚠ likely</span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500">deficiency</span>
                </span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">N+1 query inside loop — one database call per user instead of batch</h3>
                <div className="relative bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 font-mono text-xs leading-relaxed overflow-x-auto">
                  <span className="text-zinc-500 select-none">lib/teams.ts:18 &nbsp;</span>
                  <span className="text-orange-400">{"for (const id of userIds) { await db.query(\"SELECT * FROM users WHERE id = ?\", [id]); }"}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-zinc-500 leading-relaxed space-y-1">
                  <p><span className="text-gray-600 dark:text-zinc-400 font-medium">Impact:</span> 50 team members = 50 separate database round-trips. Scales linearly with team size.</p>
                  <p><span className="text-gray-600 dark:text-zinc-400 font-medium">Assumption:</span> No query batching or DataLoader is applied upstream.</p>
                </div>
                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                  <strong className="text-gray-800 dark:text-zinc-200">Fix:</strong> Batch into one query: <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono">{"db.query(\"SELECT * FROM users WHERE id IN (?)\", [userIds])"}</code>
                </p>
              </div>
            </div>

            {/* Accessibility — Medium */}
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 border-l-4 border-l-yellow-500 rounded-xl overflow-hidden shadow-sm hover:shadow-lg hover:shadow-yellow-500/5 transition-shadow">
              <div className="flex items-center gap-2.5 px-5 py-3 border-b border-gray-100 dark:border-zinc-800/80">
                <span className="w-2 h-2 rounded-full bg-yellow-500 shrink-0" aria-hidden="true" />
                <span className="text-xs font-bold text-yellow-600 dark:text-yellow-400 uppercase tracking-wider">Medium</span>
                <span className="text-xs text-gray-300 dark:text-zinc-600 mx-0.5">·</span>
                <span className="text-xs text-gray-500 dark:text-zinc-400">Accessibility Audit</span>
                <span className="ml-auto flex items-center gap-1.5">
                  <span className="text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400">certain</span>
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500">deficiency</span>
                </span>
              </div>
              <div className="px-5 py-4 space-y-3">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-zinc-100">Custom dropdown not keyboard-accessible — unreachable for keyboard-only users</h3>
                <div className="relative bg-zinc-950 border border-zinc-800 rounded-lg px-4 py-3 font-mono text-xs leading-relaxed overflow-x-auto">
                  <span className="text-zinc-500 select-none">components/RolePicker.tsx:31 &nbsp;</span>
                  <span className="text-yellow-400">{"<div onClick={toggle}>{selected}</div>"}</span>
                </div>
                <div className="text-xs text-gray-500 dark:text-zinc-500 leading-relaxed space-y-1">
                  <p><span className="text-gray-600 dark:text-zinc-400 font-medium">Issue:</span> Uses <code className="bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[11px]">div</code> + <code className="bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[11px]">onClick</code> instead of a focusable element. No <code className="bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[11px]">role</code>, <code className="bg-gray-100 dark:bg-zinc-800 px-1 py-0.5 rounded font-mono text-[11px]">aria-expanded</code>, or keyboard handler.</p>
                </div>
                <p className="text-xs text-gray-600 dark:text-zinc-400 leading-relaxed">
                  <strong className="text-gray-800 dark:text-zinc-200">Fix:</strong> Use <code className="bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded text-xs font-mono">{"<button aria-haspopup=\"listbox\" aria-expanded={open}>"}</code> and handle Arrow/Enter/Escape keys.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Honest limitations ─── */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-3 text-center">Honest assessment</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center text-gray-900 dark:text-zinc-100 mb-4">
            Where Claudit helps — and where it doesn&apos;t
          </h2>
          <p className="text-sm text-gray-500 dark:text-zinc-400 text-center mb-10 max-w-xl mx-auto">
            Every finding is a suggestion. You decide what to act on.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="p-5 rounded-2xl bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-900/50">
              <p className="text-xs font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400 mb-3">Works well for</p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-zinc-300">
                <li className="flex gap-2"><span className="text-emerald-500 shrink-0 mt-0.5">✓</span>Patterns static analysis misses — auth logic, cross-file data flow, insecure defaults</li>
                <li className="flex gap-2"><span className="text-emerald-500 shrink-0 mt-0.5">✓</span>Fast second opinion before a code review or security engagement</li>
                <li className="flex gap-2"><span className="text-emerald-500 shrink-0 mt-0.5">✓</span>Coverage across domains you don&apos;t specialize in — accessibility, SEO, infrastructure</li>
                <li className="flex gap-2"><span className="text-emerald-500 shrink-0 mt-0.5">✓</span>Common security (OWASP Top 10), accessibility (WCAG 2.2 AA), and privacy (GDPR) patterns</li>
              </ul>
            </div>
            <div className="p-5 rounded-2xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50">
              <p className="text-xs font-bold uppercase tracking-widest text-amber-600 dark:text-amber-400 mb-3">Hard limits</p>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-zinc-300">
                <li className="flex gap-2"><span className="text-amber-500 shrink-0 mt-0.5">!</span>Very large monorepos — analyses up to 500k characters with auto file-indexing; split by module for best results on bigger codebases</li>
                <li className="flex gap-2"><span className="text-amber-500 shrink-0 mt-0.5">!</span>Not a replacement for a certified auditor — use our PCI DSS, HIPAA, and SOC 2 agents to prepare for formal audits, not replace them</li>
              </ul>
            </div>
          </div>
          <div className="p-5 rounded-2xl bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/50">
            <p className="text-xs font-bold uppercase tracking-widest text-violet-600 dark:text-violet-400 mb-3">Works better with context</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-700 dark:text-zinc-300">
              <div className="flex gap-2">
                <span className="text-violet-500 shrink-0 mt-0.5">↑</span>
                <span><strong>Runtime failures</strong> — paste a stack trace or error log into the runtime context field and auditors treat confirmed failures as evidence, not speculation</span>
              </div>
              <div className="flex gap-2">
                <span className="text-violet-500 shrink-0 mt-0.5">↑</span>
                <span><strong>Domain-specific rules</strong> — describe your stack, compliance standards, and conventions in <a href="/settings" className="underline text-violet-600 dark:text-violet-400">workspace context</a> and every audit is tailored to your environment</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ─── Mid-page CTA ─── */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-2xl mx-auto text-center">
          <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/audit"
              className="px-8 py-3.5 rounded-xl font-semibold text-base text-white bg-gradient-to-br from-violet-500 to-indigo-600 hover:from-violet-400 hover:to-indigo-500 active:scale-[0.98] transition-[color,background-color,transform] focus-ring shadow-lg shadow-violet-600/25 glow-violet-sm"
            >
              Try It on Your Code
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Categories ─── */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-3 text-center">Coverage</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center text-gray-900 dark:text-zinc-100 mb-10">
            {agents.length} audits across {CATEGORIES.length} domains
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-w-4xl mx-auto">
            {CATEGORIES.map((cat) => (
              <div
                key={cat.name}
                className={`group flex items-start gap-3 p-4 rounded-xl glass border-l-4 ${cat.border} hover:shadow-lg ${cat.glow} transition-shadow duration-200`}
              >
                <span className="text-xl leading-none mt-0.5 group-hover:scale-110 transition-transform" aria-hidden="true">{cat.icon}</span>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-sm font-semibold text-gray-900 dark:text-zinc-100">{cat.name}</span>
                    <span className="text-xs font-mono text-gray-400 dark:text-zinc-500 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full">{categoryCounts[cat.name] ?? 0}</span>
                  </div>
                  <p className="text-xs text-gray-500 dark:text-zinc-400 leading-relaxed">{cat.description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Agent search + grid ─── */}
      <section id="agents" className="scroll-mt-20 px-4 sm:px-6 pb-24">
        <div className="max-w-5xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-3 text-center">Browse</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center text-gray-900 dark:text-zinc-100 mb-8">
            Find an audit
          </h2>
          <HomeSearch agents={agents} featuredAgents={featuredAgents} />
        </div>
      </section>

      {/* ─── FAQ ─── */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <p className="text-xs font-semibold uppercase tracking-widest text-violet-500 dark:text-violet-400 mb-3 text-center">FAQ</p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-center text-gray-900 dark:text-zinc-100 mb-10">
            Frequently asked questions
          </h2>
          <div className="divide-y divide-gray-200 dark:divide-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-800 overflow-hidden">
            {FAQ_ITEMS.map((item) => (
              <details key={item.q} className="group bg-white dark:bg-zinc-900/80">
                <summary className="flex items-center justify-between cursor-pointer list-none px-6 py-4 text-sm font-semibold text-gray-900 dark:text-zinc-100 hover:text-violet-600 dark:hover:text-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-950/20 transition-colors">
                  {item.q}
                  <svg className="w-4 h-4 text-gray-400 dark:text-zinc-500 group-open:rotate-180 transition-transform shrink-0 ml-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="text-sm text-gray-600 dark:text-zinc-400 leading-relaxed px-6 pb-5 pt-1">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ─── Final CTA ─── */}
      <section className="px-4 sm:px-6 pb-24">
        <div className="max-w-3xl mx-auto">
          <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-violet-600 via-indigo-600 to-violet-700 p-10 sm:p-14 text-center shadow-2xl shadow-violet-600/30">
            {/* Background decoration */}
            <div className="absolute -top-16 -right-16 w-64 h-64 bg-white/10 rounded-full blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-16 -left-16 w-64 h-64 bg-indigo-300/10 rounded-full blur-3xl" aria-hidden="true" />
            <div className="absolute inset-0 bg-grid-pattern opacity-20" aria-hidden="true" />

            <div className="relative">
              <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                Your next deploy could be safer
              </h2>
              <p className="text-violet-200 text-sm sm:text-base mb-8 max-w-md mx-auto">
                Paste code — most audits stream in under 60 seconds. No account, no credit card.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                <Link
                  href="/audit"
                  className="inline-block px-8 py-3.5 rounded-xl font-semibold text-base text-violet-700 bg-white hover:bg-violet-50 active:scale-[0.98] transition-[color,background-color,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-violet-600 shadow-lg whitespace-nowrap"
                >
                  Audit Your Code
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
