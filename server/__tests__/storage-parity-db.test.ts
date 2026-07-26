/**
 * Behavioral parity tests: MemStorage vs DatabaseStorage.
 *
 * Task 49 closed *signature* drift (IStorage declares every service-facing
 * method); this suite catches *behavioral* drift — filtering, ordering,
 * limits, and aggregate output — by running the SAME seeded scenario against
 * both implementations and asserting identical results.
 *
 * Run locally (DEV DB only — throwaway user, cleaned up after each test):
 *   npm run test:db          (syncs the dev schema first — preferred)
 *   npx tsx --test server/__tests__/storage-parity-db.test.ts
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { MemStorage, storage as dbStorage, type IStorage } from "../storage";
import { users, debts, transactions, cryptoPurchases, payments, roundUpSettings } from "../../shared/schema";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

interface Seeded {
  userId: string;
  debtIds: { active1: string; active2: string; archived: string };
  txIds: string[]; // in creation order (oldest first)
}

/** Seed the identical scenario through the PUBLIC storage API only. */
async function seedScenario(s: IStorage): Promise<Seeded> {
  const user = await s.createUser({
    email: `parity-${randomUUID()}@example.com`,
    firstName: "Parity",
    lastName: "Test",
  });
  const userId = user.id;

  const mkDebt = (name: string, current: string, original: string) =>
    s.createDebt({
      userId,
      name,
      accountNumber: "••••0000",
      originalBalance: original,
      currentBalance: current,
      interestRate: "10.00",
      minimumPayment: "25.00",
      dueDate: 5,
    });

  const active1 = await mkDebt("Parity Card A", "100.00", "200.00");
  const active2 = await mkDebt("Parity Card B", "50.50", "80.00");
  const toArchive = await mkDebt("Parity Card C", "10.00", "10.00");
  // Soft-delete the third debt — getDebtsByUserId must hide it in BOTH impls.
  await s.updateDebt(toArchive.id, { isActive: false });

  // Transactions created sequentially with real delays so their defaulted
  // timestamps have a strict order (both impls stamp "now" on create).
  const txIds: string[] = [];
  for (const [merchant, amount, roundUp] of [
    ["Coffee Shop", "4.25", "0.75"],
    ["Grocery", "23.10", "0.90"],
    ["Gas", "40.60", "0.40"],
  ] as const) {
    const tx = await s.createTransaction({
      userId,
      merchant,
      category: "test",
      amount,
      roundUpAmount: roundUp,
    });
    txIds.push(tx.id);
    await sleep(15);
  }

  await s.createCryptoPurchase({
    userId,
    cryptoSymbol: "BTC",
    amountUsd: "1.05",
    cryptoAmount: "0.00001000",
    purchasePrice: "60000.00",
  });
  await s.createCryptoPurchase({
    userId,
    cryptoSymbol: "ETH",
    amountUsd: "1.00",
    cryptoAmount: "0.00030000",
    purchasePrice: "3000.00",
  });

  return {
    userId,
    debtIds: { active1: active1.id, active2: active2.id, archived: toArchive.id },
    txIds,
  };
}

