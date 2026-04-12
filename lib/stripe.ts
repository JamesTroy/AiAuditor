// Stripe client — conditional initialization like Redis.
// Returns null when STRIPE_SECRET_KEY is missing (dev, free-tier deploys).
// Callers must check for null before using.

import Stripe from 'stripe';

export const stripe: Stripe | null = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, {
      apiVersion: '2025-02-24.acacia' as Stripe.LatestApiVersion,
      typescript: true,
    })
  : null;

// ── Plan config ─────────────────────────────────────────────────────────────

export const PLANS = {
  free: { name: 'Free', priceId: null, seats: 1, auditsPerMonth: 10, price: 0 },
  pro: { name: 'Pro', priceId: process.env.STRIPE_PRICE_PRO ?? '', seats: 3, auditsPerMonth: 100, price: 29 },
  team: { name: 'Team', priceId: process.env.STRIPE_PRICE_TEAM ?? '', seats: 10, auditsPerMonth: 500, price: 79 },
  enterprise: { name: 'Enterprise', priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? '', seats: -1, auditsPerMonth: -1, price: 299 },
} as const;

export type PlanId = keyof typeof PLANS;

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
