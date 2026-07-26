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
import { users, debts, transactions, cryptoPurchases } from "../../shared/schema";

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
