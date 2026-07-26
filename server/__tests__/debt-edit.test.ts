/**
 * Regression tests for PATCH/DELETE /api/debts/:id behavior.
 *
 * Run locally (no DB, no network):
 *   npx tsx --test server/__tests__/debt-edit.test.ts
 *
 * Invariants under test:
 *  1. Editing currentBalance ABOVE originalBalance bumps originalBalance to
 *     match, so payoff progress resets to 0% and can never render negative.
 *  2. Validation bounds mirror DB column precision (clean 400, not a 500).
 *  3. Ownership rule: a debt that doesn't exist or belongs to another user is
 *     indistinguishable (both 404 via canAccessDebt=false).
 *  4. Delete is a soft delete: isActive=false hides the debt from
 *     getDebtsByUserId but the row survives for payment-history FKs.
 *  5. Imported debts track userEditedFields only for fields actually changed.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { debtEditSchema, buildDebtEditUpdates, canAccessDebt } from "../lib/debtEdit";
import { MemStorage } from "../storage";
import type { Debt } from "@shared/schema";

function makeDebt(overrides: Partial<Debt> = {}): Debt {
  return {
    id: "debt-1",
    userId: "user-1",
    name: "Visa Card",
    originalBalance: "1000.00",
    currentBalance: "600.00",
    interestRate: "19.99",
    minimumPayment: "25.00",
    dueDate: 15,
    accountNumber: "1234",
    payeeAccountNumber: null,
    payeeRoutingNumber: null,
    isActive: true,
    source: "manual",
    provider: null,
    providerAccountId: null,
    institutionName: null,
    accountType: null,
    creditLimit: null,
    availableCredit: null,
    paymentStatus: null,
    lastImportedAt: null,
    isHidden: false,
    userEditedFields: [],
    createdAt: new Date(),
    ...overrides,
  } as Debt;
}

// ---- Invariant 1: balance edits can't produce negative progress ----

test("editing currentBalance above originalBalance bumps originalBalance to match", () => {
  const debt = makeDebt();
  const parsed = debtEditSchema.parse({ currentBalance: "1500" });
  const updates = buildDebtEditUpdates(debt, parsed);
  assert.equal(updates.currentBalance, "1500.00");
  assert.equal(updates.originalBalance, "1500.00");
  // progress = (1500 - 1500) / 1500 = 0%, never negative
});

test("editing currentBalance at or below originalBalance leaves originalBalance untouched", () => {
  const debt = makeDebt();
  for (const value of ["400", "1000", "1000.00"]) {
    const updates = buildDebtEditUpdates(debt, debtEditSchema.parse({ currentBalance: value }));
    assert.equal(updates.originalBalance, undefined, `originalBalance must not change for ${value}`);
  }
});

test("non-balance edits never touch originalBalance", () => {
  const updates = buildDebtEditUpdates(makeDebt(), debtEditSchema.parse({ name: "Renamed", dueDate: 3 }));
  assert.equal(updates.originalBalance, undefined);
  assert.equal(updates.currentBalance, undefined);
});

// ---- Invariant 2: validation bounds ----

test("validation: currentBalance must be > 0 and <= 99,999,999.99", () => {
  assert.throws(() => debtEditSchema.parse({ currentBalance: "0" }));
  assert.throws(() => debtEditSchema.parse({ currentBalance: "-5" }));
  assert.throws(() => debtEditSchema.parse({ currentBalance: "100000000" }));
  assert.throws(() => debtEditSchema.parse({ currentBalance: "abc" }));
  assert.doesNotThrow(() => debtEditSchema.parse({ currentBalance: "0.01" }));
  assert.doesNotThrow(() => debtEditSchema.parse({ currentBalance: "99999999.99" }));
});

test("validation: interestRate 0–999.99, minimumPayment 0–99,999,999.99, dueDate 1–31, name non-empty", () => {
  assert.throws(() => debtEditSchema.parse({ interestRate: "-1" }));
  assert.throws(() => debtEditSchema.parse({ interestRate: "1000" }));
  assert.doesNotThrow(() => debtEditSchema.parse({ interestRate: "0" }));
  assert.throws(() => debtEditSchema.parse({ minimumPayment: "-0.01" }));
  assert.throws(() => debtEditSchema.parse({ minimumPayment: "100000000" }));
  assert.throws(() => debtEditSchema.parse({ dueDate: 0 }));
  assert.throws(() => debtEditSchema.parse({ dueDate: 32 }));
  assert.throws(() => debtEditSchema.parse({ dueDate: 1.5 }));
  assert.throws(() => debtEditSchema.parse({ name: "   " }));
});

// ---- Invariant 3: ownership ----

test("ownership: missing debt and other user's debt are both rejected identically", () => {
  const debt = makeDebt({ userId: "user-1" });
  assert.equal(canAccessDebt(debt, "user-1"), true);
  assert.equal(canAccessDebt(debt, "user-2"), false);
  assert.equal(canAccessDebt(undefined, "user-1"), false);
});

// ---- Invariant 4: soft delete ----

test("soft delete: isActive=false hides debt from list but the row survives", async () => {
  const storage = new MemStorage();
  const debt = await storage.createDebt({
    userId: "user-1",
    name: "Loan",
    originalBalance: "500.00",
    currentBalance: "500.00",
    interestRate: "5.00",
    minimumPayment: "20.00",
    dueDate: 1,
    accountNumber: "9999",
  } as any);

  assert.equal((await storage.getDebtsByUserId("user-1")).length, 1);
  await storage.updateDebt(debt.id, { isActive: false });
  assert.equal((await storage.getDebtsByUserId("user-1")).length, 0, "inactive debt must be hidden");
  const row = await storage.getDebt(debt.id);
  assert.ok(row, "row must survive soft delete");
  assert.equal(row!.isActive, false);
});

// ---- Invariant 5: userEditedFields for imported debts ----

test("imported debt: only fields actually changed are marked user-edited", () => {
  const debt = makeDebt({ source: "imported", userEditedFields: ["name"] });
  const parsed = debtEditSchema.parse({
    name: "Visa Card", // unchanged
    currentBalance: "550", // changed
    minimumPayment: "25.00", // unchanged
    dueDate: 20, // changed
  });
  const updates = buildDebtEditUpdates(debt, parsed);
  assert.deepEqual([...(updates.userEditedFields ?? [])].sort(), ["currentBalance", "dueDate", "name"]);
});

test("imported debt: saving unchanged values does not freeze fields", () => {
  const debt = makeDebt({ source: "imported", userEditedFields: [] });
  const parsed = debtEditSchema.parse({ name: "Visa Card", currentBalance: "600.00" });
  const updates = buildDebtEditUpdates(debt, parsed);
  assert.equal(updates.userEditedFields, undefined);
});

test("manual debt: userEditedFields is never set", () => {
  const updates = buildDebtEditUpdates(makeDebt(), debtEditSchema.parse({ currentBalance: "100" }));
  assert.equal(updates.userEditedFields, undefined);
});

// ---- Invariant 6: import-refresh path applies the bump rule ----

function makeLiability(overrides: Partial<import("../services/debtImport/types").NormalizedLiability> = {}) {
  return {
    provider: "sandbox",
    providerAccountId: "acct-1",
    institutionName: "Test Bank",
    creditorName: "Test Card",
    accountType: "credit_card",
    mask: "1234",
    currentBalance: 500,
    interestRateApr: 19.99,
    minimumPayment: 25,
    dueDate: 15,
    ...overrides,
  };
}

test("import refresh: balance above originalBalance bumps originalBalance (progress resets to 0%)", async () => {
  const storage = new MemStorage();
  const first = await storage.importDebtsFromProvider("user-1", "sandbox", [makeLiability({ currentBalance: 500 })]);
  assert.equal(first.imported, 1);
  assert.equal(first.debts[0].originalBalance, "500.00");

  // Provider now reports a HIGHER balance (new spending on the card).
  const refresh = await storage.importDebtsFromProvider("user-1", "sandbox", [makeLiability({ currentBalance: 750.5 })]);
  assert.equal(refresh.updated, 1);
  const debt = refresh.debts[0];
  assert.equal(debt.currentBalance, "750.50");
  assert.equal(debt.originalBalance, "750.50", "originalBalance must bump to match");
  assert.ok(parseFloat(debt.originalBalance) >= parseFloat(debt.currentBalance), "progress can never be negative");
});

test("import refresh: lower balance leaves originalBalance untouched (progress advances)", async () => {
  const storage = new MemStorage();
  await storage.importDebtsFromProvider("user-1", "sandbox", [makeLiability({ currentBalance: 500 })]);
  const refresh = await storage.importDebtsFromProvider("user-1", "sandbox", [makeLiability({ currentBalance: 300 })]);
  const debt = refresh.debts[0];
  assert.equal(debt.currentBalance, "300.00");
  assert.equal(debt.originalBalance, "500.00");
});

test("import refresh: user-edited currentBalance is not clobbered and original not bumped", async () => {
  const storage = new MemStorage();
  const first = await storage.importDebtsFromProvider("user-1", "sandbox", [makeLiability({ currentBalance: 500 })]);
  const id = first.debts[0].id;
  await storage.updateDebt(id, { currentBalance: "400.00", userEditedFields: ["currentBalance"] });
  const refresh = await storage.importDebtsFromProvider("user-1", "sandbox", [makeLiability({ currentBalance: 900 })]);
  const debt = refresh.debts[0];
  assert.equal(debt.currentBalance, "400.00");
  assert.equal(debt.originalBalance, "500.00");
});

test("accelerated overpayment clamps balance at 0 (progress can never exceed 100%)", async () => {
  const storage = new MemStorage();
  const debt = await storage.createDebt({
    userId: "user-1",
    name: "Small Loan",
    accountNumber: "9999",
    originalBalance: "100.00",
    currentBalance: "50.00",
    interestRate: "5.00",
    minimumPayment: "10.00",
    dueDate: 1,
  } as any);
  const { updatedDebt } = await storage.makeAcceleratedPayment("user-1", debt.id, "75.00");
  assert.equal(updatedDebt.currentBalance, "0.00");
});
