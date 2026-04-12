import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import Link from 'next/link';
import { HeroSection } from '@/components/landing/HeroSection';
import { ProofStrip, HowItWorks, Features, Testimonials } from '@/components/landing/Sections';
import { Pricing, CtaSection } from '@/components/landing/PricingFooter';
import { GlobalJsonLd } from '@/components/JsonLd';

export const metadata: Metadata = {
  title: 'Claudit \u2014 AI code auditor. 190 specialized auditors.',
  description:
    'Find what your code review missed. 190 specialized AI auditors check your code for security holes, performance issues, and bad patterns \u2014 with exact fix guidance. Results in under 60 seconds.',
  openGraph: {
    title: 'Claudit \u2014 Find what your code review missed',
    description: '190 specialized AI auditors. Severity-ranked findings. Exact fix guidance. Under 60 seconds.',
    url: '/',
  },
};

export default async function LandingPage() {
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  const isLoggedIn = !!session;
  const firstName = session?.user?.name?.split(' ')[0] ?? null;

  return (
    <div className="bg-zinc-950 text-zinc-100 -mt-[1px]">
      {/* Logged-in welcome banner */}
      {isLoggedIn && (
        <div className="bg-violet-600 border-b border-violet-500/60 py-2.5 px-6 flex items-center justify-center gap-4">
          <span className="text-sm text-violet-100">
            Welcome back{firstName ? `, ${firstName}` : ''}.
          </span>
          <Link href="/dashboard" className="text-sm font-medium text-white underline underline-offset-2 hover:no-underline">
            Go to your dashboard &rarr;
          </Link>
        </div>
      )}

      <main>
        <HeroSection isLoggedIn={isLoggedIn} />
        <ProofStrip />
        <HowItWorks />
        <Features />
        <Testimonials />
        <Pricing />
        <CtaSection />
      </main>
    </div>
  );
}
