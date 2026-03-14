'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, authClient } from '@/lib/auth-client';

export default function SettingsPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [passwordSaved, setPasswordSaved] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);

  // Initialize name from session once loaded
  if (session && !name && !saving) {
    setName(session.user.name ?? '');
  }

  if (isPending) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-pulse text-gray-400">Loading...</div>
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSaved(false);

    await authClient.updateUser({ name });

    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setPasswordSaved(false);

    if (newPassword.length < 8) {
      setPasswordError('New password must be at least 8 characters');
      return;
    }

    setChangingPassword(true);

    const { error } = await authClient.changePassword({
      currentPassword,
      newPassword,
    });

    if (error) {
      setPasswordError(error.message ?? 'Failed to change password');
    } else {
      setPasswordSaved(true);
      setCurrentPassword('');
      setNewPassword('');
      setTimeout(() => setPasswordSaved(false), 3000);
    }

    setChangingPassword(false);
  }

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            Manage your account. Authentication is handled by Better Auth with sessions stored in PostgreSQL.
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
                disabled={saving}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium rounded-xl px-4 py-2 text-sm transition-colors"
              >
                {saving ? 'Saving...' : 'Save changes'}
              </button>
              {saved && (
                <span className="text-sm text-green-600 dark:text-green-400">Saved!</span>
              )}
            </div>
          </form>
        </section>

        {/* Change password */}
        <section className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-4">Change password</h2>

          {passwordError && (
            <div className="mb-4 p-3 rounded-lg bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 text-red-700 dark:text-red-400 text-sm">
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
                disabled={changingPassword}
                className="bg-violet-600 hover:bg-violet-500 disabled:opacity-50 text-white font-medium rounded-xl px-4 py-2 text-sm transition-colors"
              >
                {changingPassword ? 'Changing...' : 'Change password'}
              </button>
              {passwordSaved && (
                <span className="text-sm text-green-600 dark:text-green-400">Password updated!</span>
              )}
            </div>
          </form>
        </section>

        {/* Danger zone */}
        <section className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Danger zone</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
            Permanently delete your account and all associated data. This action cannot be undone.
          </p>
          <button
            onClick={async () => {
              if (!confirm('Are you sure you want to delete your account? This cannot be undone.')) return;
              await authClient.deleteUser();
              router.push('/');
              router.refresh();
            }}
            className="bg-red-600 hover:bg-red-500 text-white font-medium rounded-xl px-4 py-2 text-sm transition-colors"
          >
            Delete account
          </button>
        </section>
      </div>
    </div>
  );
}
