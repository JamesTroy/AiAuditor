'use client';

import { useState } from 'react';
import { authClient } from '@/lib/auth-client';
import { useRouter } from 'next/navigation';

interface Props {
  org: { id: string; name: string; slug: string | null; logo: string | null };
  isAdmin: boolean;
}

export function OrgProfileSection({ org, isAdmin }: Props) {
  const router = useRouter();
  const [name, setName] = useState(org.name);
  const [slug, setSlug] = useState(org.slug ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!isAdmin) return;
    setLoading(true);
    setError(null);
    const { error: err } = await authClient.organization.update({
      organizationId: org.id,
      data: { name, slug: slug || undefined },
    });
    setLoading(false);
    if (err) {
      setError(err.message ?? 'Failed to save.');
    } else {
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
      router.refresh();
    }
  }

  const initials = name
    .split(' ')
    .map((w) => w[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div>
      <SectionHeader
        title="Org profile"
        description="Update your organization's name, URL slug, and logo. Visible to all members."
      />

      <form onSubmit={handleSave} className="space-y-4">
        <Card>
          {/* Avatar */}
          <div className="flex items-center gap-4 mb-5 pb-5 border-b border-gray-100 dark:border-zinc-800">
            <div className="w-14 h-14 rounded-xl bg-violet-100 dark:bg-violet-500/15 flex items-center justify-center text-xl font-semibold text-violet-700 dark:text-violet-300 select-none">
              {initials}
            </div>
            <div>
              <p className="text-sm font-medium text-gray-800 dark:text-zinc-200 mb-1">{name}</p>
              <p className="text-xs text-gray-400 dark:text-zinc-500 mt-0.5">PNG or JPG &middot; 256&times;256px max</p>
            </div>
          </div>

          {/* Fields */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field label="Organization name" required>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                disabled={!isAdmin}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 outline-none focus:border-violet-400 dark:focus:border-violet-500 transition-colors disabled:opacity-60"
                required
                minLength={2}
                maxLength={50}
                placeholder="Acme Corp"
              />
            </Field>
            <Field label="URL slug">
              <input
                value={slug}
                onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
                disabled={!isAdmin}
                className="w-full px-3 py-2 text-sm bg-gray-50 dark:bg-zinc-800 border border-gray-200 dark:border-zinc-700 rounded-lg text-gray-800 dark:text-zinc-200 placeholder:text-gray-400 outline-none focus:border-violet-400 dark:focus:border-violet-500 transition-colors disabled:opacity-60"
                maxLength={50}
                placeholder="acme-corp"
              />
            </Field>
          </div>

          {error && <p className="mt-3 text-sm text-red-500">{error}</p>}

          {isAdmin && (
            <div className="mt-4 flex items-center gap-3">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 rounded-lg text-sm font-medium text-white bg-violet-600 hover:bg-violet-500 disabled:bg-zinc-400 dark:disabled:bg-zinc-700 disabled:text-zinc-200 dark:disabled:text-zinc-500 disabled:cursor-not-allowed transition-colors"
              >
                {loading ? 'Saving\u2026' : 'Save changes'}
              </button>
              {saved && (
                <span className="text-sm text-green-600 dark:text-green-400" role="status" aria-live="polite">
                  Saved
                </span>
              )}
            </div>
          )}
        </Card>
      </form>

      {!isAdmin && (
        <p className="text-xs text-gray-400 dark:text-zinc-500 mt-3">
          Only admins and owners can edit the org profile.
        </p>
      )}
    </div>
  );
}

// ── Shared primitives (exported for use by other team sections) ──────────────

export function SectionHeader({ title, description }: { title: string; description: string }) {
  return (
    <div className="mb-6">
      <h2 className="text-lg font-semibold text-gray-900 dark:text-zinc-100">{title}</h2>
      <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1 leading-relaxed">{description}</p>
    </div>
  );
}

export function Card({ children, danger = false }: { children: React.ReactNode; danger?: boolean }) {
  return (
    <div
      className={`rounded-2xl p-5 mb-4 ${
        danger
          ? 'border border-red-200 dark:border-red-900/50 bg-white dark:bg-zinc-900'
          : 'border border-gray-100 dark:border-zinc-800 bg-white dark:bg-zinc-900'
      }`}
    >
      {children}
    </div>
  );
}

export function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-500 dark:text-zinc-400 mb-1.5">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
