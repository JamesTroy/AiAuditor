import type { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Claudit collects, uses, and protects your data. GDPR-compliant, no tracking, EU-hosted.',
  alternates: { canonical: '/privacy' },
  openGraph: {
    title: 'Privacy Policy — Claudit',
    description: 'How Claudit collects, uses, and protects your data. GDPR-compliant, no tracking, EU-hosted.',
    url: '/privacy',
  },
};

export default function PrivacyPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-500 mb-10">Last updated: March 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-gray-700 dark:text-zinc-300">
          {/* 1. Controller */}
          <Section title="1. Who we are">
            <p>
              Claudit (&quot;we&quot;, &quot;us&quot;, &quot;our&quot;) operates the website at{' '}
              <strong>claudit.consulting</strong>. We are the data controller for personal data
              processed through this service.
            </p>
            <p>
              For privacy inquiries, contact us at{' '}
              <a href="mailto:privacy@claudit.consulting" className="text-violet-600 dark:text-violet-400 underline">
                privacy@claudit.consulting
              </a>.
            </p>
          </Section>

          {/* 2. Data we collect */}
          <Section title="2. Data we collect">
            <p>We collect the following categories of personal data:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Account data</strong> &mdash; name, email address, and hashed password when you create an account. If you sign in with GitHub or Google, we receive your name, email, and profile picture from the provider.</li>
              <li><strong>Audit data</strong> &mdash; code snippets or website URLs you submit for analysis, and the AI-generated audit reports. Audit results are stored in your account history.</li>
              <li><strong>Usage data</strong> &mdash; pages visited, audit counts, and scores displayed on your dashboard. We do not use third-party analytics trackers.</li>
              <li><strong>Technical data</strong> &mdash; IP address (anonymized in logs), browser type, and device information transmitted automatically with every HTTP request.</li>
            </ul>
          </Section>

          {/* 3. How we use your data */}
          <Section title="3. How we use your data">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Provide the service</strong> &mdash; your submitted code or URL is sent to Anthropic&apos;s Claude API for AI analysis. Results are streamed back to you and stored in your account. <em>Lawful basis: performance of a contract (GDPR Art. 6(1)(b)).</em></li>
              <li><strong>Account management</strong> &mdash; authentication, password resets, and email verification. <em>Lawful basis: performance of a contract.</em></li>
              <li><strong>Security</strong> &mdash; rate limiting, abuse prevention, and CSP violation monitoring. <em>Lawful basis: legitimate interests (GDPR Art. 6(1)(f)).</em></li>
            </ul>
          </Section>

          {/* 4. Third-party processors */}
          <Section title="4. Third-party processors">
            <p>We share data with the following processors, each under a Data Processing Agreement:</p>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full text-sm border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
                <thead>
                  <tr className="bg-gray-50 dark:bg-zinc-900/50 border-b border-gray-200 dark:border-zinc-800">
                    <th className="text-left px-4 py-2 font-semibold">Processor</th>
                    <th className="text-left px-4 py-2 font-semibold">Purpose</th>
                    <th className="text-left px-4 py-2 font-semibold">Data shared</th>
                    <th className="text-left px-4 py-2 font-semibold">Location</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                  <tr>
                    <td className="px-4 py-2">Anthropic</td>
                    <td className="px-4 py-2">AI code analysis</td>
                    <td className="px-4 py-2">Submitted code/URLs</td>
                    <td className="px-4 py-2">United States</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Supabase</td>
                    <td className="px-4 py-2">Database hosting</td>
                    <td className="px-4 py-2">Account data, audit history</td>
                    <td className="px-4 py-2">EU (Frankfurt)</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2">Railway</td>
                    <td className="px-4 py-2">Application hosting</td>
                    <td className="px-4 py-2">Request metadata (IP, headers)</td>
                    <td className="px-4 py-2">United States</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <p className="mt-3">
              For US-based processors, transfers are governed by EU Standard Contractual Clauses (SCCs).
              Anthropic&apos;s API is configured to not use submitted data for model training.
            </p>
          </Section>

          {/* 5. Data retention */}
          <Section title="5. Data retention">
            <ul className="list-disc pl-5 space-y-1.5">
              <li><strong>Account data</strong> &mdash; retained for the duration of your account, plus 30 days after deletion.</li>
              <li><strong>Audit results</strong> &mdash; retained for the duration of your account. You can delete individual audits from your history.</li>
              <li><strong>Session data</strong> &mdash; expires after 30 days of inactivity.</li>
              <li><strong>Server logs</strong> &mdash; anonymized IP addresses retained for 30 days, then deleted.</li>
              <li><strong>Submitted code</strong> &mdash; sent to Anthropic for analysis and not stored on our servers beyond the truncated input saved with your audit record. Anthropic does not retain API inputs beyond their standard processing window.</li>
            </ul>
          </Section>

          {/* 6. Your rights */}
          <Section title="6. Your rights">
            <p>Under GDPR, CCPA/CPRA, and applicable privacy laws, you have the right to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Access</strong> your personal data &mdash; view your data on the <Link href="/dashboard" className="text-violet-600 dark:text-violet-400 underline">Dashboard</Link>, or request a full export.</li>
              <li><strong>Rectify</strong> inaccurate data &mdash; update your name in <Link href="/settings" className="text-violet-600 dark:text-violet-400 underline">Settings</Link>.</li>
              <li><strong>Delete</strong> your account and all associated data &mdash; use the &quot;Delete Account&quot; option in <Link href="/settings" className="text-violet-600 dark:text-violet-400 underline">Settings</Link>. Deletion is completed within 30 days.</li>
              <li><strong>Export</strong> your data &mdash; audit reports can be downloaded as Markdown or JSON.</li>
              <li><strong>Object</strong> to processing based on legitimate interests.</li>
              <li><strong>Restrict</strong> processing while a dispute is being resolved.</li>
              <li><strong>Withdraw consent</strong> at any time where consent is the lawful basis.</li>
            </ul>
            <p className="mt-3">
              To exercise any right, email{' '}
              <a href="mailto:privacy@claudit.consulting" className="text-violet-600 dark:text-violet-400 underline">
                privacy@claudit.consulting
              </a>. We will respond within 30 days. You also have the right to lodge a complaint with your local data protection authority.
            </p>
          </Section>

          {/* 7. Cookies */}
          <Section title="7. Cookies and local storage">
            <p>We use only essential cookies and browser storage:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li><strong>Session cookie</strong> &mdash; authenticates your login session. Essential, no consent required.</li>
              <li><strong>Theme preference</strong> &mdash; stored in localStorage (never sent to the server). Not a cookie.</li>
              <li><strong>Audit history</strong> &mdash; recent audit results cached in localStorage for offline access. Not transmitted to the server.</li>
            </ul>
            <p className="mt-2">
              We do not use analytics cookies, advertising trackers, or any third-party tracking scripts.
            </p>
          </Section>

          {/* 8. Security */}
          <Section title="8. Security measures">
            <ul className="list-disc pl-5 space-y-1.5">
              <li>All data transmitted over HTTPS with TLS 1.3.</li>
              <li>Content Security Policy with per-request nonces to prevent XSS.</li>
              <li>Passwords hashed with bcrypt; never stored in plaintext.</li>
              <li>Two-factor authentication (TOTP) available for all accounts.</li>
              <li>Database encrypted at rest with daily backups.</li>
              <li>Rate limiting on all API endpoints.</li>
              <li>IP addresses anonymized before logging.</li>
            </ul>
          </Section>

          {/* 9. Code submissions */}
          <Section title="9. Submitted code and PII">
            <p>
              Source code you submit for auditing may contain personal data (names, emails, API keys, internal identifiers).
              We recommend removing credentials and sensitive data before submitting code for analysis.
            </p>
            <p>
              Submitted code is forwarded to Anthropic&apos;s Claude API for analysis. Anthropic processes this data
              under their API terms and does not use it for model training. We store only a truncated snippet
              (first 10,000 characters) alongside your audit record for reference.
            </p>
          </Section>

          {/* 10. Children */}
          <Section title="10. Children">
            <p>
              Claudit is not intended for use by anyone under the age of 16. We do not knowingly collect
              personal data from children.
            </p>
          </Section>

          {/* 11. Changes */}
          <Section title="11. Changes to this policy">
            <p>
              We may update this privacy policy from time to time. Material changes will be communicated
              via email to registered users. The &quot;Last updated&quot; date at the top reflects the most recent revision.
            </p>
          </Section>

          {/* Contact */}
          <div className="bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 mt-6">
            <p className="font-semibold text-gray-900 dark:text-zinc-100 mb-1">Questions?</p>
            <p>
              Contact our privacy team at{' '}
              <a href="mailto:privacy@claudit.consulting" className="text-violet-600 dark:text-violet-400 underline">
                privacy@claudit.consulting
              </a>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-gray-900 dark:text-zinc-100 mb-3">{title}</h2>
      <div className="space-y-2">{children}</div>
    </section>
  );
}
