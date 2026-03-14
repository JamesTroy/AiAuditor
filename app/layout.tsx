import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import ThemeProvider from '@/components/ThemeProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SmoothScroll from '@/components/SmoothScroll';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

const BASE_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'https://claudit.dev';

export const metadata: Metadata = {
  metadataBase: new URL(BASE_URL),
  title: {
    default: 'Claudit — AI-Powered Code Audits',
    template: '%s | Claudit',
  },
  description:
    'Instant AI-powered audits for code quality, security, and performance. 50 specialized agents powered by Claude.',
  icons: { icon: '/logo.svg' },
  openGraph: {
    type: 'website',
    siteName: 'Claudit',
    title: 'Claudit — AI-Powered Code Audits',
    description:
      'Instant AI-powered audits for code quality, security, and performance. 50 specialized agents powered by Claude.',
    url: BASE_URL,
  },
  twitter: {
    card: 'summary',
    title: 'Claudit — AI-Powered Code Audits',
    description:
      'Instant AI-powered audits for code quality, security, and performance. 50 specialized agents powered by Claude.',
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
