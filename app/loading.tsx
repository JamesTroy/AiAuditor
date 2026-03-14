export default function HomeLoading() {
  return (
    <div className="px-6 py-12">
      <div className="max-w-5xl mx-auto">
        {/* Hero skeleton */}
        <div className="text-center mb-12">
          <div className="h-6 w-32 bg-gray-200 dark:bg-zinc-800 rounded-full mx-auto mb-4 animate-pulse" />
          <div className="h-10 w-48 bg-gray-200 dark:bg-zinc-800 rounded-lg mx-auto mb-4 animate-pulse" />
          <div className="h-5 w-80 bg-gray-200 dark:bg-zinc-800 rounded mx-auto mb-2 animate-pulse" />
          <div className="h-4 w-64 bg-gray-200 dark:bg-zinc-800 rounded mx-auto animate-pulse" />
        </div>

        {/* Search skeleton */}
        <div className="mb-10 max-w-lg mx-auto">
          <div className="h-11 bg-gray-200 dark:bg-zinc-800 rounded-xl animate-pulse" />
        </div>

        {/* Card grid skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="border border-gray-200 dark:border-zinc-800 rounded-xl p-6">
              <div className="w-10 h-10 bg-gray-200 dark:bg-zinc-800 rounded-lg mb-3 animate-pulse" />
              <div className="h-6 w-3/4 bg-gray-200 dark:bg-zinc-800 rounded mb-2 animate-pulse" />
              <div className="h-4 w-full bg-gray-200 dark:bg-zinc-800 rounded mb-1 animate-pulse" />
              <div className="h-4 w-2/3 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
