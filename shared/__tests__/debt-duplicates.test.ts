import { test } from "node:test";
import assert from "node:assert/strict";
import { findDuplicateDebtPairs, balancesAreClose } from "../debtDuplicates";
import type { Debt } from "../schema";

let idCounter = 0;
function makeDebt(overrides: Partial<Debt>): Debt {
  idCounter++;
  return {
    id: `debt-${idCounter}`,
    userId: "user-1",
    name: "Some Debt",
    accountNumber: "—",
    originalBalance: "1000.00",
    currentBalance: "1000.00",
    interestRate: "20.00",
    minimumPayment: "35.00",
    dueDate: 15,
    isActive: true,
    archivedAt: null,
    paidOffAt: null,
    payeeAccountNumber: null,
    payeeRoutingNumber: null,
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
    mergedIntoDebtId: null,
    notDuplicateOf: [],
    createdAt: new Date("2026-01-01"),
    ...overrides,
  } as Debt;
}

test("founder scenario: manual JP Morgan card matches imported Chase CREDIT CARD", () => {
  const manual = makeDebt({ name: "JP Morgan Credit Card", currentBalance: "3600.00" });
  const imported = makeDebt({
    name: "CREDIT CARD",
    source: "imported",
    provider: "plaid",
    providerAccountId: "acc-1",
    institutionName: "Chase",
    currentBalance: "3843.25",
    accountNumber: "••••1234",
  });
  const pairs = findDuplicateDebtPairs([manual, imported]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].manualDebtId, manual.id);
  assert.equal(pairs[0].importedDebtId, imported.id);
});

test("matching last-4 digits flags a pair even with different balances", () => {
  const manual = makeDebt({ name: "Old Card", accountNumber: "4400", currentBalance: "500.00" });
  const imported = makeDebt({
    name: "Platinum",
    source: "imported",
    institutionName: "Amex",
    accountNumber: "••••4400",
    currentBalance: "2500.00",
  });
  const pairs = findDuplicateDebtPairs([manual, imported]);
  assert.equal(pairs.length, 1);
});

test("unrelated debts are not flagged", () => {
  const manual = makeDebt({ name: "Car Loan", currentBalance: "12000.00" });
  const imported = makeDebt({
    name: "CREDIT CARD",
    source: "imported",
    institutionName: "Chase",
    currentBalance: "3843.25",
  });
  assert.equal(findDuplicateDebtPairs([manual, imported]).length, 0);
});

test("similar names with far-apart balances are not flagged", () => {
  const manual = makeDebt({ name: "Chase Credit Card", currentBalance: "500.00" });
  const imported = makeDebt({
    name: "CREDIT CARD",
    source: "imported",
    institutionName: "Chase",
    currentBalance: "9000.00",
  });
  assert.equal(findDuplicateDebtPairs([manual, imported]).length, 0);
});

test("dismissed pairs (notDuplicateOf) are skipped", () => {
  const imported = makeDebt({
    name: "CREDIT CARD",
    source: "imported",
    institutionName: "Chase",
    currentBalance: "3843.25",
  });
  const manual = makeDebt({
    name: "JP Morgan Credit Card",
    currentBalance: "3600.00",
    notDuplicateOf: [imported.id],
  });
  assert.equal(findDuplicateDebtPairs([manual, imported]).length, 0);
});

test("archived debts are ignored", () => {
  const manual = makeDebt({ name: "Chase Credit Card", currentBalance: "3600.00", isActive: false });
  const imported = makeDebt({
    name: "CREDIT CARD",
    source: "imported",
    institutionName: "Chase",
    currentBalance: "3843.25",
  });
  assert.equal(findDuplicateDebtPairs([manual, imported]).length, 0);
});

test("two imported debts never pair with each other", () => {
  const a = makeDebt({ name: "CREDIT CARD", source: "imported", institutionName: "Chase", currentBalance: "3600.00" });
  const b = makeDebt({ name: "CREDIT CARD", source: "imported", institutionName: "Chase", currentBalance: "3700.00" });
  assert.equal(findDuplicateDebtPairs([a, b]).length, 0);
});

test("each manual debt pairs with at most one imported debt", () => {
  const manual = makeDebt({ name: "Chase Credit Card", accountNumber: "9876", currentBalance: "3600.00" });
  const weak = makeDebt({ name: "CREDIT CARD", source: "imported", institutionName: "Chase", currentBalance: "3700.00" });
  const strong = makeDebt({
    name: "CREDIT CARD",
    source: "imported",
    institutionName: "Chase",
    currentBalance: "5000.00",
    accountNumber: "••••9876",
  });
  const pairs = findDuplicateDebtPairs([manual, weak, strong]);
  assert.equal(pairs.length, 1);
  assert.equal(pairs[0].importedDebtId, strong.id, "mask match outranks balance similarity");
});

test("zero-balance debts never balance-match", () => {
  assert.equal(balancesAreClose("0.00", "0.00"), false);
  assert.equal(balancesAreClose("0.00", "100.00"), false);
  assert.equal(balancesAreClose("3600.00", "3843.25"), true);
  assert.equal(balancesAreClose("500.00", "9000.00"), false);
});
