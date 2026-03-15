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
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2">Verifying your email</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400">Please wait...</p>
      </div>
    );
  }

  if (status === 'success') {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2">Email verified</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
          Your email has been verified. You can now use all features of your account.
        </p>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 font-medium"
        >
          Go to dashboard
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
