'use client';

import { useState } from 'react';

interface Props {
  prompt: string;
}

export default function PrepPromptBox({ prompt }: Props) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    await navigator.clipboard.writeText(prompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="mt-5 border border-blue-200 dark:border-blue-900 rounded-lg overflow-hidden bg-blue-50 dark:bg-blue-950/30">
      <div className="flex items-start justify-between gap-4 px-4 py-3">
        <div>
          <p className="text-xs font-semibold text-blue-700 dark:text-blue-300 uppercase tracking-widest mb-0.5">
            Workspace Prep Prompt
          </p>
          <p className="text-xs text-blue-600 dark:text-blue-400">
            Paste this into Claude, ChatGPT, Cursor, or your preferred AI tool. It will structure your code into the ideal format for this audit — then paste the result here.
          </p>
        </div>
        <button
          onClick={handleCopy}
          className="shrink-0 text-xs font-medium px-3 py-1.5 rounded-md bg-blue-600 hover:bg-blue-500 text-white transition-colors"
        >
          {copied ? '✓ Copied' : 'Copy prompt'}
        </button>
      </div>
      <details className="group">
        <summary className="cursor-pointer px-4 py-2 text-xs text-blue-500 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 border-t border-blue-200 dark:border-blue-900 list-none flex items-center gap-1 select-none transition-colors">
          <span className="transition-transform duration-200 group-open:rotate-90">▶</span>
          Preview prompt
        </summary>
        <pre className="px-4 py-3 text-xs font-mono text-blue-700 dark:text-blue-300 whitespace-pre-wrap leading-relaxed border-t border-blue-200 dark:border-blue-900 bg-blue-50/50 dark:bg-blue-950/20 max-h-72 overflow-y-auto">
          {prompt}
        </pre>
      </details>
    </div>
  );
}
