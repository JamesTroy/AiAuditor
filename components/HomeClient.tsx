'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { AgentConfig } from '@/lib/types';
import AgentCard from '@/components/AgentCard';
import CustomAgentGrid from '@/components/CustomAgentGrid';
import KeyboardShortcutsModal from '@/components/KeyboardShortcutsModal';
import { getFavorites, toggleFavorite } from '@/lib/favorites';

const CATEGORIES = ['Code Quality', 'Security & Privacy', 'Performance', 'Infrastructure', 'Design', 'SEO', 'Marketing', 'Monetization', 'AI / LLM', 'Testing', 'Data Engineering', 'Developer Experience'] as const;

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
  const filteredAgents = useMemo(() => agents.filter(
    (a) => a.name.toLowerCase().includes(query) || a.description.toLowerCase().includes(query) || a.category.toLowerCase().includes(query)
  ), [agents, query]);

  const hasSearch = query.length > 0;
  const pinnedAgents = useMemo(() => agents.filter((a) => favorites.has(a.id)), [agents, favorites]);

  // PERF-002: Pre-compute category groups once instead of filtering per category in render.
  const grouped = useMemo(() => {
    const map = new Map<string, AgentConfig[]>();
    for (const cat of CATEGORIES) {
      map.set(cat, agents.filter((a) => a.category === cat));
    }
    return map;
  }, [agents]);

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
            placeholder="Search auditors… (⌘K)"
            aria-label="Search audit agents"
            className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] transition-all"
          />
        </div>
      </div>

      {/* Agent grid */}
      {hasSearch ? (
        <>
          {/* Pinned strip during search */}
          {pinnedAgents.length > 0 && (
            <div className="mb-4 flex items-center gap-2 flex-wrap">
              <span className="text-xs font-semibold text-yellow-500 shrink-0">⭐ Pinned:</span>
              {pinnedAgents.map((a) => (
                <a
                  key={a.id}
                  href={`/audit/${a.id}`}
                  className="text-xs px-2.5 py-1 rounded-full bg-yellow-50 dark:bg-yellow-950/30 border border-yellow-200 dark:border-yellow-800/50 text-yellow-700 dark:text-yellow-300 hover:bg-yellow-100 dark:hover:bg-yellow-950/50 transition-colors"
                >
                  {a.name}
                </a>
              ))}
            </div>
          )}

          {filteredAgents.length > 0 ? (
            <>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
                {filteredAgents.length} of {agents.length} auditors match
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
                {filteredAgents.map((agent, i) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    index={i}
                    isFavorite={favorites.has(agent.id)}
                    onToggleFavorite={() => handleToggleFavorite(agent.id)}
                  />
                ))}
              </div>
            </>
          ) : (
            <div className="py-16 text-center">
              <p className="text-gray-500 dark:text-zinc-500 text-sm mb-4">
                No auditors match <strong className="text-gray-700 dark:text-zinc-300">&ldquo;{search}&rdquo;</strong>
              </p>
              <button
                onClick={() => setSearch('')}
                className="px-4 py-2 rounded-lg text-sm text-violet-600 dark:text-violet-400 border border-violet-300 dark:border-violet-700 hover:bg-violet-50 dark:hover:bg-violet-950/30 transition-colors"
              >
                Clear search
              </button>
            </div>
          )}
        </>
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
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    index={i}
                    isFavorite={true}
                    onToggleFavorite={() => handleToggleFavorite(agent.id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* Sticky category jump chips */}
          <div className="flex flex-wrap gap-1.5 mb-8 pb-4 border-b border-gray-100 dark:border-zinc-800/60 sticky top-16 bg-gray-50/95 dark:bg-zinc-950/95 backdrop-blur-sm py-3 -mx-4 px-4 z-10">
            {CATEGORIES.map((cat) => {
              const count = grouped.get(cat)?.length ?? 0;
              if (count === 0) return null;
              return (
                <a
                  key={cat}
                  href={`#cat-${cat.replace(/[\s/]+/g, '-').toLowerCase()}`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-white dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-300 hover:border-violet-400 hover:text-violet-600 dark:hover:text-violet-300 transition-colors"
                >
                  {cat}
                  <span className="text-[10px] text-gray-400 dark:text-zinc-500 font-mono">{count}</span>
                </a>
              );
            })}
          </div>

          {/* Category sections */}
          {CATEGORIES.map((cat) => {
            const group = grouped.get(cat) ?? [];
            if (group.length === 0) return null;
            return (
              <section key={cat} id={`cat-${cat.replace(/[\s/]+/g, '-').toLowerCase()}`} className="mb-10">
                <h2 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4 border-l-2 border-violet-500/30 pl-3">
                  {cat}
                  <span className="ml-2 text-[10px] font-mono font-normal tracking-normal text-gray-400 dark:text-zinc-600 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full normal-case">
                    {group.length}
                  </span>
                </h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.map((agent, i) => (
                      <AgentCard
                        key={agent.id}
                        agent={agent}
                        index={i}
                        isFavorite={favorites.has(agent.id)}
                        onToggleFavorite={() => handleToggleFavorite(agent.id)}
                      />
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
