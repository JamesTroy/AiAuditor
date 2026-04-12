import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { db } from '@/lib/db';
import { organizationTable, member, user as userTable } from '@/lib/auth-schema';
import { eq } from 'drizzle-orm';
import { OrgProfileSection } from '@/components/team/OrgProfileSection';
import { MembersSection } from '@/components/team/MembersSection';
import {
  ApiKeysSection,
  AuditDefaultsSection,
  NotificationsSection,
  DangerZoneSection,
  BillingSection,
} from '@/components/team/TeamSections';

export const metadata: Metadata = {
  title: 'Team Settings',
  description: 'Manage your organization profile, members, billing, and preferences.',
};

const NAV = [
  { id: 'profile', label: 'Org profile' },
  { id: 'members', label: 'Members' },
  { id: 'billing', label: 'Billing & plan' },
  { id: 'apikeys', label: 'API keys' },
  { id: 'audit', label: 'Audit defaults' },
  { id: 'notifications', label: 'Notifications' },
] as const;

type SectionId = (typeof NAV)[number]['id'] | 'danger';

export default async function TeamSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ section?: string }>;
}) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) redirect('/login');

  const activeOrgId =
    (session.session as Record<string, unknown>)?.activeOrganizationId as string | null ?? null;

  if (!activeOrgId) redirect('/dashboard');

  // Join members with users to get name/email/image for the members list.
  const [orgRows, memberRows] = await Promise.all([
    db
      .select()
      .from(organizationTable)
      .where(eq(organizationTable.id, activeOrgId))
      .limit(1),
    db
      .select({
        id: member.id,
        userId: member.userId,
        role: member.role,
        createdAt: member.createdAt,
        userName: userTable.name,
        userEmail: userTable.email,
        userImage: userTable.image,
      })
      .from(member)
      .innerJoin(userTable, eq(member.userId, userTable.id))
      .where(eq(member.organizationId, activeOrgId)),
  ]);

  const org = orgRows[0];
  if (!org) redirect('/dashboard');

  const callerMember = memberRows.find((m) => m.userId === session.user.id);
  if (!callerMember) redirect('/dashboard');

  const isOwner = callerMember.role === 'owner';
  const isAdmin = callerMember.role === 'admin' || isOwner;

  const params = await searchParams;
  const section = (params.section ?? 'profile') as SectionId;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <div className="max-w-5xl mx-auto px-6 py-10">

        {/* Page header */}
        <div className="mb-8">
          <h1 className="text-2xl font-semibold tracking-tight text-gray-900 dark:text-zinc-100">
            Team settings
          </h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-1">
            {org.name} &middot; {memberRows.length} member{memberRows.length === 1 ? '' : 's'}
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-8 items-start">

          {/* Sidebar nav */}
          <nav className="w-full sm:w-44 flex-shrink-0 sm:sticky sm:top-8" aria-label="Team settings navigation">
            <div className="space-y-0.5">
              {NAV.map(({ id, label }) => (
                <Link
                  key={id}
                  href={`/settings/team?section=${id}`}
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    section === id
                      ? 'bg-white dark:bg-zinc-900 text-violet-700 dark:text-violet-300 font-medium shadow-sm border border-gray-100 dark:border-zinc-800'
                      : 'text-gray-500 dark:text-zinc-400 hover:text-gray-700 dark:hover:text-zinc-200 hover:bg-white/60 dark:hover:bg-zinc-900/60'
                  }`}
                >
                  <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${section === id ? 'bg-violet-500' : 'bg-gray-300 dark:bg-zinc-600'}`} />
                  {label}
                </Link>
              ))}
            </div>

            {/* Danger zone — separated */}
            {isOwner && (
              <>
                <div className="my-3 border-t border-gray-100 dark:border-zinc-800" />
                <Link
                  href="/settings/team?section=danger"
                  className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                    section === 'danger'
                      ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-400 font-medium'
                      : 'text-red-500/70 dark:text-red-400/50 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50/50'
                  }`}
                >
                  <span className="w-1.5 h-1.5 rounded-full bg-red-400 flex-shrink-0" />
                  Danger zone
                </Link>
              </>
            )}
          </nav>

          {/* Section content */}
          <main className="flex-1 min-w-0">
            {section === 'profile' && <OrgProfileSection org={org} isAdmin={isAdmin} />}
            {section === 'members' && (
              <MembersSection
                org={org}
                members={memberRows}
                callerUserId={session.user.id}
                isAdmin={isAdmin}
                isOwner={isOwner}
              />
            )}
            {section === 'billing' && <BillingSection org={org} memberCount={memberRows.length} />}
            {section === 'apikeys' && <ApiKeysSection orgId={activeOrgId} isAdmin={isAdmin} />}
            {section === 'audit' && <AuditDefaultsSection org={org} isAdmin={isAdmin} />}
            {section === 'notifications' && <NotificationsSection orgId={activeOrgId} userId={session.user.id} />}
            {section === 'danger' && isOwner && (
              <DangerZoneSection org={org} members={memberRows} callerUserId={session.user.id} />
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
