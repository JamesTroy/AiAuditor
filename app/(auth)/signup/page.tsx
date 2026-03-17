'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signIn, signUp } from '@/lib/auth-client';

const GITHUB_ENABLED = process.env.NEXT_PUBLIC_GITHUB_ENABLED === 'true';
const GOOGLE_ENABLED = process.env.NEXT_PUBLIC_GOOGLE_ENABLED === 'true';
const HAS_OAUTH = GITHUB_ENABLED || GOOGLE_ENABLED;

export default function SignupPage() {
  const router = useRouter();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    setLoading(true);

    try {
      const { error: authError } = await signUp.email({
        name,
        email,
        password,
        callbackURL: '/dashboard',
      });

      if (authError) {
        setError(authError.message ?? 'Something went wrong');
        setLoading(false);
      } else {
        router.push('/dashboard');
        router.refresh();
      }
    } catch (err) {
      // AUTH-007: Log error type only — never log user-supplied data (email, name).
      console.error('[signup] unexpected error', {
        type: err instanceof Error ? err.constructor.name : typeof err,
        message: err instanceof Error ? err.message : 'unknown',
      });
      setError('Unable to create account. Please try again.');
      setLoading(false);
    }
  }

  return (
    <div className="bg-white/90 dark:bg-zinc-900/70 backdrop-blur-sm border border-gray-200 dark:border-zinc-800 rounded-2xl p-8 shadow-sm motion-safe:animate-fade-up">
      <h2 className="text-xl font-semibold text-gray-900 dark:text-zinc-100 mb-6">Create an account</h2>

      {error && (
        <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm motion-safe:animate-fade-up">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
            Name
          </label>
          <input
            id="name"
            type="text"
            required
            autoComplete="name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
            placeholder="Your name"
          />
          <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">Used to personalize your dashboard</p>
        </div>

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

        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
            Password
          </label>
          <input
            id="password"
            type="password"
            required
            autoComplete="new-password"
            minLength={8}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
            placeholder="••••••••"
          />
          {password.length > 0 && (
            <div className="mt-2 flex items-center gap-2">
              <div className="flex-1 h-1.5 rounded-full bg-gray-200 dark:bg-zinc-800 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)
                      ? 'w-full bg-green-500'
                      : password.length >= 8
                        ? 'w-2/3 bg-yellow-500'
                        : 'w-1/3 bg-red-500'
                  }`}
                />
              </div>
              <span className={`text-xs ${
                password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)
                  ? 'text-green-600 dark:text-green-400'
                  : password.length >= 8
                    ? 'text-yellow-600 dark:text-yellow-400'
                    : 'text-red-600 dark:text-red-400'
              }`}>
                {password.length >= 12 && /[A-Z]/.test(password) && /[0-9]/.test(password)
                  ? 'Strong'
                  : password.length >= 8
                    ? 'Fair'
                    : 'Weak'}
              </span>
              {password.length > 0 && password.length < 8 && (
                <span className="text-xs text-red-500 dark:text-red-400 ml-1">· min 8 chars</span>
              )}
            </div>
          )}
          {password.length === 0 && (
            <p className="mt-1 text-xs text-gray-400 dark:text-zinc-500">Minimum 8 characters</p>
          )}
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full inline-flex items-center justify-center gap-2 bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-500 hover:to-indigo-500 disabled-muted text-white font-medium rounded-xl px-4 py-2.5 min-h-[44px] text-sm transition-all focus-ring"
        >
          {loading && (
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
          )}
          {loading ? 'Creating account...' : 'Create account'}
        </button>
      </form>

      {HAS_OAUTH && (
        <>
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200 dark:border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white dark:bg-zinc-900 px-2 text-gray-500 dark:text-zinc-500">
                or continue with
              </span>
            </div>
          </div>

          <div className={`grid gap-3 ${GITHUB_ENABLED && GOOGLE_ENABLED ? 'grid-cols-2' : 'grid-cols-1'}`}>
            {GITHUB_ENABLED && (
              <button
                onClick={() => signIn.social({ provider: 'github', callbackURL: '/' })}
                className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
                  <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z" />
                </svg>
                GitHub
              </button>
            )}
            {GOOGLE_ENABLED && (
              <button
                onClick={() => signIn.social({ provider: 'google', callbackURL: '/' })}
                className="flex items-center justify-center gap-2 bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 dark:text-zinc-300 hover:bg-gray-100 dark:hover:bg-zinc-700 transition-colors"
              >
                <svg className="w-4 h-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
                </svg>
                Google
              </button>
            )}
          </div>
        </>
      )}

      <p className="mt-6 text-center text-sm text-gray-500 dark:text-zinc-500">
        Already have an account?{' '}
        <Link href="/login" className="text-violet-600 dark:text-violet-400 hover:text-violet-500 font-medium">
          Sign in
        </Link>
      </p>
      <p className="mt-4 text-center text-xs text-gray-400 dark:text-zinc-600">
        Join developers running security, performance, and accessibility audits daily.
      </p>
    </div>
  );
}
