import type { Metadata } from 'next';
import { BreadcrumbJsonLd } from '@/components/JsonLd';
import { agents } from '@/lib/agents/registry';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.consulting';

export const metadata: Metadata = {
  title: 'Audit',
  description: `Paste code or enter a URL — get a severity-rated report from ${agents.length}+ specialized auditors covering security, performance, accessibility, SEO, and compliance. Results stream in real time.`,
  alternates: { canonical: '/audit' },
  openGraph: {
    title: 'Audit Your Code or Site — Claudit',
    description: `Paste code or enter a URL — get a severity-rated report from ${agents.length}+ specialized auditors. Results stream in real time.`,
    url: '/audit',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Audit Your Code or Site — Claudit',
    description: `Paste code or enter a URL — get a severity-rated report from ${agents.length}+ specialized auditors. Results stream in real time.`,
  },
};

export default function AuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Claudit', url: BASE_URL },
          { name: 'Audit', url: `${BASE_URL}/audit` },
        ]}
      />
      {children}
    </>
  );
}
