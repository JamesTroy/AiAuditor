import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { orgAuditDefaults } from '@/lib/db/schema/org-settings';
import { member } from '@/lib/auth-schema';
import { and, eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session.session as Record<string, unknown>)?.activeOrganizationId as string | null;
  if (!orgId) return NextResponse.json({ error: 'No active organization' }, { status: 400 });

  const [defaults] = await db
    .select()
    .from(orgAuditDefaults)
    .where(eq(orgAuditDefaults.orgId, orgId))
    .limit(1);

  return NextResponse.json(
    defaults ?? {
      shareWithAllMembers: true,
      allowMemberRerun: true,
      requireAdminApprovalForExternal: false,
    },
  );
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session.session as Record<string, unknown>)?.activeOrganizationId as string | null;
  if (!orgId) return NextResponse.json({ error: 'No active organization' }, { status: 400 });

  // Require admin or owner
  const [caller] = await db
    .select({ role: member.role })
    .from(member)
    .where(and(eq(member.organizationId, orgId), eq(member.userId, session.user.id)))
    .limit(1);

  if (!caller || (caller.role !== 'admin' && caller.role !== 'owner')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const body = await req.json();

  await db
    .insert(orgAuditDefaults)
    .values({
      orgId,
      shareWithAllMembers: !!body.shareWithAllMembers,
      allowMemberRerun: !!body.allowMemberRerun,
      requireAdminApprovalForExternal: !!body.requireAdminApprovalForExternal,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: orgAuditDefaults.orgId,
      set: {
        shareWithAllMembers: !!body.shareWithAllMembers,
        allowMemberRerun: !!body.allowMemberRerun,
        requireAdminApprovalForExternal: !!body.requireAdminApprovalForExternal,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
