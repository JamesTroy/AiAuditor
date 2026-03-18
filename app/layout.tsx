import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import ThemeProvider from '@/components/ThemeProvider';
import Navbar from '@/components/Navbar';
import ActivationBanner from '@/components/ActivationBanner';
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
  icons: {
    icon: [
      { url: '/favicon.svg', type: 'image/svg+xml' },
    ],
    // Apple ignores SVG touch icons — omit until a PNG is added to /public.
    // apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
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
    <html lang="en-US" className="dark" suppressHydrationWarning>
      <head>
        <meta name="theme-color" content="#09090b" media="(prefers-color-scheme: dark)" />
        <meta name="theme-color" content="#f9fafb" media="(prefers-color-scheme: light)" />
        {/* Preconnect to avatar CDNs used by OAuth profile images (GitHub, Google).
            These only benefit authenticated users, but the cost of an unused preconnect
            is negligible (single DNS+TCP+TLS handshake that expires idle). */}
        <link rel="preconnect" href="https://avatars.githubusercontent.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://avatars.githubusercontent.com" />
        <link rel="preconnect" href="https://lh3.googleusercontent.com" crossOrigin="anonymous" />
        <link rel="dns-prefetch" href="https://lh3.googleusercontent.com" />
        <GlobalJsonLd />
        <Analytics />
      </head>
      <body className={`${inter.className} bg-gray-50 dark:bg-zinc-950`}>
        <ThemeProvider>
          <SmoothScroll />
          <div className="flex flex-col min-h-screen">
            <Navbar />
            <ActivationBanner />
            <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">{children}</main>
            <noscript>
              <div role="alertdialog" aria-modal="true" aria-label="JavaScript required" aria-describedby="noscript-desc" className="fixed inset-0 z-[200] bg-white dark:bg-zinc-950 flex items-center justify-center p-8">
                <div className="text-center max-w-md">
                  <h1 className="text-2xl font-bold mb-4 text-gray-900 dark:text-zinc-100">Enable JavaScript to run audits</h1>
                  <p id="noscript-desc" className="text-gray-600 dark:text-zinc-400 mb-6">Claudit streams audit results in real time, which requires JavaScript. Enable it in your browser settings to get started — your code is never stored or shared.</p>
                  <nav className="space-y-2 text-sm">
                    <a href="/about" className="block text-violet-600 underline">Learn more about Claudit</a>
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
