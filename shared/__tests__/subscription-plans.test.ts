/**
 * Subscription plan catalog + entitlement policy invariants.
 * Run: npx tsx --test shared/__tests__/subscription-plans.test.ts
 *
 * Pins the CORRECTED entitlement policy (2026-08-04):
 *  - one plan, $2.99/month, stable Stripe lookup_key
 *  - `active` is the ONLY status granting normal paid entitlement
 *  - `trialing` fails closed (no approved trial) and is flagged unexpected
 *  - `incomplete` entitles ONLY via a server-persisted, unexpired
 *    provisionalAccessUntil (verified ACH processing)
 *  - `past_due` entitles ONLY via a server-computed, unexpired graceUntil
 *  - everything else — including unknown/malformed states — fails closed
 *  - terminal statuses (new subscription allowed): canceled,
 *    incomplete_expired, unpaid
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  PLAN_CATALOG,
  DEFAULT_PLAN_ID,
  formatPlanPrice,
  evaluateEntitlement,
  isSubscriptionTerminal,
  TERMINAL_SUBSCRIPTION_STATUSES,
} from "../subscriptionPlans";

const NOW = new Date("2026-08-04T12:00:00Z");
const FUTURE = new Date("2026-08-10T12:00:00Z");
const PAST = new Date("2026-08-01T12:00:00Z");

test("catalog pins exactly one $2.99/month plan with the stable lookup key", () => {
  assert.deepEqual(Object.keys(PLAN_CATALOG), ["debt"]);
  const plan = PLAN_CATALOG[DEFAULT_PLAN_ID];
  assert.equal(plan.priceCents, 299);
  assert.equal(plan.interval, "month");
  // Never change without creating a NEW lookup key — Stripe prices are immutable.
  assert.equal(plan.stripeLookupKey, "dime_time_debt_299_monthly");
  assert.equal(formatPlanPrice(plan.priceCents), "$2.99");
});

test("active is the only status granting entitlement by itself", () => {
  const r = evaluateEntitlement({ status: "active", plan: "debt" }, NOW);
  assert.equal(r.entitled, true);
  assert.equal(r.state, "active");

  for (const status of [
    "incomplete", "incomplete_expired", "unpaid", "canceled", "paused",
    "trialing", "past_due",
  ]) {
    const bare = evaluateEntitlement({ status, plan: "debt" }, NOW);
    assert.equal(bare.entitled, false, `bare status=${status} must not entitle`);
  }
});

test("trialing fails closed and is flagged unexpected (no approved trial)", () => {
  const r = evaluateEntitlement({ status: "trialing", plan: "debt" }, NOW);
  assert.equal(r.entitled, false);
  assert.equal(r.state, "none");
  assert.equal(r.unexpected, true);
});

test("incomplete entitles ONLY via an unexpired provisionalAccessUntil", () => {
  // No window persisted → no access.
  assert.equal(
    evaluateEntitlement({ status: "incomplete", plan: "debt" }, NOW).entitled,
    false,
  );
  // Unexpired window → finite provisional access.
  const live = evaluateEntitlement(
    { status: "incomplete", plan: "debt", provisionalAccessUntil: FUTURE },
    NOW,
  );
  assert.equal(live.entitled, true);
  assert.equal(live.state, "provisional_ach");
  // Expired window → no access (finite by construction).
  const expired = evaluateEntitlement(
    { status: "incomplete", plan: "debt", provisionalAccessUntil: PAST },
    NOW,
  );
  assert.equal(expired.entitled, false);
  assert.equal(expired.reason, "provisional_window_expired");
  // Malformed window value → fails closed.
  assert.equal(
    evaluateEntitlement(
      { status: "incomplete", plan: "debt", provisionalAccessUntil: "garbage" },
      NOW,
    ).entitled,
    false,
  );
  // A provisional window NEVER rescues a non-incomplete status.
  assert.equal(
    evaluateEntitlement(
      { status: "canceled", plan: "debt", provisionalAccessUntil: FUTURE },
      NOW,
    ).entitled,
    false,
  );
});

test("past_due entitles ONLY via an unexpired server-computed graceUntil", () => {
  assert.equal(
    evaluateEntitlement({ status: "past_due", plan: "debt" }, NOW).entitled,
    false,
  );
  const inGrace = evaluateEntitlement(
    { status: "past_due", plan: "debt", graceUntil: FUTURE },
    NOW,
  );
  assert.equal(inGrace.entitled, true);
  assert.equal(inGrace.state, "past_due_grace");
  const afterGrace = evaluateEntitlement(
    { status: "past_due", plan: "debt", graceUntil: PAST },
    NOW,
  );
  assert.equal(afterGrace.entitled, false);
  assert.equal(afterGrace.reason, "grace_period_expired");
  // graceUntil never rescues other statuses (e.g. unpaid after retries).
  assert.equal(
    evaluateEntitlement({ status: "unpaid", plan: "debt", graceUntil: FUTURE }, NOW).entitled,
    false,
  );
});

test("unknown, malformed, and missing states fail closed", () => {
  assert.equal(evaluateEntitlement(null, NOW).entitled, false);
  assert.equal(evaluateEntitlement(undefined, NOW).entitled, false);
  assert.equal(evaluateEntitlement({ status: null }, NOW).entitled, false);
  assert.equal(evaluateEntitlement({ status: "" }, NOW).entitled, false);
  for (const junk of ["ACTIVE", "Active ", "true", "1", "entitled", "premium", "expired", "refunded", "revoked"]) {
    const r = evaluateEntitlement({ status: junk, plan: "debt" }, NOW);
    assert.equal(r.entitled, false, `junk=${JSON.stringify(junk)}`);
  }
  // Unknown status is flagged for diagnostics.
  assert.equal(evaluateEntitlement({ status: "bogus", plan: "debt" }, NOW).unexpected, true);
});

test("unsupported plan/product fails closed regardless of status", () => {
  const r = evaluateEntitlement({ status: "active", plan: "unsupported" }, NOW);
  assert.equal(r.entitled, false);
  assert.equal(r.reason, "unsupported_plan");
  assert.equal(r.unexpected, true);
  // Even with live windows attached.
  assert.equal(
    evaluateEntitlement(
      { status: "incomplete", plan: "wrong_price", provisionalAccessUntil: FUTURE },
      NOW,
    ).entitled,
    false,
  );
});

test("terminal statuses are exactly canceled/incomplete_expired/unpaid", () => {
  assert.deepEqual([...TERMINAL_SUBSCRIPTION_STATUSES].sort(), [
    "canceled",
    "incomplete_expired",
    "unpaid",
  ]);
  for (const status of ["active", "incomplete", "past_due", "paused", "trialing"]) {
    assert.equal(isSubscriptionTerminal(status), false, `status=${status}`);
  }
  for (const status of ["canceled", "incomplete_expired", "unpaid"]) {
    assert.equal(isSubscriptionTerminal(status), true, `status=${status}`);
  }
  assert.equal(isSubscriptionTerminal(null), true);
  assert.equal(isSubscriptionTerminal(undefined), true);
});
