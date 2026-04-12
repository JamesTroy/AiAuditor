'use client';

import { useState, useTransition } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { SectionHeader, Card } from './OrgProfileSection';

type Role = 'owner' | 'admin' | 'member';

export interface MemberWithUser {
  id: string;
  userId: string;
  role: string;
  createdAt: Date;
  userName: string | null;
  userEmail: string;
  userImage: string | null;
}

interface Props {
  org: { id: string; name: string };
  members: MemberWithUser[];
  callerUserId: string;
  isAdmin: boolean;
  isOwner: boolean;
}

export function MembersSection({ org, members, callerUserId, isAdmin, isOwner }: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  const [email, setEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'admin' | 'member'>('member');
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviteSuccess, setInviteSuccess] = useState(false);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setInviteLoading(true);
    setInviteError(null);
    const { error } = await authClient.organization.inviteMember({
      email,
      role: inviteRole,
      organizationId: org.id,
    });
    setInviteLoading(false);
    if (error) {
      setInviteError(error.message ?? 'Failed to send invitation.');
    } else {
      setEmail('');
      setInviteSuccess(true);
      setTimeout(() => setInviteSuccess(false), 3000);
      startTransition(() => router.refresh());
    }
  }

  async function handleRoleChange(memberId: string, role: Role) {
    if (!isAdmin) return;
    await authClient.organization.updateMemberRole({ memberId, role });
    startTransition(() => router.refresh());
  }

  async function handleRemove(memberIdOrEmail: string) {
    if (!isAdmin) return;
    if (!confirm('Remove this member from the organization?')) return;
    await authClient.organization.removeMember({ memberIdOrEmail });
    startTransition(() => router.refresh());
  }

  const sortedMembers = [...members].sort((a, b) => {
    const order: Record<string, number> = { owner: 0, admin: 1, member: 2 };
    return (order[a.role] ?? 2) - (order[b.role] ?? 2);
  });

  return (
    <div>
      <SectionHeader
        title="Members"
        description="Manage who has access to your organization and what they can do."
      />

      {/* Invite form */}
      {isAdmin && (
        <Card>
          <h3 className="text-sm font-medium text-gray-800 dark:text-zinc-200 mb-1">Invite a member</h3>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">
            They&apos;ll receive an email with a link to join {org.name}.
          </p>
          <form onSubmit={handleInvite} className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">Email address</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="colleague@company.com"
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 dark:placeholder:text-zinc-500 outline-none focus:border-violet-400 dark:focus:border-violet-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">Role</label>
              <select
                value={inviteRole}
                onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member')}
                className="h-[38px] px-2 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-700 dark:text-zinc-300 outline-none focus:border-violet-400 transition-colors"
              >
                <option value="member">Member</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <button
              type="submit"
              disabled={inviteLoading}
              className="h-[38px] px-4 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              {inviteLoading ? 'Sending\u2026' : 'Send invite'}
            </button>
          </form>
          {inviteError && <p className="mt-2 text-xs text-red-500">{inviteError}</p>}
          {inviteSuccess && <p className="mt-2 text-xs text-green-600 dark:text-green-400" role="status" aria-live="polite">Invitation sent.</p>}
        </Card>
      )}

      {/* Member list */}
      <Card>
        <h3 className="text-sm font-medium text-gray-800 dark:text-zinc-200 mb-4">
          Current members ({members.length})
        </h3>
        <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60" role="list">
          {sortedMembers.map((m) => {
            const isSelf = m.userId === callerUserId;
            const isThisOwner = m.role === 'owner';
            const canModify = isAdmin && !isSelf && !isThisOwner;
            const displayName = m.userName ?? m.userEmail ?? '?';
            const initials = displayName
              .split(' ')
              .map((w) => w[0])
              .join('')
              .toUpperCase()
              .slice(0, 2);

            return (
              <li key={m.id} className="flex items-center gap-3 py-3">
                <div className="w-8 h-8 rounded-full bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center text-xs font-medium text-violet-700 dark:text-violet-300 flex-shrink-0 select-none">
                  {initials}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 truncate">
                    {displayName}
                    {isSelf && <span className="ml-1.5 text-xs text-gray-400 dark:text-zinc-500 font-normal">(you)</span>}
                  </p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 truncate">{m.userEmail}</p>
                </div>
                {canModify && isOwner ? (
                  <select
                    value={m.role}
                    onChange={(e) => handleRoleChange(m.id, e.target.value as Role)}
                    className="text-xs px-2 py-1 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-600 dark:text-zinc-300 outline-none"
                    aria-label={`Change role for ${displayName}`}
                  >
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                  </select>
                ) : (
                  <RoleBadge role={m.role} />
                )}
                {canModify && (
                  <button
                    onClick={() => handleRemove(m.userEmail ?? m.id)}
                    className="text-xs px-2 py-1 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors"
                    aria-label={`Remove ${displayName}`}
                  >
                    Remove
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </Card>

      {/* Role legend */}
      <div className="bg-gray-50 dark:bg-zinc-900/50 border border-gray-100 dark:border-zinc-800 rounded-xl p-4">
        <p className="text-xs font-medium text-gray-500 dark:text-zinc-400 mb-3">Role permissions</p>
        <div className="space-y-2 text-xs text-gray-500 dark:text-zinc-400">
          <div className="flex items-start gap-2"><RoleBadge role="owner" /><span>Full access. Can delete the org, transfer ownership, manage billing, and all admin actions.</span></div>
          <div className="flex items-start gap-2"><RoleBadge role="admin" /><span>Can invite and remove members, change roles (except owner), and manage org settings.</span></div>
          <div className="flex items-start gap-2"><RoleBadge role="member" /><span>Can run audits and view org audit history. Cannot manage members or settings.</span></div>
        </div>
      </div>
    </div>
  );
}

function RoleBadge({ role }: { role: string }) {
  const styles: Record<string, string> = {
    owner: 'bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300',
    admin: 'bg-blue-50 dark:bg-blue-500/10 text-blue-700 dark:text-blue-400',
    member: 'bg-gray-100 dark:bg-zinc-700 text-gray-600 dark:text-zinc-300',
  };
  return (
    <span className={`inline-block text-[11px] font-medium px-2 py-0.5 rounded-full ${styles[role] ?? styles.member}`}>
      {role.charAt(0).toUpperCase() + role.slice(1)}
    </span>
  );
}
