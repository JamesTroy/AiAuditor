import type { Metadata } from 'next';
import Logo from '@/components/Logo';
import AuthAnimatedShell from './AuthAnimatedShell';

export const metadata: Metadata = {
  robots: { index: false, follow: false },
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 flex items-center justify-center px-4 py-12 relative overflow-hidden">
      {/* Gradient mesh background */}
      <div className="absolute inset-0 bg-gradient-to-br from-gray-50 via-gray-100 to-gray-50 dark:from-zinc-950 dark:via-zinc-900 dark:to-zinc-950 -z-20" />
      {/* PERF: Decorative gradient orbs. Was two blur-3xl (64px filter
          blur) on solid-color rounded divs — each one independently caps
          compositor refresh rate. Replaced with CSS radial-gradient
          backgrounds: same soft-glow visual, zero paint cost per frame
          because gradients compose as flat layers. */}
      <div
        className="absolute top-1/4 right-1/4 w-72 h-72 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, rgba(139,92,246,0.15), transparent 70%)' }}
      />
      <div
        className="absolute bottom-1/4 left-1/4 w-80 h-80 -z-10 pointer-events-none"
        style={{ background: 'radial-gradient(closest-side, rgba(99,102,241,0.10), transparent 70%)' }}
      />
      {/* Grid pattern overlay */}
      <div className="absolute inset-0 bg-grid-pattern -z-10 opacity-30 pointer-events-none" />

      <AuthAnimatedShell
        title={
          <>
            <Logo size={36} className="mb-3 drop-shadow-[0_0_12px_rgba(139,92,246,0.3)]" />
            <h1 className="text-2xl font-bold text-gray-900 dark:text-zinc-100">Claudit</h1>
            <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
              Automated security, performance, and compliance audits
            </p>
            <p className="text-xs text-gray-400 dark:text-zinc-600 mt-2">
              Create an account → Verify email → Run your first audit
            </p>
          </>
        }
      >
        {children}
      </AuthAnimatedShell>
    </div>
  );
}
