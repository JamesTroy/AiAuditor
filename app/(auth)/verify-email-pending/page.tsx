'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

export default function VerifyEmailPendingPage() {
  const searchParams = useSearchParams();
  const email = searchParams.get('email') ?? '';

  return (
    <div className="bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm motion-safe:animate-fade-up text-center">
      <div className="flex justify-center mb-4">
        <svg className="w-10 h-10 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <rect x="2" y="4" width="20" height="16" rx="2" />
          <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
        </svg>
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2">Check your inbox</h2>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
        We sent a verification link to{' '}
        {email && <strong className="text-gray-700 dark:text-zinc-300">{email}</strong>}.{' '}
        Click the link to activate your account and start auditing.
      </p>
      <p className="text-xs text-gray-400 dark:text-zinc-600">
        Didn&apos;t receive it? Check your spam folder or{' '}
        <Link href="/signup" className="text-violet-600 dark:text-violet-400 hover:text-violet-500 underline underline-offset-2">
          try a different email
        </Link>
        .
      </p>
    </div>
  );
}
