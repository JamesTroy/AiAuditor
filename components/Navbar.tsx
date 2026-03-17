'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import UserNav from '@/components/UserNav';
import { useSession } from '@/lib/auth-client';

const PUBLIC_LINKS = [
  { href: '/', label: 'Explore Audits', title: 'Browse all available audit types' },
  { href: '/code-audit', label: 'Code Audit', title: 'Run a full multi-agent code audit' },
  { href: '/site-audit', label: 'Site Audit', title: 'Run a comprehensive site audit' },
  { href: '/pricing', label: 'Pricing', title: 'View pricing and plans' },
] as const;

const AUTH_LINKS = [
  { href: '/dashboard', label: 'Dashboard', title: 'View your audit history and scores' },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const { data: session } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const NAV_LINKS = session ? [...PUBLIC_LINKS, ...AUTH_LINKS] : PUBLIC_LINKS;

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    triggerRef.current?.focus();
  }, []);

  // Close drawer on route change
  useEffect(() => {
    setDrawerOpen(false);
  }, [pathname]);

  // Escape key closes drawer
  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') closeDrawer();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  // Focus trap inside drawer
  useEffect(() => {
    if (!drawerOpen || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();

    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  // Lock body scroll when drawer is open
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  return (
    <>
      <header className="sticky top-0 z-50">
      <nav aria-label="Main navigation" className="bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-zinc-800/50">
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-violet-600 focus:text-white focus:text-sm focus:font-medium focus-ring"
        >
          Skip to content
        </a>
        <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between">
          {/* Left: Logo */}
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <Logo size={28} />
            <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100">Claudit</span>
          </Link>

          {/* Center: Desktop nav links */}
          <div className="hidden sm:flex items-center gap-1">
            {NAV_LINKS.map((item) => {
              const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={'title' in item ? item.title : ''}
                  aria-current={isActive ? 'page' : undefined}
                  className={`relative text-sm px-3 py-1.5 rounded-lg transition-colors ${
                    isActive
                      ? 'text-gray-900 dark:text-zinc-100'
                      : 'text-gray-500 dark:text-zinc-500 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100/50 dark:hover:bg-zinc-800/50'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute inset-x-2 -bottom-[13px] h-0.5 rounded-full bg-violet-500" />
                  )}
                </Link>
              );
            })}
          </div>

          {/* Right: CTA + separator + Theme + User */}
          <div className="flex items-center gap-2">
            {pathname !== '/code-audit' && pathname !== '/site-audit' && (
              <Link
                href="/code-audit"
                className="hidden sm:inline-flex px-4 py-1.5 rounded-full text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 active:scale-[0.98] active:bg-violet-700 transition-colors focus-ring whitespace-nowrap shadow-sm shadow-violet-600/20"
              >
                {session ? 'New Audit' : 'Get Started Free'}
              </Link>
            )}
            <span className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-zinc-800" aria-hidden="true" />
            <ThemeToggle />
            <UserNav />
            <button
              ref={triggerRef}
              onClick={() => setDrawerOpen(true)}
              className="flex sm:hidden items-center justify-center min-h-[44px] min-w-[44px] -mr-2 rounded-lg text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors focus-ring"
              aria-label="Open navigation menu"
              aria-expanded={drawerOpen}
              aria-controls="mobile-nav"
            >
              <svg width="20" height="20" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                <line x1="3" y1="5" x2="17" y2="5" />
                <line x1="3" y1="10" x2="17" y2="10" />
                <line x1="3" y1="15" x2="17" y2="15" />
              </svg>
            </button>
          </div>
        </div>
      </nav>
      </header>

      {/* Mobile drawer overlay + panel */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Backdrop with fade */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm animate-fade-in"
            onClick={closeDrawer}
            aria-hidden="true"
          />

          {/* Drawer panel */}
          <div
            ref={drawerRef}
            id="mobile-nav"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation menu"
            className="absolute inset-y-0 left-0 w-72 max-w-[calc(100vw-3rem)] bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-drawer-in"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 h-14 border-b border-gray-200 dark:border-zinc-800 shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                {session ? (
                  <>
                    <div className="w-6 h-6 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {(session.user?.name?.[0] ?? session.user?.email?.[0] ?? 'U').toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
                      {session.user?.name ?? session.user?.email ?? 'User'}
                    </span>
                  </>
                ) : (
                  <Link href="/" className="flex items-center gap-2" onClick={closeDrawer}>
                    <Logo size={24} />
                    <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100">Claudit</span>
                  </Link>
                )}
              </div>
              <button
                onClick={closeDrawer}
                className="flex items-center justify-center min-h-[44px] min-w-[44px] -mr-2 rounded-lg text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors focus-ring"
                aria-label="Close navigation menu"
              >
                <svg width="18" height="18" viewBox="0 0 18 18" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" aria-hidden="true">
                  <line x1="4" y1="4" x2="14" y2="14" />
                  <line x1="14" y1="4" x2="4" y2="14" />
                </svg>
              </button>
            </div>

            {/* Drawer nav links */}
            <nav className="flex-1 overflow-y-auto px-4 py-4" aria-label="Mobile navigation">
              <ul className="flex flex-col gap-1">
                {NAV_LINKS.map((item) => {
                  const isActive = item.href === '/' ? pathname === '/' : pathname.startsWith(item.href);
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        title={'title' in item ? item.title : ''}
                        aria-current={isActive ? 'page' : undefined}
                        onClick={closeDrawer}
                        className={`flex items-center min-h-[48px] px-4 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'text-gray-900 dark:text-zinc-100 bg-gray-100 dark:bg-zinc-800'
                            : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100/50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Drawer footer */}
            <div className="border-t border-gray-200 dark:border-zinc-800 px-6 py-4 space-y-3">
              <Link
                href="/code-audit"
                onClick={closeDrawer}
                className="flex items-center justify-center min-h-[48px] px-4 rounded-full text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring shadow-sm shadow-violet-600/20"
              >
                {session ? 'New Audit' : 'Get Started Free'}
              </Link>
              <p className="text-xs text-gray-400 dark:text-zinc-500 text-center">
                Security · Performance · Accessibility · Compliance
              </p>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
