export default function HistoryLoading() {
  return (
    <div className="px-6 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-8 w-36 bg-gray-200 dark:bg-zinc-800 rounded mb-2 animate-pulse" />
          <div className="h-4 w-80 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
        </div>

        {/* History entries skeleton */}
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="h-5 w-40 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
                <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
              </div>
              <div className="h-4 w-full bg-gray-200 dark:bg-zinc-800 rounded mb-1 animate-pulse" />
              <div className="h-4 w-2/3 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
