'use client';

import { useRouter } from 'next/navigation';
import { useRef } from 'react';

// Quick-run audit bar that links to /audit with the prompt pre-filled.
export function DashboardHeader() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const val = inputRef.current?.value.trim();
    if (!val) {
      router.push('/audit');
    } else {
      router.push(`/audit?q=${encodeURIComponent(val)}`);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-0 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-xl overflow-hidden mb-0 focus-within:border-violet-400 dark:focus-within:border-violet-500 transition-colors"
    >
      <span className="pl-4 pr-2 text-gray-400 dark:text-zinc-500 flex-shrink-0" aria-hidden="true">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="1" width="12" height="14" rx="2" />
          <path d="M5 5h6M5 8h6M5 11h4" strokeLinecap="round" />
        </svg>
      </span>
      <input
        ref={inputRef}
        type="text"
        placeholder="Paste code or describe what to audit..."
        className="flex-1 bg-transparent py-2.5 pr-2 text-sm text-gray-700 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none font-sans"
        aria-label="Quick audit input"
      />
      <button
        type="submit"
        className="bg-violet-600 hover:bg-violet-500 active:bg-violet-700 text-white text-sm font-medium px-4 py-2.5 transition-colors flex-shrink-0 flex items-center gap-1.5"
      >
        Run audit
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      </button>
    </form>
  );
}
