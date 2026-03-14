import Logo from '@/components/Logo';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 -z-20" />
      {/* Decorative gradient orbs */}
      <div className="absolute top-1/4 right-1/4 w-72 h-72 bg-violet-500/15 blur-3xl rounded-full -z-10 pointer-events-none" />
      <div className="absolute bottom-1/4 left-1/4 w-80 h-80 bg-indigo-500/10 blur-3xl rounded-full -z-10 pointer-events-none" />
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern -z-10 opacity-30 pointer-events-none" />

      <div className="w-full max-w-md">
        <div className="text-center mb-8 flex flex-col items-center">
          <Logo size={36} className="mb-3 drop-shadow-[0_0_12px_rgba(139,92,246,0.3)]" />
          <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Claudit</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            AI-powered code audits
          </p>
        </div>
        {children}
      </div>
    </div>
  );
}
