import Link from 'next/link';

const CHECK = '✓';
const X = '✗';

export default function StackPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 text-sm mb-8 inline-flex items-center gap-1 transition-colors"
        >
          ← Back to audits
        </Link>

        {/* Hero */}
        <div className="mb-12">
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight mb-3">
            The Stack Behind Claudit
          </h1>
          <p className="text-lg text-gray-600 dark:text-zinc-400 max-w-2xl">
            A production-ready, GDPR-compliant auth and database setup for Next.js — designed for developers who want to ship fast without cutting corners on security.
          </p>
        </div>

        {/* Recommended Stack */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Recommended Stack</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <StackCard
              layer="Authentication"
              choice="Better Auth"
              description="Open-source, self-hosted auth with plugins for admin roles, 2FA, and organizations. The successor to NextAuth.js — built by the same team."
              color="violet"
            />
            <StackCard
              layer="Database"
              choice="PostgreSQL on Supabase"
              description="Managed Postgres with built-in auth, storage, and realtime. Generous free tier, EU regions for GDPR, and a full REST/GraphQL API alongside direct SQL access."
              color="blue"
            />
            <StackCard
              layer="ORM"
              choice="Drizzle ORM"
              description="7KB bundle (vs Prisma's 2MB). No codegen step, native edge runtime support, and SQL-like syntax with full TypeScript type safety."
              color="emerald"
            />
            <StackCard
              layer="Email"
              choice="Resend"
              description="Modern email API for transactional emails. Free up to 3,000 emails/day. Handles verification emails, password resets, and 2FA codes."
              color="amber"
            />
          </div>
        </section>

        {/* Why this beats the alternatives */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Why This Beats the Alternatives</h2>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                    <th className="text-left px-5 py-3 font-semibold text-gray-700 dark:text-zinc-300">Feature</th>
                    <th className="text-center px-4 py-3 font-semibold text-violet-600 dark:text-violet-400">Better Auth</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500 dark:text-zinc-500">NextAuth v5</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500 dark:text-zinc-500">Clerk</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500 dark:text-zinc-500">Supabase Auth</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  <ComparisonRow feature="Self-hosted (you own the data)" better="yes" next="yes" clerk="no" supa="partial" />
                  <ComparisonRow feature="EU data residency" better="yes" next="yes" clerk="no" supa="yes" />
                  <ComparisonRow feature="Admin roles & user management" better="yes" next="no" clerk="yes" supa="no" />
                  <ComparisonRow feature="Built-in 2FA (TOTP)" better="yes" next="no" clerk="yes" supa="no" />
                  <ComparisonRow feature="Organizations & teams" better="yes" next="no" clerk="yes" supa="no" />
                  <ComparisonRow feature="Email verification" better="yes" next="yes" clerk="yes" supa="yes" />
                  <ComparisonRow feature="OAuth providers" better="yes" next="yes" clerk="yes" supa="yes" />
                  <ComparisonRow feature="Active maintenance" better="yes" next="no" clerk="yes" supa="yes" />
                  <ComparisonRow feature="No vendor lock-in" better="yes" next="yes" clerk="no" supa="partial" />
                  <ComparisonRow feature="Free at any scale" better="yes" next="yes" clerk="no" supa="partial" />
                  <ComparisonRow feature="TypeScript-first" better="yes" next="partial" clerk="yes" supa="partial" />
                  <ComparisonRow feature="Next.js App Router support" better="yes" next="yes" clerk="yes" supa="yes" />
                </tbody>
              </table>
            </div>
          </div>

          <div className="mt-6 space-y-4">
            <AlternativeNote
              name="NextAuth.js (Auth.js v5)"
              emoji="⚠️"
              note="In maintenance mode since early 2025. The lead maintainer left and the project was absorbed into Better Auth. Still receives security patches, but no new features. Starting a new project on Auth.js in 2026 is inadvisable."
            />
            <AlternativeNote
              name="Clerk"
              emoji="💸"
              note="Excellent DX and beautiful pre-built UI, but no EU data residency (GDPR risk), and pricing climbs fast: $1,825/mo at 100K users, $19,825/mo at 1M users. Your entire user system lives on their infrastructure — migration means rebuilding from scratch."
            />
            <AlternativeNote
              name="Supabase Auth"
              emoji="🔒"
              note="Strong contender with EU hosting and a generous free tier. Falls short on admin roles, 2FA, and organization management — you'd build these yourself. Auth is coupled to Supabase's platform, making future migration harder."
            />
            <AlternativeNote
              name="Lucia Auth"
              emoji="🪦"
              note="Deprecated in March 2025. The author converted it into an educational resource. Do not use for new projects."
            />
            <AlternativeNote
              name="Custom (bcrypt + JWT)"
              emoji="🔧"
              note="Rolling your own auth means implementing OAuth, email verification, password reset, 2FA, session management, CSRF protection, rate limiting, and account enumeration prevention. The surface area for security mistakes is enormous. Better Auth already solves all of this with battle-tested code."
            />
          </div>
        </section>

        {/* What Better Auth gives you */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">What Better Auth Gives You Out of the Box</h2>
          <p className="text-gray-600 dark:text-zinc-400 mb-6">
            Better Auth uses a plugin system — you add only what you need. Here&apos;s what powers Claudit:
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <PluginCard
              name="Core"
              tag="Built-in"
              features={[
                'Email & password authentication',
                'Session management (in your database)',
                'Password hashing (bcrypt/argon2)',
                'CSRF protection',
                'Rate limiting on auth endpoints',
                'Account enumeration prevention',
              ]}
            />
            <PluginCard
              name="OAuth"
              tag="Built-in"
              features={[
                'GitHub, Google, and 20+ providers',
                'OAuth2 + PKCE flow',
                'Account linking (same email)',
                'State parameter CSRF protection',
                'Automatic profile sync',
              ]}
            />
            <PluginCard
              name="Admin Plugin"
              tag="Plugin"
              features={[
                'User roles (user, admin, custom)',
                'Ban/unban users with reasons',
                'User impersonation for debugging',
                'Admin-only endpoints',
                'User management API',
              ]}
            />
            <PluginCard
              name="Two-Factor (2FA)"
              tag="Plugin"
              features={[
                'TOTP authenticator app support',
                'Backup recovery codes',
                'OTP via email/SMS',
                'Per-user enable/disable',
                'Remember trusted devices',
              ]}
            />
            <PluginCard
              name="Email Verification"
              tag="Built-in"
              features={[
                'Verification link on signup',
                'Configurable expiry time',
                'Resend verification endpoint',
                'Custom email templates (via Resend)',
                'Require verification before access',
              ]}
            />
            <PluginCard
              name="Password Reset"
              tag="Built-in"
              features={[
                'Secure reset token generation',
                'Configurable token expiry',
                'Rate-limited reset requests',
                'Custom reset email templates',
                'Token invalidation after use',
              ]}
            />
          </div>

          <div className="mt-6 bg-violet-50 dark:bg-violet-950/20 border border-violet-200 dark:border-violet-900/50 rounded-xl p-5">
            <p className="text-sm font-medium text-violet-800 dark:text-violet-300 mb-1">
              Also available (not used in this project)
            </p>
            <p className="text-sm text-violet-700 dark:text-violet-400">
              Organization & teams plugin, Magic link auth, Phone/SMS auth, Passkeys (WebAuthn),
              API key management, Session impersonation, and more. See the{' '}
              <a
                href="https://better-auth.com/docs/plugins"
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-violet-500"
              >
                Better Auth plugin directory
              </a>.
            </p>
          </div>
        </section>

        {/* Cost breakdown */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Cost: ~$30/mo</h2>
          <p className="text-gray-600 dark:text-zinc-400 mb-6">
            A production-ready stack with auth, database, hosting, and email — for less than a Netflix subscription.
          </p>

          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/50">
                  <th className="text-left px-5 py-3 font-semibold text-gray-700 dark:text-zinc-300">Service</th>
                  <th className="text-left px-5 py-3 font-semibold text-gray-700 dark:text-zinc-300">Plan</th>
                  <th className="text-right px-5 py-3 font-semibold text-gray-700 dark:text-zinc-300">Monthly</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                <CostRow service="Supabase" plan="Pro (8GB DB, daily backups, EU region)" cost="$25" />
                <CostRow service="Railway" plan="Pro (hosting, usage-based)" cost="$5" />
                <CostRow service="Better Auth" plan="Open source — forever free" cost="$0" />
                <CostRow service="Drizzle ORM" plan="Open source — forever free" cost="$0" />
                <CostRow service="Resend" plan="Free tier (3,000 emails/day)" cost="$0" />
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-gray-200 dark:border-zinc-700 bg-gray-50 dark:bg-zinc-900/50">
                  <td colSpan={2} className="px-5 py-3 font-bold text-gray-900 dark:text-zinc-100">Total</td>
                  <td className="text-right px-5 py-3 font-bold text-violet-600 dark:text-violet-400 text-lg">~$30/mo</td>
                </tr>
              </tfoot>
            </table>
          </div>

          <div className="mt-6 grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-zinc-500 mb-2">
                For comparison: Clerk
              </p>
              <div className="space-y-1 text-sm text-gray-600 dark:text-zinc-400">
                <p>10K users: <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">Free</span></p>
                <p>50K users: <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">$825/mo</span></p>
                <p>100K users: <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">$1,825/mo</span></p>
                <p>1M users: <span className="font-mono font-bold text-red-600 dark:text-red-400">$19,825/mo</span></p>
              </div>
            </div>
            <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
              <p className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-zinc-500 mb-2">
                This stack at scale
              </p>
              <div className="space-y-1 text-sm text-gray-600 dark:text-zinc-400">
                <p>10K users: <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">~$30/mo</span></p>
                <p>50K users: <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">~$50/mo</span></p>
                <p>100K users: <span className="font-mono font-bold text-gray-900 dark:text-zinc-100">~$80/mo</span></p>
                <p>1M users: <span className="font-mono font-bold text-green-600 dark:text-green-400">~$200/mo</span></p>
              </div>
            </div>
          </div>
        </section>

        {/* Getting started */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Get Started in 5 Minutes</h2>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6">
            <ol className="space-y-4 text-sm">
              <StepItem
                number={1}
                title="Get your Supabase connection string"
                description="Go to your Supabase project → Settings → Database → Connection string (URI). Copy it and use it as DATABASE_URL."
              />
              <StepItem
                number={2}
                title="Add environment variables"
                description="Copy .env.example to .env.local. Add your DATABASE_URL, generate a BETTER_AUTH_SECRET with `openssl rand -base64 32`, and add your ANTHROPIC_API_KEY."
              />
              <StepItem
                number={3}
                title="Push the database schema"
                description="Run `npx drizzle-kit push` to create all tables in your Supabase database. This creates user, session, account, verification, twoFactor, and audit tables."
              />
              <StepItem
                number={4}
                title="Start the dev server"
                description="Run `npm run dev` and open localhost:3000. Sign up for an account — you're live."
              />
              <StepItem
                number={5}
                title="Add OAuth (optional)"
                description="Create OAuth apps on GitHub and Google, add the client IDs and secrets to .env.local. The login page will automatically show the OAuth buttons."
              />
            </ol>
          </div>
        </section>

        {/* Architecture diagram */}
        <section className="mb-12">
          <h2 className="text-2xl font-bold mb-6">Architecture</h2>
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-6">
            <pre className="text-xs sm:text-sm font-mono text-gray-700 dark:text-zinc-300 overflow-x-auto leading-relaxed">{`┌─────────────────────────────────────────────────┐
│  Next.js 15 App Router                          │
│  ├── app/                                       │
│  │   ├── (auth)/login/signup/reset/             │
│  │   ├── dashboard/  settings/  admin/          │
│  │   ├── api/                                   │
│  │   │   ├── auth/[...all]/   ← Better Auth     │
│  │   │   └── audit/           ← Claude API      │
│  │   └── layout.tsx                             │
│  ├── lib/                                       │
│  │   ├── auth.ts        ← Better Auth config    │
│  │   ├── auth-client.ts ← React hooks           │
│  │   ├── auth-schema.ts ← Drizzle schema        │
│  │   └── db.ts          ← Drizzle + Neon client │
│  └── middleware.ts      ← CSP + auth gate       │
├─────────────────────────────────────────────────┤
│  Better Auth (self-hosted, in-process)          │
│  Plugins: admin, 2FA, email verification        │
├─────────────────────────────────────────────────┤
│  Drizzle ORM (7KB, no codegen)                  │
├─────────────────────────────────────────────────┤
│  Supabase PostgreSQL (managed, EU region)        │
└─────────────────────────────────────────────────┘`}</pre>
          </div>
        </section>

        <footer className="text-center text-sm text-gray-400 dark:text-zinc-600 py-8 border-t border-gray-200 dark:border-zinc-800">
          Built with the stack above. View the source code to see exactly how it all fits together.
        </footer>
      </div>
    </main>
  );
}

// ─── Components ─────────────────────────────────────────────────

function StackCard({ layer, choice, description, color }: {
  layer: string;
  choice: string;
  description: string;
  color: string;
}) {
  const colors: Record<string, string> = {
    violet: 'border-violet-200 dark:border-violet-900/50 bg-violet-50 dark:bg-violet-950/20',
    blue: 'border-blue-200 dark:border-blue-900/50 bg-blue-50 dark:bg-blue-950/20',
    emerald: 'border-emerald-200 dark:border-emerald-900/50 bg-emerald-50 dark:bg-emerald-950/20',
    amber: 'border-amber-200 dark:border-amber-900/50 bg-amber-50 dark:bg-amber-950/20',
  };
  const textColors: Record<string, string> = {
    violet: 'text-violet-700 dark:text-violet-300',
    blue: 'text-blue-700 dark:text-blue-300',
    emerald: 'text-emerald-700 dark:text-emerald-300',
    amber: 'text-amber-700 dark:text-amber-300',
  };

  return (
    <div className={`border rounded-xl p-5 ${colors[color]}`}>
      <p className="text-xs font-mono uppercase tracking-widest text-gray-500 dark:text-zinc-500 mb-1">
        {layer}
      </p>
      <p className={`text-lg font-bold mb-2 ${textColors[color]}`}>{choice}</p>
      <p className="text-sm text-gray-600 dark:text-zinc-400">{description}</p>
    </div>
  );
}

function ComparisonRow({ feature, better, next, clerk, supa }: {
  feature: string;
  better: 'yes' | 'no' | 'partial';
  next: 'yes' | 'no' | 'partial';
  clerk: 'yes' | 'no' | 'partial';
  supa: 'yes' | 'no' | 'partial';
}) {
  function cell(value: 'yes' | 'no' | 'partial') {
    if (value === 'yes') return <span className="text-green-600 dark:text-green-400 font-bold">{CHECK}</span>;
    if (value === 'no') return <span className="text-red-500 dark:text-red-400">{X}</span>;
    return <span className="text-amber-500 dark:text-amber-400 text-xs font-medium">Partial</span>;
  }

  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
      <td className="px-5 py-2.5 text-gray-700 dark:text-zinc-300">{feature}</td>
      <td className="text-center px-4 py-2.5">{cell(better)}</td>
      <td className="text-center px-4 py-2.5">{cell(next)}</td>
      <td className="text-center px-4 py-2.5">{cell(clerk)}</td>
      <td className="text-center px-4 py-2.5">{cell(supa)}</td>
    </tr>
  );
}

function AlternativeNote({ name, emoji, note }: { name: string; emoji: string; note: string }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl px-5 py-4">
      <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 mb-1">
        {emoji} {name}
      </p>
      <p className="text-sm text-gray-600 dark:text-zinc-400">{note}</p>
    </div>
  );
}

function PluginCard({ name, tag, features }: { name: string; tag: string; features: string[] }) {
  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-3">
        <p className="text-sm font-bold text-gray-900 dark:text-zinc-100">{name}</p>
        <span className="text-[10px] font-mono uppercase tracking-widest px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-950/30 text-violet-600 dark:text-violet-400">
          {tag}
        </span>
      </div>
      <ul className="space-y-1.5">
        {features.map((f) => (
          <li key={f} className="text-sm text-gray-600 dark:text-zinc-400 flex items-start gap-2">
            <span className="text-green-500 dark:text-green-400 mt-0.5 shrink-0">{CHECK}</span>
            {f}
          </li>
        ))}
      </ul>
    </div>
  );
}

function CostRow({ service, plan, cost }: { service: string; plan: string; cost: string }) {
  return (
    <tr className="hover:bg-gray-50 dark:hover:bg-zinc-800/50">
      <td className="px-5 py-3 font-medium text-gray-900 dark:text-zinc-100">{service}</td>
      <td className="px-5 py-3 text-gray-500 dark:text-zinc-500">{plan}</td>
      <td className="text-right px-5 py-3 font-mono font-bold text-gray-900 dark:text-zinc-100">{cost}</td>
    </tr>
  );
}

function StepItem({ number, title, description }: { number: number; title: string; description: string }) {
  return (
    <li className="flex gap-4">
      <div className="shrink-0 w-7 h-7 rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center mt-0.5">
        {number}
      </div>
      <div>
        <p className="font-semibold text-gray-900 dark:text-zinc-100">{title}</p>
        <p className="text-gray-600 dark:text-zinc-400 mt-0.5">{description}</p>
      </div>
    </li>
  );
}
