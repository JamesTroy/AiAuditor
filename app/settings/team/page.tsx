'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useSession, authClient } from '@/lib/auth-client';
import Link from 'next/link';

type FormStatus = 'idle' | 'saving' | 'saved' | 'error';

interface Org {
  id: string;
  name: string;
  slug: string;
  logo?: string | null;
  createdAt: Date;
}

interface OrgMember {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  user: { id: string; name: string; email: string; image?: string | null };
}

interface OrgInvitation {
  id: string;
  email: string;
  role: string;
  status: string;
  expiresAt: Date;
}

export default function TeamSettingsPage() {
  const { data: session, isPending } = useSession();
  const router = useRouter();

  // State
  const [orgs, setOrgs] = useState<Org[]>([]);
  const [activeOrgId, setActiveOrgId] = useState<string | null>(null);
  const [members, setMembers] = useState<OrgMember[]>([]);
  const [invitations, setInvitations] = useState<OrgInvitation[]>([]);
  const [loading, setLoading] = useState(true);

  // Create org form
  const [newOrgName, setNewOrgName] = useState('');
  const [createStatus, setCreateStatus] = useState<FormStatus>('idle');
  const [createError, setCreateError] = useState('');

  // Invite form
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'member' | 'admin'>('member');
  const [inviteStatus, setInviteStatus] = useState<FormStatus>('idle');
  const [inviteError, setInviteError] = useState('');

  // Action feedback
  const [actionError, setActionError] = useState('');

  const fetchOrgs = useCallback(async () => {
    try {
      const res = await authClient.organization.list();
      if (res.data) {
        setOrgs(res.data as unknown as Org[]);
      }
    } catch { /* ignore */ }
  }, []);

  const fetchMembers = useCallback(async (orgId: string) => {
    try {
      const res = await authClient.organization.getFullOrganization({
        query: { organizationId: orgId },
      });
      if (res.data) {
        setMembers((res.data as unknown as { members: OrgMember[] }).members ?? []);
        setInvitations((res.data as unknown as { invitations: OrgInvitation[] }).invitations ?? []);
      }
    } catch { /* ignore */ }
  }, []);

  // Load orgs on mount
  useEffect(() => {
    if (!session) return;
    const activeId = (session.session as Record<string, unknown>)?.activeOrganizationId as string | null ?? null;
    setActiveOrgId(activeId);
    fetchOrgs().then(() => setLoading(false));
  }, [session, fetchOrgs]);

  // Load members when active org changes
  useEffect(() => {
    if (activeOrgId) {
      fetchMembers(activeOrgId);
    } else {
      setMembers([]);
      setInvitations([]);
    }
  }, [activeOrgId, fetchMembers]);

  if (isPending || loading) {
    return (
      <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="h-8 w-40 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
          <div className="h-4 w-64 mt-2 rounded bg-gradient-to-r from-gray-200 via-gray-100 to-gray-200 dark:from-zinc-800 dark:via-zinc-700 dark:to-zinc-800 bg-[length:200%_100%] animate-[shimmer_1.5s_ease-in-out_infinite]" />
        </div>
      </div>
    );
  }

  if (!session) {
    router.push('/login');
    return null;
  }

  const activeOrg = orgs.find((o) => o.id === activeOrgId);
  const currentMember = members.find((m) => m.userId === session.user.id);
  const isOwnerOrAdmin = currentMember?.role === 'owner' || currentMember?.role === 'admin';

  async function handleCreateOrg(e: React.FormEvent) {
    e.preventDefault();
    if (!newOrgName.trim()) return;
    setCreateStatus('saving');
    setCreateError('');
    try {
      const slug = newOrgName.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
      const res = await authClient.organization.create({
        name: newOrgName.trim(),
        slug: slug || `team-${Date.now()}`,
      });
      if (res.error) {
        setCreateError(res.error.message ?? 'Failed to create team');
        setCreateStatus('error');
        return;
      }
      // Set as active and refresh
      if (res.data?.id) {
        await authClient.organization.setActive({ organizationId: res.data.id });
        setActiveOrgId(res.data.id);
      }
      setNewOrgName('');
      setCreateStatus('saved');
      await fetchOrgs();
      router.refresh();
      setTimeout(() => setCreateStatus('idle'), 3000);
    } catch {
      setCreateError('Failed to create team');
      setCreateStatus('error');
    }
  }

  async function handleSwitchOrg(orgId: string | null) {
    try {
      await authClient.organization.setActive({ organizationId: orgId });
      setActiveOrgId(orgId);
      router.refresh();
    } catch {
      setActionError('Failed to switch team');
    }
  }

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!inviteEmail.trim() || !activeOrgId) return;
    setInviteStatus('saving');
    setInviteError('');
    try {
      const res = await authClient.organization.inviteMember({
        email: inviteEmail.trim(),
        role: inviteRole,
        organizationId: activeOrgId,
      });
      if (res.error) {
        setInviteError(res.error.message ?? 'Failed to send invite');
        setInviteStatus('error');
        return;
      }
      setInviteEmail('');
      setInviteStatus('saved');
      await fetchMembers(activeOrgId);
      setTimeout(() => setInviteStatus('idle'), 3000);
    } catch {
      setInviteError('Failed to send invite');
      setInviteStatus('error');
    }
  }

  async function handleRemoveMember(memberId: string) {
    if (!activeOrgId) return;
    setActionError('');
    try {
      await authClient.organization.removeMember({
        memberIdOrEmail: memberId,
        organizationId: activeOrgId,
      });
      await fetchMembers(activeOrgId);
    } catch {
      setActionError('Failed to remove member');
    }
  }

  async function handleUpdateRole(memberId: string, newRole: string) {
    if (!activeOrgId) return;
    setActionError('');
    try {
      await authClient.organization.updateMemberRole({
        memberId,
        role: newRole,
        organizationId: activeOrgId,
      });
      await fetchMembers(activeOrgId);
    } catch {
      setActionError('Failed to update role');
    }
  }

  async function handleCancelInvite(invitationId: string) {
    if (!activeOrgId) return;
    setActionError('');
    try {
      await authClient.organization.cancelInvitation({
        invitationId,
      });
      await fetchMembers(activeOrgId);
    } catch {
      setActionError('Failed to cancel invitation');
    }
  }

  const roleBadge = (role: string) => {
    const styles: Record<string, string> = {
      owner: 'bg-violet-100 dark:bg-violet-950 text-violet-700 dark:text-violet-300',
      admin: 'bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300',
      member: 'bg-gray-100 dark:bg-zinc-800 text-gray-600 dark:text-zinc-400',
    };
    return (
      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${styles[role] ?? styles.member}`}>
        {role}
      </span>
    );
  };

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="mb-8">
          <div className="flex items-center gap-2">
            <Link href="/settings" className="text-sm text-gray-500 dark:text-zinc-500 hover:text-gray-700 dark:hover:text-zinc-300 transition-colors">
              Settings
            </Link>
            <svg className="w-3.5 h-3.5 text-gray-400 dark:text-zinc-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="9 18 15 12 9 6" /></svg>
            <span className="text-sm font-medium">Team</span>
          </div>
          <h1 className="text-2xl font-bold mt-3">Team Settings</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            Create a team, invite members, and manage shared audit history.
          </p>
        </div>

        {actionError && (
          <div className="mb-4 px-4 py-3 rounded-xl bg-red-50 dark:bg-red-950/50 border border-red-200 dark:border-red-800 text-sm text-red-700 dark:text-red-300">
            {actionError}
          </div>
        )}

        {/* ─── Switch / Create Organization ─── */}
        <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-sm font-semibold mb-4">Your teams</h2>

          {orgs.length === 0 && (
            <p className="text-xs text-gray-500 dark:text-zinc-500 mb-4">
              Just building solo? You don&apos;t need a team &mdash; your personal audits are always private to you. Create a team if you want to share audit history with collaborators.
            </p>
          )}

          {orgs.length > 0 && (
            <div className="space-y-2 mb-4">
              <button
                onClick={() => handleSwitchOrg(null)}
                className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-colors ${
                  !activeOrgId
                    ? 'bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 font-medium'
                    : 'bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-gray-300 dark:hover:border-zinc-600'
                }`}
              >
                <span>Personal</span>
                {!activeOrgId && <span className="text-xs text-violet-500">Active</span>}
              </button>
              {orgs.map((org) => (
                <button
                  key={org.id}
                  onClick={() => handleSwitchOrg(org.id)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-colors ${
                    activeOrgId === org.id
                      ? 'bg-violet-50 dark:bg-violet-950/50 border border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 font-medium'
                      : 'bg-gray-50 dark:bg-zinc-800/50 border border-gray-200 dark:border-zinc-700 text-gray-700 dark:text-zinc-300 hover:border-gray-300 dark:hover:border-zinc-600'
                  }`}
                >
                  <span>{org.name}</span>
                  {activeOrgId === org.id && <span className="text-xs text-violet-500">Active</span>}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleCreateOrg} className="flex gap-2">
            <input
              type="text"
              value={newOrgName}
              onChange={(e) => setNewOrgName(e.target.value)}
              placeholder="New team name"
              className="flex-1 min-h-[44px] bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 transition-colors"
            />
            <button
              type="submit"
              disabled={createStatus === 'saving' || !newOrgName.trim()}
              className="px-5 py-2 min-h-[44px] rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors focus-ring"
            >
              {createStatus === 'saving' ? 'Creating...' : 'Create Team'}
            </button>
          </form>
          {createStatus === 'saved' && (
            <p className="text-sm text-green-600 dark:text-green-400 mt-2">Team created!</p>
          )}
          {createError && (
            <p className="text-sm text-red-600 dark:text-red-400 mt-2">{createError}</p>
          )}
        </div>

        {/* ─── Members (only when org is active) ─── */}
        {activeOrg && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-sm font-semibold mb-4">
              Members of {activeOrg.name}
            </h2>

            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {members.map((m) => (
                <div key={m.id} className="flex items-center justify-between py-3 gap-3">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/20 text-violet-600 dark:text-violet-400 flex items-center justify-center text-xs font-bold shrink-0">
                      {(m.user.name?.[0] ?? m.user.email?.[0] ?? '?').toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">{m.user.name}</p>
                      <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">{m.user.email}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {roleBadge(m.role)}
                    {isOwnerOrAdmin && m.userId !== session.user.id && m.role !== 'owner' && (
                      <div className="flex items-center gap-1">
                        <select
                          value={m.role}
                          onChange={(e) => handleUpdateRole(m.id, e.target.value)}
                          className="text-xs bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg px-2 py-1 text-gray-700 dark:text-zinc-300"
                        >
                          <option value="member">member</option>
                          <option value="admin">admin</option>
                        </select>
                        <button
                          onClick={() => handleRemoveMember(m.id)}
                          className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors"
                        >
                          Remove
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ─── Invite Members ─── */}
        {activeOrg && isOwnerOrAdmin && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
            <h2 className="text-sm font-semibold mb-4">Invite a member</h2>
            <form onSubmit={handleInvite} className="flex gap-2">
              <input
                type="email"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="flex-1 min-h-[44px] bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2 text-sm text-gray-900 dark:text-zinc-100 placeholder-gray-500 dark:placeholder-zinc-400 focus:outline-none focus:border-violet-500 dark:focus:border-violet-500 transition-colors"
              />
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'member' | 'admin')}
                className="min-h-[44px] bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-3 py-2 text-sm text-gray-700 dark:text-zinc-300"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
              <button
                type="submit"
                disabled={inviteStatus === 'saving' || !inviteEmail.trim()}
                className="px-5 py-2 min-h-[44px] rounded-xl text-sm font-semibold text-white bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors focus-ring"
              >
                {inviteStatus === 'saving' ? 'Sending...' : 'Invite'}
              </button>
            </form>
            {inviteStatus === 'saved' && (
              <p className="text-sm text-green-600 dark:text-green-400 mt-2">Invitation sent!</p>
            )}
            {inviteError && (
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">{inviteError}</p>
            )}
          </div>
        )}

        {/* ─── Pending Invitations ─── */}
        {activeOrg && invitations.length > 0 && (
          <div className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6">
            <h2 className="text-sm font-semibold mb-4">Pending invitations</h2>
            <div className="divide-y divide-gray-100 dark:divide-zinc-800">
              {invitations.filter((i) => i.status === 'pending').map((inv) => (
                <div key={inv.id} className="flex items-center justify-between py-3">
                  <div className="min-w-0">
                    <p className="text-sm truncate">{inv.email}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500">
                      {inv.role} · expires {new Date(inv.expiresAt).toLocaleDateString()}
                    </p>
                  </div>
                  {isOwnerOrAdmin && (
                    <button
                      onClick={() => handleCancelInvite(inv.id)}
                      className="text-xs text-red-500 hover:text-red-600 dark:hover:text-red-400 px-3 py-1.5 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/50 transition-colors shrink-0"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
