/**
 * Unit tests for the progressive-trust limit ladder (pure function — no DB).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { computeRealTransferTrust } from "../realTransferTrust";

const NOW = new Date("2026-08-01T12:00:00Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

test("new user gets base limits ($5/day, 1/day, $1 first)", () => {
  const t = computeRealTransferTrust([], null, NOW);
  assert.equal(t.tier, "new");
  assert.equal(t.flagged, false);
  assert.equal(t.dailyTotalMaxDollars, 5);
  assert.equal(t.dailyCountMax, 1);
  assert.equal(t.firstTransferMaxDollars, 1);
});

test("pending/processing transfers alone do not raise limits", () => {
  const t = computeRealTransferTrust(
    [{ status: "pending", createdAt: daysAgo(2) }, { status: "processing", createdAt: daysAgo(1) }],
    null, NOW,
  );
  assert.equal(t.tier, "new");
  assert.equal(t.dailyTotalMaxDollars, 5);
});

test("first settlement (<7 days) raises to $25/day, 3/day", () => {
  const t = computeRealTransferTrust([{ status: "settled", createdAt: daysAgo(2) }], null, NOW);
  assert.equal(t.tier, "settled");
  assert.equal(t.dailyTotalMaxDollars, 25);
  assert.equal(t.dailyCountMax, 3);
});

test("7+ days since first settlement raises to $100/day, 5/day", () => {
  const t = computeRealTransferTrust([{ status: "settled", createdAt: daysAgo(8) }], null, NOW);
  assert.equal(t.tier, "trusted");
  assert.equal(t.dailyTotalMaxDollars, 100);
  assert.equal(t.dailyCountMax, 5);
});

test("30+ days since first settlement raises to $250/day, 10/day", () => {
  const t = computeRealTransferTrust(
    [{ status: "settled", createdAt: daysAgo(31) }, { status: "settled", createdAt: daysAgo(3) }],
    null, NOW,
  );
  assert.equal(t.tier, "established");
  assert.equal(t.dailyTotalMaxDollars, 250);
  assert.equal(t.dailyCountMax, 10);
});

test("earliest settlement date drives the tier, not the latest", () => {
  const t = computeRealTransferTrust(
    [{ status: "settled", createdAt: daysAgo(1) }, { status: "settled", createdAt: daysAgo(10) }],
    null, NOW,
  );
  assert.equal(t.tier, "trusted");
});

test("settlement aging uses updatedAt (settlement time) over createdAt", () => {
  // Created 40 days ago but only settled 2 days ago — must NOT be established.
  const t = computeRealTransferTrust(
    [{ status: "settled", createdAt: daysAgo(40), updatedAt: daysAgo(2) }],
    null, NOW,
  );
  assert.equal(t.tier, "settled");
  assert.equal(t.dailyTotalMaxDollars, 25);
});

test("a returned transfer demotes to base limits even at high tier", () => {
  const t = computeRealTransferTrust(
    [{ status: "settled", createdAt: daysAgo(40) }, { status: "returned", createdAt: daysAgo(2) }],
    null, NOW,
  );
  assert.equal(t.flagged, true);
  assert.equal(t.dailyTotalMaxDollars, 5);
  assert.equal(t.dailyCountMax, 1);
});

test("a disputed transfer also flags the user", () => {
  const t = computeRealTransferTrust([{ status: "disputed", createdAt: daysAgo(1) }], null, NOW);
  assert.equal(t.flagged, true);
  assert.equal(t.dailyTotalMaxDollars, 5);
});

test("failed/cancelled/refunded transfers do NOT flag the user", () => {
  const t = computeRealTransferTrust(
    [
      { status: "failed", createdAt: daysAgo(3) },
      { status: "cancelled", createdAt: daysAgo(3) },
      { status: "refunded", createdAt: daysAgo(3) },
      { status: "settled", createdAt: daysAgo(10) },
    ],
    null, NOW,
  );
  assert.equal(t.flagged, false);
  assert.equal(t.tier, "trusted");
});

test("admin override raises the daily cap and wins over the tier", () => {
  const t = computeRealTransferTrust([], 200, NOW);
  assert.equal(t.overrideApplied, true);
  assert.equal(t.dailyTotalMaxDollars, 200);
  assert.equal(t.dailyCountMax, 1, "count still follows the tier");
});

test("admin override can LOWER the cap below the tier", () => {
  const t = computeRealTransferTrust([{ status: "settled", createdAt: daysAgo(40) }], 10, NOW);
  assert.equal(t.dailyTotalMaxDollars, 10);
});

test("admin override releases a flagged user after manual review", () => {
  const t = computeRealTransferTrust(
    [{ status: "settled", createdAt: daysAgo(40) }, { status: "returned", createdAt: daysAgo(2) }],
    50, NOW,
  );
  assert.equal(t.flagged, true, "still visibly flagged");
  assert.equal(t.dailyTotalMaxDollars, 50, "but the override releases the cap");
});

test("override of 0 suspends daily transfers entirely", () => {
  const t = computeRealTransferTrust([{ status: "settled", createdAt: daysAgo(10) }], 0, NOW);
  assert.equal(t.dailyTotalMaxDollars, 0);
});
