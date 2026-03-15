import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Full Site Audit',
  description: 'Enter a website URL and run security, SEO, accessibility, and performance audits — severity-rated findings with specific fixes.',
  alternates: { canonical: '/site-audit' },
  openGraph: {
    title: 'Full Site Audit — Claudit',
    description: 'Enter any URL and run up to 20 audits at once — security, SEO, accessibility, performance, and more.',
    url: '/site-audit',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Full Site Audit — Claudit',
    description: 'Enter any URL and run up to 20 audits at once — security, SEO, accessibility, performance, and more.',
  },
};

export default function SiteAuditLayout({ children }: { children: React.ReactNode }) {
  return children;
}
