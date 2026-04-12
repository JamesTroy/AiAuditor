import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { db } from '@/lib/db';
import { orgNotificationPrefs } from '@/lib/db/schema/org-settings';
import { and, eq } from 'drizzle-orm';

export async function GET() {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session.session as Record<string, unknown>)?.activeOrganizationId as string | null;
  if (!orgId) return NextResponse.json({ error: 'No active organization' }, { status: 400 });

  const [prefs] = await db
    .select()
    .from(orgNotificationPrefs)
    .where(and(eq(orgNotificationPrefs.orgId, orgId), eq(orgNotificationPrefs.userId, session.user.id)))
    .limit(1);

  return NextResponse.json(
    prefs ?? {
      newMemberJoins: true,
      auditScoreBelow70: true,
      criticalFindingDetected: true,
      weeklyDigest: false,
    },
  );
}

export async function POST(req: NextRequest) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session.session as Record<string, unknown>)?.activeOrganizationId as string | null;
  if (!orgId) return NextResponse.json({ error: 'No active organization' }, { status: 400 });

  const body = await req.json();

  await db
    .insert(orgNotificationPrefs)
    .values({
      orgId,
      userId: session.user.id,
      newMemberJoins: !!body.newMemberJoins,
      auditScoreBelow70: !!body.auditScoreBelow70,
      criticalFindingDetected: !!body.criticalFindingDetected,
      weeklyDigest: !!body.weeklyDigest,
      updatedAt: new Date(),
    })
    .onConflictDoUpdate({
      target: [orgNotificationPrefs.orgId, orgNotificationPrefs.userId],
      set: {
        newMemberJoins: !!body.newMemberJoins,
        auditScoreBelow70: !!body.auditScoreBelow70,
        criticalFindingDetected: !!body.criticalFindingDetected,
        weeklyDigest: !!body.weeklyDigest,
        updatedAt: new Date(),
      },
    });

  return NextResponse.json({ ok: true });
}
