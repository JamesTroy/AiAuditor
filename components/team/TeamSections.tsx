'use client';

// Scaffold sections for team settings. Better Auth native sections (DangerZone)
// are fully wired. Custom sections (Billing, AuditDefaults, Notifications, ApiKeys)
// have clear TODOs for persistence.

import { useState, useTransition } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { SectionHeader, Card } from './OrgProfileSection';
import type { MemberWithUser } from './MembersSection';

// ── DangerZoneSection ───────────────────────────────────────────────────────

export function DangerZoneSection({
  org,
  members,
  callerUserId,
}: {
  org: { id: string; name: string };
  members: MemberWithUser[];
  callerUserId: string;
}) {
  const router = useRouter();
  const [, startTransition] = useTransition();
  const [transferTo, setTransferTo] = useState('');
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);

  const transferCandidates = members.filter(
    (m) => m.userId !== callerUserId && m.role !== 'owner',
  );

  async function handleTransfer(e: React.FormEvent) {
    e.preventDefault();
    if (!transferTo) return;
    const target = transferCandidates.find((m) => m.id === transferTo);
    if (!confirm(`Transfer ownership to ${target?.userName}? You will become an admin.`)) return;
    setError(null);
    const { error: err } = await authClient.organization.updateMemberRole({
      memberId: transferTo,
      role: 'owner',
    });
    if (err) { setError(err.message ?? 'Failed to transfer.'); return; }
    startTransition(() => router.refresh());
  }

  async function handleDelete(e: React.FormEvent) {
    e.preventDefault();
    if (deleteConfirm !== org.name) return;
    const { error: err } = await authClient.organization.delete({ organizationId: org.id });
    if (err) { setError(err.message ?? 'Failed to delete.'); return; }
    router.push('/dashboard');
  }

  return (
    <div>
      <SectionHeader
        title="Danger zone"
        description="These actions are permanent and cannot be undone. Proceed carefully."
      />

      {/* Transfer ownership */}
      <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-zinc-900 p-5 mb-4">
        <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Transfer ownership</h3>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4 leading-relaxed">
          Assign the Owner role to another member. You will be downgraded to Admin.
        </p>
        <form onSubmit={handleTransfer} className="flex gap-2">
          <select
            value={transferTo}
            onChange={(e) => setTransferTo(e.target.value)}
            className="flex-1 text-sm px-3 py-2 bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-700 dark:text-zinc-300 outline-none"
            required
          >
            <option value="">Select a member&hellip;</option>
            {transferCandidates.map((m) => (
              <option key={m.id} value={m.id}>
                {m.userName ?? m.userEmail} ({m.role})
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-lg transition-colors"
          >
            Transfer
          </button>
        </form>
      </div>

      {/* Delete org */}
      <div className="rounded-2xl border border-red-200 dark:border-red-900/40 bg-white dark:bg-zinc-900 p-5">
        <h3 className="text-sm font-medium text-red-700 dark:text-red-400 mb-1">Delete organization</h3>
        <p className="text-xs text-gray-500 dark:text-zinc-400 mb-4 leading-relaxed">
          Permanently deletes <strong className="text-gray-700 dark:text-zinc-300">{org.name}</strong>, all members, invitations, and audit history.
        </p>
        <form onSubmit={handleDelete}>
          <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">
            Type <span className="font-mono text-red-600 dark:text-red-400">{org.name}</span> to confirm
          </label>
          <div className="flex gap-2">
            <input
              value={deleteConfirm}
              onChange={(e) => setDeleteConfirm(e.target.value)}
              placeholder={org.name}
              className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 outline-none focus:border-red-400 transition-colors"
            />
            <button
              type="submit"
              disabled={deleteConfirm !== org.name}
              className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              Delete org
            </button>
          </div>
        </form>
      </div>

      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}

// ── ApiKeysSection (scaffold — requires apiKey() plugin) ────────────────────

export function ApiKeysSection({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  return (
    <div>
      <SectionHeader
        title="API keys"
        description="Generate keys to access Claudit programmatically. Keys inherit the permissions of their creator."
      />
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4">
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Setup required</p>
        <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
          Add <code className="font-mono">apiKey()</code> to your <code className="font-mono">auth.ts</code> plugins array and run{' '}
          <code className="font-mono">npx @better-auth/cli migrate</code> to create the{' '}
          <code className="font-mono">apikey</code> table.
        </p>
      </div>
    </div>
  );
}

// ── BillingSection (scaffold — requires Stripe/Polar) ───────────────────────

export function BillingSection({ org, memberCount }: { org: { id: string; name: string }; memberCount: number }) {
  return (
    <div>
      <SectionHeader
        title="Billing & plan"
        description="Manage your team's subscription, seat count, and payment details."
      />
      <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4 mb-6">
        <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Custom integration required</p>
        <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
          Connect Stripe or Polar to this section. Store the plan on <code className="font-mono">organization.metadata.plan</code>.
        </p>
      </div>
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">Current plan</p>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">
              {memberCount} member{memberCount === 1 ? '' : 's'} &middot; Connect Stripe to see plan details
            </p>
          </div>
          <button disabled className="px-3 py-1.5 text-xs font-medium text-gray-400 bg-gray-100 dark:bg-zinc-800 rounded-lg cursor-not-allowed">
            Manage plan
          </button>
        </div>
      </Card>
    </div>
  );
}

// ── AuditDefaultsSection (scaffold — needs persistence) ─────────────────────

export function AuditDefaultsSection({ org, isAdmin }: { org: { id: string }; isAdmin: boolean }) {
  const [defaults, setDefaults] = useState({
    shareWithAllMembers: true,
    allowMemberRerun: true,
    requireAdminApprovalForExternal: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof typeof defaults) {
    setDefaults((d) => ({ ...d, [key]: !d[key] }));
  }

  async function handleSave() {
    if (!isAdmin) return;
    setSaving(true);
    // TODO: Persist via authClient.organization.update({ data: { metadata: defaults } })
    await new Promise((r) => setTimeout(r, 600));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const settings = [
    { key: 'shareWithAllMembers' as const, label: 'Share results with all members', description: 'All org members can view any audit result by default' },
    { key: 'allowMemberRerun' as const, label: 'Allow members to re-run audits', description: 'Members can re-audit any previously audited file' },
    { key: 'requireAdminApprovalForExternal' as const, label: 'Require admin approval to share externally', description: 'Audit reports must be approved before sharing outside the org' },
  ];

  return (
    <div>
      <SectionHeader title="Audit defaults" description="Set default visibility and sharing behavior for all audits in this organization." />
      <Card>
        <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60" role="list">
          {settings.map(({ key, label, description }) => (
            <li key={key} className="flex items-center justify-between py-3.5 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{label}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{description}</p>
              </div>
              <button
                role="switch"
                aria-checked={defaults[key]}
                aria-label={label}
                disabled={!isAdmin}
                onClick={() => toggle(key)}
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${
                  defaults[key] ? 'bg-violet-600' : 'bg-gray-200 dark:bg-zinc-700'
                } disabled:opacity-40`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${defaults[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </li>
          ))}
        </ul>
        {isAdmin && (
          <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-3">
            <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors">
              {saving ? 'Saving\u2026' : 'Save defaults'}
            </button>
            {saved && <span className="text-sm text-green-600 dark:text-green-400" role="status" aria-live="polite">Saved</span>}
          </div>
        )}
      </Card>
    </div>
  );
}

// ── NotificationsSection (scaffold — needs persistence) ─────────────────────

export function NotificationsSection({ orgId, userId }: { orgId: string; userId: string }) {
  const [prefs, setPrefs] = useState({
    newMemberJoins: true,
    auditScoreBelow70: true,
    criticalFindingDetected: true,
    weeklyDigest: false,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  function toggle(key: keyof typeof prefs) {
    setPrefs((p) => ({ ...p, [key]: !p[key] }));
  }

  async function handleSave() {
    setSaving(true);
    // TODO: POST to /api/org/notifications with { orgId, userId, prefs }
    await new Promise((r) => setTimeout(r, 500));
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  }

  const items = [
    { key: 'newMemberJoins' as const, label: 'New member joins', description: 'Notify when someone accepts an invitation' },
    { key: 'auditScoreBelow70' as const, label: 'Audit score drops below 70', description: 'Alert when any audit in the org scores poorly' },
    { key: 'criticalFindingDetected' as const, label: 'Critical finding detected', description: 'Notify when a Critical severity issue is found' },
    { key: 'weeklyDigest' as const, label: 'Weekly digest', description: 'Summary of org activity, scores, and trends every Monday' },
  ];

  return (
    <div>
      <SectionHeader title="Notifications" description="Choose what events trigger email notifications for your activity in this organization." />
      <Card>
        <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60" role="list">
          {items.map(({ key, label, description }) => (
            <li key={key} className="flex items-center justify-between py-3.5 gap-4">
              <div>
                <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{label}</p>
                <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{description}</p>
              </div>
              <button
                role="switch"
                aria-checked={prefs[key]}
                aria-label={label}
                onClick={() => toggle(key)}
                className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${prefs[key] ? 'bg-violet-600' : 'bg-gray-200 dark:bg-zinc-700'}`}
              >
                <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${prefs[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
              </button>
            </li>
          ))}
        </ul>
        <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-3">
          <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors">
            {saving ? 'Saving\u2026' : 'Save preferences'}
          </button>
          {saved && <span className="text-sm text-green-600 dark:text-green-400" role="status" aria-live="polite">Saved</span>}
        </div>
      </Card>
    </div>
  );
}
