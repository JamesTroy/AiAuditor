import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { headers } from 'next/headers';
import { stripe, getOrCreateStripeCustomer } from '@/lib/stripe';
import { db } from '@/lib/db';
import { organizationTable } from '@/lib/auth-schema';
import { eq } from 'drizzle-orm';

export async function POST() {
  if (!stripe) return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });

  const session = await auth.api.getSession({ headers: await headers() });
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const orgId = (session.session as Record<string, unknown>)?.activeOrganizationId as string | null;
  if (!orgId) return NextResponse.json({ error: 'No active organization' }, { status: 400 });

  const [org] = await db
    .select({ name: organizationTable.name })
    .from(organizationTable)
    .where(eq(organizationTable.id, orgId))
    .limit(1);

  if (!org) return NextResponse.json({ error: 'Org not found' }, { status: 404 });

  const customerId = await getOrCreateStripeCustomer(orgId, org.name, session.user.email);

  const portalSession = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/settings/team?section=billing`,
  });

  return NextResponse.json({ url: portalSession.url });
}
