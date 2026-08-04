/**
 * Entitlement-correction tests: provisional-ACH qualification and the
 * server-side window derivation in buildSubscriptionRow.
 * Run: npx tsx --test server/__tests__/subscription-entitlement-correction.test.ts
 *
 * Everything here is pure — Stripe objects are fixtures shaped like the
 * provider's expanded responses; no network, no DB.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  verifyProvisionalAchEligibility,
  buildSubscriptionRow,
  authoritativeEventAt,
} from "../services/subscriptionService";
import { evaluateEntitlement } from "@shared/subscriptionPlans";

const NOW = new Date("2026-08-04T12:00:00Z");
const WINDOWS = { provisionalDays: 7, graceDays: 14 };
const NO_PROVISIONAL = { provisionalDays: 0, graceDays: 14 };

/** A fully-qualified incomplete subscription with a processing ACH debit. */
function processingSub(overrides: any = {}): any {
  const sub: any = {
    id: "sub_1",
    status: "incomplete",
    customer: "cus_1",
    metadata: { dimeTimeUserId: "u1", dimeTimePlanId: "debt" },
    items: {
      data: [{
        price: { id: "price_1", lookup_key: "dime_time_debt_299_monthly" },
        current_period_start: 1786190400,
        current_period_end: 1788868800,
      }],
    },
    cancel_at_period_end: false,
    canceled_at: null,
    latest_invoice: {
      id: "in_1",
      subscription: "sub_1",
      customer: "cus_1",
      payment_intent: {
        id: "pi_1",
        status: "processing",
        customer: "cus_1",
        invoice: "in_1",
        payment_method: "pm_1",
        payment_method_types: ["us_bank_account"],
      },
    },
    ...overrides,
  };
  return sub;
}

// ---------- verifyProvisionalAchEligibility ----------

test("legitimate ACH processing qualifies", () => {
  const r = verifyProvisionalAchEligibility(processingSub());
  assert.equal(r.eligible, true);
  assert.equal(r.paymentIntentStatus, "processing");
});

test("every disqualifying PaymentIntent state is rejected", () => {
  for (const status of [
    "requires_payment_method", "requires_confirmation", "requires_action",
    "canceled", "failed", "succeeded", "bogus",
  ]) {
    const sub = processingSub();
    sub.latest_invoice.payment_intent.status = status;
    assert.equal(
      verifyProvisionalAchEligibility(sub).eligible,
      false,
      `pi status=${status} must not qualify`,
    );
  }
});

test("missing PaymentIntent / unexpanded invoice do not qualify", () => {
  const noPi = processingSub();
  noPi.latest_invoice.payment_intent = null;
  assert.equal(verifyProvisionalAchEligibility(noPi).eligible, false);

  const stringPi = processingSub();
  stringPi.latest_invoice.payment_intent = "pi_1"; // not expanded → unverifiable
  assert.equal(verifyProvisionalAchEligibility(stringPi).eligible, false);

  const stringInvoice = processingSub({ latest_invoice: "in_1" });
  assert.equal(verifyProvisionalAchEligibility(stringInvoice).eligible, false);
});

test("cross-object ownership mismatches are rejected", () => {
  const wrongInvoiceSub = processingSub();
  wrongInvoiceSub.latest_invoice.subscription = "sub_OTHER";
  assert.equal(verifyProvisionalAchEligibility(wrongInvoiceSub).eligible, false);

  const wrongInvoiceCustomer = processingSub();
  wrongInvoiceCustomer.latest_invoice.customer = "cus_OTHER";
  assert.equal(verifyProvisionalAchEligibility(wrongInvoiceCustomer).eligible, false);

  const wrongPiCustomer = processingSub();
  wrongPiCustomer.latest_invoice.payment_intent.customer = "cus_OTHER";
  assert.equal(verifyProvisionalAchEligibility(wrongPiCustomer).eligible, false);

  const wrongPiInvoice = processingSub();
  wrongPiInvoice.latest_invoice.payment_intent.invoice = "in_OTHER";
  assert.equal(verifyProvisionalAchEligibility(wrongPiInvoice).eligible, false);
});

test("unsupported payment method and missing mandate evidence are rejected", () => {
  const card = processingSub();
  card.latest_invoice.payment_intent.payment_method_types = ["card"];
  assert.equal(verifyProvisionalAchEligibility(card).eligible, false);

  const noPm = processingSub();
  noPm.latest_invoice.payment_intent.payment_method = null;
  assert.equal(verifyProvisionalAchEligibility(noPm).eligible, false);
});

