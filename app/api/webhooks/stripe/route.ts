import { NextRequest, NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe } from '@/lib/stripe';
import { db } from '@/lib/db';
import { orgBilling } from '@/lib/db/schema/org-settings';
import { eq } from 'drizzle-orm';

export async function POST(req: NextRequest) {
  if (!stripe) return NextResponse.json({ error: 'Billing not configured' }, { status: 503 });

  const body = await req.text();
  const sig = req.headers.get('stripe-signature');

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Missing signature' }, { status: 400 });
  }

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  switch (event.type) {
    case 'checkout.session.completed': {
      const s = event.data.object as Stripe.Checkout.Session;
      const orgId = s.metadata?.orgId;
      const planId = s.metadata?.planId;
      if (orgId && planId) {
        await db
          .update(orgBilling)
          .set({ plan: planId, status: 'active', stripeSubId: s.subscription as string })
          .where(eq(orgBilling.orgId, orgId));
      }
      break;
    }

    case 'customer.subscription.updated': {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (orgId) {
        // Stripe v18+: current_period_end moved to subscription items.
        // Extract from the first item if available, fallback to null.
        const itemPeriodEnd = sub.items?.data?.[0]?.current_period_end;
        await db
          .update(orgBilling)
          .set({
            plan: sub.metadata?.planId ?? 'pro',
            status: sub.status,
            currentPeriodEnd: itemPeriodEnd ? new Date(itemPeriodEnd * 1000) : null,
            cancelAtPeriodEnd: sub.cancel_at_period_end,
            updatedAt: new Date(),
          })
          .where(eq(orgBilling.orgId, orgId));
      }
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      const orgId = sub.metadata?.orgId;
      if (orgId) {
        await db
          .update(orgBilling)
          .set({ plan: 'free', status: 'canceled', stripeSubId: null, updatedAt: new Date() })
          .where(eq(orgBilling.orgId, orgId));
      }
      break;
    }

    case 'invoice.payment_failed': {
      const inv = event.data.object as Stripe.Invoice;
      const customerId = inv.customer as string;
      const billing = await db
        .select({ orgId: orgBilling.orgId })
        .from(orgBilling)
        .where(eq(orgBilling.stripeCustomerId, customerId))
        .limit(1);
      if (billing[0]) {
        await db
          .update(orgBilling)
          .set({ status: 'past_due', updatedAt: new Date() })
          .where(eq(orgBilling.orgId, billing[0].orgId));
      }
      break;
    }
  }

  return NextResponse.json({ received: true });
}
