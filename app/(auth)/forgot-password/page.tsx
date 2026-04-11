'use client';

import { useState } from 'react';
import Link from 'next/link';

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const res = await fetch('/api/auth/forget-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, redirectTo: '/reset-password' }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(data?.message ?? 'Something went wrong');
      } else {
        setSent(true);
      }
    } catch {
      setError('Network error. Please try again.');
    }

    setLoading(false);
  }

  if (sent) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm text-center motion-safe:animate-fade-up">
        <div className="flex justify-center mb-4">
          <svg className="w-10 h-10 text-violet-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="2" y="4" width="20" height="16" rx="2" /><path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" /></svg>
        </div>
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2">Check your email</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
          If an account exists for <strong>{email}</strong>, we sent a password reset link.
        </p>
        <Link
          href="/login"
          className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 font-medium"
        >
          Back to sign in
        </Link>
      </div>
    );
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2">Reset your password</h2>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
        Enter your email and we&apos;ll send you a reset link.
      </p>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm motion-safe:animate-fade-up">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="email" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
            Email
          </label>
          <input
            id="email"
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
            placeholder="you@example.com"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-violet-600 hover:bg-violet-500 disabled-muted text-white font-medium rounded-xl px-4 py-2.5 min-h-[44px] text-sm transition-colors focus-ring"
        >
          {loading && (
            <svg className="w-4 h-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          )}
          {loading ? 'Sending...' : 'Send reset link'}
        </button>
      </form>

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-500">
        <Link href="/login" className="text-violet-600 dark:text-violet-400 hover:text-violet-500 font-medium">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
