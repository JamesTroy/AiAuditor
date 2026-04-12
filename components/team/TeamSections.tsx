'use client';

// Wired team settings sections. Better Auth native (DangerZone, ApiKeys) are
// fully functional. Billing, AuditDefaults, and Notifications call API routes
// that persist to the org_* tables. All degrade gracefully when backends
// aren't configured (no Stripe key, tables not yet migrated, etc.).

import { useState, useEffect, useTransition } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';
import { SectionHeader, Card } from './OrgProfileSection';
import { PLANS, type PlanId } from '@/lib/plans';
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
              <option key={m.id} value={m.id}>{m.userName ?? m.userEmail} ({m.role})</option>
            ))}
          </select>
          <button type="submit" className="px-4 py-2 text-sm font-medium text-red-700 dark:text-red-400 bg-red-50 dark:bg-red-950/30 hover:bg-red-100 dark:hover:bg-red-950/50 border border-red-200 dark:border-red-900/50 rounded-lg transition-colors">
            Transfer
          </button>
        </form>
      </div>
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
            <input value={deleteConfirm} onChange={(e) => setDeleteConfirm(e.target.value)} placeholder={org.name} className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 outline-none focus:border-red-400 transition-colors" />
            <button type="submit" disabled={deleteConfirm !== org.name} className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-700 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed rounded-lg transition-colors">
              Delete org
            </button>
          </div>
        </form>
      </div>
      {error && <p className="mt-3 text-sm text-red-500">{error}</p>}
    </div>
  );
}

// ── ApiKeysSection ──────────────────────────────────────────────────────────

