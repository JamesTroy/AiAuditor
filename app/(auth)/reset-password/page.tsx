'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

export default function ResetPasswordPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') ?? '';
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token && !success) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2">Invalid reset link</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
          This password reset link is invalid or has expired. Please request a new one.
        </p>
        <Link
          href="/forgot-password"
          className="text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 font-medium"
        >
          Request new reset link
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm text-center">
        <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2">Password reset</h2>
        <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
          Your password has been updated. You can now sign in with your new password.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center gap-1 text-sm text-violet-600 dark:text-violet-400 hover:text-violet-500 font-medium"
        >
          Sign in
        </Link>
      </div>
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await authClient.resetPassword({
        newPassword: password,
        token,
      });

      if (authError) {
        setError(authError.message ?? 'Failed to reset password. The link may have expired.');
        setLoading(false);
      } else {
        setSuccess(true);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-2">Set new password</h2>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mb-6">
        Enter your new password below.
      </p>

      {error && (
        <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
            New password
          </label>
          <input
            id="password"
            type="password"
            required
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
            placeholder="Minimum 8 characters"
          />
        </div>

        <div>
          <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
            Confirm password
          </label>
          <input
            id="confirmPassword"
            type="password"
            required
            minLength={8}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
            placeholder="Repeat your password"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-violet-600 hover:bg-violet-500 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-xl px-4 py-2.5 text-sm transition-colors"
        >
          {loading ? 'Resetting...' : 'Reset password'}
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
