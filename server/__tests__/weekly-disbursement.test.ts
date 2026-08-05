/**
 * Weekly round-up disbursement — pure logic tests.
 *
 * Covers the Friday 00:00 America/New_York boundary calculation and the
 * disbursable-balance math (settled collections minus non-void payments).
 * The money-movement path is exercised in dev via the admin dry-run
 * endpoint; real runs are founder-gated behind two flags.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  getFridayBoundary,
  computeDisbursableFromTransfers,
} from "../services/weeklyDisbursementService";
import type { Transfer } from "@shared/schema";

function t(partial: Partial<Transfer>): Transfer {
  return {
    id: "t1",
    userId: "u1",
    type: "roundup_collection",
    amount: "0.00",
    status: "settled",
    plaidTransferId: null,
    plaidAuthorizationId: null,
    mercuryTransferId: null,
    stripePaymentIntentId: null,
    stripeChargeId: null,
    provider: null,
    stripeAccountId: null,
    debtId: null,
    correlationId: "c1",
    idempotencyKey: null,
    errorCode: null,
    errorMessage: null,
    rawRequest: null,
    rawResponse: null,
    createdAt: new Date("2026-08-01T00:00:00Z"),
    updatedAt: new Date("2026-08-01T00:00:00Z"),
    ...partial,
  } as Transfer;
}

// ---------- getFridayBoundary ----------

test("a Wednesday maps back to the previous Friday", () => {
  // Wed Aug 5 2026, noon ET
  const now = new Date("2026-08-05T16:00:00Z");
  assert.equal(getFridayBoundary(now).toISOString().slice(0, 10), "2026-07-31");
});

test("Friday just after midnight ET maps to that same Friday", () => {
  // Fri Aug 7 2026 00:30 ET == 04:30 UTC (EDT)
  const now = new Date("2026-08-07T04:30:00Z");
  assert.equal(getFridayBoundary(now).toISOString().slice(0, 10), "2026-08-07");
});

test("Thursday 11:59pm ET still maps to the PREVIOUS Friday", () => {
  // Thu Aug 6 2026 23:59 ET == Fri Aug 7 03:59 UTC (EDT) — UTC date is
  // already Friday, but ET wall-clock is still Thursday. Timezone matters.
  const now = new Date("2026-08-07T03:59:00Z");
  assert.equal(getFridayBoundary(now).toISOString().slice(0, 10), "2026-07-31");
});

test("Saturday maps back to the day-old Friday", () => {
  const now = new Date("2026-08-08T16:00:00Z");
  assert.equal(getFridayBoundary(now).toISOString().slice(0, 10), "2026-08-07");
});

test("boundary is stable across a whole ET week (idempotency key)", () => {
  // Every instant from Fri 00:00 ET to Thu 23:59 ET yields the same date.
  const friday = getFridayBoundary(new Date("2026-08-07T05:00:00Z"));
  const sunday = getFridayBoundary(new Date("2026-08-09T12:00:00Z"));
  const thursday = getFridayBoundary(new Date("2026-08-13T20:00:00Z"));
  assert.equal(friday.toISOString(), sunday.toISOString());
  assert.equal(friday.toISOString(), thursday.toISOString());
});

// ---------- computeDisbursableFromTransfers ----------

test("settled collections sum; unsettled ones do not count", () => {
  const balance = computeDisbursableFromTransfers([
    t({ amount: "2.50", status: "settled" }),
    t({ amount: "1.25", status: "settled", type: "stripe_ach_debit" }),
    t({ amount: "9.99", status: "pending" }), // in flight — not yet money in the bank
    t({ amount: "5.00", status: "failed" }),
    t({ amount: "5.00", status: "returned" }),
  ]);
  assert.equal(balance, 3.75);
});

test("prior debt payments reduce the balance — including PENDING ones (never double-disburse)", () => {
  const balance = computeDisbursableFromTransfers([
    t({ amount: "10.00", status: "settled" }),
    t({ id: "p1", type: "debt_payment", amount: "3.00", status: "settled" }),
    t({ id: "p2", type: "debt_payment", amount: "2.00", status: "pending" }),
  ]);
  assert.equal(balance, 5.0);
});

test("failed/cancelled/returned/refunded payments do NOT reduce the balance", () => {
  const balance = computeDisbursableFromTransfers([
    t({ amount: "10.00", status: "settled" }),
    t({ id: "p1", type: "debt_payment", amount: "4.00", status: "failed" }),
    t({ id: "p2", type: "debt_payment", amount: "4.00", status: "cancelled" }),
    t({ id: "p3", type: "debt_payment", amount: "4.00", status: "returned" }),
    t({ id: "p4", type: "debt_payment", amount: "4.00", status: "refunded" }),
  ]);
  assert.equal(balance, 10.0);
});

test("'simulated' debt payments (flag-off era) never reduce the balance", () => {
  const balance = computeDisbursableFromTransfers([
    t({ amount: "10.00", status: "settled" }),
    t({ id: "p1", type: "debt_payment", amount: "6.00", status: "simulated" }),
  ]);
  assert.equal(balance, 10.0);
});

test("unknown/ambiguous debt-payment statuses COUNT as spent (fail-safe vs double-pay)", () => {
  const balance = computeDisbursableFromTransfers([
    t({ amount: "10.00", status: "settled" }),
    t({ id: "p1", type: "debt_payment", amount: "3.00", status: "requires_action" }),
    t({ id: "p2", type: "debt_payment", amount: "2.00", status: "created" }),
    t({ id: "p3", type: "debt_payment", amount: "1.00", status: "some_future_status" }),
  ]);
  assert.equal(balance, 4.0);
});

test("balance never goes negative", () => {
  const balance = computeDisbursableFromTransfers([
    t({ amount: "1.00", status: "settled" }),
    t({ id: "p1", type: "debt_payment", amount: "5.00", status: "settled" }),
  ]);
  assert.equal(balance, 0);
});

test("garbage amounts are ignored, cents are rounded exactly", () => {
  const balance = computeDisbursableFromTransfers([
    t({ amount: "0.10", status: "settled" }),
    t({ id: "b", amount: "0.20", status: "settled" }),
    t({ id: "c", amount: "not-a-number", status: "settled" }),
    t({ id: "d", amount: "-5.00", status: "settled" }),
  ]);
  assert.equal(balance, 0.3);
});

test("empty ledger disburses nothing", () => {
  assert.equal(computeDisbursableFromTransfers([]), 0);
});
