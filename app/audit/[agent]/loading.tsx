export default function AuditLoading() {
  return (
    <div className="px-6 py-12">
      <div className="max-w-4xl mx-auto">
        {/* Breadcrumb skeleton */}
        <div className="h-4 w-48 bg-gray-200 dark:bg-zinc-800 rounded mb-6 animate-pulse" />

        {/* Agent header skeleton */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-12 h-12 bg-gray-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
          <div>
            <div className="h-7 w-48 bg-gray-200 dark:bg-zinc-800 rounded mb-2 animate-pulse" />
            <div className="h-4 w-64 bg-gray-200 dark:bg-zinc-800 rounded animate-pulse" />
          </div>
        </div>

        {/* Textarea skeleton */}
        <div className="h-48 bg-gray-200 dark:bg-zinc-800 rounded-xl mb-4 animate-pulse" />

        {/* Button skeleton */}
        <div className="h-11 w-32 bg-gray-200 dark:bg-zinc-800 rounded-lg animate-pulse" />
      </div>
    </div>
  );
}
