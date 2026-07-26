/**
 * Pure logic for PATCH /api/debts/:id — extracted so the balance-vs-progress
 * invariant is unit-testable without a DB or HTTP server.
 *
 * Invariant: payoff progress is (originalBalance - currentBalance) / originalBalance.
 * If a user edits currentBalance ABOVE originalBalance, we bump originalBalance
 * to match so progress resets to 0% instead of going negative.
 */
import { z } from "zod";
import type { Debt } from "@shared/schema";

// Upper bounds match the DB column precision so an oversized value returns a
// clean 400 instead of a raw Postgres overflow (500).
export const debtEditSchema = z
  .object({
    name: z.string().trim().min(1).optional(),
    currentBalance: z.string().optional(),
    interestRate: z.string().optional(),
    minimumPayment: z.string().optional(),
    dueDate: z.number().int().min(1).max(31).optional(),
    accountNumber: z.string().optional(),
  })
  .refine(
    (d) => d.currentBalance === undefined || (parseFloat(d.currentBalance) > 0 && parseFloat(d.currentBalance) <= 99999999.99),
    { message: "Current balance must be between 0.01 and 99,999,999.99", path: ["currentBalance"] },
  )
  .refine(
    (d) => d.interestRate === undefined || (parseFloat(d.interestRate) >= 0 && parseFloat(d.interestRate) <= 999.99),
    { message: "Interest rate must be between 0 and 999.99", path: ["interestRate"] },
  )
  .refine(
    (d) => d.minimumPayment === undefined || (parseFloat(d.minimumPayment) >= 0 && parseFloat(d.minimumPayment) <= 99999999.99),
    { message: "Minimum payment must be between 0 and 99,999,999.99", path: ["minimumPayment"] },
  );

export type DebtEditInput = z.infer<typeof debtEditSchema>;

/** Owner-only access rule shared by PATCH and DELETE /api/debts/:id. */
export function canAccessDebt(debt: Debt | undefined, userId: string): debt is Debt {
  return !!debt && debt.userId === userId;
}

export function buildDebtEditUpdates(debt: Debt, parsed: DebtEditInput): Partial<Debt> {
  const updates: Partial<Debt> = {};
  if (parsed.name !== undefined) updates.name = parsed.name.trim();
  if (parsed.currentBalance !== undefined) {
    const newCurrent = parseFloat(parsed.currentBalance);
    updates.currentBalance = newCurrent.toFixed(2);
    // Balance edited above the original: bump originalBalance to match so
    // progress resets to 0% and can never render negative.
    if (newCurrent > parseFloat(debt.originalBalance)) {
      updates.originalBalance = newCurrent.toFixed(2);
    }
  }
  if (parsed.interestRate !== undefined) updates.interestRate = parseFloat(parsed.interestRate).toFixed(2);
  if (parsed.minimumPayment !== undefined) updates.minimumPayment = parseFloat(parsed.minimumPayment).toFixed(2);
  if (parsed.dueDate !== undefined) updates.dueDate = parsed.dueDate;
  if (parsed.accountNumber !== undefined) {
    const acct = String(parsed.accountNumber).trim();
    updates.accountNumber = acct !== "" ? acct : "—";
  }

  // For imported debts, remember which fields the user overrode so a later
  // provider refresh (ENABLE_DEBT_IMPORT) doesn't clobber the manual edit.
  if (debt.source === "imported") {
    const refreshTracked = ["name", "currentBalance", "interestRate", "minimumPayment", "dueDate"] as const;
    // Only mark fields the user actually changed — saving an imported debt
    // unchanged must not freeze every field from future provider refreshes.
    const changed = refreshTracked.filter(
      (f) => updates[f] !== undefined && String(updates[f]) !== String(debt[f]),
    );
    if (changed.length > 0) {
      const existingEdited = debt.userEditedFields ?? [];
      updates.userEditedFields = Array.from(new Set([...existingEdited, ...changed]));
    }
  }

  return updates;
}

/**
 * Canonical bump rule for ANY code path that writes currentBalance outside
 * PATCH /api/debts/:id (provider import refresh, etc.). If the new balance
 * exceeds the stored originalBalance, returns the bumped originalBalance
 * (formatted to 2 decimals) so payoff progress resets to 0% instead of going
 * negative; returns undefined when no bump is needed.
 */
export function bumpedOriginalBalance(originalBalance: string, newCurrentBalance: string): string | undefined {
  const next = parseFloat(newCurrentBalance);
  if (Number.isFinite(next) && next > parseFloat(originalBalance)) {
    return next.toFixed(2);
  }
  return undefined;
}