async function cleanupDb(userId: string): Promise<void> {
  await db.delete(payments).where(eq(payments.userId, userId));
  await db.delete(roundUpSettings).where(eq(roundUpSettings.userId, userId));
  await db.delete(cryptoPurchases).where(eq(cryptoPurchases.userId, userId));
  await db.delete(transactions).where(eq(transactions.userId, userId));
  await db.delete(debts).where(eq(debts.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

/**
 * Run the same scenario against one implementation and return a normalized
 * observation object. Parity = deepEqual of the two observations.
 */
async function observe(s: IStorage, seeded: Seeded) {
  const { userId, debtIds, txIds } = seeded;

  const activeDebts = await s.getDebtsByUserId(userId);
  const archivedDebts = await s.getArchivedDebtsByUserId(userId);

  const allTx = await s.getTransactionsByUserId(userId);
  const limitedTx = await s.getTransactionsByUserId(userId, 2);

  const summary = await s.getDashboardSummary(userId);

  // Map ids to stable labels so observations from different impls compare.
  const label = new Map<string, string>([
    [debtIds.active1, "active1"],
    [debtIds.active2, "active2"],
    [debtIds.archived, "archived"],
    [txIds[0], "tx0"],
    [txIds[1], "tx1"],
    [txIds[2], "tx2"],
  ]);
  const l = (id: string) => label.get(id) ?? `UNKNOWN(${id})`;

  return {
    activeDebts: activeDebts
      .map((d) => ({ key: l(d.id), name: d.name, currentBalance: d.currentBalance, isActive: d.isActive }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    archivedDebts: archivedDebts.map((d) => ({ key: l(d.id), isActive: d.isActive })),
    // Ordering matters here — newest first in both implementations.
    allTxOrder: allTx.map((t) => l(t.id)),
    limitedTxOrder: limitedTx.map((t) => l(t.id)),
    summary,
  };
}

test("parity: MemStorage and DatabaseStorage return identical results for the same scenario", async () => {
  const mem = new MemStorage();
  const memSeed = await seedScenario(mem);
  const memObs = await observe(mem, memSeed);

  const dbSeed = await seedScenario(dbStorage);
  try {
    const dbObs = await observe(dbStorage, dbSeed);

    // Pin the expected behavior explicitly first, so a failure names the
    // drifted behavior rather than just "objects differ".
    assert.deepEqual(memObs.allTxOrder, ["tx2", "tx1", "tx0"], "MemStorage: transactions newest-first");
    assert.deepEqual(dbObs.allTxOrder, ["tx2", "tx1", "tx0"], "DatabaseStorage: transactions newest-first");
    assert.deepEqual(memObs.limitedTxOrder, ["tx2", "tx1"], "MemStorage: limit keeps newest");
    assert.deepEqual(dbObs.limitedTxOrder, ["tx2", "tx1"], "DatabaseStorage: limit keeps newest");

    assert.equal(memObs.activeDebts.length, 2, "MemStorage: soft-deleted debt hidden from active list");
    assert.equal(dbObs.activeDebts.length, 2, "DatabaseStorage: soft-deleted debt hidden from active list");
    assert.deepEqual(memObs.archivedDebts.map((d) => d.key), ["archived"]);
    assert.deepEqual(dbObs.archivedDebts.map((d) => d.key), ["archived"]);

    // Dashboard aggregates: 100.00 + 50.50 debt; 0.75+0.90+0.40 round-ups; 1.05+1.00 crypto.
    const expectedSummary = {
      totalDebt: "150.50",
      totalRoundUps: "2.05",
      totalCrypto: "2.05",
      debtCount: 2,
      transactionCount: 3,
    };
    assert.deepEqual(memObs.summary, expectedSummary, "MemStorage dashboard summary");
    assert.deepEqual(dbObs.summary, expectedSummary, "DatabaseStorage dashboard summary");

    // Finally: full observation parity (catches any drift the explicit
    // assertions above didn't anticipate).
    assert.deepEqual(dbObs, memObs, "MemStorage and DatabaseStorage observations must match exactly");
  } finally {
    await cleanupDb(dbSeed.userId);
  }
});

/**
 * Write-path parity (money-moving business rules):
 *   - makeAcceleratedPayment: balance math, clamp-at-0, paidOffAt stamping,
 *     payment record source/status.
 *   - updateDebt archive→restore: archivedAt stamped on soft-delete, cleared
 *     on restore.
 *   - deleteDebtPermanently: debt + payment history gone, dangling
 *     round-up target reference nulled.
 * Timestamps are normalized to booleans (stamped vs not) since wall-clock
 * values can never match across implementations.
 */
async function observeWrites(s: IStorage, seeded: Seeded) {
  const { userId, debtIds } = seeded;

  // 1. Partial accelerated payment on active1: 100.00 - 40.25 → 59.75.
  const partial = await s.makeAcceleratedPayment(userId, debtIds.active1, "40.25");

  // 2. Full-payoff (overpayment) on active2: 50.50 - 60.00 → clamps to 0.00.
  const payoff = await s.makeAcceleratedPayment(userId, debtIds.active2, "60.00");

  // 3. Paying an archived debt must be rejected identically.
  let archivedPayError = false;
  try {
    await s.makeAcceleratedPayment(userId, debtIds.archived, "1.00");
  } catch {
    archivedPayError = true;
  }

  // 4. Archive active1, then restore it — archivedAt bookkeeping.
  const archived = await s.updateDebt(debtIds.active1, { isActive: false });
  const restored = await s.updateDebt(debtIds.active1, { isActive: true });

  // 5. Point round-up settings at the paid-off debt, archive it, then
  //    permanently delete it — payments cascade + target reference nulled.
  await s.createOrUpdateRoundUpSettings({ userId, targetDebtId: debtIds.active2 });
  await s.updateDebt(debtIds.active2, { isActive: false });
  await s.deleteDebtPermanently(debtIds.active2);

  const deletedDebt = await s.getDebt(debtIds.active2);
  const deletedDebtPayments = await s.getPaymentsByDebtId(debtIds.active2);
  const settingsAfterDelete = await s.getRoundUpSettings(userId);
  const remainingPayments = await s.getPaymentsByUserId(userId);

  return {
    partial: {
      paymentAmount: partial.payment.amount,
      paymentSource: partial.payment.source,
      paymentStatus: partial.payment.status,
      newBalance: partial.updatedDebt.currentBalance,
      paidOff: partial.updatedDebt.paidOffAt !== null,
    },
    payoff: {
      paymentAmount: payoff.payment.amount,
      newBalance: payoff.updatedDebt.currentBalance,
      paidOff: payoff.updatedDebt.paidOffAt !== null,
    },
    archivedPayError,
    archive: {
      isActive: archived?.isActive,
      archivedAtStamped: archived?.archivedAt != null,
    },
    restore: {
      isActive: restored?.isActive,
      archivedAtCleared: restored?.archivedAt == null,
      // Restore must not touch payoff bookkeeping on a non-paid-off debt.
      paidOff: restored?.paidOffAt != null,
      balance: restored?.currentBalance,
    },
    afterPermanentDelete: {
      debtGone: deletedDebt === undefined,
      paymentsGone: deletedDebtPayments.length === 0,
      roundUpTargetCleared: settingsAfterDelete?.targetDebtId === null,
      remainingPaymentCount: remainingPayments.length,
    },
  };
}

/**
 * Round-up settings default parity:
 *   MemStorage fills defaults inline in code, while DatabaseStorage relies on
 *   schema column defaults. If those two lists drift, round-up behavior (how
 *   much money is swept) differs between dev and production. This observes
 *   the FULL row from a minimal-payload create, then a partial update, and
 *   asserts identical results (ids/userIds normalized away).
 */
async function observeRoundUpSettings(s: IStorage, userId: string) {
  // 1. Create with the minimal possible payload — every other field must
  //    come from defaults, identically in both implementations.
  const created = await s.createOrUpdateRoundUpSettings({ userId });

  // 2. Partial update — must change ONLY the provided fields and must not
  //    clobber (or re-default) anything else.
  const updated = await s.createOrUpdateRoundUpSettings({
    userId,
    multiplier: "2.00",
    cryptoEnabled: true,
  });

  const fetched = await s.getRoundUpSettings(userId);

  // Normalize instance-specific identifiers; keep every other column.
  const norm = (r: typeof created | undefined) => {
    if (!r) return undefined;
    const { id: _id, userId: _uid, ...rest } = r;
    return rest;
  };
  return { created: norm(created), updated: norm(updated), fetched: norm(fetched) };
}

test("parity: round-up settings defaults and partial updates match in MemStorage and DatabaseStorage", async () => {
  const mem = new MemStorage();
  const memUser = await mem.createUser({
    email: `parity-${randomUUID()}@example.com`,
    firstName: "Parity",
    lastName: "Test",
  });
  const memObs = await observeRoundUpSettings(mem, memUser.id);

  const dbUser = await dbStorage.createUser({
    email: `parity-${randomUUID()}@example.com`,
    firstName: "Parity",
    lastName: "Test",
  });
  try {
    const dbObs = await observeRoundUpSettings(dbStorage, dbUser.id);

    // Pin the expected defaulted row explicitly so a failure names the
    // drifted field (and so schema-default changes are caught deliberately).
    const expectedCreated = {
      isEnabled: true,
      sourceAccountId: null,
      targetDebtId: null,
      fundingStripeAccountId: null,
      multiplier: "1.00",
      autoApplyThreshold: "25.00",
      cryptoEnabled: false,
      cryptoPercentage: "0.00",
      preferredCrypto: "BTC",
    };
    assert.deepEqual(memObs.created, expectedCreated, "MemStorage: minimal-payload create defaults");
    assert.deepEqual(dbObs.created, expectedCreated, "DatabaseStorage: minimal-payload create defaults");

    // Partial update changes only the provided fields.
    const expectedUpdated = { ...expectedCreated, multiplier: "2.00", cryptoEnabled: true };
    assert.deepEqual(memObs.updated, expectedUpdated, "MemStorage: partial update must not clobber unrelated fields");
    assert.deepEqual(dbObs.updated, expectedUpdated, "DatabaseStorage: partial update must not clobber unrelated fields");

    // Round-trip read matches what the write returned.
    assert.deepEqual(memObs.fetched, memObs.updated, "MemStorage: fetched row matches returned row");
    assert.deepEqual(dbObs.fetched, dbObs.updated, "DatabaseStorage: fetched row matches returned row");

    // Full parity across every observed column.
    assert.deepEqual(dbObs, memObs, "round-up settings observations must match exactly");
  } finally {
    await cleanupDb(dbUser.id);
  }
});

test("parity: money-moving writes behave identically in MemStorage and DatabaseStorage", async () => {
  const mem = new MemStorage();
  const memSeed = await seedScenario(mem);
  const memObs = await observeWrites(mem, memSeed);

  const dbSeed = await seedScenario(dbStorage);
  try {
    const dbObs = await observeWrites(dbStorage, dbSeed);

    // Pin the expected behavior explicitly so failures name the drift.
    const expected = {
      partial: {
        paymentAmount: "40.25",
        paymentSource: "accelerated",
        paymentStatus: "completed",
        newBalance: "59.75",
        paidOff: false,
      },
      payoff: {
        paymentAmount: "60.00",
        newBalance: "0.00",
        paidOff: true,
      },
      archivedPayError: true,
      archive: { isActive: false, archivedAtStamped: true },
      restore: { isActive: true, archivedAtCleared: true, paidOff: false, balance: "59.75" },
      afterPermanentDelete: {
        debtGone: true,
        paymentsGone: true,
        roundUpTargetCleared: true,
        remainingPaymentCount: 1, // the partial payment on active1 survives
      },
    };
    assert.deepEqual(memObs, expected, "MemStorage write behavior");
    assert.deepEqual(dbObs, expected, "DatabaseStorage write behavior");

    // Full observation parity (catches drift the pins didn't anticipate).
    assert.deepEqual(dbObs, memObs, "write observations must match exactly");
  } finally {
    await cleanupDb(dbSeed.userId);
  }
});
