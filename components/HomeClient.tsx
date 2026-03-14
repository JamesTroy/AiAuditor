'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { AgentConfig } from '@/lib/types';
import AgentCard from '@/components/AgentCard';
import CustomAgentGrid from '@/components/CustomAgentGrid';
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal';
import { getFavorites, toggleFavorite } from '@/lib/favorites';

const CATEGORIES = ['Code Quality', 'Security & Privacy', 'Performance', 'Infrastructure', 'Design'] as const;

interface HomeClientProps {
  agents: AgentConfig[];
}

export default function HomeClient({ agents }: HomeClientProps) {
  const [search, setSearch] = useState('');
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setFavorites(getFavorites());
  }, []);

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
    <>
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
            className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] transition-all"
          />
        </div>
      </div>

      {/* Agent grid */}
      {hasSearch ? (
        filteredAgents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {filteredAgents.map((agent, i) => (
              <Link key={agent.id} href={`/audit/${agent.id}`} className="block">
                <AgentCard
                  agent={agent}
                  index={i}
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
              <h2 className="text-xs font-semibold uppercase tracking-widest text-yellow-500 mb-4">
                <span aria-hidden="true">⭐ </span>Pinned
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {pinnedAgents.map((agent, i) => (
                  <Link key={agent.id} href={`/audit/${agent.id}`} className="block">
                    <AgentCard
                      agent={agent}
                      index={i}
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
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4 border-l-2 border-violet-500/30 pl-3">{cat}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.map((agent, i) => (
                    <Link key={agent.id} href={`/audit/${agent.id}`} className="block">
                      <AgentCard
                        agent={agent}
                        index={i}
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

      {shortcutsOpen && <KeyboardShortcutsModal onClose={() => setShortcutsOpen(false)} />}
    </>
  );
}
