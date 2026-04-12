// Plan configuration — shared between server (lib/stripe.ts) and client
// (TeamSections.tsx). No server-only imports here.

export const PLANS = {
  free: { name: 'Free', priceId: null, seats: 1, auditsPerMonth: 10, price: 0 },
  pro: { name: 'Pro', priceId: process.env.STRIPE_PRICE_PRO ?? '', seats: 3, auditsPerMonth: 100, price: 29 },
  team: { name: 'Team', priceId: process.env.STRIPE_PRICE_TEAM ?? '', seats: 10, auditsPerMonth: 500, price: 79 },
  enterprise: { name: 'Enterprise', priceId: process.env.STRIPE_PRICE_ENTERPRISE ?? '', seats: -1, auditsPerMonth: -1, price: 299 },
} as const;

export type PlanId = keyof typeof PLANS;
