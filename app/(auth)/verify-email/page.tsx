'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export default function VerifyEmailPage() {
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [status, setStatus] = useState<'verifying' | 'success' | 'error'>('verifying');
  const [error, setError] = useState('');

  useEffect(() => {
    if (!token) {
      setStatus('error');
      setError('Invalid or missing verification link.');
      return;
    }

    authClient.verifyEmail({ query: { token } }).then(({ error: authError }) => {
      if (authError) {
        setStatus('error');
        setError(authError.message ?? 'Verification failed. The link may have expired.');
      } else {
        setStatus('success');
      }
    }).catch(() => {
      setStatus('error');
      setError('Something went wrong. Please try again.');
    });
  }, [token]);

  if (status === 'verifying') {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm text-center">
        <div className="flex justify-center mb-4">
          <svg className="w-8 h-8 text-violet-500 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2">Verifying your email</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Please wait...</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm text-center motion-safe:animate-fade-up">
        <div className="flex justify-center mb-4">
          <svg className="w-10 h-10 text-green-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" /></svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2">Email verified</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">Your email has been verified. You&apos;re ready to run your first security, performance, and accessibility audit.</p>
        <Link
          href="/site-audit"
          className="inline-flex items-center gap-1 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 font-medium"
        >
          Run your first audit
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm text-center">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2">Verification failed</h2>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">{error}</p>
      <Link
        href="/login"
        className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 font-medium"
      >
        Back to sign in
      </Link>
    </div>
  );
}
