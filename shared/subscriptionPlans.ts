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
 * judgment call — "does this subscription grant premium access?" — here so
 * the client and server can never drift.
 *
 * Entitlement policy (corrected 2026-08-04 — see evaluateEntitlement):
 *   - `active`      — entitled. The only status that grants normal paid access.
 *   - `trialing`    — NOT entitled. Dime Time has no approved free trial; a
 *                     trialing subscription is unexpected and fails closed
 *                     (flagged for diagnostics, never silently granted).
 *   - `incomplete`  — NOT entitled by status alone. Provisional access exists
 *                     ONLY while a server-verified ACH PaymentIntent is
 *                     `processing` AND a server-persisted, finite
 *                     `provisionalAccessUntil` deadline is in the future.
 *   - `past_due`    — NOT entitled by status alone. Grace exists ONLY while a
 *                     server-computed, finite `graceUntil` (set once when a
 *                     previously-active subscription enters past_due; never
 *                     extended by duplicate/out-of-order webhooks) is in the
 *                     future.
 *   - everything else (incomplete_expired, unpaid, canceled, paused, missing,
 *     unknown, malformed) — NOT entitled. Unknown states fail closed.
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

/** Normalized entitlement states derived server-side. */
export type EntitlementState =
  | "active" // normal paid entitlement
  | "provisional_ach" // finite window while first verified ACH debit processes
  | "past_due_grace" // finite grace while Stripe retries a failed renewal
  | "none";

/** The minimal fields evaluateEntitlement needs from a subscription row. */
export interface EntitlementInput {
  status: string | null | undefined;
  plan?: string | null;
  provisionalAccessUntil?: Date | string | null;
  graceUntil?: Date | string | null;
}

export interface EntitlementResult {
  state: EntitlementState;
  entitled: boolean;
  /** Machine-readable reason, for diagnostics/logging — never a grant input. */
  reason: string;
  /** True when the provider state is unexpected and should be surfaced loudly. */
  unexpected?: boolean;
}

function toDate(v: Date | string | null | undefined): Date | null {
  if (!v) return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * THE single entitlement evaluator. Every server route, gate, and
 * client-facing "entitled" value must derive from this function. Inputs are
 * exclusively server-persisted fields (status + server-computed deadlines) —
 * no client-supplied value can influence the result. Fails closed on
 * anything unknown, missing, or malformed.
 */
export function evaluateEntitlement(
  sub: EntitlementInput | null | undefined,
  now: Date = new Date(),
): EntitlementResult {
  if (!sub || !sub.status) {
    return { state: "none", entitled: false, reason: "no_subscription" };
  }
  // Unsupported plan/product fails closed regardless of status. Rows written
  // from provider data get plan "unsupported" when the price's lookup_key
  // does not match the approved catalog (see subscriptionService).
  const plan = sub.plan ?? DEFAULT_PLAN_ID;
  if (!(plan in PLAN_CATALOG)) {
    return { state: "none", entitled: false, reason: "unsupported_plan", unexpected: true };
  }

  switch (sub.status) {
    case "active":
      return { state: "active", entitled: true, reason: "status_active" };
    case "trialing":
      // No approved trial exists — fail closed and flag loudly.
      return { state: "none", entitled: false, reason: "unexpected_trialing", unexpected: true };
    case "incomplete": {
      const until = toDate(sub.provisionalAccessUntil);
      if (until && now < until) {
        return { state: "provisional_ach", entitled: true, reason: "verified_ach_processing" };
      }
      return {
        state: "none",
        entitled: false,
        reason: until ? "provisional_window_expired" : "incomplete_without_verified_payment",
      };
    }
    case "past_due": {
      const until = toDate(sub.graceUntil);
      if (until && now < until) {
        return { state: "past_due_grace", entitled: true, reason: "within_grace_period" };
      }
      return {
        state: "none",
        entitled: false,
        reason: until ? "grace_period_expired" : "past_due_without_grace",
      };
    }
    case "incomplete_expired":
    case "unpaid":
    case "canceled":
    case "paused":
      return { state: "none", entitled: false, reason: `status_${sub.status}` };
    default:
      // Unknown/malformed provider state — fail closed, flag for diagnostics.
      return { state: "none", entitled: false, reason: "unknown_status", unexpected: true };
  }
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
