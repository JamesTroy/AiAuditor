import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { LandingNav } from '@/components/landing/LandingNav';
import { HeroSection } from '@/components/landing/HeroSection';
import { ProofStrip, HowItWorks, Features, Testimonials } from '@/components/landing/Sections';
import { Pricing, CtaSection, LandingFooter } from '@/components/landing/PricingFooter';

export const metadata: Metadata = {
  title: 'Claudit \u2014 AI code auditor. 193 specialized auditors.',
  description:
    'Find what your code review missed. 193 specialized AI auditors check your code for security holes, performance issues, and bad patterns \u2014 with exact fix guidance. Results in under 60 seconds.',
  openGraph: {
    title: 'Claudit \u2014 Find what your code review missed',
    description: '193 specialized AI auditors. Severity-ranked findings. Exact fix guidance. Under 60 seconds.',
    url: '/',
  },
};

export default async function LandingPage() {
  // The landing page is for logged-out visitors only. Authenticated users go
  // straight to their dashboard — the symmetric move to /dashboard redirecting
  // unauthenticated visitors to /login.
  const session = await auth.api.getSession({ headers: await headers() }).catch(() => null);
  if (session) redirect('/dashboard');

  return (
    <div className="bg-zinc-950 text-zinc-100">
      <LandingNav isLoggedIn={false} />

      <main>
        <HeroSection isLoggedIn={false} />
        <ProofStrip />
        <HowItWorks />
        <Features />
        <Testimonials />
        <Pricing />
        <CtaSection />
      </main>

      <LandingFooter />
    </div>
  );
}
