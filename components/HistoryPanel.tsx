'use client';

import React, { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { ChevronRight, ChevronDown, X } from 'lucide-react';

import { getHistory, deleteAudit, AuditEntry } from '@/lib/history';
import SafeMarkdown from '@/components/markdownComponents';

interface Props {
  agentId: string;
  // ARCH-003: Parent passes a MutableRefObject; HistoryPanel writes its load
  // function into it so the parent can trigger a refresh without a counter.
  reloadRef?: React.MutableRefObject<(() => void) | null>;
}

export default function HistoryPanel({ agentId, reloadRef }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    setEntries(getHistory(agentId));
  }, [agentId]);

  // Keep the ref target current so the parent always calls the latest closure.
  useEffect(() => {
    if (reloadRef) reloadRef.current = load;
  }, [load, reloadRef]);

  useEffect(() => {
    load();
  }, [load]);

  if (entries.length === 0) return null;

  function handleDelete(id: string, e: React.MouseEvent) {
    e.stopPropagation();
    deleteAudit(id);
    load();
    if (expanded === id) setExpanded(null);
  }

  function formatTime(ts: number) {
    const d = new Date(ts);
    return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  return (
    <div className="mt-10 border-t border-gray-200 dark:border-zinc-800 pt-8">
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-zinc-400 hover:text-gray-900 dark:hover:text-zinc-200 transition-colors"
        >
          {open ? <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" /> : <ChevronRight className="w-3.5 h-3.5" aria-hidden="true" />}
          <span>Recent Audits ({entries.length})</span>
        </button>
        <Link
          href="/dashboard"
          className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-800 dark:hover:text-zinc-300 transition-colors"
        >
          View all →
        </Link>
      </div>

      {open && (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="border border-gray-200 dark:border-zinc-800 rounded-lg bg-white dark:bg-zinc-900 overflow-hidden"
            >
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono shrink-0">{formatTime(entry.timestamp)}</span>
                <span className="text-sm text-gray-700 dark:text-zinc-300 truncate flex-1">{entry.inputSnippet}</span>
                <button
                  onClick={(e) => handleDelete(entry.id, e)}
                  className="text-gray-400 dark:text-zinc-500 hover:text-red-400 transition-colors shrink-0 p-1"
                  aria-label={`Delete audit from ${formatTime(entry.timestamp)}`}
                >
                  <X className="w-3.5 h-3.5" />
                </button>
                <ChevronDown className={`w-3.5 h-3.5 text-gray-400 dark:text-zinc-500 transition-transform duration-200 shrink-0 ${expanded === entry.id ? 'rotate-180' : ''}`} aria-hidden="true" />
              </div>

              {expanded === entry.id && (
                <div className="border-t border-gray-200 dark:border-zinc-800 px-4 py-4">
                  <div className="prose prose-sm max-w-prose dark:prose-invert">
                    <SafeMarkdown>{entry.result}</SafeMarkdown>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
