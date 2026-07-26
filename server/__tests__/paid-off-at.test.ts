/**
 * Payoff-date stamping tests (both storage implementations).
 *
 * Run locally (DB tests hit the DEV DB only — throwaway user, cleaned up):
 *   npx tsx --test server/__tests__/paid-off-at.test.ts
 *
 * Invariants under test (identical for MemStorage and DatabaseStorage):
 *  1. paidOffAt is stamped ONCE at the actual >0 → <=0 crossing.
 *  2. A 0 → 0 update never re-stamps (the celebration date is permanent).
 *  3. A legacy debt already at zero with no paidOffAt is NEVER backfilled
 *     with "now" (by balance updates or import refresh).
 *  4. Balance going back above zero clears paidOffAt; a later re-zero
 *     stamps a fresh date.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { MemStorage, storage } from "../storage";
import { db } from "../db";
import { users, debts } from "../../shared/schema";
import type { NormalizedLiability } from "../services/debtImport/types";

// ---------- MemStorage ----------

async function memDebt(currentBalance: string) {
  const store = new MemStorage();
  const debt = await store.createDebt({
    userId: "demo-user-1",
    name: "Test Card",
    accountNumber: "1234",
    originalBalance: "1000.00",
    currentBalance,
    interestRate: "19.99",
    minimumPayment: "25.00",
    dueDate: 15,
  } as any);
  return { store, debt };
}

test("Mem: >0 → 0 stamps paidOffAt once; 0 → 0 does not move it", async () => {
  const { store, debt } = await memDebt("600.00");
  assert.equal(debt.paidOffAt, null);

  const zeroed = await store.updateDebt(debt.id, { currentBalance: "0.00" });
  assert.ok(zeroed?.paidOffAt instanceof Date, "crossing to zero must stamp paidOffAt");
  const first = zeroed!.paidOffAt!;

  await new Promise((r) => setTimeout(r, 5));
  const again = await store.updateDebt(debt.id, { currentBalance: "0.00" });
  assert.equal(again!.paidOffAt!.getTime(), first.getTime(), "0 → 0 must not re-stamp");
});

test("Mem: legacy zero-balance debt is never backfilled with now", async () => {
  const { store, debt } = await memDebt("600.00");
  // Simulate a legacy pre-feature row: already zero, no paidOffAt.
  await store.updateDebt(debt.id, { currentBalance: "0.00", paidOffAt: null });
  const after = await store.updateDebt(debt.id, { currentBalance: "0.00" });
  assert.equal(after!.paidOffAt, null, "already-zero debt must keep paidOffAt null");
});

test("Mem: balance back above zero clears paidOffAt; re-zero re-stamps", async () => {
  const { store, debt } = await memDebt("600.00");
  await store.updateDebt(debt.id, { currentBalance: "0.00" });

  const reopened = await store.updateDebt(debt.id, { currentBalance: "100.00" });
  assert.equal(reopened!.paidOffAt, null, "going above zero must clear paidOffAt");

  const rezeroed = await store.updateDebt(debt.id, { currentBalance: "0.00" });
  assert.ok(rezeroed!.paidOffAt instanceof Date, "re-zero must stamp a fresh date");
});

test("Mem: accelerated payment to zero stamps paidOffAt (no payment-history inference)", async () => {
  const { store, debt } = await memDebt("50.00");
  const { updatedDebt } = await store.makeAcceleratedPayment("demo-user-1", debt.id, "50.00");
  assert.equal(updatedDebt.currentBalance, "0.00");
  assert.ok(updatedDebt.paidOffAt instanceof Date);
});

test("Mem: import refresh zeroing a balance stamps; already-zero import does not", async () => {
  const store = new MemStorage();
  const lib = (balance: number): NormalizedLiability =>
    ({
      provider: "sandbox",
      providerAccountId: "acct-1",
      institutionName: "Test Bank",
      creditorName: "Test Card",
      accountType: "credit_card",
      mask: "1234",
      currentBalance: balance,
      interestRateApr: 19.99,
      minimumPayment: 25,
      dueDate: 15,
    }) as NormalizedLiability;

  // Newly imported already-at-zero debt: unknown payoff day → null.
  const first = await store.importDebtsFromProvider("demo-user-1", "sandbox", [lib(0)]);
  assert.equal(first.debts[0].paidOffAt, null, "already-zero import must not backfill");

  // Refresh keeps it at zero: still null.
  const still = await store.importDebtsFromProvider("demo-user-1", "sandbox", [lib(0)]);
  assert.equal(still.debts[0].paidOffAt, null);

  // Balance rises, then a refresh zeroes it: THAT is the crossing.
  await store.importDebtsFromProvider("demo-user-1", "sandbox", [lib(250)]);
  const zeroed = await store.importDebtsFromProvider("demo-user-1", "sandbox", [lib(0)]);
  assert.ok(zeroed.debts[0].paidOffAt instanceof Date, "refresh crossing to zero must stamp");
});

// ---------- DatabaseStorage (dev DB, throwaway user) ----------

async function makeDbUser(): Promise<string> {
  const userId = "paidoff-db-test-" + randomUUID();
  await db.insert(users).values({ id: userId, email: userId + "@example.com" });
  return userId;
}

async function cleanupDb(userId: string): Promise<void> {
  await db.delete(debts).where(eq(debts.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

test("DB: crossing stamps once, 0→0 keeps it, reopen clears, re-zero re-stamps", async () => {
  const userId = await makeDbUser();
  try {
    const debt = await storage.createDebt({
      userId,
      name: "DB Test Card",
      accountNumber: "9999",
      originalBalance: "500.00",
      currentBalance: "500.00",
      interestRate: "10.00",
      minimumPayment: "20.00",
      dueDate: 1,
    } as any);
    assert.equal(debt.paidOffAt, null);

    const zeroed = await storage.updateDebt(debt.id, { currentBalance: "0.00" });
    assert.ok(zeroed?.paidOffAt instanceof Date, "crossing to zero must stamp");
    const first = zeroed!.paidOffAt!;

    const again = await storage.updateDebt(debt.id, { currentBalance: "0.00" });
    assert.equal(again!.paidOffAt!.getTime(), first.getTime(), "0 → 0 must not re-stamp");

    const reopened = await storage.updateDebt(debt.id, { currentBalance: "50.00" });
    assert.equal(reopened!.paidOffAt, null, "reopening must clear paidOffAt");

    const rezeroed = await storage.updateDebt(debt.id, { currentBalance: "0.00" });
    assert.ok(rezeroed!.paidOffAt instanceof Date, "re-zero must stamp a fresh date");

    // Assert what was PERSISTED, not just returned.
    const [row] = await db.select().from(debts).where(eq(debts.id, debt.id));
    assert.ok(row.paidOffAt instanceof Date);
  } finally {
    await cleanupDb(userId);
  }
});

test("DB: legacy already-zero debt is never backfilled by an update or import refresh", async () => {
  const userId = await makeDbUser();
  try {
    // Legacy imported row already at zero, no paidOffAt (inserted directly).
    const [legacy] = await db
      .insert(debts)
      .values({
        id: randomUUID(),
        userId,
        name: "Legacy Paid Card",
        accountNumber: "0000",
        originalBalance: "300.00",
        currentBalance: "0.00",
        interestRate: "0.00",
        minimumPayment: "0.00",
        dueDate: 1,
        source: "imported",
        provider: "sandbox",
        providerAccountId: "legacy-acct",
      })
      .returning();
    assert.equal(legacy.paidOffAt, null);

    // Balance update that stays at zero: no backfill.
    const updated = await storage.updateDebt(legacy.id, { currentBalance: "0.00" });
    assert.equal(updated!.paidOffAt, null, "0 → 0 update must not backfill");

    // First import refresh after rollout, still zero: no backfill.
    const refresh = await storage.importDebtsFromProvider(userId, "sandbox", [
      {
        provider: "sandbox",
        providerAccountId: "legacy-acct",
        institutionName: "Test Bank",
        creditorName: "Legacy Paid Card",
        accountType: "credit_card",
        mask: "0000",
        currentBalance: 0,
        interestRateApr: 0,
        minimumPayment: 0,
        dueDate: 1,
      } as NormalizedLiability,
    ]);
    assert.equal(refresh.updated, 1);
    assert.equal(refresh.debts[0].paidOffAt, null, "import refresh must not backfill legacy zero");
  } finally {
    await cleanupDb(userId);
  }
});
