import { NextResponse } from 'next/server';

// Payment tiers removed — everything is free during early access.
// Endpoint preserved so any cached client doesn't 404, but it always
// refuses. The full Stripe checkout implementation is in git history
// (last commit before this one) — to re-enable, restore that version
// and drop this stub.
export async function POST() {
  return NextResponse.json(
    { error: 'Billing is disabled during early access. All features are free.' },
    { status: 410 },
  );
}
