import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Full Site Audit',
  description: 'Enter a website URL and get an instant AI-powered audit across security, SEO, accessibility, performance, responsive design, and code quality.',
};

export default function SiteAuditLayout({ children }: { children: React.ReactNode }) {
  return children;
}
