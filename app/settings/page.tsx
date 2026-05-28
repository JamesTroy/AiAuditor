'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'motion/react';
import { useSession, authClient } from '@/lib/auth-client';
import TwoFactorSettings from '@/components/TwoFactorSettings';
import ActiveSessions from '@/components/ActiveSessions';
import { fadeUp, staggerContainer, transitions } from '@/lib/motion/variants';
// SM-004: Discriminated form status replaces saving + saved booleans.
type FormStatus = 'idle' | 'saving' | 'saved' | 'error';

interface ScheduledAudit {
  id: string;
  name: string;
  repoUrl: string;
  branch: string;
  schedule: 'daily' | 'weekly';
  threshold: number;
  lastScore: number | null;
  lastRunAt: string | null;
  enabled: boolean;
}

interface WebhookConfig {
  id: string;
  name: string;
  apiKeyPreview: string;
  threshold: number;
  enabled: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

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
  // Workspace context state
  const [workspaceContext, setWorkspaceContext] = useState('');
  const [workspaceStatus, setWorkspaceStatus] = useState<FormStatus>('idle');
  const workspaceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // SM-019: Cleanup timer refs for saved-state reset.
  const profileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Scheduled audits ──────────────────────────────────────────
  const [scheduledAuditsList, setScheduledAuditsList] = useState<ScheduledAudit[]>([]);
  const [showAddAudit, setShowAddAudit] = useState(false);
  const [auditForm, setAuditForm] = useState({
    name: '', repoUrl: '', githubToken: '', branch: 'main', schedule: 'daily' as 'daily' | 'weekly', threshold: 70,
  });
  const [auditFormStatus, setAuditFormStatus] = useState<FormStatus>('idle');
  const [auditFormError, setAuditFormError] = useState('');

  // ── Webhook configs ────────────────────────────────────────────
  const [webhookList, setWebhookList] = useState<WebhookConfig[]>([]);
  const [showAddWebhook, setShowAddWebhook] = useState(false);
  const [webhookForm, setWebhookForm] = useState({ name: '', threshold: 70 });
  const [webhookFormStatus, setWebhookFormStatus] = useState<FormStatus>('idle');
  const [webhookFormError, setWebhookFormError] = useState('');
  const [newApiKey, setNewApiKey] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState(false);

  // SM-015: Initialize name from session in useEffect, not during render.
  useEffect(() => {
    if (session?.user.name && !name && profileStatus === 'idle') {
      setName(session.user.name);
    }
  }, [session, name, profileStatus]);

  useEffect(() => {
    if (!session) return;
    fetch('/api/scheduled-audits').then((r) => r.json()).then((d) => {
      if (Array.isArray(d.scheduledAudits)) setScheduledAuditsList(d.scheduledAudits);
    }).catch(() => { /* ignore */ });
    fetch('/api/webhooks/configs').then((r) => r.json()).then((d) => {
      if (Array.isArray(d.webhookConfigs)) setWebhookList(d.webhookConfigs);
    }).catch(() => { /* ignore */ });
  }, [session]);

