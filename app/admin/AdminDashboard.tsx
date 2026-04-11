'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';

// ─── Types ──────────────────────────────────────────────────────

interface UserRow {
  id: string;
  name: string;
  email: string;
  role: string | null;
  createdAt: Date;
  banned: boolean | null;
  banReason: string | null;
}

interface AuditRow {
  id: string;
  agentName: string;
  status: string;
  score: number | null;
  createdAt: Date;
  userId: string;
  userName: string | null;
  userEmail: string | null;
}

interface OrgRow {
  id: string;
  name: string;
  slug: string;
  createdAt: Date;
  memberCount: number;
}

interface TopUser {
  userId: string;
  userName: string;
  userEmail: string;
  auditCount: number;
}

interface Stats {
  totalUsers: number;
  totalAudits: number;
  totalOrgs: number;
  activeSessions: number;
  auditsToday: number;
  auditsThisWeek: number;
  auditsThisMonth: number;
  completedAudits: number;
  failedAudits: number;
  successRate: number;
}

interface DismissalStatRow {
  agentId: string;
  agentName: string;
  dismissals: number;
  restorations: number;
  dismissalsCritical: number;
  dismissalsHigh: number;
  dismissalsMedium: number;
  dismissalsLow: number;
  dismissalsCertain: number;
  dismissalsLikely: number;
  updatedAt: Date;
}

interface Props {
  stats: Stats;
  users: UserRow[];
  audits: AuditRow[];
  orgs: OrgRow[];
  topUsers: TopUser[];
  currentUserId: string;
  dismissalStats: DismissalStatRow[];
}

type Tab = 'overview' | 'users' | 'audits' | 'orgs' | 'agent-health';

// ─── Component ──────────────────────────────────────────────────

