'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { AgentConfig } from '@/lib/types';
import AgentCard from '@/components/AgentCard';

const CATEGORIES = ['Code Quality', 'Security & Privacy', 'Performance', 'Infrastructure', 'Design'] as const;

interface HomeSearchProps {
  agents: AgentConfig[];
}

export default function HomeSearch({ agents }: HomeSearchProps) {
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const id = setTimeout(() => setDebouncedSearch(search), 150);
    return () => clearTimeout(id);
  }, [search]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  const query = debouncedSearch.toLowerCase();
  const filteredAgents = useMemo(() => agents.filter(
    (a) => a.name.toLowerCase().includes(query) || a.description.toLowerCase().includes(query) || a.category.toLowerCase().includes(query)
  ), [agents, query]);

  const hasSearch = query.length > 0;

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
            aria-label="Search audit agents"
            className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] transition-all"
          />
        </div>
      </div>

      {/* Agent grid */}
      {hasSearch ? (
        filteredAgents.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {filteredAgents.map((agent, i) => (
              <AgentCard key={agent.id} agent={agent} index={i} />
            ))}
          </div>
        ) : (
          <p className="text-center text-gray-500 dark:text-zinc-500 text-sm py-12">No agents match &ldquo;{search}&rdquo;.</p>
        )
      ) : (
        <>
          {CATEGORIES.map((cat) => {
            const group = agents.filter((a) => a.category === cat);
            if (group.length === 0) return null;
            return (
              <section key={cat} className="mb-10">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4 border-l-2 border-violet-500/30 pl-3">{cat}</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                  {group.map((agent, i) => (
                    <AgentCard key={agent.id} agent={agent} index={i} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      )}
    </>
  );
}
