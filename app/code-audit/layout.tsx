import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Full Code Audit — Claudit',
  description:
    'Paste any code and get a comprehensive audit across security, performance, accessibility, SQL, API design, and 120+ more specialized checks — all running simultaneously.',
  alternates: { canonical: '/code-audit' },
  openGraph: {
    title: 'Full Code Audit — Claudit',
    description:
      'Paste any code and get a comprehensive audit across security, performance, accessibility, SQL, API design, and 120+ more specialized checks — all running simultaneously.',
    url: '/code-audit',
  },
};

export default function CodeAuditLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
