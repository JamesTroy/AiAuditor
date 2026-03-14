export default function SiteAuditLoading() {
  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12 animate-pulse">
      <div className="max-w-4xl mx-auto">
        {/* Header skeleton */}
        <div className="text-center mb-10">
          <div className="h-9 w-64 bg-gray-200 dark:bg-zinc-800 rounded-lg mx-auto mb-3" />
          <div className="h-5 w-96 max-w-full bg-gray-200 dark:bg-zinc-800 rounded-lg mx-auto" />
        </div>

        {/* Input skeleton */}
        <div className="flex flex-col sm:flex-row gap-3 mb-8">
          <div className="flex-1 h-13 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
          <div className="h-13 w-40 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
        </div>

        {/* Agent cards skeleton */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-24 bg-gray-200 dark:bg-zinc-800 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
