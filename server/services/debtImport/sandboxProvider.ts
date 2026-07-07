import type { LiabilityProvider, NormalizedLiability } from "./types";

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const SANDBOX_INSTITUTION = "First Platypus Bank (Sandbox)";

/**
 * A fixed set of fake liabilities. Deliberately covers three account types so
 * the UI can be exercised across credit cards, student loans, and auto loans.
 */
const SAMPLE_LIABILITIES: NormalizedLiability[] = [
  {
    provider: "sandbox",
    providerAccountId: "sbx-cc-001",
    institutionName: SANDBOX_INSTITUTION,
    creditorName: "Platypus Visa Signature",
    accountType: "credit_card",
    mask: "4821",
    currentBalance: 3450.75,
    interestRateApr: 22.99,
    minimumPayment: 89.0,
    dueDate: 15,
    creditLimit: 8000,
    availableCredit: 4549.25,
    paymentStatus: "current",
  },
  {
    provider: "sandbox",
    providerAccountId: "sbx-sl-002",
    institutionName: "Sallie Sandbox Servicing",
    creditorName: "Federal Student Loan",
    accountType: "student_loan",
    mask: "7733",
    currentBalance: 18230.42,
    interestRateApr: 5.5,
    minimumPayment: 210.0,
    dueDate: 5,
    creditLimit: null,
    availableCredit: null,
    paymentStatus: "current",
  },
  {
    provider: "sandbox",
    providerAccountId: "sbx-auto-003",
    institutionName: "Sandbox Auto Finance",
    creditorName: "Auto Loan — SUV",
    accountType: "auto_loan",
    mask: "1290",
    currentBalance: 12750.0,
    interestRateApr: 7.25,
    minimumPayment: 345.0,
    dueDate: 22,
    creditLimit: null,
    availableCredit: null,
    paymentStatus: "current",
  },
];

/**
 * Sandbox liability provider. Returns fixed fake liabilities so the entire
 * import pipeline (connect -> fetch -> normalize -> save -> display -> refresh
 * -> disconnect) is exercisable end-to-end WITHOUT any real provider approval.
 * Selected via `DEBT_IMPORT_PROVIDER=sandbox` (the default).
 */
export const sandboxProvider: LiabilityProvider = {
  name: "sandbox",
  async initializeConnection() {
    await delay(150);
    return { status: "active", institutionName: SANDBOX_INSTITUTION };
  },
  async fetchLiabilities() {
    await delay(250);
    return SAMPLE_LIABILITIES.map((l) => ({ ...l }));
  },
  async disconnect() {
    await delay(50);
  },
};
