import type { Metadata } from 'next';
import { BreadcrumbJsonLd } from '@/components/JsonLd';

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.consulting';

export const metadata: Metadata = {
  title: 'Full Site Audit',
  description: 'Enter a website URL and run security, SEO, accessibility, and performance audits — severity-rated findings with specific fixes.',
  alternates: { canonical: '/site-audit' },
  openGraph: {
    title: 'Full Site Audit — Claudit',
    description: 'Enter any URL and run security, SEO, accessibility, and performance audits — severity-rated findings with specific fixes.',
    url: '/site-audit',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Full Site Audit — Claudit',
    description: 'Enter any URL and run security, SEO, accessibility, and performance audits — severity-rated findings with specific fixes.',
  },
};

export default function SiteAuditLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <BreadcrumbJsonLd
        items={[
          { name: 'Claudit', url: BASE_URL },
          { name: 'Site Audit', url: `${BASE_URL}/site-audit` },
        ]}
      />
      {children}
    </>
  );
}
