import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import ThemeProvider from '@/components/ThemeProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';

import { GlobalJsonLd } from '@/components/JsonLd';
import Analytics from '@/components/Analytics';
import SmoothScroll from '@/components/SmoothScroll';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.consulting';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Find What Your Code Review Missed — Claudit',
    template: '%s | Claudit',
  },
  description:
    'Paste code or enter a URL — get a severity-rated security, performance, and accessibility report with results streaming in real time. Audits covering OWASP, GDPR, SOC 2, and more.',
  manifest: '/site.webmanifest',
  alternates: {
    canonical: '/',
  },
  openGraph: {
    type: 'website',
    siteName: 'Claudit',
    title: 'Find What Your Code Review Missed — Claudit',
    description:
      'Paste code or enter a URL — get a severity-rated security, performance, and accessibility report with results streaming in real time. Audits covering OWASP, GDPR, SOC 2, and more.',
    url: BASE_URL,
    images: [{ url: '/opengraph-image', width: 1200, height: 630, alt: 'Claudit — automated code auditing' }],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Find What Your Code Review Missed — Claudit',
    description:
      'Paste code or enter a URL — get a severity-rated security, performance, and accessibility report with results streaming in real time. Audits covering OWASP, GDPR, SOC 2, and more.',
    images: ['/opengraph-image'],
  },
  robots: {
    index: true,
    follow: true,
    'max-snippet': -1,
    'max-image-preview': 'large' as const,
    'max-video-preview': -1,
  },
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Reading headers forces dynamic rendering so Next.js can inject the
  // per-request CSP nonce (from middleware x-nonce) into inline scripts.
  // The nonce is NOT exposed in the DOM — only used internally by Next.js.
  await headers();

  return (
    <html lang="en-US" className="dark">
      <head>
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#f9fafb" media="(prefers-color-scheme: light)" />
        <GlobalJsonLd />
        <Analytics />
      </head>
      <body className={`${inter.className} bg-gray-50 dark:bg-zinc-950`}>
        <ThemeProvider>
          <SmoothScroll />
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <main id="main-content" role="main" tabIndex={-1} className="flex-1">{children}</main>
            <noscript>
              <div className="fixed inset-0 z-[200] bg-white dark:bg-zinc-950 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-zinc-100">JavaScript Required</h1>
                  <p className="text-gray-600 dark:text-zinc-400 mb-6">Claudit requires JavaScript to run audits and display results. Please enable JavaScript in your browser settings.</p>
                  <nav className="space-y-2 text-sm">
                    <a href="/site-audit" className="block text-violet-600 underline">Site Audit</a>
                    <a href="/about" className="block text-violet-600 underline">About</a>
                    <a href="/privacy" className="block text-violet-600 underline">Privacy Policy</a>
                    <a href="/terms" className="block text-violet-600 underline">Terms of Service</a>
                  </nav>
                </div>
              </div>
            </noscript>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
