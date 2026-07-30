import type { Debt } from "./schema";

// Duplicate detection between MANUAL debts and IMPORTED debts.
//
// When a user adds a debt by hand and later connects their bank, the same
// real card can end up in the list twice ("JP Morgan Credit Card" $3,600
// manual + "CREDIT CARD" $3,843.25 imported from Chase), inflating totals.
// This module flags LIKELY duplicates so the UI can offer a merge — it never
// deletes anything itself.
//
// A manual/imported pair is flagged when:
//   1. Their account-number last-4 digits match exactly (strong signal), OR
//   2. Their balances are close (within 15% or $300) AND the names or
//      institutions share meaningful words (bank aliases like
//      "JP Morgan" ≈ "Chase" are normalized).
// Pairs the user already dismissed (manual.notDuplicateOf) are skipped.

export interface DuplicateDebtPair {
  manualDebtId: string;
  importedDebtId: string;
  reason: string;
}

// Words too generic to indicate a match on their own institution-wise, but
// "credit card" ↔ "credit card" IS meaningful for name overlap, so we only
// strip true fillers.
const FILLER_WORDS = new Set(["the", "of", "and", "my", "a", "an", "account", "acct"]);

// Same-institution aliases — each group collapses to one canonical token.
const INSTITUTION_ALIASES: string[][] = [
  ["chase", "jpmorgan", "jpmorganchase", "jpm", "jp", "morgan"],
  ["amex", "american", "express", "americanexpress"],
  ["boa", "bofa", "bankofamerica"],
  ["citi", "citibank", "citigroup"],
  ["wellsfargo", "wells", "fargo", "wf"],
  ["capitalone", "capital"],
  ["usbank", "us"],
  ["navyfederal", "navy", "nfcu"],
];

function canonicalToken(token: string): string {
  for (const group of INSTITUTION_ALIASES) {
    if (group.includes(token)) return group[0];
  }
  return token;
}

function tokenize(...texts: (string | null | undefined)[]): Set<string> {
  const tokens = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const raw of text.toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length < 2 || FILLER_WORDS.has(raw)) continue;
      tokens.add(canonicalToken(raw));
    }
  }
  return tokens;
}

function tokensOverlap(a: Set<string>, b: Set<string>): boolean {
  for (const t of a) if (b.has(t)) return true;
  return false;
}

function lastFour(accountNumber: string | null | undefined): string | null {
  if (!accountNumber) return null;
  const digits = accountNumber.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}

/**
 * Stable dismissal fingerprint for an imported debt.
 *
 * "Keep both" dismissals are stored in manual.notDuplicateOf. Storing only the
 * imported debt's row id breaks when a bank is disconnected and relinked: the
 * re-import creates NEW rows (a new Plaid Item yields new account ids), so the
 * user would be re-prompted about pairs they already answered. The fingerprint
 * is built from what actually identifies the card to the detector — the
 * account's last four digits plus the canonicalized institution (falling back
 * to name tokens when no institution is present) — which survive a relink.
 *
 * Returns null when the debt carries no identifying signal at all.
 */
export function debtDismissalFingerprint(d: Pick<Debt, "accountNumber" | "institutionName" | "name">): string | null {
  const mask = lastFour(d.accountNumber);
  const instTokens = [...tokenize(d.institutionName)].sort().join(".");
  // Institution is the stable text across relinks; only fall back to the
  // display name when the provider gave us no institution.
  const tokens = instTokens || [...tokenize(d.name)].sort().join(".");
  if (!mask && !tokens) return null;
  return `fp:${mask ?? ""}:${tokens}`;
}

export function balancesAreClose(a: string, b: string): boolean {
  const balA = parseFloat(a);
  const balB = parseFloat(b);
  if (!Number.isFinite(balA) || !Number.isFinite(balB)) return false;
  if (balA <= 0 || balB <= 0) return false;
  const diff = Math.abs(balA - balB);
  const larger = Math.max(balA, balB);
  return diff <= 300 || diff / larger <= 0.15;
}

/**
 * Find likely manual↔imported duplicate pairs among a user's ACTIVE debts.
 * Each manual debt is paired with at most one imported debt (the strongest
 * match). Pairs the user dismissed via notDuplicateOf are excluded.
 */
export function findDuplicateDebtPairs(debts: Debt[]): DuplicateDebtPair[] {
  const active = debts.filter((d) => d.isActive);
  const manuals = active.filter((d) => d.source === "manual");
  const imports = active.filter((d) => d.source === "imported");
  if (manuals.length === 0 || imports.length === 0) return [];

  const pairs: DuplicateDebtPair[] = [];
  for (const manual of manuals) {
    const dismissed = new Set(manual.notDuplicateOf ?? []);
    const manualTokens = tokenize(manual.name, manual.institutionName);
    const manualMask = lastFour(manual.accountNumber);

    let best: { imported: Debt; score: number; reason: string } | null = null;
    for (const imported of imports) {
      if (dismissed.has(imported.id)) continue;
      const fp = debtDismissalFingerprint(imported);
      if (fp && dismissed.has(fp)) continue;

      const importedMask = lastFour(imported.accountNumber);
      const maskMatch = !!manualMask && !!importedMask && manualMask === importedMask;
      const importedTokens = tokenize(imported.name, imported.institutionName);
      const nameMatch = tokensOverlap(manualTokens, importedTokens);
      const balanceClose = balancesAreClose(manual.currentBalance, imported.currentBalance);

      let score = 0;
      let reason = "";
      if (maskMatch) {
        score = 3;
        reason = "Account numbers end in the same four digits";
      } else if (balanceClose && nameMatch) {
        score = 2;
        reason = "Similar name or institution with a close balance";
      } else {
        continue;
      }
      if (!best || score > best.score) best = { imported, score, reason };
    }
    if (best) {
      pairs.push({
        manualDebtId: manual.id,
        importedDebtId: best.imported.id,
        reason: best.reason,
      });
    }
  }
  return pairs;
}
