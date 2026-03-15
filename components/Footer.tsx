import Link from 'next/link';
import Logo from '@/components/Logo';

export default function Footer() {
  return (
    <footer className="border-t border-gray-200/50 dark:border-zinc-800/50 py-8 mt-auto">
      <div className="max-w-5xl mx-auto px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <Link href="/" className="flex items-center gap-2 text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors">
          <Logo size={20} />
          <span className="text-xs font-medium">Claudit</span>
        </Link>

        <p className="text-xs text-gray-400 dark:text-zinc-600">
          AI-powered code auditing
        </p>

        <div className="flex items-center gap-4">
          <Link href="/stack" className="text-xs text-gray-400 dark:text-zinc-600 hover:text-gray-600 dark:hover:text-zinc-400 transition-colors">
            Stack
          </Link>
        </div>
      </div>
    </footer>
  );
}
