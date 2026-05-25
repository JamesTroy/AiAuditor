'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Logo from '@/components/Logo';
import ThemeToggle from '@/components/ThemeToggle';
import UserNav from '@/components/UserNav';
import { useSession } from '@/lib/auth-client';

// Signed-out: discovery-focused
const PUBLIC_LINKS = [
  { href: '/audit', label: 'Audit', title: 'Paste code or enter a URL to run an audit' },
  { href: '/pricing', label: 'Pricing', title: 'View pricing and plans' },
] as const;

// Signed-in: task-focused
const AUTH_LINKS = [
  { href: '/dashboard', label: 'Dashboard', title: 'View your audit history and scores' },
] as const;

export default function Navbar() {
  const pathname = usePathname();
  const { data: session, isPending } = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const drawerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const closeDrawer = useCallback(() => {
    setDrawerOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => { setDrawerOpen(false); }, [pathname]);

  useEffect(() => {
    if (!drawerOpen) return;
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') closeDrawer(); }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [drawerOpen, closeDrawer]);

  useEffect(() => {
    if (!drawerOpen || !drawerRef.current) return;
    const focusable = drawerRef.current.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])'
    );
    if (focusable.length > 0) focusable[0].focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key !== 'Tab' || focusable.length === 0) return;
      const first = focusable[0]; const last = focusable[focusable.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [drawerOpen]);

  useEffect(() => {
    document.body.style.overflow = drawerOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [drawerOpen]);

  if (pathname === '/') return null;

  const NAV_LINKS = session ? [...PUBLIC_LINKS, ...AUTH_LINKS] : PUBLIC_LINKS;
  const firstName = session?.user?.name?.split(' ')[0] ?? session?.user?.email?.split('@')[0];

  return (
    <>
      <header className="sticky top-0 z-50">
        {/* Glass panel */}
        <div className="relative bg-white/80 dark:bg-[#0a0a0f]/90 backdrop-blur-2xl">
          {/* Top violet accent line */}
          <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-violet-500/60 to-transparent" />
          {/* Bottom border */}
          <div className="absolute inset-x-0 bottom-0 h-px bg-gradient-to-r from-transparent via-white/10 dark:via-zinc-700/50 to-transparent" />

          <nav aria-label="Main navigation">
            <a
              href="#main-content"
              className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:px-4 focus:py-2 focus:rounded-lg focus:bg-violet-600 focus:text-white focus:text-sm focus:font-medium focus-ring"
            >
              Skip to content
            </a>

            <div className="max-w-5xl mx-auto px-6 h-14 flex items-center justify-between gap-4">
              {/* Logo */}
              <Link href="/" className="flex items-center gap-2 shrink-0 group">
                <div className="transition-transform group-hover:scale-105 duration-200">
                  <Logo size={28} />
                </div>
                <span className="font-bold text-sm tracking-tight text-gray-900 dark:text-zinc-100">
                  Claudit
                </span>
              </Link>

              {/* Desktop nav links */}
              <div className="hidden sm:flex items-center gap-0.5">
                {NAV_LINKS.map((item) => {
                  const isActive = pathname.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      title={'title' in item ? item.title : ''}
                      aria-current={isActive ? 'page' : undefined}
                      className={`relative text-sm px-3.5 py-1.5 rounded-lg font-medium transition-all duration-150 ${
                        isActive
                          ? 'text-violet-600 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10 ring-1 ring-violet-200 dark:ring-violet-500/20'
                          : 'text-gray-500 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-100/60 dark:hover:bg-zinc-800/60'
                      }`}
                    >
                      {item.label}
                    </Link>
                  );
                })}
              </div>

              {/* Right section */}
              <div className="flex items-center gap-2">
                {/* CTA button */}
                {!pathname.startsWith('/audit') && (
                  <Link
                    href="/audit"
                    className={`hidden sm:inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full text-sm font-semibold text-white transition-all duration-200 focus-ring whitespace-nowrap shadow-sm ${
                      session
                        ? 'bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 shadow-violet-600/25 hover:shadow-violet-500/40 hover:shadow-md active:scale-[0.97]'
                        : 'bg-violet-600 hover:bg-violet-500 shadow-violet-600/20 active:scale-[0.97]'
                    }`}
                  >
                    {session ? (
                      <>
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                          <line x1="6.5" y1="1" x2="6.5" y2="12" />
                          <line x1="1" y1="6.5" x2="12" y2="6.5" />
                        </svg>
                        New Audit
                      </>
                    ) : 'Get Started Free'}
                  </Link>
                )}

                {/* Separator */}
                <div className="hidden sm:block w-px h-5 bg-gray-200 dark:bg-zinc-800" aria-hidden="true" />

                <ThemeToggle />

                {/* Signed-in: first name + avatar */}
                {!isPending && session && firstName && (
                  <span className="hidden lg:block text-sm font-semibold bg-gradient-to-r from-violet-500 to-indigo-400 bg-clip-text text-transparent select-none">
                    {firstName}
                  </span>
                )}

                <UserNav />

                {/* Mobile menu trigger */}
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
        </div>
      </header>

      {/* Mobile drawer */}
      <div id="mobile-nav" aria-hidden={!drawerOpen} className={`fixed inset-0 z-50 sm:hidden ${drawerOpen ? '' : 'hidden'}`}>
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={closeDrawer} aria-hidden="true" />

        <div
          ref={drawerRef}
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
          className="absolute inset-y-0 left-0 w-72 max-w-[calc(100vw-3rem)] bg-white dark:bg-zinc-950 border-r border-gray-200 dark:border-zinc-800/80 shadow-2xl flex flex-col animate-drawer-in"
        >
          {/* Drawer header */}
          <div className="flex items-center justify-between px-5 h-14 border-b border-gray-100 dark:border-zinc-800/80 shrink-0">
            {session ? (
              <div className="flex items-center gap-3 min-w-0">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 text-white flex items-center justify-center text-xs font-bold shrink-0 shadow-sm shadow-violet-500/30">
                  {(session.user?.name?.[0] ?? session.user?.email?.[0] ?? 'U').toUpperCase()}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900 dark:text-zinc-100 truncate leading-tight">
                    {session.user?.name ?? 'User'}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-zinc-500 truncate leading-tight">
                    {session.user?.email}
                  </p>
                </div>
              </div>
            ) : (
              <Link href="/" className="flex items-center gap-2" onClick={closeDrawer}>
                <Logo size={24} />
                <span className="font-bold text-sm text-gray-900 dark:text-zinc-100">Claudit</span>
              </Link>
            )}
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

          {/* Drawer links */}
          <nav className="flex-1 overflow-y-auto px-3 py-3" aria-label="Mobile navigation">
            <ul className="flex flex-col gap-0.5">
              {NAV_LINKS.map((item) => {
                const isActive = pathname.startsWith(item.href);
                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      onClick={closeDrawer}
                      className={`flex items-center min-h-[44px] px-4 rounded-lg text-sm font-medium transition-all ${
                        isActive
                          ? 'text-gray-900 dark:text-zinc-100 bg-gray-100 dark:bg-zinc-800'
                          : 'text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 hover:bg-gray-50 dark:hover:bg-zinc-800/60'
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
          <div className="border-t border-gray-100 dark:border-zinc-800/80 px-4 py-4 space-y-2">
            <Link
              href="/audit"
              onClick={closeDrawer}
              className="flex items-center justify-center gap-2 min-h-[46px] px-4 rounded-full text-sm font-semibold text-white bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 transition-all shadow-sm shadow-violet-600/25 focus-ring"
            >
              <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <line x1="6.5" y1="1" x2="6.5" y2="12" />
                <line x1="1" y1="6.5" x2="12" y2="6.5" />
              </svg>
              {session ? 'New Audit' : 'Get Started Free'}
            </Link>
            <p className="text-xs text-gray-400 dark:text-zinc-600 text-center">
              Security · Performance · Accessibility
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
