'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, authClient } from '@/lib/auth-client';
import TwoFactorSettings from '@/components/TwoFactorSettings';
import ActiveSessions from '@/components/ActiveSessions';

// SM-004: Discriminated form status replaces saving + saved booleans.
type FormStatus = 'idle' | 'saving' | 'saved' | 'error';

export default function SettingsPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [profileStatus, setProfileStatus] = useState<FormStatus>('idle');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordStatus, setPasswordStatus] = useState<FormStatus>('idle');
  // CRED-002: Delete account requires password re-entry.
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  // SM-019: Cleanup timer refs for saved-state reset.
  const profileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // SM-015: Initialize name from session in useEffect, not during render.
  useEffect(() => {
    if (session?.user.name && !name && profileStatus === 'idle') {
      setName(session.user.name);
    }
  }, [session, name, profileStatus]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (profileTimerRef.current) clearTimeout(profileTimerRef.current);
      if (passwordTimerRef.current) clearTimeout(passwordTimerRef.current);
    };
  }, []);

  if (isPending) {
    return (
      <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="h-8 w-32 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
            <div className="h-4 w-64 mt-2 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
              <div className="h-5 w-24 mb-4 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
              <div className="space-y-4">
                <div className="h-10 rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
                <div className="h-10 rounded-xl bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setProfileStatus('saving');

    await authClient.updateUser({ name });

    setProfileStatus('saved');
    if (profileTimerRef.current) clearTimeout(profileTimerRef.current);
    profileTimerRef.current = setTimeout(() => setProfileStatus('idle'), 3000);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordStatus('idle');

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    setPasswordStatus('saving');

    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
    });

    if (error) {
      setPasswordError(error.message ?? 'Failed to change password');
      setPasswordStatus('error');
    } else {
      setPasswordStatus('saved');
      setCurrentPassword('');
      setNewPassword('');
      if (passwordTimerRef.current) clearTimeout(passwordTimerRef.current);
      passwordTimerRef.current = setTimeout(() => setPasswordStatus('idle'), 3000);
    }
  }

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            Manage your profile, security, and account preferences.
          </p>
        </div>

        {/* Profile */}
        <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Profile</h2>
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div>
              <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                Name
              </label>
              <input
                id="name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                Email
              </label>
              <input
                type="email"
                value={session.user.email}
                disabled
                className="w-full bg-gray-100 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm text-gray-500 dark:text-zinc-500 cursor-not-allowed"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={profileStatus === 'saving'}
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled-muted text-white font-medium rounded-xl px-4 py-2 min-h-[44px] text-sm transition-colors focus-ring"
              >
                {profileStatus === 'saving' && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                )}
                {profileStatus === 'saving' ? 'Saving...' : 'Save changes'}
              </button>
              {profileStatus === 'saved' && (
                <span className="text-sm text-green-600 dark:text-green-400 motion-safe:animate-fade-up">Saved!</span>
              )}
            </div>
          </form>
        </section>

        {/* Change password */}
        <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Change password</h2>

          {passwordError && (
            <div role="alert" className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm motion-safe:animate-fade-up">
              {passwordError}
            </div>
          )}

          <form onSubmit={handleChangePassword} className="space-y-4">
            <div>
              <label htmlFor="currentPassword" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                Current password
              </label>
              <input
                id="currentPassword"
                type="password"
                autoComplete="current-password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label htmlFor="newPassword" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                New password
              </label>
              <input
                id="newPassword"
                type="password"
                autoComplete="new-password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={passwordStatus === 'saving'}
                className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled-muted text-white font-medium rounded-xl px-4 py-2 min-h-[44px] text-sm transition-colors focus-ring"
              >
                {passwordStatus === 'saving' && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                )}
                {passwordStatus === 'saving' ? 'Changing...' : 'Change password'}
              </button>
              {passwordStatus === 'saved' && (
                <span className="text-sm text-green-600 dark:text-green-400 motion-safe:animate-fade-up">Password updated!</span>
              )}
            </div>
          </form>
        </section>

        {/* Two-factor authentication */}
        <TwoFactorSettings twoFactorEnabled={session.user.twoFactorEnabled ?? false} />

        {/* Active sessions */}
        <ActiveSessions />

        {/* Danger zone — CRED-002: Requires password re-entry */}
        <section className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Danger zone</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>

          {!showDeleteConfirm ? (
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl px-4 py-2 min-h-[44px] text-sm transition-colors focus-ring"
            >
              Delete account
            </button>
          ) : (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setDeleteError('');
                setDeleteLoading(true);
                try {
                  // Verify password first via a password change to self (validates current password)
                  const { error } = await authClient.deleteUser({ password: deletePassword });
                  if (error) {
                    setDeleteError(error.message ?? 'Incorrect password or deletion failed.');
                    setDeleteLoading(false);
                  } else {
                    router.push('/');
                    router.refresh();
                  }
                } catch {
                  setDeleteError('Failed to delete account. Please try again.');
                  setDeleteLoading(false);
                }
              }}
              className="space-y-3"
            >
              {deleteError && (
                <div role="alert" className="p-3 rounded-lg bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm motion-safe:animate-fade-up">
                  {deleteError}
                </div>
              )}
              <div>
                <label htmlFor="deletePassword" className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                  Enter your password to confirm
                </label>
                <input
                  id="deletePassword"
                  type="password"
                  required
                  value={deletePassword}
                  onChange={(e) => setDeletePassword(e.target.value)}
                  className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-red-500/50 focus:border-red-500 transition-colors"
                  placeholder="Your password"
                />
              </div>
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={deleteLoading || !deletePassword}
                  className="inline-flex items-center gap-2 bg-red-600 hover:bg-red-500 disabled-muted text-white font-medium rounded-xl px-4 py-2 min-h-[44px] text-sm transition-colors focus-ring"
                >
                  {deleteLoading && (
                    <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  )}
                  {deleteLoading ? 'Deleting...' : 'Confirm deletion'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowDeleteConfirm(false); setDeletePassword(''); setDeleteError(''); }}
                  className="text-sm text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 min-h-[44px] px-2 transition-colors"
                >
                  Cancel
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