test("non-incomplete statuses never enter the provisional path", () => {
  for (const status of ["active", "past_due", "canceled", "trialing"]) {
    assert.equal(
      verifyProvisionalAchEligibility(processingSub({ status })).eligible,
      false,
    );
  }
});

// ---------- buildSubscriptionRow: provisional window ----------

test("verified ACH processing + configured window ⇒ finite provisional access", () => {
  const row = buildSubscriptionRow({
    stripeSub: processingSub(), userId: "u1", existing: null,
    eventAt: NOW, windows: WINDOWS, now: NOW,
  });
  assert.ok(row.provisionalAccessUntil);
  assert.equal(
    (row.provisionalAccessUntil as Date).getTime(),
    NOW.getTime() + 7 * 24 * 3600 * 1000,
  );
  assert.equal(row.lastPaymentIntentStatus, "processing");
  const r = evaluateEntitlement(row as any, NOW);
  assert.equal(r.entitled, true);
  assert.equal(r.state, "provisional_ach");
  // ...and it expires: after the window, no access.
  const later = new Date(NOW.getTime() + 8 * 24 * 3600 * 1000);
  assert.equal(evaluateEntitlement(row as any, later).entitled, false);
});

test("no configured window (founder decision pending) ⇒ NO provisional access", () => {
  const row = buildSubscriptionRow({
    stripeSub: processingSub(), userId: "u1", existing: null,
    eventAt: NOW, windows: NO_PROVISIONAL, now: NOW,
  });
  assert.equal(row.provisionalAccessUntil, null);
  assert.equal(evaluateEntitlement(row as any, NOW).entitled, false);
});

test("unverified incomplete (no processing PI) ⇒ no provisional access", () => {
  const sub = processingSub();
  sub.latest_invoice.payment_intent.status = "requires_payment_method";
  const row = buildSubscriptionRow({
    stripeSub: sub, userId: "u1", existing: null,
    eventAt: NOW, windows: WINDOWS, now: NOW,
  });
  assert.equal(row.provisionalAccessUntil, null);
  assert.equal(evaluateEntitlement(row as any, NOW).entitled, false);
});

test("duplicate events never extend an existing provisional window", () => {
  const original = new Date("2026-08-05T00:00:00Z");
  const row = buildSubscriptionRow({
    stripeSub: processingSub(), userId: "u1",
    existing: { status: "incomplete", provisionalAccessUntil: original, graceUntil: null },
    eventAt: NOW, windows: WINDOWS, now: new Date(NOW.getTime() + 3600_000),
  });
  assert.equal((row.provisionalAccessUntil as Date).getTime(), original.getTime());
});

test("revocation (failure/cancel/dispute/refund/return) clears provisional access", () => {
  const row = buildSubscriptionRow({
    stripeSub: processingSub(), userId: "u1",
    existing: { status: "incomplete", provisionalAccessUntil: new Date("2026-08-09T00:00:00Z"), graceUntil: null },
    eventAt: NOW, revokeProvisional: true, windows: WINDOWS, now: NOW,
  });
  assert.equal(row.provisionalAccessUntil, null);
  assert.equal(evaluateEntitlement(row as any, NOW).entitled, false);
});

test("verified success ⇒ status active, provisional window cleared, entitled", () => {
  const activated = processingSub({ status: "active" });
  activated.latest_invoice.payment_intent.status = "succeeded";
  const row = buildSubscriptionRow({
    stripeSub: activated, userId: "u1",
    existing: { status: "incomplete", provisionalAccessUntil: new Date("2026-08-09T00:00:00Z"), graceUntil: null },
    eventAt: NOW, windows: WINDOWS, now: NOW,
  });
  assert.equal(row.status, "active");
  assert.equal(row.provisionalAccessUntil, null);
  const r = evaluateEntitlement(row as any, NOW);
  assert.equal(r.entitled, true);
  assert.equal(r.state, "active");
});

// ---------- buildSubscriptionRow: past-due grace ----------

test("active → past_due starts a finite grace window exactly once", () => {
  const pd = processingSub({ status: "past_due" });
  const row = buildSubscriptionRow({
    stripeSub: pd, userId: "u1",
    existing: { status: "active", provisionalAccessUntil: null, graceUntil: null },
    eventAt: NOW, windows: WINDOWS, now: NOW,
  });
  assert.equal(
    (row.graceUntil as Date).getTime(),
    NOW.getTime() + 14 * 24 * 3600 * 1000,
  );
  assert.equal(evaluateEntitlement(row as any, NOW).entitled, true);
  // After graceUntil, access ends.
  const after = new Date(NOW.getTime() + 15 * 24 * 3600 * 1000);
  assert.equal(evaluateEntitlement(row as any, after).entitled, false);
});

