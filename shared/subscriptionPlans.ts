/**
 * Subscription plan catalog + status semantics.
 *
 * Single source of truth shared by client and server. The catalog here is
 * deliberately NOT a parallel product database — Stripe owns the product and
 * price objects (created via the API with a stable `lookup_key`); this module
 * only pins the constants the app needs to render copy and to find/create the
 * right Stripe price.
 *
 * Launch scope (founder decision, 2026-07): a single plan — "Dime Time Debt"
 * at $2.99/month, anniversary billing, charge immediately, no trial. Two
 * future tiers (Bitcoin $3.99, Split $4.99) are intentionally absent; add
 * them to PLAN_CATALOG when they launch — no other plumbing should change.
 */

export type PlanId = "debt";

export interface SubscriptionPlan {
  id: PlanId;
  name: string;
  priceCents: number;
  /** Stable Stripe price lookup_key — never reuse across price changes. */
  stripeLookupKey: string;
  interval: "month";
  blurb: string;
  features: string[];
}

export const PLAN_CATALOG: Record<PlanId, SubscriptionPlan> = {
  debt: {
    id: "debt",
    name: "Dime Time Debt",
    priceCents: 299,
    stripeLookupKey: "dime_time_debt_299_monthly",
    interval: "month",
    blurb:
      "Automate your spare change into real debt payments. Round-ups are " +
      "collected automatically and applied toward the debts you choose.",
    features: [
      "Automatic round-up collection on every purchase",
      "Round-up multipliers (2x, 3x) to accelerate payoff",
      "Automatic application of round-ups to your debts",
      "Everything in the free plan: debt tracking & payoff projections",
    ],
  },
};

export const DEFAULT_PLAN_ID: PlanId = "debt";

/** Format cents for display, e.g. 299 -> "$2.99". */
export function formatPlanPrice(priceCents: number): string {
  return `$${(priceCents / 100).toFixed(2)}`;
}

/**
 * Normalized subscription status vocabulary. We store Stripe's own status
 * strings verbatim (they are already well-defined) and centralize the ONE
 * judgment call — "does this status grant premium access?" — here so the
 * client and server can never drift.
 *
 * Entitlement policy (founder-approved, mirrors Acorns-style ACH billing):
 *   - `active` / `trialing`  — obviously entitled.
 *   - `incomplete`           — first invoice's ACH debit is in flight
 *                              (2–4 business days). We unlock immediately on
 *                              subscribe ("unlock on processing") and revoke
 *                              via webhook if the payment fails.
 *   - `past_due`             — a renewal payment failed; Stripe is retrying.
 *                              Grace period: keep premium during retries.
 *                              `unpaid`/`canceled` (retries exhausted) revoke.
 */
export type SubscriptionStatus =
  | "incomplete"
  | "incomplete_expired"
  | "trialing"
  | "active"
  | "past_due"
  | "canceled"
  | "unpaid"
  | "paused";

export const ENTITLED_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set([
  "active",
  "trialing",
  "incomplete",
  "past_due",
]);

export function isSubscriptionEntitled(status: string | null | undefined): boolean {
  if (!status) return false;
  return ENTITLED_SUBSCRIPTION_STATUSES.has(status);
}

/** Statuses that mean the subscription is over and a NEW one may be created. */
export const TERMINAL_SUBSCRIPTION_STATUSES: ReadonlySet<string> = new Set([
  "canceled",
  "incomplete_expired",
  "unpaid",
]);

export function isSubscriptionTerminal(status: string | null | undefined): boolean {
  if (!status) return true;
  return TERMINAL_SUBSCRIPTION_STATUSES.has(status);
}