  // Load workspace context on mount
  useEffect(() => {
    fetch('/api/settings/workspace')
      .then((r) => r.json())
      .then((d) => { if (typeof d.workspaceContext === 'string') setWorkspaceContext(d.workspaceContext); })
      .catch(() => { /* ignore */ });
  }, []);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (profileTimerRef.current) clearTimeout(profileTimerRef.current);
      if (passwordTimerRef.current) clearTimeout(passwordTimerRef.current);
      if (workspaceTimerRef.current) clearTimeout(workspaceTimerRef.current);
    };
  }, []);

  if (isPending) {
    return (
      <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="h-8 w-32 rounded skeleton" />
            <div className="h-4 w-64 mt-2 rounded skeleton" />
          </div>
          {[1, 2, 3].map((i) => (
            <div key={i} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
              <div className="h-5 w-24 mb-4 rounded skeleton" />
              <div className="space-y-4">
                <div className="h-10 rounded-xl skeleton" />
                <div className="h-10 rounded-xl skeleton" />
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

  async function handleSaveWorkspace(e: React.FormEvent) {
    e.preventDefault();
    setWorkspaceStatus('saving');
    try {
      const res = await fetch('/api/settings/workspace', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ workspaceContext }),
      });
      if (!res.ok) {
        const { error } = await res.json();
        throw new Error(error ?? 'Failed to save');
      }
      setWorkspaceStatus('saved');
      if (workspaceTimerRef.current) clearTimeout(workspaceTimerRef.current);
      workspaceTimerRef.current = setTimeout(() => setWorkspaceStatus('idle'), 3000);
    } catch (err) {
      setWorkspaceStatus('error');
      console.error(err);
    }
  }

  async function handleAddAudit(e: React.FormEvent) {
    e.preventDefault();
    setAuditFormStatus('saving');
    setAuditFormError('');
    try {
      const res = await fetch('/api/scheduled-audits', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(auditForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create');
      setScheduledAuditsList((prev) => [data.scheduledAudit, ...prev]);
      setAuditForm({ name: '', repoUrl: '', githubToken: '', branch: 'main', schedule: 'daily', threshold: 70 });
      setShowAddAudit(false);
      setAuditFormStatus('idle');
    } catch (err) {
      setAuditFormError(err instanceof Error ? err.message : 'Failed to create');
      setAuditFormStatus('error');
    }
  }

  async function handleToggleAudit(id: string, enabled: boolean) {
    setScheduledAuditsList((prev) => prev.map((a) => a.id === id ? { ...a, enabled } : a));
    await fetch(`/api/scheduled-audits/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled }),
    }).catch(() => { /* revert on failure ideally, ignored for now */ });
  }

  async function handleDeleteAudit(id: string) {
    if (!confirm('Delete this scheduled audit?')) return;
    setScheduledAuditsList((prev) => prev.filter((a) => a.id !== id));
    await fetch(`/api/scheduled-audits/${id}`, { method: 'DELETE' }).catch(() => { /* ignore */ });
  }

  async function handleAddWebhook(e: React.FormEvent) {
    e.preventDefault();
    setWebhookFormStatus('saving');
    setWebhookFormError('');
    try {
      const res = await fetch('/api/webhooks/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(webhookForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? 'Failed to create');
      setNewApiKey(data.apiKey);
      // Reload list to get the new config (without the key).
      fetch('/api/webhooks/configs').then((r) => r.json()).then((d) => {
        if (Array.isArray(d.webhookConfigs)) setWebhookList(d.webhookConfigs);
      }).catch(() => { /* ignore */ });
      setWebhookForm({ name: '', threshold: 70 });
      setShowAddWebhook(false);
      setWebhookFormStatus('idle');
    } catch (err) {
      setWebhookFormError(err instanceof Error ? err.message : 'Failed to create');
      setWebhookFormStatus('error');
    }
  }

  async function handleDeleteWebhook(id: string) {
    if (!confirm('Delete this webhook? Any CI step using it will stop working.')) return;
    setWebhookList((prev) => prev.filter((w) => w.id !== id));
    await fetch(`/api/webhooks/configs/${id}`, { method: 'DELETE' }).catch(() => { /* ignore */ });
  }

  async function handleCopyKey(key: string) {
    await navigator.clipboard.writeText(key).catch(() => { /* ignore */ });
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  return (
    <div className="text-gray-900 dark:text-zinc-100 px-6 py-12">
      <motion.div
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className="max-w-2xl mx-auto"
      >
        <motion.div variants={fadeUp} className="mb-8">
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mt-1">
            Manage your profile, security, and account preferences.
          </p>
        </motion.div>

        {/* Profile */}
        <motion.section variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
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
                  <svg className="w-4 h-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                )}
                {profileStatus === 'saving' ? 'Saving...' : 'Save changes'}
              </button>
              {profileStatus === 'saved' && (
                <span role="status" aria-live="polite" className="text-sm text-green-600 dark:text-green-400 motion-safe:animate-fade-up">Saved!</span>
              )}
            </div>
          </form>
        </motion.section>

        {/* Change password */}
        <motion.section variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
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
                  <svg className="w-4 h-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                )}
                {passwordStatus === 'saving' ? 'Changing...' : 'Change password'}
              </button>
              {passwordStatus === 'saved' && (
                <span className="text-sm text-green-600 dark:text-green-400 motion-safe:animate-fade-up">Password updated!</span>
              )}
            </div>
          </form>
        </motion.section>

        {/* Two-factor authentication */}
        <TwoFactorSettings twoFactorEnabled={session.user.twoFactorEnabled ?? false} />

        {/* Active sessions */}
        <ActiveSessions />

        {/* Workspace Context */}
        <motion.section variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <h2 className="text-lg font-semibold mb-1">Workspace context <span className="text-xs font-normal text-gray-400 dark:text-zinc-500 ml-1">(optional)</span></h2>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
            Tell the auditors about your project — your tech stack, any rules you follow, or things to watch out for. Automatically included with every audit so findings are relevant to your setup. Leave blank if you&apos;re just getting started.
          </p>
          <form onSubmit={handleSaveWorkspace} className="space-y-3">
            <textarea
              value={workspaceContext}
              onChange={(e) => setWorkspaceContext(e.target.value)}
              maxLength={2000}
              rows={5}
              placeholder={`Examples:\n- Stack: Next.js, Supabase, deployed on Railway\n- I use Tailwind CSS and prefer simple, readable code\n- No user data should appear in logs\n- Flag anything that could expose user data to other users`}
              className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-3 text-sm font-mono text-gray-900 dark:text-zinc-100 placeholder-gray-400 dark:placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 resize-y transition-colors"
            />
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <button
                  type="submit"
                  disabled={workspaceStatus === 'saving'}
                  className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled-muted text-white font-medium rounded-xl px-4 py-2 min-h-[44px] text-sm transition-colors focus-ring"
                >
                  {workspaceStatus === 'saving' && (
                    <svg className="w-4 h-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                  )}
                  {workspaceStatus === 'saving' ? 'Saving...' : 'Save context'}
                </button>
                {workspaceStatus === 'saved' && (
                  <span role="status" aria-live="polite" className="text-sm text-green-600 dark:text-green-400 motion-safe:animate-fade-up">Saved!</span>
                )}
                {workspaceStatus === 'error' && (
                  <span className="text-sm text-red-600 dark:text-red-400">Failed to save — try again</span>
                )}
              </div>
              <span className="text-xs text-gray-400 dark:text-zinc-600">{workspaceContext.length}/2000</span>
            </div>
          </form>
        </motion.section>

        {/* GitHub integration — single-line card linking to the dedicated /settings/integrations page */}
        <motion.section variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-4 mb-6">
          <Link
            href="/settings/integrations"
            className="flex items-center justify-between gap-4 group"
          >
            <div className="flex items-center gap-3 min-w-0">
              <svg className="w-5 h-5 shrink-0 text-gray-700 dark:text-zinc-300" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M12 0a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2.1c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.7-1.3-1.7-1.1-.8.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.9 2.9 1.3 3.6 1 .1-.8.4-1.3.8-1.6-2.7-.3-5.5-1.3-5.5-5.9 0-1.3.5-2.4 1.2-3.2-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2.9-.3 2-.4 3-.4s2.1.1 3 .4c2.3-1.5 3.3-1.2 3.3-1.2.6 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.2 0 4.6-2.8 5.6-5.5 5.9.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 0z" />
              </svg>
              <div className="min-w-0">
                <p className="text-sm font-semibold">GitHub</p>
                <p className="text-xs text-gray-500 dark:text-zinc-500 truncate">Review pull requests automatically.</p>
              </div>
            </div>
            <span className="shrink-0 text-sm text-violet-600 dark:text-violet-400 group-hover:underline">
              Manage →
            </span>
          </Link>
        </motion.section>

        {/* Scheduled audits */}
        <motion.section variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold">Scheduled audits</h2>
            <button
              onClick={() => setShowAddAudit((v) => !v)}
              className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
            >
              {showAddAudit ? 'Cancel' : '+ Add'}
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
            Automatically audit a GitHub repo on a schedule. Get an email alert when the score drops.
          </p>

          <AnimatePresence>
            {showAddAudit && (
              <motion.form
                key="add-audit-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={transitions.snappy}
                onSubmit={handleAddAudit}
                className="overflow-hidden"
              >
                <div className="border border-gray-200 dark:border-zinc-700 rounded-xl p-4 mb-4 space-y-3">
                  {auditFormError && (
                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">{auditFormError}</div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Name</label>
                    <input
                      required
                      placeholder="My App — main branch"
                      value={auditForm.name}
                      onChange={(e) => setAuditForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">GitHub repo URL</label>
                    <input
                      required
                      type="url"
                      placeholder="https://github.com/you/your-repo"
                      value={auditForm.repoUrl}
                      onChange={(e) => setAuditForm((f) => ({ ...f, repoUrl: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Branch</label>
                      <input
                        value={auditForm.branch}
                        onChange={(e) => setAuditForm((f) => ({ ...f, branch: e.target.value }))}
                        className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Schedule</label>
                      <select
                        value={auditForm.schedule}
                        onChange={(e) => setAuditForm((f) => ({ ...f, schedule: e.target.value as 'daily' | 'weekly' }))}
                        className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                      >
                        <option value="daily">Daily</option>
                        <option value="weekly">Weekly</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                      Alert threshold <span className="text-gray-400 dark:text-zinc-500 font-normal">— email when score drops below</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={0} max={100} step={5}
                        value={auditForm.threshold}
                        onChange={(e) => setAuditForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
                        className="flex-1"
                      />
                      <span className="w-10 text-right text-sm font-mono">{auditForm.threshold}</span>
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                      GitHub token <span className="text-gray-400 dark:text-zinc-500 font-normal">(optional — required for private repos)</span>
                    </label>
                    <input
                      type="password"
                      placeholder="ghp_xxxxxxxxxxxx"
                      value={auditForm.githubToken}
                      onChange={(e) => setAuditForm((f) => ({ ...f, githubToken: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                    />
                    <p className="text-xs text-gray-400 dark:text-zinc-600 mt-1">Use a fine-grained PAT with read-only contents access. Stored encrypted.</p>
                  </div>
                  <button
                    type="submit"
                    disabled={auditFormStatus === 'saving'}
                    className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled-muted text-white font-medium rounded-xl px-4 py-2 text-sm transition-colors"
                  >
                    {auditFormStatus === 'saving' && (
                      <svg className="w-4 h-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    )}
                    {auditFormStatus === 'saving' ? 'Saving...' : 'Create scheduled audit'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {scheduledAuditsList.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-zinc-600 py-2">No scheduled audits yet.</p>
          ) : (
            <ul className="space-y-3">
              {scheduledAuditsList.map((a) => (
                <li key={a.id} className="flex items-start justify-between gap-4 border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium truncate">{a.name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 truncate mt-0.5">{a.repoUrl} — {a.branch} — {a.schedule}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
                      {a.lastScore !== null ? `Last score: ${a.lastScore}/100` : 'Not yet run'}{a.lastRunAt ? ` · ${new Date(a.lastRunAt).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <label className="relative inline-flex items-center cursor-pointer" title={a.enabled ? 'Disable' : 'Enable'}>
                      <input type="checkbox" className="sr-only peer" checked={a.enabled} onChange={(e) => handleToggleAudit(a.id, e.target.checked)} />
                      <div className="w-9 h-5 bg-gray-200 dark:bg-zinc-700 peer-checked:bg-violet-600 rounded-full transition-colors after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-4" />
                    </label>
                    <button
                      onClick={() => handleDeleteAudit(a.id)}
                      className="text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors"
                      aria-label="Delete"
                    >
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </motion.section>

        {/* Pre-deploy webhooks */}
        <motion.section variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-gray-200 dark:border-zinc-800 rounded-xl p-6 mb-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-lg font-semibold">Pre-deploy webhooks</h2>
            <button
              onClick={() => { setShowAddWebhook((v) => !v); setNewApiKey(null); }}
              className="text-sm text-violet-600 dark:text-violet-400 hover:underline"
            >
              {showAddWebhook ? 'Cancel' : '+ Create'}
            </button>
          </div>
          <p className="text-sm text-gray-500 dark:text-zinc-500 mb-4">
            Block deploys when audit score falls below your threshold. Call from a GitHub Actions step — returns <code className="text-xs bg-gray-100 dark:bg-zinc-800 px-1 rounded">200</code> (pass) or <code className="text-xs bg-gray-100 dark:bg-zinc-800 px-1 rounded">422</code> (fail).
          </p>

          {/* One-time key reveal */}
          <AnimatePresence>
            {newApiKey && (
              <motion.div
                key="new-key"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/40 rounded-xl p-4"
              >
                <p className="text-sm font-semibold text-amber-800 dark:text-amber-300 mb-2">Save this key — it won&apos;t be shown again</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 text-xs font-mono bg-white dark:bg-zinc-900 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2 break-all text-gray-900 dark:text-zinc-100">{newApiKey}</code>
                  <button
                    onClick={() => handleCopyKey(newApiKey)}
                    className="shrink-0 text-xs bg-amber-100 dark:bg-amber-900/50 hover:bg-amber-200 dark:hover:bg-amber-800/50 text-amber-800 dark:text-amber-300 border border-amber-300 dark:border-amber-700 rounded-lg px-3 py-2 transition-colors"
                  >
                    {copiedKey ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                <button onClick={() => setNewApiKey(null)} className="mt-2 text-xs text-amber-700 dark:text-amber-400 hover:underline">Dismiss</button>
              </motion.div>
            )}
          </AnimatePresence>

          <AnimatePresence>
            {showAddWebhook && (
              <motion.form
                key="add-webhook-form"
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                transition={transitions.snappy}
                onSubmit={handleAddWebhook}
                className="overflow-hidden"
              >
                <div className="border border-gray-200 dark:border-zinc-700 rounded-xl p-4 mb-4 space-y-3">
                  {webhookFormError && (
                    <div className="text-sm text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950 border border-red-200 dark:border-red-900 rounded-lg px-3 py-2">{webhookFormError}</div>
                  )}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">Name</label>
                    <input
                      required
                      placeholder="Production gate"
                      value={webhookForm.name}
                      onChange={(e) => setWebhookForm((f) => ({ ...f, name: e.target.value }))}
                      className="w-full bg-gray-50 dark:bg-zinc-800 border border-gray-300 dark:border-zinc-700 rounded-xl px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/50 focus:border-violet-500 transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-1">
                      Score threshold <span className="text-gray-400 dark:text-zinc-500 font-normal">— fail deploy below this</span>
                    </label>
                    <div className="flex items-center gap-3">
                      <input
                        type="range" min={0} max={100} step={5}
                        value={webhookForm.threshold}
                        onChange={(e) => setWebhookForm((f) => ({ ...f, threshold: Number(e.target.value) }))}
                        className="flex-1"
                      />
                      <span className="w-10 text-right text-sm font-mono">{webhookForm.threshold}</span>
                    </div>
                  </div>
                  <button
                    type="submit"
                    disabled={webhookFormStatus === 'saving'}
                    className="inline-flex items-center gap-2 bg-violet-600 hover:bg-violet-500 disabled-muted text-white font-medium rounded-xl px-4 py-2 text-sm transition-colors"
                  >
                    {webhookFormStatus === 'saving' && (
                      <svg className="w-4 h-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
                    )}
                    {webhookFormStatus === 'saving' ? 'Creating...' : 'Create webhook'}
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {webhookList.length === 0 ? (
            <p className="text-sm text-gray-400 dark:text-zinc-600 py-2">No webhook configs yet.</p>
          ) : (
            <ul className="space-y-3 mb-4">
              {webhookList.map((w) => (
                <li key={w.id} className="flex items-start justify-between gap-4 border border-gray-100 dark:border-zinc-800 rounded-xl px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium">{w.name}</p>
                    <p className="text-xs text-gray-500 dark:text-zinc-500 mt-0.5 font-mono">{w.apiKeyPreview}</p>
                    <p className="text-xs text-gray-400 dark:text-zinc-600 mt-0.5">
                      Threshold: {w.threshold}/100{w.lastUsedAt ? ` · Last used: ${new Date(w.lastUsedAt).toLocaleDateString()}` : ' · Never used'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteWebhook(w.id)}
                    className="text-gray-400 dark:text-zinc-600 hover:text-red-500 dark:hover:text-red-400 transition-colors shrink-0 mt-1"
                    aria-label="Delete"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" /></svg>
                  </button>
                </li>
              ))}
            </ul>
          )}

          {/* GitHub Actions example */}
          <details className="mt-2">
            <summary className="text-sm text-gray-500 dark:text-zinc-500 cursor-pointer hover:text-gray-700 dark:hover:text-zinc-300 transition-colors">GitHub Actions example</summary>
            <pre className="mt-3 text-xs bg-gray-950 text-gray-100 rounded-xl p-4 overflow-x-auto leading-relaxed">{`- name: Claudit pre-deploy gate
  run: |
    RESULT=$(curl -sf -X POST \\
      https://claudit.consulting/api/webhooks/pre-deploy \\
      -H "Authorization: Bearer \${{ secrets.CLAUDIT_API_KEY }}" \\
      -H "Content-Type: application/json" \\
      -d '{"owner":"YOUR_ORG","repo":"YOUR_REPO","branch":"main"}')
    PASSED=$(echo "$RESULT" | jq -r '.passed')
    SCORE=$(echo "$RESULT" | jq -r '.score')
    echo "Audit score: $SCORE"
    if [ "$PASSED" != "true" ]; then
      echo "::error::Audit score $SCORE is below threshold"
      exit 1
    fi`}</pre>
            <p className="text-xs text-gray-400 dark:text-zinc-600 mt-2">Add <code className="bg-gray-100 dark:bg-zinc-800 px-1 rounded">CLAUDIT_API_KEY</code> to your GitHub repository secrets.</p>
          </details>
        </motion.section>

        {/* Danger zone — CRED-002: Requires password re-entry */}
        <motion.section variants={fadeUp} className="bg-white dark:bg-zinc-900 border border-red-200 dark:border-red-900/50 rounded-xl p-6">
          <h2 className="text-lg font-semibold text-red-600 dark:text-red-400 mb-2">Delete account</h2>
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
                    <svg className="w-4 h-4 motion-safe:animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>
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
        </motion.section>
      </motion.div>
    </div>
  );
}
