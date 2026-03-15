import type { Metadata } from 'next';
import Link from 'next/link';

export const dynamic = 'force-static';

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'Terms and conditions for using the Claudit AI code auditing platform.',
  alternates: { canonical: '/terms' },
  openGraph: {
    title: 'Terms of Service — Claudit',
    description: 'Terms and conditions for using the Claudit AI code auditing platform.',
    url: '/terms',
  },
};

export default function TermsPage() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-3xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-sm text-gray-500 dark:text-zinc-500 mb-10">Last updated: March 2026</p>

        <div className="space-y-10 text-sm leading-relaxed text-gray-700 dark:text-zinc-300">
          <Section title="1. Acceptance of terms">
            <p>
              By accessing or using Claudit (&quot;the Service&quot;), you agree to be bound by these Terms of
              Service. If you do not agree, you may not use the Service.
            </p>
          </Section>

          <Section title="2. Description of Service">
            <p>
              Claudit provides AI-powered code and website auditing. You submit code snippets, files,
              or URLs, and our system returns structured findings and recommendations. The Service is
              provided &quot;as is&quot; and is intended as a supplementary tool, not a replacement for
              professional security assessments or code reviews.
            </p>
          </Section>

          <Section title="3. Account registration">
            <p>
              To use certain features, you must create an account with accurate information. You are
              responsible for maintaining the confidentiality of your login credentials and for all
              activity under your account.
            </p>
          </Section>

          <Section title="4. Acceptable use">
            <p>You agree not to:</p>
            <ul className="list-disc pl-5 space-y-1.5 mt-2">
              <li>Use the Service to develop malware, exploits, or attack tools.</li>
              <li>Submit code or content that you do not have the right to share.</li>
              <li>Attempt to circumvent rate limits, access controls, or security measures.</li>
              <li>Reverse-engineer, scrape, or programmatically access the Service beyond the provided interface.</li>
              <li>Use the Service in any way that violates applicable laws or regulations.</li>
            </ul>
          </Section>

          <Section title="5. Intellectual property">
            <p>
              You retain ownership of all code and content you submit. Claudit does not claim any
              intellectual property rights over your submissions. AI-generated audit reports are provided
              for your use and may be shared, exported, or archived as you see fit.
            </p>
          </Section>

          <Section title="6. Data handling">
            <p>
              Your data is handled in accordance with our{' '}
              <Link href="/privacy" className="text-violet-600 dark:text-violet-400 underline">
                Privacy Policy
              </Link>. Submitted code is sent to our AI provider for analysis and is not retained beyond the
              audit session. Audit results are stored in your account until you delete them.
            </p>
          </Section>

          <Section title="7. Limitation of liability">
            <p>
              The Service is provided for informational purposes only. Claudit does not guarantee the
              accuracy, completeness, or reliability of any audit findings. We are not liable for any
              damages arising from your use of or reliance on the Service, including but not limited to
              security incidents, data loss, or business interruption.
            </p>
            <p>
              To the maximum extent permitted by law, Claudit&apos;s total liability shall not exceed the
              amount you have paid for the Service in the twelve months preceding the claim.
            </p>
          </Section>

          <Section title="8. Service availability">
            <p>
              We strive to maintain high availability but do not guarantee uninterrupted access. We may
              modify, suspend, or discontinue any part of the Service at any time with reasonable notice.
              Scheduled maintenance will be communicated in advance when possible.
            </p>
          </Section>

          <Section title="9. Termination">
            <p>
              You may delete your account at any time from your{' '}
              <Link href="/settings" className="text-violet-600 dark:text-violet-400 underline">
                Settings
              </Link> page. We may suspend or terminate accounts that violate these terms. Upon
              termination, your data will be deleted in accordance with our retention policy.
            </p>
          </Section>

          <Section title="10. Changes to these terms">
            <p>
              We may update these terms from time to time. Material changes will be communicated via
              email to registered users at least 30 days before taking effect. Continued use of the
              Service after changes take effect constitutes acceptance of the revised terms.
            </p>
          </Section>

          <Section title="11. Governing law">
            <p>
              These terms are governed by the laws of the jurisdiction in which Claudit operates.
              Any disputes shall be resolved through binding arbitration or in the courts of that
              jurisdiction.
            </p>
          </Section>

          <div className="bg-gray-50 dark:bg-zinc-900/50 border border-gray-200 dark:border-zinc-800 rounded-xl p-5 mt-6">
            <p className="font-semibold text-gray-900 dark:text-zinc-100 mb-1">Questions?</p>
            <p>
              Contact us at{' '}
              <a href="mailto:support@claudit.consulting" className="text-violet-600 dark:text-violet-400 underline">
                support@claudit.consulting
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