test("duplicate past_due events never reset or extend grace", () => {
  const original = new Date("2026-08-06T00:00:00Z");
  const pd = processingSub({ status: "past_due" });
  const row = buildSubscriptionRow({
    stripeSub: pd, userId: "u1",
    existing: { status: "past_due", provisionalAccessUntil: null, graceUntil: original },
    eventAt: new Date(NOW.getTime() + 5 * 24 * 3600 * 1000),
    windows: WINDOWS, now: new Date(NOW.getTime() + 5 * 24 * 3600 * 1000),
  });
  assert.equal((row.graceUntil as Date).getTime(), original.getTime());
});

test("past_due with NO previously-active local history gets no grace (fail closed)", () => {
  const pd = processingSub({ status: "past_due" });
  for (const existing of [
    null,
    { status: "incomplete", provisionalAccessUntil: null, graceUntil: null },
    { status: "canceled", provisionalAccessUntil: null, graceUntil: null },
  ]) {
    const row = buildSubscriptionRow({
      stripeSub: pd, userId: "u1", existing: existing as any,
      eventAt: NOW, windows: WINDOWS, now: NOW,
    });
    assert.equal(row.graceUntil, null);
    assert.equal(evaluateEntitlement(row as any, NOW).entitled, false);
  }
});

test("returning to active clears graceUntil", () => {
  const row = buildSubscriptionRow({
    stripeSub: processingSub({ status: "active" }), userId: "u1",
    existing: { status: "past_due", provisionalAccessUntil: null, graceUntil: new Date("2026-08-10T00:00:00Z") },
    eventAt: NOW, windows: WINDOWS, now: NOW,
  });
  assert.equal(row.graceUntil, null);
});

// ---------- product/price integrity ----------

test("wrong price lookup_key marks the plan unsupported ⇒ never entitled", () => {
  const wrong = processingSub({ status: "active" });
  wrong.items.data[0].price.lookup_key = "some_other_price_lookup";
  const row = buildSubscriptionRow({
    stripeSub: wrong, userId: "u1", existing: null,
    eventAt: NOW, windows: WINDOWS, now: NOW,
  });
  assert.equal(row.plan, "unsupported");
  const r = evaluateEntitlement(row as any, NOW);
  assert.equal(r.entitled, false);
  assert.equal(r.reason, "unsupported_plan");
});

test("unknown plan metadata fails closed too", () => {
  const odd = processingSub({ status: "active", metadata: { dimeTimePlanId: "mystery_plan", dimeTimeUserId: "u1" } });
  const row = buildSubscriptionRow({
    stripeSub: odd, userId: "u1", existing: null,
    eventAt: NOW, windows: WINDOWS, now: NOW,
  });
  assert.equal(evaluateEntitlement(row as any, NOW).entitled, false);
});

// ---------- out-of-order stamp ----------

test("authoritative stamps always beat the newest stored webhook timestamp", () => {
  // Server clock behind Stripe: a fresh Stripe re-fetch must still win the
  // out-of-order guard, so the stamp is bumped past the stored event time.
  const storedNewer = new Date("2026-08-04T12:00:05Z"); // 5s ahead of "now"
  const stamp = authoritativeEventAt({ lastStripeEventAt: storedNewer }, NOW);
  assert.ok(stamp.getTime() > storedNewer.getTime());
  // Normal case: clock ahead of stored events → just "now".
  const older = new Date("2026-08-04T11:00:00Z");
  assert.equal(authoritativeEventAt({ lastStripeEventAt: older }, NOW).getTime(), NOW.getTime());
  // No existing row → "now".
  assert.equal(authoritativeEventAt(null, NOW).getTime(), NOW.getTime());
});

test("rows carry the event timestamp for the storage out-of-order guard", () => {
  const eventAt = new Date("2026-08-03T09:00:00Z");
  const row = buildSubscriptionRow({
    stripeSub: processingSub(), userId: "u1", existing: null,
    eventAt, windows: WINDOWS, now: NOW,
  });
  assert.equal((row.lastStripeEventAt as Date).getTime(), eventAt.getTime());
});
