import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import ThemeProvider from '@/components/ThemeProvider';
import Navbar from '@/components/Navbar';
import Footer from '@/components/Footer';
import SmoothScroll from '@/components/SmoothScroll';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

export const metadata: Metadata = {
  title: 'Claudit',
  description: 'Instant AI-powered audits for code quality, security, and performance. Powered by Claude.',
  icons: { icon: '/logo.svg' },
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
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
