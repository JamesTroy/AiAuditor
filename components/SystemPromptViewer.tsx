'use client';

import { useState } from 'react';

interface Props {
  prompt: string;
}

export default function SystemPromptViewer({ prompt }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <details className="mt-4 group">
      <summary className="cursor-pointer text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-600 dark:hover:text-zinc-300 transition-colors list-none flex items-center gap-1 select-none">
        <span className="transition-transform duration-200 group-open:rotate-90">▶</span>
        View system prompt
      </summary>
      <div className="mt-3 border border-gray-200 dark:border-zinc-800 rounded-lg overflow-hidden">
        <div className="flex items-center justify-between px-4 py-2 bg-gray-100 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-800">
          <span className="text-xs text-gray-400 dark:text-zinc-500 font-mono uppercase tracking-widest">System Prompt</span>
          <button
            onClick={handleCopy}
            className="text-xs text-gray-400 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-200 px-2 py-1 rounded hover:bg-gray-200 dark:hover:bg-zinc-700 transition-colors"
          >
            {copied ? '✓ Copied' : 'Copy'}
          </button>
        </div>
        <pre className="p-4 text-xs font-mono text-gray-600 dark:text-zinc-400 bg-white dark:bg-zinc-950 overflow-x-auto whitespace-pre-wrap leading-relaxed max-h-96 overflow-y-auto">
          {prompt}
        </pre>
      </div>
    </details>
  );
}
