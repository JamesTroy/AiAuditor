import { NextResponse } from 'next/server';

// Payment tiers removed — endpoint inert during early access.
// Restore the previous Stripe customer-portal implementation from git
// history to re-enable.
export async function POST() {
  return NextResponse.json(
    { error: 'Billing is disabled during early access. All features are free.' },
    { status: 410 },
  );
}
