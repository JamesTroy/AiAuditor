'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import SafeMarkdown from '@/components/markdownComponents';
import { setChainInput } from '@/lib/session';

interface Props {
  result: string | null;
  agentName: string;
  agentId: string;
  input: string;
  status?: string;
}

export default function AuditResultView({ result, agentName, agentId, input, status }: Props) {
  const router = useRouter();
  const [copied, setCopied] = useState(false);

  if (!result) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-8 text-center">
        {status === 'failed' ? (
          <>
            <p className="text-gray-900 dark:text-zinc-100 font-medium mb-1">This audit did not complete</p>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
              The analysis may have timed out or encountered an error. Try running it again.
            </p>
            <Link
              href="/site-audit"
              className="inline-block px-5 py-2 rounded-xl text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 transition-colors focus-ring"
            >
              Run a new audit
            </Link>
          </>
        ) : (
          <p className="text-gray-500 dark:text-zinc-500">No result available for this audit.</p>
        )}
      </div>
    );
  }

  function handleDownload() {
    const blob = new Blob([result!], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${agentName.toLowerCase().replace(/\s+/g, '-')}-audit.md`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(result!);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback: clipboard API may be unavailable in insecure contexts
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <button
          onClick={() => {
            setChainInput(input);
            router.push(`/audit/${agentId}`);
          }}
          className="text-xs text-violet-600 dark:text-violet-400 hover:text-violet-500 border border-violet-300 dark:border-violet-700 rounded-lg px-3 py-1.5 min-h-[44px] transition-colors focus-ring font-medium"
        >
          Re-audit
        </button>
        <button
          onClick={handleCopy}
          className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 min-h-[44px] transition-colors focus-ring"
        >
          {copied ? 'Copied!' : 'Copy'}
        </button>
        <button
          onClick={handleDownload}
          className="text-xs text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 border border-gray-300 dark:border-zinc-700 rounded-lg px-3 py-1.5 min-h-[44px] transition-colors focus-ring"
        >
          Download .md
        </button>
      </div>
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 prose prose-sm dark:prose-invert max-w-none">
        <SafeMarkdown>{result}</SafeMarkdown>
      </div>
    </>
  );
}
