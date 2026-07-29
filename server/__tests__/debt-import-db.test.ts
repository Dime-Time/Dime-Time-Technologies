/**
 * DB-backed parity tests for DatabaseStorage.importDebtsFromProvider.
 *
 * Run locally (DEV DB only — throwaway user, cleaned up after each test):
 *   npm run test:db          (syncs the dev schema first — preferred)
 *   npx tsx --test server/__tests__/debt-import-db.test.ts
 *
 * Why this exists: MemStorage and DatabaseStorage have silently drifted
 * before. server/__tests__/debt-edit.test.ts pins the originalBalance bump
 * rule on MemStorage only; these tests pin the SAME invariants against the
 * real Postgres implementation:
 *  1. A provider refresh reporting a HIGHER balance bumps originalBalance to
 *     match (payoff progress resets to 0%, never negative).
 *  2. A LOWER balance leaves originalBalance untouched (progress advances).
 *  3. A user-edited currentBalance is never clobbered by a refresh, and its
 *     originalBalance is untouched even when the provider reports a higher
 *     balance.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { users, debts } from "../../shared/schema";
import type { NormalizedLiability } from "../services/debtImport/types";

async function makeUser(): Promise<string> {
  const userId = "import-db-test-" + randomUUID();
  await db.insert(users).values({ id: userId, email: userId + "@example.com" });
  return userId;
}

async function cleanup(userId: string): Promise<void> {
  await db.delete(debts).where(eq(debts.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

function makeLiability(overrides: Partial<NormalizedLiability> = {}): NormalizedLiability {
  return {
    provider: "sandbox",
    providerAccountId: "acct-db-1",
    institutionName: "Test Bank",
    creditorName: "Test Card",
    accountType: "credit_card",
    mask: "1234",
    currentBalance: 500,
    interestRateApr: 19.99,
    minimumPayment: 25,
    dueDate: 15,
    ...overrides,
  } as NormalizedLiability;
}

test("DB: refresh with higher balance bumps originalBalance (progress never negative)", async () => {
  const userId = await makeUser();
  try {
    const first = await storage.importDebtsFromProvider(userId, "sandbox", [
      makeLiability({ currentBalance: 500 }),
    ]);
    assert.equal(first.imported, 1);
    assert.equal(first.debts[0].originalBalance, "500.00");
    assert.equal(first.debts[0].currentBalance, "500.00");

    const refresh = await storage.importDebtsFromProvider(userId, "sandbox", [
      makeLiability({ currentBalance: 750.5 }),
    ]);
    assert.equal(refresh.updated, 1);
    const debt = refresh.debts[0];
    assert.equal(debt.currentBalance, "750.50");
    assert.equal(debt.originalBalance, "750.50", "originalBalance must bump to match in the DB");

    // Re-read straight from Postgres — assert what was PERSISTED, not just returned.
    const [row] = await db.select().from(debts).where(eq(debts.id, debt.id));
    assert.equal(row.currentBalance, "750.50");
    assert.equal(row.originalBalance, "750.50");
    assert.ok(
      parseFloat(row.originalBalance) >= parseFloat(row.currentBalance),
      "persisted progress can never be negative",
    );
  } finally {
    await cleanup(userId);
  }
});

test("DB: refresh with lower balance leaves originalBalance untouched", async () => {
  const userId = await makeUser();
  try {
    await storage.importDebtsFromProvider(userId, "sandbox", [makeLiability({ currentBalance: 500 })]);
    const refresh = await storage.importDebtsFromProvider(userId, "sandbox", [
      makeLiability({ currentBalance: 300 }),
    ]);
    const [row] = await db.select().from(debts).where(eq(debts.id, refresh.debts[0].id));
    assert.equal(row.currentBalance, "300.00");
    assert.equal(row.originalBalance, "500.00");
  } finally {
    await cleanup(userId);
  }
});

test("DB: user-edited currentBalance is not clobbered and originalBalance not bumped", async () => {
  const userId = await makeUser();
  try {
    const first = await storage.importDebtsFromProvider(userId, "sandbox", [
      makeLiability({ currentBalance: 500 }),
    ]);
    const id = first.debts[0].id;
    // Simulate a user manual edit tracked by userEditedFields.
    await storage.updateDebt(id, { currentBalance: "400.00", userEditedFields: ["currentBalance"] });

    const refresh = await storage.importDebtsFromProvider(userId, "sandbox", [
      makeLiability({ currentBalance: 900 }),
    ]);
    assert.equal(refresh.updated, 1);
    const [row] = await db.select().from(debts).where(eq(debts.id, id));
    assert.equal(row.currentBalance, "400.00", "user edit must survive a provider refresh");
    assert.equal(row.originalBalance, "500.00", "originalBalance must not bump when balance is user-edited");
    // Non-edited fields still refresh.
    assert.ok(row.lastImportedAt, "refresh metadata still updates");
  } finally {
    await cleanup(userId);
  }
});

test("DB: merge marker and keep-both dismissal survive a provider refresh", async () => {
  const userId = await makeUser();
  try {
    // Two imported cards + a manual entry the user typed in earlier.
    const first = await storage.importDebtsFromProvider(userId, "sandbox", [
      makeLiability({ providerAccountId: "acct-merge", mask: "4321", currentBalance: 3843.25 }),
      makeLiability({ providerAccountId: "acct-keep", mask: "9876", currentBalance: 1200 }),
    ]);
    assert.equal(first.imported, 2);
    const importedMerge = first.debts.find((d) => d.providerAccountId === "acct-merge")!;
    const importedKeep = first.debts.find((d) => d.providerAccountId === "acct-keep")!;

    const manual = await storage.createDebt({
      userId,
      name: "JP Morgan Credit Card",
      accountNumber: "****4321",
      originalBalance: "4000.00",
      currentBalance: "3600.00",
      interestRate: "22.99",
      minimumPayment: "35.00",
      dueDate: 15,
    } as any);

    // What the merge and dismiss-duplicate routes persist:
    await storage.updateDebt(manual.id, { isActive: false, mergedIntoDebtId: importedMerge.id });
    const manual2 = await storage.createDebt({
      userId,
      name: "Other Card",
      accountNumber: "****9876",
      originalBalance: "1300.00",
      currentBalance: "1250.00",
      interestRate: "19.99",
      minimumPayment: "25.00",
      dueDate: 5,
    } as any);
    await storage.updateDebt(manual2.id, { notDuplicateOf: [importedKeep.id] });

    // Provider refresh with new balances.
    const refresh = await storage.importDebtsFromProvider(userId, "sandbox", [
      makeLiability({ providerAccountId: "acct-merge", mask: "4321", currentBalance: 3700 }),
      makeLiability({ providerAccountId: "acct-keep", mask: "9876", currentBalance: 1150 }),
    ]);
    assert.equal(refresh.imported, 0, "refresh must update in place, never insert new rows");
    assert.equal(refresh.updated, 2);

    // Merged manual debt stays archived with its marker (persisted, not just returned).
    const [mergedRow] = await db.select().from(debts).where(eq(debts.id, manual.id));
    assert.equal(mergedRow.isActive, false, "refresh must not resurrect a merged manual debt");
    assert.equal(mergedRow.mergedIntoDebtId, importedMerge.id);

    // Keep-both dismissal persists.
    const [keepRow] = await db.select().from(debts).where(eq(debts.id, manual2.id));
    assert.deepEqual(keepRow.notDuplicateOf, [importedKeep.id], "refresh must not clear notDuplicateOf");
    assert.equal(keepRow.isActive, true);
  } finally {
    await cleanup(userId);
  }
});
