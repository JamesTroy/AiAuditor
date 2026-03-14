'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import UserNav from '@/components/UserNav';

const NAV_LINKS = [
  { href: '/', label: 'Agents' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/history', label: 'History' },
  { href: '/stack', label: 'Stack' },
] as const;

export default function Navbar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-zinc-800/50">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:px-4 focus:py-2 focus:rounded-lg focus:bg-violet-600 focus:text-white focus:text-sm focus:font-medium focus-ring"
      >
        Skip to content
      </a>
      <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
        {/* Left: Logo */}
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <Logo size={28} />
          <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100">Claudit</span>
        </Link>

        {/* Center: Nav links */}
        <div className="hidden sm:flex items-center gap-1">
          {NAV_LINKS.map(({ href, label }) => {
            const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
            return (
              <Link
                key={href}
                href={href}
                className={`text-sm px-3 py-1.5 rounded-lg transition-colors ${
                  isActive
                    ? 'text-gray-900 dark:text-zinc-100 bg-gray-100/80 dark:bg-zinc-800/80'
                    : 'text-gray-500 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100/50 dark:hover:bg-zinc-800/50'
                }`}
              >
                {label}
              </Link>
            );
          })}
        </div>

        {/* Right: Theme + User */}
        <div className="flex items-center gap-2">
          <ThemeToggle />
          <UserNav />
        </div>
      </div>
    </nav>
  );
}
