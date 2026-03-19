'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';

const PRODUCT_LINKS = [
  { href: '/audit', label: 'Audit' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/pricing', label: 'Pricing' },
  { href: '/about', label: 'About' },
] as const;

const LEGAL_LINKS = [
  { href: '/trust', label: 'Trust & Security' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
  { href: '/security', label: 'Disclosure' },
  { href: '/about#contact', label: 'Contact' },
] as const;

export default function Footer() {
  const pathname = usePathname();

  const linkClass = (href: string) => {
    const isActive = pathname === href;
    return `text-sm py-3 min-h-[44px] inline-flex items-center transition-colors focus-ring rounded ${
      isActive
        ? 'text-gray-900 dark:text-zinc-100 font-medium'
        : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300'
    }`;
  };

  return (
    <footer className="border-t border-gray-200/50 dark:border-zinc-800/50 mt-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-10">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-8 sm:gap-6">
          {/* Brand column */}
          <div className="sm:col-span-2 space-y-3">
            <Link href="/" className="inline-flex items-center gap-2 p-2 -m-2 min-h-[44px] min-w-[44px] text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors focus-ring rounded-lg">
              <Logo size={20} />
              <span className="text-sm font-semibold">Claudit</span>
            </Link>
            <p className="text-sm text-gray-500 dark:text-zinc-400 leading-relaxed max-w-xs">
              Neither Claudit nor Anthropic trains on your code. Never stored.{' '}
              <Link href="/trust" className="underline underline-offset-2 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors">Trust & Security</Link>.
            </p>
            <Link
              href="/audit"
              className="inline-flex text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 dark:hover:text-violet-300 font-medium transition-colors focus-ring"
            >
              Start a free audit <span aria-hidden="true">&rarr;</span>
            </Link>
          </div>

          {/* Product column */}
          <nav className="flex flex-col gap-2" aria-label="Product">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-zinc-400 mb-1">Product</span>
            {PRODUCT_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className={linkClass(href)}>{label}</Link>
            ))}
          </nav>

          {/* Legal column */}
          <nav className="flex flex-col gap-2" aria-label="Legal">
            <span className="text-xs font-semibold uppercase tracking-widest text-gray-500 dark:text-zinc-400 mb-1">Legal</span>
            {LEGAL_LINKS.map(({ href, label }) => (
              <Link key={href} href={href} className={linkClass(href)}>{label}</Link>
            ))}
          </nav>
        </div>
      </div>

      {/* Copyright */}
      <div className="border-t border-gray-200/50 dark:border-zinc-800/50 py-4">
        <p className="text-center text-xs text-gray-500 dark:text-zinc-400">
          &copy; {new Date().getFullYear()} Claudit. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
