const shimmer = 'animate-pulse bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]';

export default function DashboardLoading() {
  return (
    <div className="px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Header skeleton */}
        <div className="mb-8">
          <div className={`h-8 w-40 rounded mb-2 ${shimmer}`} />
          <div className={`h-4 w-72 rounded ${shimmer}`} />
        </div>

        {/* Stat cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="border border-gray-200 dark:border-zinc-800 rounded-xl p-5">
              <div className={`h-8 w-16 rounded mb-2 ${shimmer}`} />
              <div className={`h-4 w-24 rounded ${shimmer}`} />
            </div>
          ))}
        </div>

        {/* Section header skeleton */}
        <div className={`h-5 w-32 rounded mb-4 ${shimmer}`} />

        {/* Audit rows skeleton */}
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-gray-200 dark:border-zinc-800 rounded-xl px-5 py-4 flex items-center justify-between">
              <div className="space-y-2 flex-1">
                <div className={`h-4 w-48 rounded ${shimmer}`} />
                <div className={`h-3 w-32 rounded ${shimmer}`} />
              </div>
              <div className="flex items-center gap-3">
                <div className={`h-5 w-14 rounded ${shimmer}`} />
                <div className={`h-5 w-20 rounded-full ${shimmer}`} />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