export function ApiKeysSection({ orgId, isAdmin }: { orgId: string; isAdmin: boolean }) {
  const [name, setName] = useState('');
  const [creating, setCreating] = useState(false);
  const [newKey, setNewKey] = useState<string | null>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const [keys, setKeys] = useState<any[]>([]);
  const [loadingKeys, setLoadingKeys] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pluginMissing, setPluginMissing] = useState(false);

  useEffect(() => {
    async function load() {
      setLoadingKeys(true);
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const { data } = await (authClient as any).apiKey.list();
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const orgKeys = (data ?? []).filter((k: any) => k.metadata?.organizationId === orgId);
        setKeys(orgKeys);
      } catch {
        setPluginMissing(true);
      } finally {
        setLoadingKeys(false);
      }
    }
    load();
  }, [orgId]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setCreating(true);
    setError(null);
    setNewKey(null);
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data, error: err } = await (authClient as any).apiKey.create({
        name: name.trim(),
        metadata: { organizationId: orgId },
      });
      if (err) throw new Error(err.message);
      setNewKey(data.key);
      setKeys((prev) => [data, ...prev]);
      setName('');
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to generate key.');
    } finally {
      setCreating(false);
    }
  }

  async function handleRevoke(keyId: string) {
    if (!confirm('Revoke this key? Integrations using it will stop working immediately.')) return;
    try {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (authClient as any).apiKey.delete({ keyId });
      setKeys((prev) => prev.filter((k) => k.id !== keyId));
    } catch {
      setError('Failed to revoke key.');
    }
  }

  if (pluginMissing) {
    return (
      <div>
        <SectionHeader title="API keys" description="Generate keys to access Claudit programmatically." />
        <div className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-xl p-4">
          <p className="text-xs font-medium text-amber-700 dark:text-amber-400 mb-1">Setup required</p>
          <p className="text-xs text-amber-600 dark:text-amber-500 leading-relaxed">
            Add <code className="font-mono">apiKey()</code> to your <code className="font-mono">auth.ts</code> plugins and run <code className="font-mono">npx @better-auth/cli migrate</code>.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div>
      <SectionHeader title="API keys" description="Generate keys to access Claudit programmatically. Keys are scoped to this organization." />
      {isAdmin && (
        <Card>
          <h3 className="text-sm font-medium text-gray-800 dark:text-zinc-200 mb-1">Generate new key</h3>
          <p className="text-xs text-gray-400 dark:text-zinc-500 mb-4">The full key is shown once — copy it immediately.</p>
          <form onSubmit={handleCreate} className="flex gap-2">
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Key name..." required className="flex-1 px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 outline-none focus:border-violet-400 transition-colors" />
            <button type="submit" disabled={creating} className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors">
              {creating ? 'Generating\u2026' : 'Generate key'}
            </button>
          </form>
          {error && <p className="mt-2 text-xs text-red-500">{error}</p>}
          {newKey && (
            <div className="mt-3 p-3 bg-green-50 dark:bg-green-950/30 border border-green-200 dark:border-green-900/50 rounded-xl">
              <p className="text-xs font-medium text-green-700 dark:text-green-400 mb-1.5">Key generated — copy it now.</p>
              <code className="block text-xs font-mono text-green-800 dark:text-green-300 break-all select-all bg-green-100/60 dark:bg-green-900/30 px-2 py-1.5 rounded-lg">{newKey}</code>
            </div>
          )}
        </Card>
      )}
      <Card>
        <h3 className="text-sm font-medium text-gray-800 dark:text-zinc-200 mb-4">Active keys {!loadingKeys && `(${keys.length})`}</h3>
        {loadingKeys ? (
          <p className="text-xs text-gray-400 dark:text-zinc-500">Loading&hellip;</p>
        ) : keys.length === 0 ? (
          <p className="text-xs text-gray-400 dark:text-zinc-500">No active keys.</p>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60" role="list">
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {keys.map((k: any) => (
              <li key={k.id} className="flex items-center gap-3 py-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{k.name}</p>
                  <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">Created {new Date(k.createdAt).toLocaleDateString()}</p>
                </div>
                <code className="text-xs font-mono text-gray-400 dark:text-zinc-500 bg-gray-50 dark:bg-zinc-800 px-2 py-1 rounded-lg">{k.start ?? k.prefix}&bull;&bull;&bull;&bull;&bull;&bull;&bull;&bull;</code>
                {isAdmin && (
                  <button onClick={() => handleRevoke(k.id)} className="text-xs px-2 py-1 rounded-lg text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition-colors">Revoke</button>
                )}
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}

// ── BillingSection ──────────────────────────────────────────────────────────

interface BillingData {
  plan: PlanId;
  status: string;
  seats: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
}

export function BillingSection({
  org,
  memberCount,
  billing,
}: {
  org: { id: string; name: string };
  memberCount: number;
  billing?: BillingData | null;
}) {
  const [portalLoading, setPortalLoading] = useState(false);
  const [checkoutLoading, setCheckoutLoading] = useState<PlanId | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentPlan = PLANS[billing?.plan ?? 'free'];
  const isActive = billing?.status === 'active' || !billing;

  async function openPortal() {
    setPortalLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/billing/portal', { method: 'POST' });
      const { url, error: err } = await res.json();
      if (err) throw new Error(err);
      window.location.href = url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to open billing portal.');
      setPortalLoading(false);
    }
  }

  async function startCheckout(planId: PlanId) {
    setCheckoutLoading(planId);
    setError(null);
    try {
      const res = await fetch('/api/billing/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ planId }),
      });
      const { url, error: err } = await res.json();
      if (err) throw new Error(err);
      window.location.href = url;
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to start checkout.');
      setCheckoutLoading(null);
    }
  }

  return (
    <div>
      <SectionHeader title="Billing & plan" description="Manage your team's subscription, seat count, and payment details." />
      <Card>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <p className="text-base font-semibold text-gray-900 dark:text-zinc-100">{currentPlan.name}</p>
              <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${isActive ? 'bg-green-50 dark:bg-green-950/40 text-green-700 dark:text-green-400' : billing?.status === 'past_due' ? 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400' : 'bg-gray-100 dark:bg-zinc-800 text-gray-500'}`}>
                {billing?.cancelAtPeriodEnd ? 'Cancels at period end' : (billing?.status ?? 'Free')}
              </span>
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1">
              {memberCount} of {currentPlan.seats === -1 ? 'unlimited' : currentPlan.seats} seats
              {billing?.currentPeriodEnd && ` \u00b7 Renews ${new Date(billing.currentPeriodEnd).toLocaleDateString()}`}
              {currentPlan.price > 0 && ` \u00b7 $${currentPlan.price}/mo`}
            </p>
          </div>
          {billing && (
            <button onClick={openPortal} disabled={portalLoading} className="px-3 py-1.5 text-sm font-medium text-violet-700 dark:text-violet-300 bg-violet-50 dark:bg-violet-500/10 hover:bg-violet-100 dark:hover:bg-violet-500/20 rounded-lg transition-colors disabled:opacity-50">
              {portalLoading ? 'Loading\u2026' : 'Manage billing \u2192'}
            </button>
          )}
        </div>
        {currentPlan.seats !== -1 && (
          <div>
            <div className="h-1.5 bg-gray-100 dark:bg-zinc-800 rounded-full overflow-hidden">
              <div className="h-full bg-violet-500 rounded-full transition-[width]" style={{ width: `${Math.min(100, (memberCount / currentPlan.seats) * 100)}%` }} />
            </div>
            <p className="text-xs text-gray-400 dark:text-zinc-500 mt-1.5">
              {memberCount} of {currentPlan.seats} seats &middot; {currentPlan.auditsPerMonth === -1 ? 'Unlimited' : currentPlan.auditsPerMonth} audits/mo
            </p>
          </div>
        )}
      </Card>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
        {(['pro', 'team', 'enterprise'] as PlanId[]).map((planId) => {
          const plan = PLANS[planId];
          const isCurrent = (billing?.plan ?? 'free') === planId;
          return (
            <div key={planId} className={`rounded-2xl border p-4 ${isCurrent ? 'border-violet-300 dark:border-violet-600 bg-violet-50/50 dark:bg-violet-500/5' : 'border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900'}`}>
              <p className="text-sm font-semibold text-gray-800 dark:text-zinc-200 mb-0.5">{plan.name}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mb-3">{plan.seats === -1 ? 'Unlimited seats' : `${plan.seats} seats`} &middot; ${plan.price}/mo</p>
              {isCurrent ? (
                <span className="text-xs text-violet-600 dark:text-violet-400 font-medium">Current plan</span>
              ) : (
                <button onClick={() => startCheckout(planId)} disabled={checkoutLoading !== null} className="text-xs font-medium text-violet-600 dark:text-violet-400 hover:underline disabled:opacity-50">
                  {checkoutLoading === planId ? 'Redirecting\u2026' : 'Upgrade \u2192'}
                </button>
              )}
            </div>
          );
        })}
      </div>
      {error && <p className="text-sm text-red-500 mt-2">{error}</p>}
    </div>
  );
}

// ── AuditDefaultsSection ────────────────────────────────────────────────────

interface AuditDefaults {
  shareWithAllMembers: boolean;
  allowMemberRerun: boolean;
  requireAdminApprovalForExternal: boolean;
}

const AUDIT_SETTINGS: { key: keyof AuditDefaults; label: string; description: string }[] = [
  { key: 'shareWithAllMembers', label: 'Share results with all members', description: 'All org members can view any audit result by default' },
  { key: 'allowMemberRerun', label: 'Allow members to re-run audits', description: 'Members can re-audit any previously audited file' },
  { key: 'requireAdminApprovalForExternal', label: 'Require admin approval to share externally', description: 'Reports must be approved before sharing outside the org' },
];

export function AuditDefaultsSection({ org, isAdmin }: { org: { id: string }; isAdmin: boolean }) {
  const [defaults, setDefaults] = useState<AuditDefaults>({ shareWithAllMembers: true, allowMemberRerun: true, requireAdminApprovalForExternal: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/org/audit-defaults').then((r) => r.json()).then((d) => setDefaults(d)).catch(() => {}).finally(() => setLoading(false));
  }, [org.id]);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/org/audit-defaults', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(defaults) });
      if (!res.ok) throw new Error((await res.json()).error);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to save.'); } finally { setSaving(false); }
  }

  return (
    <div>
      <SectionHeader title="Audit defaults" description="Set default visibility and sharing behavior for all audits in this organization." />
      <Card>
        {loading ? <p className="text-xs text-gray-400 dark:text-zinc-500">Loading&hellip;</p> : (
          <>
            <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60" role="list">
              {AUDIT_SETTINGS.map(({ key, label, description }) => (
                <li key={key} className="flex items-center justify-between py-3.5 gap-4">
                  <div><p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{label}</p><p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{description}</p></div>
                  <button role="switch" aria-checked={defaults[key]} aria-label={label} disabled={!isAdmin} onClick={() => setDefaults((d) => ({ ...d, [key]: !d[key] }))} className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${defaults[key] ? 'bg-violet-600' : 'bg-gray-200 dark:bg-zinc-700'} disabled:opacity-40 disabled:cursor-not-allowed`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${defaults[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </li>
              ))}
            </ul>
            {isAdmin && (
              <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-3">
                <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors">{saving ? 'Saving\u2026' : 'Save defaults'}</button>
                {saved && <span className="text-sm text-green-600 dark:text-green-400" role="status" aria-live="polite">Saved</span>}
                {error && <span className="text-sm text-red-500">{error}</span>}
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

// ── NotificationsSection ────────────────────────────────────────────────────

interface NotifPrefs {
  newMemberJoins: boolean;
  auditScoreBelow70: boolean;
  criticalFindingDetected: boolean;
  weeklyDigest: boolean;
}

const NOTIF_SETTINGS: { key: keyof NotifPrefs; label: string; description: string }[] = [
  { key: 'newMemberJoins', label: 'New member joins', description: 'Notify when someone accepts an invitation' },
  { key: 'auditScoreBelow70', label: 'Audit score drops below 70', description: 'Alert when any org audit scores poorly' },
  { key: 'criticalFindingDetected', label: 'Critical finding detected', description: 'Notify on Critical severity issues' },
  { key: 'weeklyDigest', label: 'Weekly digest', description: 'Summary of org activity every Monday' },
];

export function NotificationsSection({ orgId, userId }: { orgId: string; userId: string }) {
  const [prefs, setPrefs] = useState<NotifPrefs>({ newMemberJoins: true, auditScoreBelow70: true, criticalFindingDetected: true, weeklyDigest: false });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/org/notifications').then((r) => r.json()).then((d) => setPrefs(d)).catch(() => {}).finally(() => setLoading(false));
  }, [orgId, userId]);

  async function handleSave() {
    setSaving(true); setError(null);
    try {
      const res = await fetch('/api/org/notifications', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(prefs) });
      if (!res.ok) throw new Error((await res.json()).error);
      setSaved(true); setTimeout(() => setSaved(false), 2500);
    } catch (e: unknown) { setError(e instanceof Error ? e.message : 'Failed to save.'); } finally { setSaving(false); }
  }

  return (
    <div>
      <SectionHeader title="Notifications" description="Choose what events trigger email notifications in this organization." />
      <Card>
        {loading ? <p className="text-xs text-gray-400 dark:text-zinc-500">Loading&hellip;</p> : (
          <>
            <ul className="divide-y divide-gray-50 dark:divide-zinc-800/60" role="list">
              {NOTIF_SETTINGS.map(({ key, label, description }) => (
                <li key={key} className="flex items-center justify-between py-3.5 gap-4">
                  <div><p className="text-sm font-medium text-gray-800 dark:text-zinc-200">{label}</p><p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">{description}</p></div>
                  <button role="switch" aria-checked={prefs[key]} aria-label={label} onClick={() => setPrefs((p) => ({ ...p, [key]: !p[key] }))} className={`relative w-9 h-5 rounded-full transition-colors flex-shrink-0 ${prefs[key] ? 'bg-violet-600' : 'bg-gray-200 dark:bg-zinc-700'}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${prefs[key] ? 'translate-x-4' : 'translate-x-0.5'}`} />
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-4 pt-4 border-t border-gray-100 dark:border-zinc-800 flex items-center gap-3">
              <button onClick={handleSave} disabled={saving} className="px-4 py-2 text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:cursor-not-allowed rounded-lg transition-colors">{saving ? 'Saving\u2026' : 'Save preferences'}</button>
              {saved && <span className="text-sm text-green-600 dark:text-green-400" role="status" aria-live="polite">Saved</span>}
              {error && <span className="text-sm text-red-500">{error}</span>}
            </div>
          </>
        )}
      </Card>
    </div>
  );
}
