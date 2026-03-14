'use client';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en" className="dark">
      <body className="bg-zinc-950 text-zinc-100 flex items-center justify-center min-h-screen px-6">
        <div className="text-center max-w-md">
          <div className="w-16 h-16 mx-auto mb-6 rounded-2xl bg-red-500/10 flex items-center justify-center">
            <span className="text-3xl" role="img" aria-label="warning">⚠️</span>
          </div>
          <h1 className="text-2xl font-bold mb-2">Something went wrong</h1>
          <p className="text-zinc-400 text-sm mb-6">
            An unexpected error occurred. Please try again.
          </p>
          {error.digest && (
            <p className="text-zinc-600 text-xs mb-4 font-mono">Error ID: {error.digest}</p>
          )}
          <button
            onClick={reset}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors focus-ring"
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