export default function AdminDashboard({ stats, users, audits, orgs, topUsers, currentUserId, dismissalStats }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<Tab>('overview');
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'user' | 'banned'>('all');
  const [loading, setLoading] = useState<string | null>(null);
  const [banReason, setBanReason] = useState('');
  const [banTarget, setBanTarget] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ userId: string; action: string } | null>(null);
  const [userPage, setUserPage] = useState(0);
  const [auditPage, setAuditPage] = useState(0);
  const USERS_PER_PAGE = 20;
  const AUDITS_PER_PAGE = 15;

  // ─── User filtering & pagination ──────────────────────────────

  const filteredUsers = users.filter((u) => {
    const matchesSearch =
      u.name?.toLowerCase().includes(search.toLowerCase()) ||
      u.email.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (roleFilter === 'admin') return u.role === 'admin';
    if (roleFilter === 'banned') return u.banned;
    if (roleFilter === 'user') return u.role !== 'admin' && !u.banned;
    return true;
  });

  const totalUserPages = Math.ceil(filteredUsers.length / USERS_PER_PAGE);
  const pagedUsers = filteredUsers.slice(userPage * USERS_PER_PAGE, (userPage + 1) * USERS_PER_PAGE);

  const totalAuditPages = Math.ceil(audits.length / AUDITS_PER_PAGE);
  const pagedAudits = audits.slice(auditPage * AUDITS_PER_PAGE, (auditPage + 1) * AUDITS_PER_PAGE);

  // ─── Actions ──────────────────────────────────────────────────

  async function setRole(userId: string, role: 'admin' | 'user') {
    setLoading(userId);
    try {
      await authClient.admin.setRole({ userId, role });
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message :'Failed to update role');
    } finally {
      setLoading(null);
      setConfirmAction(null);
    }
  }

  async function toggleBan(userId: string, currentlyBanned: boolean) {
    if (!currentlyBanned && !banReason.trim()) {
      setBanTarget(userId);
      return;
    }
    setLoading(userId);
    try {
      if (currentlyBanned) {
        await authClient.admin.unbanUser({ userId });
      } else {
        await authClient.admin.banUser({ userId, banReason: banReason.trim() || 'Banned by admin' });
        setBanTarget(null);
        setBanReason('');
      }
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message :'Failed to update ban status');
    } finally {
      setLoading(null);
      setConfirmAction(null);
    }
  }

  async function deleteUser(userId: string) {
    setLoading(userId);
    try {
      await authClient.admin.removeUser({ userId });
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message :'Failed to delete user');
    } finally {
      setLoading(null);
      setConfirmAction(null);
    }
  }

  async function impersonateUser(userId: string) {
    setLoading(userId);
    try {
      await authClient.admin.impersonateUser({ userId });
      router.push('/dashboard');
      router.refresh();
    } catch (e: unknown) {
      alert(e instanceof Error ? e.message :'Failed to impersonate user');
    } finally {
      setLoading(null);
    }
  }

  function exportUsersCSV() {
    const headers = ['Name', 'Email', 'Role', 'Status', 'Joined'];
    const rows = filteredUsers.map((u) => [
      u.name,
      u.email,
      u.role || 'user',
      u.banned ? 'Banned' : 'Active',
      new Date(u.createdAt).toLocaleDateString(),
    ]);
    const csv = [headers, ...rows].map((r) => r.map((c) => `"${c}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `users-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  // ─── Shared UI helpers ────────────────────────────────────────

  const tabClass = (t: Tab) =>
    `px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
      tab === t
        ? 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-400'
        : 'text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800'
    }`;

  const cardClass = 'bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl';

  function Pagination({ page, total, setPage }: { page: number; total: number; setPage: (p: number) => void }) {
    if (total <= 1) return null;
    return (
      <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-zinc-800">
        <p className="text-xs text-gray-500 dark:text-zinc-500">
          Page {page + 1} of {total}
        </p>
        <div className="flex gap-2">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="text-xs px-3 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30"
          >
            Previous
          </button>
          <button
            onClick={() => setPage(Math.min(total - 1, page + 1))}
            disabled={page >= total - 1}
            className="text-xs px-3 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:opacity-30"
          >
            Next
          </button>
        </div>
      </div>
    );
  }

  // ─── Confirmation Dialog ──────────────────────────────────────

  function ConfirmDialog() {
    if (!confirmAction) return null;
    const u = users.find((u) => u.id === confirmAction.userId);
    if (!u) return null;
    const labels: Record<string, { title: string; desc: string; btn: string; color: string }> = {
      'grant-admin': {
        title: 'Grant Admin',
        desc: `Make ${u.name} an admin? They will have full access to this dashboard.`,
        btn: 'Grant Admin',
        color: 'bg-violet-600 hover:bg-violet-500',
      },
      'revoke-admin': {
        title: 'Revoke Admin',
        desc: `Remove admin access from ${u.name}?`,
        btn: 'Revoke Admin',
        color: 'bg-gray-600 hover:bg-gray-500',
      },
      delete: {
        title: 'Delete User',
        desc: `Permanently delete ${u.name} (${u.email})? This cannot be undone. Their audits will also be deleted.`,
        btn: 'Delete User',
        color: 'bg-red-600 hover:bg-red-500',
      },
    };
    const l = labels[confirmAction.action];
    if (!l) return null;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className={`${cardClass} p-6 max-w-sm mx-4 shadow-xl`}>
          <h3 className="text-lg font-semibold mb-2">{l.title}</h3>
          <p className="text-sm text-gray-600 dark:text-zinc-400 mb-6">{l.desc}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={() => setConfirmAction(null)}
              className="text-sm px-4 py-2 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => {
                if (confirmAction.action === 'grant-admin') setRole(u.id, 'admin');
                else if (confirmAction.action === 'revoke-admin') setRole(u.id, 'user');
                else if (confirmAction.action === 'delete') deleteUser(u.id);
              }}
              disabled={loading === u.id}
              className={`text-sm px-4 py-2 rounded-lg text-white ${l.color} transition-colors disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed`}
            >
              {loading === u.id ? 'Processing…' : l.btn}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ─── Overview Tab ─────────────────────────────────────────────

  function OverviewTab() {
    return (
      <div className="space-y-8">
        {/* Stat cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Users', value: stats.totalUsers, color: 'border-l-violet-500' },
            { label: 'Audits', value: stats.totalAudits, color: 'border-l-emerald-500' },
            { label: 'Teams', value: stats.totalOrgs, color: 'border-l-blue-500' },
            { label: 'Active Sessions', value: stats.activeSessions, color: 'border-l-amber-500' },
          ].map((stat) => (
            <div key={stat.label} className={`${cardClass} border-l-2 ${stat.color} p-5 shadow-sm`}>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Audit activity */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'Today', value: stats.auditsToday },
            { label: 'This Week', value: stats.auditsThisWeek },
            { label: 'This Month', value: stats.auditsThisMonth },
            { label: 'Success Rate', value: `${stats.successRate}%` },
          ].map((stat) => (
            <div key={stat.label} className={`${cardClass} p-5 shadow-sm`}>
              <p className="text-2xl font-bold">{stat.value}</p>
              <p className="text-xs text-gray-500 dark:text-zinc-500 mt-1">{stat.label}</p>
            </div>
          ))}
        </div>

        {/* Pass / Fail breakdown */}
        <div className={`${cardClass} p-5 shadow-sm`}>
          <h3 className="text-sm font-semibold mb-3">Audit Results</h3>
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <div className="h-3 rounded-full bg-gray-100 dark:bg-zinc-800 overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-[width]"
                  style={{ width: `${stats.successRate}%` }}
                />
              </div>
            </div>
            <div className="flex gap-4 text-xs">
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                {stats.completedAudits} passed
              </span>
              <span className="text-red-600 dark:text-red-400 font-medium">
                {stats.failedAudits} failed
              </span>
              <span className="text-gray-500 dark:text-zinc-500">
                {stats.totalAudits - stats.completedAudits - stats.failedAudits} other
              </span>
            </div>
          </div>
        </div>

        {/* Top Users */}
        <div className={`${cardClass} overflow-hidden shadow-sm`}>
          <div className="px-5 py-4 border-b border-gray-100 dark:border-zinc-800">
            <h3 className="text-sm font-semibold">Most Active Users</h3>
          </div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/80">
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-zinc-500">#</th>
                <th className="text-left px-4 py-2.5 font-medium text-gray-500 dark:text-zinc-500">User</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-500 dark:text-zinc-500">Audits</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
              {topUsers.map((u, i) => (
                <tr key={u.userId} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                  <td className="px-4 py-2.5 text-gray-400 dark:text-zinc-600 font-mono text-xs">{i + 1}</td>
                  <td className="px-4 py-2.5">
                    <p className="font-medium truncate max-w-[200px]">{u.userName}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">{u.userEmail}</p>
                  </td>
                  <td className="px-4 py-2.5 text-right font-mono text-sm font-medium">{u.auditCount}</td>
                </tr>
              ))}
              {topUsers.length === 0 && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-gray-400 dark:text-zinc-600 text-sm">
                    No audit data yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ─── Users Tab ────────────────────────────────────────────────

  function UsersTab() {
    return (
      <div>
        <div className="flex flex-col sm:flex-row gap-3 mb-4">
          <input
            type="text"
            placeholder="Search users by name or email…"
            value={search}
            onChange={(e) => { setSearch(e.target.value); setUserPage(0); }}
            className="flex-1 sm:max-w-sm px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          />
          <select
            value={roleFilter}
            onChange={(e) => { setRoleFilter(e.target.value as typeof roleFilter); setUserPage(0); }}
            className="px-3 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 focus:outline-none focus:ring-2 focus:ring-violet-500/40"
          >
            <option value="all">All Users ({users.length})</option>
            <option value="admin">Admins ({users.filter((u) => u.role === 'admin').length})</option>
            <option value="user">Regular ({users.filter((u) => u.role !== 'admin' && !u.banned).length})</option>
            <option value="banned">Banned ({users.filter((u) => u.banned).length})</option>
          </select>
          <button
            onClick={exportUsersCSV}
            className="px-4 py-2 text-sm rounded-lg border border-gray-200 dark:border-zinc-800 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors"
          >
            Export CSV
          </button>
        </div>

        <p className="text-xs text-gray-500 dark:text-zinc-500 mb-3">
          Showing {filteredUsers.length} of {users.length} users
        </p>

        <div className={`${cardClass} overflow-hidden`}>
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
                {pagedUsers.map((u) => (
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
                        <span
                          className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
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
                      <div className="flex items-center justify-end gap-1.5">
                        {/* Impersonate */}
                        {u.id !== currentUserId && (
                          <button
                            onClick={() => impersonateUser(u.id)}
                            disabled={loading === u.id}
                            title="Sign in as this user"
                            className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-500 dark:text-zinc-500 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
                          >
                            Impersonate
                          </button>
                        )}

                        {/* Role toggle */}
                        {u.id !== currentUserId && (
                          u.role === 'admin' ? (
                            <button
                              onClick={() => setConfirmAction({ userId: u.id, action: 'revoke-admin' })}
                              disabled={loading === u.id}
                              className="text-xs px-2 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 text-gray-600 dark:text-zinc-400 hover:bg-gray-100 dark:hover:bg-zinc-800 transition-colors disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
                            >
                              Revoke Admin
                            </button>
                          ) : (
                            <button
                              onClick={() => setConfirmAction({ userId: u.id, action: 'grant-admin' })}
                              disabled={loading === u.id}
                              className="text-xs px-2 py-1 rounded-lg border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
                            >
                              Grant Admin
                            </button>
                          )
                        )}

                        {/* Ban toggle */}
                        {u.id !== currentUserId && (
                          u.banned ? (
                            <button
                              onClick={() => toggleBan(u.id, true)}
                              disabled={loading === u.id}
                              className="text-xs px-2 py-1 rounded-lg border border-green-200 dark:border-green-800 text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-950 transition-colors disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
                            >
                              Unban
                            </button>
                          ) : (
                            <button
                              onClick={() => toggleBan(u.id, false)}
                              disabled={loading === u.id}
                              className="text-xs px-2 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
                            >
                              Ban
                            </button>
                          )
                        )}

                        {/* Delete */}
                        {u.id !== currentUserId && (
                          <button
                            onClick={() => setConfirmAction({ userId: u.id, action: 'delete' })}
                            disabled={loading === u.id}
                            className="text-xs px-2 py-1 rounded-lg border border-red-200 dark:border-red-800 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950 transition-colors disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
                          >
                            Delete
                          </button>
                        )}

                        {u.id === currentUserId && (
                          <span className="text-xs text-gray-400 dark:text-zinc-600 italic">You</span>
                        )}
                      </div>

                      {/* Ban reason inline */}
                      {banTarget === u.id && (
                        <div className="mt-2 flex items-center gap-2 justify-end">
                          <input
                            type="text"
                            placeholder="Ban reason…"
                            value={banReason}
                            onChange={(e) => setBanReason(e.target.value)}
                            onKeyDown={(e) => { if (e.key === 'Enter') toggleBan(u.id, false); }}
                            className="text-xs px-2.5 py-1 rounded-lg border border-gray-200 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-gray-900 dark:text-zinc-100 w-40 focus:outline-none focus:ring-2 focus:ring-red-500/40"
                            autoFocus
                          />
                          <button
                            onClick={() => toggleBan(u.id, false)}
                            disabled={loading === u.id}
                            className="text-xs px-2.5 py-1 rounded-lg bg-red-600 text-white hover:bg-red-500 transition-colors disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed"
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
                {pagedUsers.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-zinc-600 text-sm">
                      No users found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={userPage} total={totalUserPages} setPage={setUserPage} />
        </div>
      </div>
    );
  }

  // ─── Audits Tab ───────────────────────────────────────────────

  function AuditsTab() {
    return (
      <div>
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/80">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Agent</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">User</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Status</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Score</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Date</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">View</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {pagedAudits.map((a) => (
                  <tr key={a.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium truncate max-w-[200px]">{a.agentName}</td>
                    <td className="px-4 py-3">
                      <p className="text-sm truncate max-w-[150px]">{a.userName || '—'}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 truncate max-w-[150px]">{a.userEmail || ''}</p>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium ${
                        a.status === 'completed'
                          ? 'bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400'
                          : a.status === 'failed'
                            ? 'bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400'
                            : a.status === 'running'
                              ? 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400'
                              : 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400'
                      }`}>
                        {a.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {a.score != null ? `${a.score}/100` : '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-zinc-500 text-xs">
                      {new Date(a.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/dashboard/audit/${a.id}`}
                        className="text-xs px-2.5 py-1 rounded-lg border border-violet-200 dark:border-violet-800 text-violet-600 dark:text-violet-400 hover:bg-violet-50 dark:hover:bg-violet-950 transition-colors"
                      >
                        View
                      </Link>
                    </td>
                  </tr>
                ))}
                {pagedAudits.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-8 text-center text-gray-400 dark:text-zinc-600 text-sm">
                      No audits found.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <Pagination page={auditPage} total={totalAuditPages} setPage={setAuditPage} />
        </div>
      </div>
    );
  }

  // ─── Orgs Tab ─────────────────────────────────────────────────

  function OrgsTab() {
    return (
      <div>
        <p className="text-xs text-gray-500 dark:text-zinc-500 mb-3">
          {orgs.length} team{orgs.length !== 1 ? 's' : ''} on the platform
        </p>
        <div className={`${cardClass} overflow-hidden`}>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900/80">
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Name</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Slug</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Members</th>
                  <th className="text-left px-4 py-3 font-medium text-gray-500 dark:text-zinc-500">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {orgs.map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-zinc-800/50 transition-colors">
                    <td className="px-4 py-3 font-medium">{o.name}</td>
                    <td className="px-4 py-3 text-gray-500 dark:text-zinc-400 font-mono text-xs">{o.slug}</td>
                    <td className="px-4 py-3">
                      <span className="inline-flex items-center text-xs px-2 py-0.5 rounded-full font-medium bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-400">
                        {o.memberCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-500 dark:text-zinc-500 text-xs">
                      {new Date(o.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
                {orgs.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-400 dark:text-zinc-600 text-sm">
                      No teams created yet.
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

  // ─── Agent Health Tab ─────────────────────────────────────────

  function AgentHealthTab() {
    const maxDismissals = dismissalStats[0]?.dismissals ?? 1;
    return (
      <div>
        <div className="mb-6">
          <h2 className="text-lg font-semibold">Agent Dismissal Analytics</h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            Agents with high dismissal counts are producing false positives. Use this to target prompt improvements.
            <br />
            <span className="text-amber-600 dark:text-amber-400 font-medium">
              [CERTAIN] dismissals are the most critical signal
            </span>{' '}
            — the AI was confident but users disagreed.
          </p>
        </div>

        {dismissalStats.length === 0 ? (
          <div className="text-center py-16 text-gray-400 dark:text-zinc-600 text-sm">
            No dismissal data yet. Dismissals will appear here as users review audit results.
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-gray-200 dark:border-zinc-800">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200 dark:border-zinc-800 bg-gray-50 dark:bg-zinc-900">
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-zinc-400">Agent</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-zinc-400">Dismissals</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-zinc-400">Restorations</th>
                  <th className="px-4 py-3 text-right font-medium text-red-500 dark:text-red-400" title="[CERTAIN] findings dismissed — highest-signal false positives">Certain FP</th>
                  <th className="px-4 py-3 text-right font-medium text-orange-500 dark:text-orange-400">Likely FP</th>
                  <th className="px-4 py-3 text-right font-medium text-gray-500 dark:text-zinc-400">By Severity</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-500 dark:text-zinc-400 w-40">Volume</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-zinc-800">
                {dismissalStats.map((row) => {
                  const pct = maxDismissals > 0 ? Math.round((row.dismissals / maxDismissals) * 100) : 0;
                  const netDismissals = Math.max(0, row.dismissals - row.restorations);
                  return (
                    <tr key={row.agentId} className="hover:bg-gray-50 dark:hover:bg-zinc-900/50">
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900 dark:text-zinc-100">{row.agentName}</div>
                        <div className="text-xs text-gray-400 dark:text-zinc-500 font-mono">{row.agentId}</div>
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        <span className={`font-semibold ${row.dismissals > 20 ? 'text-red-600 dark:text-red-400' : row.dismissals > 5 ? 'text-amber-600 dark:text-amber-400' : 'text-gray-700 dark:text-zinc-300'}`}>
                          {row.dismissals}
                        </span>
                        {netDismissals !== row.dismissals && (
                          <div className="text-xs text-gray-400 dark:text-zinc-600">net {netDismissals}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums text-gray-500 dark:text-zinc-400">
                        {row.restorations || '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.dismissalsCertain > 0 ? (
                          <span className="font-semibold text-red-600 dark:text-red-400">{row.dismissalsCertain}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right tabular-nums">
                        {row.dismissalsLikely > 0 ? (
                          <span className="text-amber-600 dark:text-amber-400">{row.dismissalsLikely}</span>
                        ) : '—'}
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1 text-xs text-gray-400 dark:text-zinc-500 tabular-nums">
                          {row.dismissalsCritical > 0 && <span className="text-red-500">C:{row.dismissalsCritical}</span>}
                          {row.dismissalsHigh > 0 && <span className="text-orange-500">H:{row.dismissalsHigh}</span>}
                          {row.dismissalsMedium > 0 && <span className="text-amber-500">M:{row.dismissalsMedium}</span>}
                          {row.dismissalsLow > 0 && <span className="text-slate-400">L:{row.dismissalsLow}</span>}
                          {!row.dismissalsCritical && !row.dismissalsHigh && !row.dismissalsMedium && !row.dismissalsLow && '—'}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden min-w-[60px]">
                            <div
                              className={`h-full rounded-full transition-[width] ${row.dismissals > 20 ? 'bg-red-500' : row.dismissals > 5 ? 'bg-amber-500' : 'bg-blue-400'}`}
                              style={{ width: `${pct}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-400 dark:text-zinc-500 w-6 text-right">{pct}%</span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <p className="text-xs text-gray-400 dark:text-zinc-600 mt-4">
          Updated in real-time as users dismiss findings. Restorations indicate a user reconsidered; net dismissals (dismissals − restorations) is the cleaner signal.
        </p>
      </div>
    );
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-2xl font-bold">Admin Dashboard</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            Manage users, view audits, and monitor platform activity.
          </p>
        </div>

        {/* Tab nav */}
        <div className="flex gap-2 mb-8 overflow-x-auto">
          <button onClick={() => setTab('overview')} className={tabClass('overview')}>Overview</button>
          <button onClick={() => setTab('users')} className={tabClass('users')}>
            Users ({stats.totalUsers})
          </button>
          <button onClick={() => setTab('audits')} className={tabClass('audits')}>
            Audits ({stats.totalAudits})
          </button>
          <button onClick={() => setTab('orgs')} className={tabClass('orgs')}>
            Teams ({stats.totalOrgs})
          </button>
          <button onClick={() => setTab('agent-health')} className={tabClass('agent-health')}>
            Agent Health
          </button>
        </div>

        {tab === 'overview' && <OverviewTab />}
        {tab === 'users' && <UsersTab />}
        {tab === 'audits' && <AuditsTab />}
        {tab === 'orgs' && <OrgsTab />}
        {tab === 'agent-health' && <AgentHealthTab />}
      </div>

      <ConfirmDialog />
    </div>
  );
}
