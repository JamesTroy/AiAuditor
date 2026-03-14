import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import ThemeProvider from '@/components/ThemeProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SmoothScroll from '@/components/SmoothScroll';
import { GlobalJsonLd } from '@/components/JsonLd';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.dev';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'AI Code Audit Tool — Claudit',
    template: '%s | Claudit',
  },
  description:
    'Run instant AI code audits across security, quality, and performance — 50 specialized agents, results in seconds. Try it free.',
  manifest: '/site.webmanifest',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'Claudit',
    title: 'AI Code Audit Tool — Claudit',
    description:
      'Run instant AI code audits across security, quality, and performance — 50 specialized agents, results in seconds. Try it free.',
    url: BASE_URL,
    images: [{ url: '/og-default.png', width: 1200, height: 630, alt: 'Claudit — AI Code Audit Tool' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'AI Code Audit Tool — Claudit',
    description:
      'Run instant AI code audits across security, quality, and performance — 50 specialized agents, results in seconds.',
    images: ['/og-default.png'],
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // VULN-007: Read the per-request nonce injected by middleware.ts.
  // Next.js automatically stamps this onto its own inline hydration scripts,
  // removing the need for 'unsafe-inline' in script-src for modern browsers.
  // We surface it here so any next/script components added in the future can
  // receive it via <Script nonce={nonce} />.
  const nonce = (await headers()).get('x-nonce') ?? undefined;

  return (
    <html lang="en" className="dark" {...(nonce ? { 'data-nonce': nonce } : {})}>
      <head>
        <GlobalJsonLd />
      </head>
      <body className={`${inter.className} bg-gray-50 dark:bg-zinc-950 transition-colors duration-200`}>
        <ThemeProvider>
          <SmoothScroll />
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main id="main-content" className="flex-1">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
