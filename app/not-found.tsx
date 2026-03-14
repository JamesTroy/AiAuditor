import Link from 'next/link';
import Logo from '@/components/Logo';

export default function NotFound() {
  return (
    <div className="flex items-center justify-center min-h-[60vh] px-6">
      <div className="text-center max-w-md">
        <Logo size={48} className="mx-auto mb-6 opacity-30" />
        <h1 className="text-5xl font-bold text-gray-900 dark:text-zinc-100 mb-2">404</h1>
        <p className="text-gray-500 dark:text-zinc-400 text-sm mb-6">
          This page doesn&apos;t exist or has been moved.
        </p>
        <div className="flex items-center justify-center gap-3">
          <Link
            href="/"
            className="px-5 py-2.5 rounded-lg bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors focus-ring"
          >
            Browse agents
          </Link>
          <Link
            href="/dashboard"
            className="px-5 py-2.5 rounded-lg border border-gray-300 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 text-sm font-medium hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors focus-ring"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
