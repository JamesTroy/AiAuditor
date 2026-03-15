'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import UserNav from '@/components/UserNav';

const NAV_LINKS = [
  { href: '/', label: 'Audit Studio' },
  { href: '/site-audit', label: 'Site Audit' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/how-it-works', label: 'How It Works' },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

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
      <nav className="sticky top-0 z-50 bg-white/70 dark:bg-zinc-950/70 backdrop-blur-xl border-b border-gray-200/50 dark:border-zinc-800/50">
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

          {/* Right: Hamburger (mobile) + Theme + User */}
          <div className="flex items-center gap-2">
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

      {/* Mobile drawer overlay + panel */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50 backdrop-blur-sm"
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
            className="absolute inset-y-0 left-0 w-72 max-w-[calc(100vw-3rem)] bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800 shadow-2xl flex flex-col animate-slide-in"
          >
            {/* Drawer header */}
            <div className="flex items-center justify-between px-6 h-14 border-b border-gray-200 dark:border-zinc-800 shrink-0">
              <Link href="/" className="flex items-center gap-2" onClick={closeDrawer}>
                <Logo size={24} />
                <span className="font-semibold text-sm text-gray-900 dark:text-zinc-100">Claudit</span>
              </Link>
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
                {NAV_LINKS.map(({ href, label }) => {
                  const isActive = href === '/' ? pathname === '/' : pathname.startsWith(href);
                  return (
                    <li key={href}>
                      <Link
                        href={href}
                        onClick={closeDrawer}
                        className={`flex items-center min-h-[48px] px-4 rounded-lg text-sm font-medium transition-colors ${
                          isActive
                            ? 'text-gray-900 dark:text-zinc-100 bg-gray-100 dark:bg-zinc-800'
                            : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100/50 dark:hover:bg-zinc-800/50'
                        }`}
                      >
                        {label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </nav>

            {/* Drawer footer */}
            <div className="border-t border-gray-200 dark:border-zinc-800 px-6 py-4 text-xs text-gray-400 dark:text-zinc-600">
              50 audits · Security · Performance · Compliance
            </div>
          </div>
        </div>
      )}
    </>
  );
}
