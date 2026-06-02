import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isDemoUser,
  applyDemoSummary,
  DEMO_TRANSACTIONS,
} from "../demoData";

test("isDemoUser matches only the review account (case-insensitive)", () => {
  assert.equal(isDemoUser({ email: "tim@dime-time.com" }), true);
  assert.equal(isDemoUser({ email: "  TIM@Dime-Time.com " }), true);
  assert.equal(isDemoUser({ email: "someone@else.com" }), false);
  assert.equal(isDemoUser({ email: "tim@dimetime.com" }), false); // no hyphen domain
  assert.equal(isDemoUser(undefined), false);
  assert.equal(isDemoUser(null), false);
  assert.equal(isDemoUser({}), false);
});

test("demo dataset hits its calibration targets", () => {
  const total = DEMO_TRANSACTIONS.reduce((s, t) => s + parseFloat(t.roundUpAmount), 0);
  const spend = DEMO_TRANSACTIONS.reduce((s, t) => s + parseFloat(t.amount), 0);
  assert.equal(DEMO_TRANSACTIONS.length, 589);
  assert.equal(total.toFixed(2), "512.34");
  assert.equal((total / DEMO_TRANSACTIONS.length).toFixed(2), "0.87");
  assert.equal(((total / spend) * 100).toFixed(1), "3.8");

  const byCat: Record<string, number> = {};
  for (const t of DEMO_TRANSACTIONS) byCat[t.category] = (byCat[t.category] || 0) + parseFloat(t.amount);
  const top = Object.entries(byCat).sort((a, b) => b[1] - a[1])[0][0];
  assert.equal(top, "Dining & Restaurants");
});

test("applyDemoSummary only injects when there is NO round-up/payment activity", () => {
  // Empty activity (real debts present, no round-ups) -> inject demo figures.
  const empty = applyDemoSummary({
    totalDebt: "25000",
    totalRoundUps: "0",
    thisMonthRoundUps: "0",
    thisMonthPayments: "0",
    progressPercentage: 17,
    debtFreeDate: "Aug 2030",
    debtsCount: 2,
  });
  assert.equal(empty?.totalRoundUps, "42.18");
  assert.equal(empty?.totalDebt, "25000"); // real fields untouched
  assert.equal(empty?.progressPercentage, 17);

  // Real activity present -> pass through untouched (real data always wins).
  const real = applyDemoSummary({
    totalDebt: "25000",
    totalRoundUps: "0",
    thisMonthRoundUps: "0",
    thisMonthPayments: "12.50", // real payment
    progressPercentage: 17,
    debtFreeDate: "Aug 2030",
    debtsCount: 2,
  });
  assert.equal(real?.thisMonthPayments, "12.50");
  assert.equal(real?.totalRoundUps, "0");

  // Mixed: only ONE field has activity -> still passes through untouched.
  const mixed = applyDemoSummary({
    totalRoundUps: "0",
    thisMonthRoundUps: "5.00", // real activity in one field
    thisMonthPayments: "0",
  });
  assert.equal(mixed?.totalRoundUps, "0");
  assert.equal(mixed?.thisMonthRoundUps, "5.00");
  assert.equal(mixed?.thisMonthPayments, "0");

  // Undefined summary passes through.
  assert.equal(applyDemoSummary(undefined), undefined);
});
