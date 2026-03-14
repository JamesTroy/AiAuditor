'use client';

import { useState, useEffect, useCallback } from 'react';
import ReactMarkdown from 'react-markdown';
import { getHistory, deleteAudit, AuditEntry } from '@/lib/history';

interface Props {
  agentId: string;
  refreshTrigger?: number;
}

export default function HistoryPanel({ agentId, refreshTrigger }: Props) {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [open, setOpen] = useState(false);

  const load = useCallback(() => {
    setEntries(getHistory(agentId));
  }, [agentId]);

  useEffect(() => {
    load();
  }, [load, refreshTrigger]);

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
    <div className="mt-10 border-t border-zinc-800 pt-8">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 text-sm text-zinc-400 hover:text-zinc-200 transition-colors mb-4"
      >
        <span className={`transition-transform duration-200 ${open ? 'rotate-90' : ''}`}>▶</span>
        <span>Recent Audits ({entries.length})</span>
      </button>

      {open && (
        <div className="flex flex-col gap-3">
          {entries.map((entry) => (
            <div
              key={entry.id}
              className="border border-zinc-800 rounded-lg bg-zinc-900 overflow-hidden"
            >
              <div
                className="flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-zinc-800/50 transition-colors"
                onClick={() => setExpanded(expanded === entry.id ? null : entry.id)}
              >
                <span className="text-xs text-zinc-500 font-mono shrink-0">{formatTime(entry.timestamp)}</span>
                <span className="text-sm text-zinc-300 truncate flex-1">{entry.inputSnippet}</span>
                <button
                  onClick={(e) => handleDelete(entry.id, e)}
                  className="text-zinc-600 hover:text-red-400 transition-colors text-xs shrink-0"
                  aria-label="Delete entry"
                >
                  ✕
                </button>
                <span className={`text-zinc-500 text-xs transition-transform duration-200 shrink-0 ${expanded === entry.id ? 'rotate-180' : ''}`}>
                  ▼
                </span>
              </div>

              {expanded === entry.id && (
                <div className="border-t border-zinc-800 px-4 py-4">
                  <div className="prose prose-invert prose-sm max-w-none">
                    <ReactMarkdown>{entry.result}</ReactMarkdown>
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
