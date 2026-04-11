'use client';

import { useState, useMemo, useEffect, useRef } from 'react';
import { AgentConfig } from '@/lib/types';
import AgentCard from '@/components/AgentCard';

const CATEGORIES = ['Code Quality', 'Security & Privacy', 'Performance', 'Infrastructure', 'Design', 'SEO', 'Marketing', 'Monetization', 'AI / LLM', 'Testing', 'Data Engineering', 'Developer Experience'] as const;

interface HomeSearchProps {
  agents: AgentConfig[];
  featuredAgents?: AgentConfig[];
}

export default function HomeSearch({ agents, featuredAgents = [] }: HomeSearchProps) {
  const [search, setSearch] = useState('');
  const [showAll, setShowAll] = useState(false);
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

  const grouped = useMemo(() => {
    const map = new Map<string, AgentConfig[]>();
    for (const cat of CATEGORIES) {
      map.set(cat, agents.filter((a) => a.category === cat));
    }
    return map;
  }, [agents]);

  const hasSearch = query.length > 0;

  return (
    <>
      {/* Search */}
      <div className="mb-8 max-w-lg mx-auto" role="search" aria-label="Search audit agents">
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-sm" aria-hidden="true">⌕</span>
          <input
            ref={searchRef}
            type="search"
            value={search}
            onChange={(e) => { setSearch(e.target.value); if (e.target.value) setShowAll(false); }}
            placeholder="Search auditors… (⌘K)"
            aria-label="Search audit agents"
            className="w-full min-h-[44px] bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-xl pl-9 pr-4 py-3 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 focus:shadow-[0_0_0_3px_rgba(139,92,246,0.15)] transition-[box-shadow,border-color]"
          />
        </div>
      </div>

      {hasSearch ? (
        /* Search results */
        filteredAgents.length > 0 ? (
          <>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
              {filteredAgents.length} of {agents.length} auditors match
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-10">
              {filteredAgents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} index={i} />
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
        )
      ) : showAll ? (
        /* Full grid grouped by category */
        <>
          <div className="flex justify-center mb-6">
            <button
              onClick={() => setShowAll(false)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-zinc-400 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 transition-colors focus-ring"
            >
              &larr; Show fewer
            </button>
          </div>

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

          {CATEGORIES.map((cat) => {
            const group = grouped.get(cat) ?? [];
            if (group.length === 0) return null;
            return (
              <section key={cat} id={`cat-${cat.replace(/[\s/]+/g, '-').toLowerCase()}`} className="mb-10">
                <h3 className="text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-zinc-500 mb-4 border-l-2 border-violet-500/30 pl-3">
                  {cat}
                  <span className="ml-2 text-[10px] font-mono font-normal tracking-normal text-gray-400 dark:text-zinc-600 bg-gray-100 dark:bg-zinc-800 px-1.5 py-0.5 rounded-full normal-case">
                    {group.length}
                  </span>
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6">
                  {group.map((agent, i) => (
                    <AgentCard key={agent.id} agent={agent} index={i} />
                  ))}
                </div>
              </section>
            );
          })}
        </>
      ) : (
        /* Featured agents + browse all button */
        <>
          {featuredAgents.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-6 mb-8">
              {featuredAgents.map((agent, i) => (
                <AgentCard key={agent.id} agent={agent} index={i} />
              ))}
            </div>
          )}
          <div className="flex justify-center">
            <button
              onClick={() => setShowAll(true)}
              className="px-6 py-2.5 rounded-xl text-sm font-medium text-gray-600 dark:text-zinc-400 border border-gray-300 dark:border-zinc-700 hover:border-gray-400 dark:hover:border-zinc-500 hover:text-gray-900 dark:hover:text-zinc-200 transition-colors focus-ring"
            >
              Browse all {agents.length} auditors &rarr;
            </button>
          </div>
        </>
      )}
    </>
  );
}
