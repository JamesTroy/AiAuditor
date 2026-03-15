import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Full Site Audit',
  description: 'Enter a website URL and get an instant AI-powered audit across security, SEO, accessibility, performance, responsive design, and code quality.',
  alternates: { canonical: '/site-audit' },
  openGraph: {
    title: 'Full Site Audit — Claudit',
    description: 'Enter any URL and run up to 20 AI audits at once — security, SEO, accessibility, performance, and more.',
    url: '/site-audit',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Full Site Audit — Claudit',
    description: 'Enter any URL and run up to 20 AI audits at once — security, SEO, accessibility, performance, and more.',
  },
};

export default function SiteAuditLayout({ children }: { children: React.ReactNode }) {
  return children;
}
