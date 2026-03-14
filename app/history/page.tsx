'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import Link from 'next/link';

import {
  getHistory, deleteAudit, clearHistory, starAudit, unstarAudit, setAuditNote, AuditEntry,
} from '@/lib/history';
import SafeMarkdown from '@/components/markdownComponents';

export default function HistoryPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [editingNote, setEditingNote] = useState<Record<string, string>>({});
  const noteRefs = useRef<Record<string, string>>({});

  const load = useCallback(() => {
    setEntries(getHistory());
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const agentIds = Array.from(new Set(entries.map((e) => e.agentId)));

  // Stats
  const totalAudits = entries.length;
  const mostUsedAgent = (() => {
    if (entries.length === 0) return null;
    const counts: Record<string, { name: string; count: number }> = {};
    for (const e of entries) {
      if (!counts[e.agentId]) counts[e.agentId] = { name: e.agentName, count: 0 };
      counts[e.agentId].count++;
    }
    return Object.values(counts).sort((a, b) => b.count - a.count)[0];
  })();
  const oldestEntry = entries.length > 0 ? entries.reduce((min, e) => e.timestamp < min ? e.timestamp : min, entries[0].timestamp) : null;

  const query = search.toLowerCase();
  let displayed = filter === 'starred'
    ? entries.filter((e) => e.starred)
    : filter
    ? entries.filter((e) => e.agentId === filter)
    : entries;

  if (query) {
    displayed = displayed.filter(
      (e) => e.inputSnippet.toLowerCase().includes(query) ||
        e.result.toLowerCase().includes(query) ||
        (e.note ?? '').toLowerCase().includes(query)
    );
  }

  function handleDelete(id: string) {
    deleteAudit(id);
    load();
    if (expanded === id) setExpanded(null);
  }

  function handleClearAll() {
    if (!confirm('Delete all audit history? This cannot be undone.')) return;
    clearHistory();
    load();
    setExpanded(null);
  }

  function handleToggleStar(e: React.MouseEvent, entry: AuditEntry) {
    e.stopPropagation();
    if (entry.starred) {
      unstarAudit(entry.id);
    } else {
      starAudit(entry.id);
    }
    load();
  }

  function handleNoteChange(id: string, value: string) {
    setEditingNote((prev) => ({ ...prev, [id]: value }));
    noteRefs.current[id] = value;
  }

  function handleNoteBlur(id: string) {
    const note = noteRefs.current[id] ?? editingNote[id] ?? '';
    setAuditNote(id, note);
    load();
  }

  function formatTime(ts: number) {
    return new Date(ts).toLocaleString(undefined, {
      month: 'short', day: 'numeric', year: 'numeric',
      hour: '2-digit', minute: '2-digit',
    });
  }

  function formatDate(ts: number) {
    return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function getNoteValue(entry: AuditEntry) {
    return entry.id in editingNote ? editingNote[entry.id] : (entry.note ?? '');
  }

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-zinc-950 text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-4xl mx-auto">
        <Link
          href="/"
          className="text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 text-sm mb-8 inline-flex items-center gap-1 transition-colors"
        >
          ← All agents
        </Link>

        <div className="flex items-start justify-between mt-6 mb-6 gap-4 flex-wrap">
          <div>
            <h1 className="text-3xl font-bold mb-1">Audit History</h1>
            <p className="text-gray-500 dark:text-zinc-500 text-sm">
              {entries.length} audit{entries.length !== 1 ? 's' : ''} stored locally
            </p>
          </div>
          {entries.length > 0 && (
            <button
              onClick={handleClearAll}
              className="text-sm text-red-500 hover:text-red-400 border border-red-300 dark:border-red-800 hover:border-red-400 px-3 py-1.5 rounded-lg transition-colors"
            >
              Clear all
            </button>
          )}
        </div>

        {/* Stats row */}
        {entries.length > 0 && (
          <div className="flex items-center gap-6 mb-6 text-xs text-gray-500 dark:text-zinc-500 flex-wrap">
            <span>
              <span className="font-semibold text-gray-700 dark:text-zinc-300">{totalAudits}</span> total
            </span>
            {mostUsedAgent && (
              <span>
                Most used: <span className="font-semibold text-gray-700 dark:text-zinc-300">{mostUsedAgent.name}</span>
                <span className="text-gray-400 dark:text-zinc-600"> ×{mostUsedAgent.count}</span>
              </span>
            )}
            {oldestEntry && (
              <span>
                Since <span className="font-semibold text-gray-700 dark:text-zinc-300">{formatDate(oldestEntry)}</span>
              </span>
            )}
          </div>
        )}

        {entries.length === 0 ? (
          <div className="text-center py-24 text-gray-400 dark:text-zinc-600">
            <p className="text-lg mb-2">No audit history yet.</p>
            <p className="text-sm">Run an audit to see results here.</p>
          </div>
        ) : (
          <>
            {/* Search + Filter row */}
            <div className="flex items-center gap-3 mb-6 flex-wrap">
              <div className="relative flex-1 min-w-48">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 dark:text-zinc-500 text-sm">⌕</span>
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search history…"
                  className="w-full bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg pl-9 pr-4 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 transition-colors"
                />
              </div>
              <select
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="bg-white dark:bg-zinc-900 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-gray-700 dark:text-zinc-300 focus:outline-none focus:border-gray-500 dark:focus:border-zinc-500 transition-colors"
              >
                <option value="">All agents</option>
                <option value="starred">⭐ Starred</option>
                {agentIds.map((id) => {
                  const name = entries.find((e) => e.agentId === id)?.agentName ?? id;
                  return <option key={id} value={id}>{name}</option>;
                })}
              </select>
            </div>

            {displayed.length === 0 ? (
              <p className="text-center text-gray-400 dark:text-zinc-600 text-sm py-12">No entries match your filters.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {displayed.map((entry) => (
                  <div
                    key={entry.id}
                    className="border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden"
                  >
                    <div
                      className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                      onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
                    >
                      {/* Star */}
                      <button
                        onClick={(e) => handleToggleStar(e, entry)}
                        className={`text-sm shrink-0 transition-colors hover:scale-110 ${entry.starred ? 'text-yellow-400' : 'text-gray-300 dark:text-zinc-700 hover:text-yellow-400'}`}
                        aria-label={entry.starred ? 'Unstar entry' : 'Star entry'}
                      >
                        {entry.starred ? '⭐' : '☆'}
                      </button>
                      <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono shrink-0 w-36">{formatTime(entry.timestamp)}</span>
                      <span className="text-xs font-medium text-gray-500 dark:text-zinc-500 shrink-0 bg-gray-100 dark:bg-zinc-800 px-2 py-0.5 rounded">
                        {entry.agentName}
                      </span>
                      <span className="text-sm text-gray-700 dark:text-zinc-300 truncate flex-1">{entry.inputSnippet}</span>
                      {entry.note && (
                        <span className="text-xs text-gray-400 dark:text-zinc-600 shrink-0" title={entry.note}>📝</span>
                      )}
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(entry.id); }}
                        className="text-gray-400 dark:text-zinc-600 hover:text-red-400 transition-colors text-xs shrink-0"
                        aria-label="Delete entry"
                      >
                        ✕
                      </button>
                      <span className={`text-gray-400 dark:text-zinc-500 text-xs shrink-0 transition-transform duration-200 ${expanded === entry.id ? 'rotate-180' : ''}`}>
                        ▼
                      </span>
                    </div>

                    {expanded === entry.id && (
                      <div className="border-t border-gray-200 dark:border-zinc-800 px-4 py-4">
                        <div className="flex items-center justify-between mb-3">
                          <Link
                            href={`/audit/${entry.agentId}`}
                            className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 transition-colors"
                          >
                            Open {entry.agentName} →
                          </Link>
                        </div>
                        <div className="prose prose-sm max-w-none dark:prose-invert mb-4">
                          <SafeMarkdown>{entry.result}</SafeMarkdown>
                        </div>
                        {/* Note */}
                        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800">
                          <label className="block text-xs text-gray-400 dark:text-zinc-600 mb-1.5 uppercase tracking-widest font-semibold">
                            Note
                          </label>
                          <textarea
                            value={getNoteValue(entry)}
                            onChange={(e) => handleNoteChange(entry.id, e.target.value)}
                            onBlur={() => handleNoteBlur(entry.id)}
                            placeholder="Add a personal note…"
                            rows={2}
                            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-3 py-2 text-sm text-gray-800 dark:text-zinc-200 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:border-gray-400 dark:focus:border-zinc-500 resize-y transition-colors"
                          />
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
