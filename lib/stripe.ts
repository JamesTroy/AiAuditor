// Stripe client — conditional initialization like Redis.
// Returns null when STRIPE_SECRET_KEY is missing (dev, free-tier deploys).
// Callers must check for null before using.

import Stripe from 'stripe';

// Re-export plan config from the shared module (safe for client imports).
export { PLANS, type PlanId } from '@/lib/plans';

export const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
      typescript: true,
    })
  : null;

// ── Helpers ─────────────────────────────────────────────────────────────────

export async function getOrCreateStripeCustomer(orgId: string, orgName: string, email: string): Promise<string> {
  if (!stripe) throw new Error('Stripe is not configured');

  const { db } = await import('@/lib/db');
  const { orgBilling } = await import('@/lib/db/schema/org-settings');
  const { eq } = await import('drizzle-orm');

  const existing = await db
    .select({ stripeCustomerId: orgBilling.stripeCustomerId })
    .from(orgBilling)
    .where(eq(orgBilling.orgId, orgId))
    .limit(1);

  if (existing[0]?.stripeCustomerId) {
    return existing[0].stripeCustomerId;
  }

  const customer = await stripe.customers.create({
    name: orgName,
    email,
    metadata: { orgId },
  });

  await db
    .insert(orgBilling)
    .values({ orgId, stripeCustomerId: customer.id })
    .onConflictDoUpdate({
      target: orgBilling.orgId,
      set: { stripeCustomerId: customer.id },
    });

  return customer.id;
}
