'use client';

import { useEffect } from 'react';

interface Props {
  onClose: () => void;
}

const SHORTCUTS = [
  { key: '⌘ Enter', description: 'Run audit (in input area)' },
  { key: 'Esc', description: 'Stop streaming / close modal' },
  { key: '⌘ K', description: 'Focus agent search (homepage)' },
  { key: '?', description: 'Open this shortcuts reference' },
];

export default function KeyboardShortcutsModal({ onClose }: Props) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 dark:bg-black/70 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="shortcuts-title"
    >
      <div className="w-full max-w-sm bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-2xl shadow-2xl">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-zinc-800">
          <h2 id="shortcuts-title" className="text-base font-semibold text-gray-900 dark:text-zinc-100">
            Keyboard Shortcuts
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 transition-colors text-xl leading-none"
            aria-label="Close"
          >
            ✕
          </button>
        </div>
        <div className="px-6 py-5 flex flex-col gap-3">
          {SHORTCUTS.map(({ key, description }) => (
            <div key={key} className="flex items-center justify-between gap-4">
              <span className="text-sm text-gray-600 dark:text-zinc-400">{description}</span>
              <kbd className="shrink-0 font-mono text-xs bg-gray-100 dark:bg-zinc-800 text-gray-700 dark:text-zinc-300 border border-gray-300 dark:border-zinc-700 rounded px-2 py-1">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
