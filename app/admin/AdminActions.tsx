'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: Date;
  banned: boolean | null;
  banReason: string | null;
}

export default function AdminActions({ users }: { users: UserRow[] }) {
  const router = useRouter();
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banTarget, setBanTarget] = useState<string | null>(null);

  const filtered = users.filter(
    (u) =>
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase()),
  );

  async function setRole(userId: string, role: 'admin' | 'user') {
    setLoading(userId);
    try {
      await authClient.admin.setRole({ userId, role });
      router.refresh();
    } catch (e: any) {
      alert(e.message || 'Failed to update role');
    } finally {
      setLoading(null);
    }
  }

  async function toggleBan(userId: string, banned: boolean) {
    if (!banned && !banReason.trim()) {
      setBanTarget(userId);
      return;
    }
    setLoading(userId);
    try {
      if (banned) {
        await authClient.admin.unbanUser({ userId });
      } else {
        await authClient.admin.banUser({ userId, banReason: banReason.trim() || 'Banned by admin' });
        setBanTarget(null);
        setBanReason('');
      }
      router.refresh();
    } catch (e: any) {
      alert(e.message || 'Failed to update ban status');
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">User Management</h2>

      <div className="mb-4">
        <input
          type="text"
          placeholder="Search users by name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full sm:w-80 px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
        />
      </div>

      <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/80">
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Name</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Email</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Role</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Status</th>
                <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Joined</th>
                <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {filtered.map((u) => (
                <tr key={u.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-3 font-medium truncate max-w-[160px]">{u.name}</td>
                  <td className="px-4 py-3 text-gray-500 dark:text-zinc-400 truncate max-w-[200px]">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                      u.role === 'admin'
                        ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400'
                        : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                    }`}>
                      {u.role || 'user'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {u.banned ? (
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                        title={u.banReason || undefined}
                      >
                        Banned
                      </span>
                    ) : (
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400">
                        Active
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 dark:text-zinc-500 text-xs">
                    {new Date(u.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {u.role === 'admin' ? (
                        <button
                          onClick={() => setRole(u.id, 'user')}
                          disabled={loading === u.id}
                          className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-50"
                        >
                          Revoke Admin
                        </button>
                      ) : (
                        <button
                          onClick={() => setRole(u.id, 'admin')}
                          disabled={loading === u.id}
                          className="text-xs px-2.5 py-1 rounded-lg border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors disabled:opacity-50"
                        >
                          Grant Admin
                        </button>
                      )}

                      {u.banned ? (
                        <button
                          onClick={() => toggleBan(u.id, true)}
                          disabled={loading === u.id}
                          className="text-xs px-2.5 py-1 rounded-lg border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors disabled:opacity-50"
                        >
                          Unban
                        </button>
                      ) : (
                        <button
                          onClick={() => toggleBan(u.id, false)}
                          disabled={loading === u.id}
                          className="text-xs px-2.5 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:opacity-50"
                        >
                          Ban
                        </button>
                      )}
                    </div>

                    {/* Ban reason modal inline */}
                    {banTarget === u.id && (
                      <div className="mt-2 flex items-center gap-2 justify-end">
                        <input
                          type="text"
                          placeholder="Ban reason…"
                          value={banReason}
                          onChange={(e) => setBanReason(e.target.value)}
                          className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 w-40 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                        />
                        <button
                          onClick={() => toggleBan(u.id, false)}
                          disabled={loading === u.id}
                          className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors disabled:opacity-50"
                        >
                          Confirm
                        </button>
                        <button
                          onClick={() => { setBanTarget(null); setBanReason(''); }}
                          className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
                        >
                          Cancel
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-zinc-600 text-sm">
                    No users found.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
