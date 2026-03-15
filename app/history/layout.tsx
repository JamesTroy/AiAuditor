import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Audit History',
  description: 'Browse your past code audits stored locally in your browser.',
  openGraph: {
    title: 'Audit History — Claudit',
    description: 'Browse your past code audits stored locally in your browser.',
    url: '/history',
  },
};

export default function HistoryLayout({ children }: { children: React.ReactNode }) {
  return children;
}
