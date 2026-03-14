'use client';

import Link from 'next/link';

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center max-w-md">
        <div className="w-14 h-14 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
          <span className="text-2xl" role="img" aria-label="warning">⚠️</span>
        </div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100 mb-2">Something went wrong</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mb-6">
          An error occurred while loading this page.
        </p>
        {error.digest && (
          <p className="text-gray-400 dark:text-zinc-600 text-xs mb-4 font-mono">Error ID: {error.digest}</p>
        )}
        <div className="flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors focus-ring"
          >
            Try again
          </button>
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors focus-ring"
          >
            Go home
          </Link>
        </div>
      </div>
    </div>
  );
}
