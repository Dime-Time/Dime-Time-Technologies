/**
 * Subscription plan catalog + entitlement policy invariants.
 * Run: npx tsx --test shared/__tests__/subscription-plans.test.ts
 *
 * Pins the founder-approved policy so client/server can never drift:
 *  - one plan, $2.99/month, stable Stripe lookup_key
 *  - entitled statuses: active, trialing, incomplete (ACH in flight),
 *    past_due (retry grace); everything else is NOT entitled
 *  - terminal statuses (new subscription allowed): canceled,
 *    incomplete_expired, unpaid
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_CATALOG,
  DEFAULT_PLAN_ID,
  formatPlanPrice,
  isSubscriptionEntitled,
  isSubscriptionTerminal,
  ENTITLED_SUBSCRIPTION_STATUSES,
  TERMINAL_SUBSCRIPTION_STATUSES,
} from "../subscriptionPlans";

test("catalog pins exactly one $2.99/month plan with the stable lookup key", () => {
  assert.deepEqual(Object.keys(PLAN_CATALOG), ["debt"]);
  const plan = PLAN_CATALOG[DEFAULT_PLAN_ID];
  assert.equal(plan.priceCents, 299);
  assert.equal(plan.interval, "month");
  // Never change without creating a NEW lookup key — Stripe prices are immutable.
  assert.equal(plan.stripeLookupKey, "dime_time_debt_299_monthly");
  assert.equal(formatPlanPrice(plan.priceCents), "$2.99");
});

test("entitlement matrix matches the approved policy exactly", () => {
  const expectations: Record<string, boolean> = {
    active: true,
    trialing: true,
    incomplete: true, // first ACH debit in flight — unlock on processing
    past_due: true, // Stripe retry grace period
    incomplete_expired: false,
    canceled: false,
    unpaid: false,
    paused: false,
    expired: false, // not a Stripe status, but must never entitle
    refunded: false,
    revoked: false,
  };
  for (const [status, expected] of Object.entries(expectations)) {
    assert.equal(isSubscriptionEntitled(status), expected, `status=${status}`);
  }
  assert.equal(isSubscriptionEntitled(null), false);
  assert.equal(isSubscriptionEntitled(undefined), false);
  assert.equal(isSubscriptionEntitled(""), false);
  // The allowlist is closed — exactly these four.
  assert.deepEqual([...ENTITLED_SUBSCRIPTION_STATUSES].sort(), [
    "active",
    "incomplete",
    "past_due",
    "trialing",
  ]);
});

test("client-supplied garbage can never entitle", () => {
  for (const junk of ["ACTIVE", "Active ", "true", "1", "entitled", "premium"]) {
    assert.equal(isSubscriptionEntitled(junk), false, `junk=${JSON.stringify(junk)}`);
  }
});

test("terminal matrix: only ended subscriptions allow creating a new one", () => {
  assert.deepEqual([...TERMINAL_SUBSCRIPTION_STATUSES].sort(), [
    "canceled",
    "incomplete_expired",
    "unpaid",
  ]);
  // A live (entitled or retrying) subscription is never terminal —
  // the duplicate-subscription guard depends on this.
  for (const s of ENTITLED_SUBSCRIPTION_STATUSES) {
    assert.equal(isSubscriptionTerminal(s), false, `status=${s}`);
  }
  // No row at all = terminal (user may subscribe).
  assert.equal(isSubscriptionTerminal(null), true);
  assert.equal(isSubscriptionTerminal(undefined), true);
});
