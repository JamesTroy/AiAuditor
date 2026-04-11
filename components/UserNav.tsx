'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSession, signOut, authClient } from '@/lib/auth-client';

interface UserOrg {
  id: string;
  name: string;
}

export default function UserNav() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [orgs, setOrgs] = useState<UserOrg[]>([]);
  const [orgsLoaded, setOrgsLoaded] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const activeOrgId = session
    ? ((session.session as Record<string, unknown>)?.activeOrganizationId as string | null ?? null)
    : null;

  const fetchOrgs = useCallback(async () => {
    if (orgsLoaded) return;
    try {
      const res = await authClient.organization.list();
      if (res.data) {
        setOrgs(res.data.map((o: { id: string; name: string }) => ({ id: o.id, name: o.name })));
      }
    } catch { /* ignore */ }
    setOrgsLoaded(true);
  }, [orgsLoaded]);

  // Fetch orgs when menu opens
  useEffect(() => {
    if (open && session) fetchOrgs();
  }, [open, session, fetchOrgs]);

  // AUDIT-003: Close on outside click
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // AUDIT-003: Keyboard navigation for dropdown menu (WCAG 2.1 AA)
  // Escape closes, Arrow keys navigate, Home/End jump to first/last item
  const handleMenuKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (!open) return;

    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
      return;
    }

    const items = menuRef.current?.querySelectorAll<HTMLElement>(
      'a[role="menuitem"], button[role="menuitem"]',
    );
    if (!items || items.length === 0) return;

    const currentIndex = Array.from(items).findIndex((el) => el === document.activeElement);

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = currentIndex < items.length - 1 ? currentIndex + 1 : 0;
      items[next].focus();
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const prev = currentIndex > 0 ? currentIndex - 1 : items.length - 1;
      items[prev].focus();
    } else if (e.key === 'Home') {
      e.preventDefault();
      items[0].focus();
    } else if (e.key === 'End') {
      e.preventDefault();
      items[items.length - 1].focus();
    }
  }, [open]);

  // Focus first menu item when menu opens
  useEffect(() => {
    if (open) {
      // Small delay to let the menu render
      requestAnimationFrame(() => {
        const firstItem = menuRef.current?.querySelector<HTMLElement>(
          'a[role="menuitem"], button[role="menuitem"]',
        );
        firstItem?.focus();
      });
    }
  }, [open]);

  if (!session) {
    return (
      <Link
        href="/login"
        className="text-xs font-medium text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-100 px-3 py-2 min-h-[44px] inline-flex items-center rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
      >
        Sign in
      </Link>
    );
  }

  const initials = session.user.name
    ?.split(' ')
    .map((n) => n[0])
    .join('')
    .slice(0, 2)
    .toUpperCase() ?? '?';

  return (
    <div ref={menuRef} className="relative">
      <button
        ref={triggerRef}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' && !open) { e.preventDefault(); setOpen(true); }
        }}
        className="w-10 h-10 min-w-[44px] min-h-[44px] rounded-full bg-violet-600 text-white text-xs font-bold flex items-center justify-center hover:bg-violet-500 transition-colors focus-ring"
        aria-label="User menu"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        {session.user.image ? (
          <Image src={session.user.image} alt={`${session.user.name ?? 'User'}'s avatar`} width={40} height={40} className="w-10 h-10 rounded-full" />
        ) : (
          initials
        )}
      </button>

      {open && (
        <div role="menu" aria-label="User menu" onKeyDown={handleMenuKeyDown} className="absolute right-0 mt-2 w-56 bg-white/90 dark:bg-zinc-900/90 backdrop-blur-xl border border-gray-200 dark:border-zinc-800 rounded-xl shadow-lg py-1 z-50 motion-safe:animate-slide-in">
          <div className="px-4 py-3 border-b border-gray-100 dark:border-zinc-800">
            <p className="text-sm font-medium text-gray-900 dark:text-zinc-100 truncate">
              {session.user.name}
            </p>
            <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">
              {session.user.email}
            </p>
          </div>

          {/* Org switcher */}
          {orgs.length > 0 && (
            <div className="border-b border-gray-100 dark:border-zinc-800 py-1">
              <p className="px-4 py-1 text-xs font-medium text-gray-400 dark:text-zinc-600 uppercase tracking-wider">Workspace</p>
              <button
                onClick={async () => {
                  await authClient.organization.setActive({ organizationId: null });
                  setOpen(false);
                  router.refresh();
                }}
                className={`w-full text-left px-4 py-1.5 text-sm transition-colors ${
                  !activeOrgId
                    ? 'text-violet-600 dark:text-violet-400 font-medium'
                    : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
                }`}
              >
                Personal
              </button>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={async () => {
                    await authClient.organization.setActive({ organizationId: org.id });
                    setOpen(false);
                    router.refresh();
                  }}
                  className={`w-full text-left px-4 py-1.5 text-sm transition-colors ${
                    activeOrgId === org.id
                      ? 'text-violet-600 dark:text-violet-400 font-medium'
                      : 'text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800'
                  }`}
                >
                  {org.name}
                </button>
              ))}
            </div>
          )}

          <Link
            href="/dashboard"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Dashboard
          </Link>
          <Link
            href="/settings/team"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Team Settings
          </Link>
          <Link
            href="/settings"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm text-gray-700 dark:text-zinc-300 hover:bg-gray-50 dark:hover:bg-zinc-800"
          >
            Settings
          </Link>
          {(session.user as Record<string, unknown>).role === 'admin' && (
            <Link
              href="/admin"
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-violet-600 dark:text-violet-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              Admin
            </Link>
          )}

          <div className="border-t border-gray-100 dark:border-zinc-800 mt-1 pt-1">
            <button
              role="menuitem"
              onClick={async () => {
                await signOut();
                setOpen(false);
                router.push('/');
                router.refresh();
              }}
              className="w-full text-left px-4 py-2 text-sm text-red-600 dark:text-red-400 hover:bg-gray-50 dark:hover:bg-zinc-800"
            >
              Sign out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
