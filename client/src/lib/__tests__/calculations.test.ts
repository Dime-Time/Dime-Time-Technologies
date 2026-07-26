/**
 * Regression tests for debt progress clamping.
 * Run: npx tsx --test client/src/lib/__tests__/calculations.test.ts
 *
 * Invariant: progress rendered to the user is always in [0, 100], even for
 * legacy rows where currentBalance > originalBalance or data is malformed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { calculateDebtProgress } from "../calculations";

test("normal progress values are unchanged", () => {
  assert.equal(calculateDebtProgress("1000", "600"), 40);
  assert.equal(calculateDebtProgress("1000", "1000"), 0);
  assert.equal(calculateDebtProgress("1000", "0"), 100);
});

test("balance above original clamps to 0, never negative", () => {
  assert.equal(calculateDebtProgress("1000", "1500"), 0);
  assert.equal(calculateDebtProgress("100", "100000"), 0);
});

test("overpayment / bad data clamps to at most 100", () => {
  assert.equal(calculateDebtProgress("1000", "-50"), 100);
});

test("zero, negative, or non-numeric originals return 0", () => {
  assert.equal(calculateDebtProgress("0", "500"), 0);
  assert.equal(calculateDebtProgress("-10", "500"), 0);
  assert.equal(calculateDebtProgress("abc", "500"), 0);
  assert.equal(calculateDebtProgress("1000", "abc"), 0);
});
