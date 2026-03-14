export default function DashboardLoading() {
  return (
    <div className="px-6 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className="h-8 w-40 bg-gray-200 dark:bg-zinc-800 rounded mb-2 animate-pulse" />
          <div className="h-4 w-72 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-10">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
              <div className="h-4 w-24 bg-gray-200 dark:bg-zinc-800 rounded mb-3 animate-pulse" />
              <div className="h-8 w-16 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="border border-gray-200 dark:border-zinc-800 rounded-xl p-6">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4 py-3 border-b border-gray-100 dark:border-zinc-800/50 last:border-0">
              <div className="h-4 w-1/4 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-1/3 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
              <div className="h-4 w-16 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
