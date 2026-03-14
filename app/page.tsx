'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { agents } from '@/lib/agents';
import AgentCard from '@/components/AgentCard';
import CustomAgentGrid from '@/components/CustomAgentGrid';
import ThemeToggle from '@/components/ThemeToggle';
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal';
import { getFavorites, toggleFavorite } from '@/lib/favorites';
import UserNav from '@/components/UserNav';
import Logo from '@/components/Logo';

const CATEGORIES = ['Code Quality', 'Security & Privacy', 'Performance', 'Infrastructure', 'Design'] as const;

export default function Home() {
  const [search, setSearch] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

  // ⌘K / Ctrl+K focuses search; ? opens shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
      if (e.key === '?' && !(e.target instanceof HTMLInputElement) && !(e.target instanceof HTMLTextAreaElement)) {
        setShortcutsOpen(true);
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // PERF-023: useCallback so AgentCard (React.memo) gets a stable reference.
  const handleToggleFavorite = useCallback((id: string) => {
    toggleFavorite(id);
    setFavorites(getFavorites());
  }, []);

  const query = search.toLowerCase();
  const filteredAgents = agents.filter(
    (a) => a.name.toLowerCase().includes(query) || a.description.toLowerCase().includes(query) || a.category.toLowerCase().includes(query)
  );

  const hasSearch = query.length > 0;
  const pinnedAgents = agents.filter((a) => favorites.has(a.id));

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 px-6 py-20">
      <div className="max-w-5xl mx-auto">
        {/* Header row */}
        <div className="flex items-center justify-end gap-2 mb-8">
          <Link
            href="/stack"
            className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Stack
          </Link>
          <Link
            href="/history"
            className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            History
          </Link>
          <button
            onClick={() => setShortcutsOpen(true)}
            className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 px-3 py-2 rounded-lg hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            aria-label="Keyboard shortcuts"
          >
            ?
          </button>
          <ThemeToggle />
          <UserNav />
        </div>

        {/* Hero */}
        <div className="text-center mb-12 relative">
          <div
            className="absolute inset-0 -z-10 mx-auto w-96 h-32 blur-3xl opacity-20 rounded-full"
            style={{ background: 'radial-gradient(ellipse, #6366f1 0%, #3b82f6 50%, transparent 100%)' }}
          />
          <div className="flex items-center justify-center gap-3 mb-4">
            <Logo size={48} />
            <h1 className="text-3xl sm:text-4xl lg:text-5xl font-bold tracking-tight">Claudit</h1>
          </div>
          <p className="text-gray-600 dark:text-zinc-300 text-lg max-w-xl mx-auto">
            Instant AI-powered audits for code quality, security, and performance.
            Powered by Claude.
          </p>
        </div>

        {/* Search */}
        <div className="mb-10 max-w-lg mx-auto">
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-sm">⌕</span>
            <input
              ref={searchRef}
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search agents… (⌘K)"
              className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 transition-colors"
            />
          </div>
        </div>

        {/* Agent grid */}
        {hasSearch ? (
          filteredAgents.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
              {filteredAgents.map((agent) => (
                <Link key={agent.id} href={`/audit/${agent.id}`} className="block">
                  <AgentCard
                    agent={agent}
                    isFavorite={favorites.has(agent.id)}
                    onToggleFavorite={() => handleToggleFavorite(agent.id)}
                  />
                </Link>
              ))}
            </div>
          ) : (
            <p className="text-center text-gray-500 dark:text-zinc-500 text-sm py-12">No agents match &ldquo;{search}&rdquo;.</p>
          )
        ) : (
          <>
            {/* Pinned section */}
            {pinnedAgents.length > 0 && (
              <section className="mb-10">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-yellow-500 mb-4">⭐ Pinned</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {pinnedAgents.map((agent) => (
                    <Link key={agent.id} href={`/audit/${agent.id}`} className="block">
                      <AgentCard
                        agent={agent}
                        isFavorite={true}
                        onToggleFavorite={() => handleToggleFavorite(agent.id)}
                      />
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Category sections */}
            {CATEGORIES.map((cat) => {
              const group = agents.filter((a) => a.category === cat);
              if (group.length === 0) return null;
              return (
                <section key={cat} className="mb-10">
                  <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4">{cat}</h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                    {group.map((agent) => (
                      <Link key={agent.id} href={`/audit/${agent.id}`} className="block">
                        <AgentCard
                          agent={agent}
                          isFavorite={favorites.has(agent.id)}
                          onToggleFavorite={() => handleToggleFavorite(agent.id)}
                        />
                      </Link>
                    ))}
                  </div>
                </section>
              );
            })}
          </>
        )}

        <CustomAgentGrid />
      </div>

      {shortcutsOpen && <KeyboardShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </main>
  );
}
