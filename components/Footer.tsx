'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';

const FOOTER_LINKS = [
  { href: '/about', label: 'About' },
  { href: '/how-it-works', label: 'How It Works' },
  { href: '/privacy', label: 'Privacy' },
  { href: '/terms', label: 'Terms' },
] as const;

export default function Footer() {
  const pathname = usePathname();

  return (
    <footer className="border-t border-gray-200/50 dark:border-zinc-800/50 py-8 mt-auto">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 py-2 text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors">
          <Logo size={20} />
          <span className="text-sm font-medium">Claudit</span>
        </Link>

        <p className="text-sm text-gray-500 dark:text-zinc-500">
          Automated code auditing
        </p>

        <nav className="flex flex-wrap items-center justify-center gap-2 sm:gap-4" aria-label="Footer">
          {FOOTER_LINKS.map(({ href, label }) => {
            const isActive = pathname === href;
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm py-3 px-2 min-h-[44px] inline-flex items-center transition-colors ${
                  isActive
                    ? 'text-gray-900 dark:text-zinc-100 font-medium'
                    : 'text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </nav>
      </div>
    </footer>
  );
}
