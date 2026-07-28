import type { LiabilityProvider, NormalizedLiability } from "./types";
import { LinkRequiredError, LiabilitiesNotEnabledError } from "./types";
import { plaidService } from "../plaidService";
import { encryptToken, decryptToken } from "../encryptionService";
import { storage } from "../../storage";

/**
 * Plaid Liabilities provider — real integration (Plaid Link + liabilitiesGet).
 *
 * Works today against Plaid SANDBOX (real Link UI + real liabilitiesGet using
 * Plaid's sandbox test banks, e.g. user_good / pass_good). It is production-
 * ready: to move real customer data, change CONFIG ONLY — set PLAID_ENV=production
 * with production Plaid secrets and the Liabilities product entitlement, keep
 * DEBT_IMPORT_PROVIDER=plaid. No code change is required.
 *
 * Connection lifecycle:
 *   linkFlow.createLinkToken -> (client Plaid Link) -> linkFlow.completeLink
 *     (exchange public_token -> encrypt access_token -> store connection)
 *   fetchLiabilities: load connection -> decrypt token -> liabilitiesGet -> map
 *   initializeConnection: verify an active connection exists (else LinkRequiredError)
 *   disconnect: best-effort Plaid itemRemove
 */

const PROVIDER = "plaid";

/**
 * Plaid error codes that mean the item can no longer be queried until the user
 * re-authenticates. We surface these as LinkRequiredError so the client relaunches
 * Link (re-connect) instead of showing a dead-end generic error.
 */
const REAUTH_ERROR_CODES = new Set(["ITEM_LOGIN_REQUIRED", "PENDING_EXPIRATION", "PENDING_DISCONNECT"]);

function isReauthRequired(err: any): boolean {
  const code = err?.response?.data?.error_code;
  return typeof code === "string" && REAUTH_ERROR_CODES.has(code);
}

/**
 * Plaid error codes that mean our Plaid account (or this item) does not have the
 * Liabilities product enabled. In production this is expected until Plaid grants
 * the Liabilities entitlement; we surface it as LiabilitiesNotEnabledError so the
 * client shows "coming soon" instead of a generic failure.
 */
const LIABILITIES_NOT_ENABLED_CODES = new Set([
  "INVALID_PRODUCT",
  "INVALID_PRODUCTS",
  "PRODUCTS_NOT_SUPPORTED",
]);

function isLiabilitiesNotEnabled(err: any): boolean {
  const code = err?.response?.data?.error_code;
  return typeof code === "string" && LIABILITIES_NOT_ENABLED_CODES.has(code);
}

function num(v: unknown, fallback = 0): number {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}

/** Parse the day-of-month (1-31) from a Plaid `YYYY-MM-DD` date; default 1. */
function parseDueDay(dateStr?: string | null): number {
  if (!dateStr) return 1;
  const day = parseInt(String(dateStr).slice(8, 10), 10);
  if (!Number.isFinite(day) || day < 1 || day > 31) return 1;
  return day;
}

/** Prefer the purchase APR; fall back to the first APR; default 0. */
function pickPurchaseApr(aprs?: any[] | null): number {
  if (!Array.isArray(aprs) || aprs.length === 0) return 0;
  const purchase = aprs.find((a) => a?.apr_type === "purchase_apr");
  const chosen = purchase ?? aprs[0];
  return num(chosen?.apr_percentage, 0);
}

/**
 * Map a Plaid liabilitiesGet payload into our provider-agnostic shape. Credit
 * cards, student loans, and mortgages are joined to their `accounts[]` entry by
 * account_id (for balance / mask / name). dueDate & interestRate are NOT NULL in
 * our schema, so missing values default to 1 (day) / 0 (apr).
 */
function mapLiabilities(
  data: { accounts: any[]; liabilities: any },
  institutionName: string,
): NormalizedLiability[] {
  const accountsById = new Map<string, any>();
  for (const acc of data.accounts ?? []) accountsById.set(acc.account_id, acc);

  const out: NormalizedLiability[] = [];
  const libs = data.liabilities ?? {};

  for (const c of libs.credit ?? []) {
    const acc = accountsById.get(c.account_id);
    if (!acc) continue;
    out.push({
      provider: PROVIDER,
      providerAccountId: c.account_id,
      institutionName,
      creditorName: acc.name || acc.official_name || "Credit Card",
      accountType: "credit_card",
      mask: acc.mask ?? "",
      currentBalance: num(acc.balances?.current, num(c.last_statement_balance, 0)),
      interestRateApr: pickPurchaseApr(c.aprs),
      minimumPayment: num(c.minimum_payment_amount, 0),
      dueDate: parseDueDay(c.next_payment_due_date),
      creditLimit: acc.balances?.limit != null ? num(acc.balances.limit) : null,
      availableCredit: acc.balances?.available != null ? num(acc.balances.available) : null,
      paymentStatus: c.is_overdue ? "overdue" : "current",
    });
  }

  for (const s of libs.student ?? []) {
    const acc = accountsById.get(s.account_id);
    if (!acc) continue;
    out.push({
      provider: PROVIDER,
      providerAccountId: s.account_id,
      institutionName,
      creditorName: s.loan_name || acc.name || "Student Loan",
      accountType: "student_loan",
      mask: acc.mask ?? "",
      currentBalance: num(acc.balances?.current, 0),
      interestRateApr: num(s.interest_rate_percentage, 0),
      minimumPayment: num(s.minimum_payment_amount, 0),
      dueDate: parseDueDay(s.next_payment_due_date),
      creditLimit: null,
      availableCredit: null,
      paymentStatus: s.is_overdue ? "overdue" : "current",
    });
  }

  for (const m of libs.mortgage ?? []) {
    const acc = accountsById.get(m.account_id);
    if (!acc) continue;
    out.push({
      provider: PROVIDER,
      providerAccountId: m.account_id,
      institutionName,
      creditorName: acc.name || "Mortgage",
      accountType: "mortgage",
      mask: acc.mask ?? "",
      currentBalance: num(acc.balances?.current, 0),
      interestRateApr: num(m.interest_rate?.percentage, 0),
      minimumPayment: num(m.next_monthly_payment, 0),
      dueDate: parseDueDay(m.next_payment_due_date),
      creditLimit: null,
      availableCredit: null,
      paymentStatus: m.is_overdue ? "overdue" : "current",
    });
  }

  return out;
}

export const plaidLiabilityProvider: LiabilityProvider = {
  name: PROVIDER,

  linkFlow: {
    async createLinkToken(userId: string): Promise<string> {
      try {
        return await plaidService.createLiabilitiesLinkToken(userId);
      } catch (err) {
        if (isLiabilitiesNotEnabled(err)) {
          throw new LiabilitiesNotEnabledError();
        }
        throw err;
      }
    },

    async completeLink(userId: string, publicToken: string, institutionName?: string) {
      const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);
      // Retire any legacy itemless rows: they can't be keyed per-bank, and
      // leaving them active would double-fetch once item-keyed rows exist.
      const legacy = (await storage.getDebtProviderConnections(userId, PROVIDER)).filter(
        (c) => !c.providerItemId && c.status === "active",
      );
      for (const row of legacy) {
        await storage.upsertDebtProviderConnection({
          userId,
          provider: PROVIDER,
          providerItemId: null,
          status: "disconnected",
        });
      }
      await storage.upsertDebtProviderConnection({
        userId,
        provider: PROVIDER,
        providerItemId: itemId,
        accessTokenEnc: encryptToken(accessToken),
        institutionName: institutionName ?? null,
        status: "active",
        consentAt: new Date(),
        lastSyncAt: new Date(),
      });
      return { status: "active", institutionName: institutionName ?? undefined };
    },
  },

  async initializeConnection(userId: string) {
    const conns = (await storage.getDebtProviderConnections(userId, PROVIDER)).filter(
      (c) => c.status === "active" && c.accessTokenEnc,
    );
    if (conns.length === 0) {
      throw new LinkRequiredError();
    }
    const names = conns.map((c) => c.institutionName).filter(Boolean) as string[];
    return { status: "active", institutionName: names.join(", ") || undefined };
  },

  /**
   * Fetch liabilities across ALL active connections (a user may have linked
   * multiple banks, e.g. Chase and USAA). Per-connection reauth failures don't
   * sink the whole import: that connection is flipped to "error" and skipped;
   * we only throw LinkRequiredError when NO connection produced data.
   */
  async fetchLiabilities(userId: string): Promise<NormalizedLiability[]> {
    const conns = (await storage.getDebtProviderConnections(userId, PROVIDER)).filter(
      (c) => c.status === "active" && c.accessTokenEnc,
    );
    if (conns.length === 0) {
      throw new LinkRequiredError();
    }
    const out: NormalizedLiability[] = [];
    let reauthNeeded = 0;
    for (const conn of conns) {
      const accessToken = decryptToken(conn.accessTokenEnc!);
      try {
        const data = await plaidService.getLiabilities(accessToken);
        out.push(...mapLiabilities(data, conn.institutionName ?? "Linked account"));
        await storage.upsertDebtProviderConnection({
          userId,
          provider: PROVIDER,
          providerItemId: conn.providerItemId,
          status: "active",
          lastSyncAt: new Date(),
        });
      } catch (err) {
        if (isReauthRequired(err)) {
          reauthNeeded++;
          await storage.upsertDebtProviderConnection({
            userId,
            provider: PROVIDER,
            providerItemId: conn.providerItemId,
            status: "error",
          });
          continue;
        }
        if (isLiabilitiesNotEnabled(err)) {
          throw new LiabilitiesNotEnabledError();
        }
        throw err;
      }
    }
    if (out.length === 0 && reauthNeeded > 0) {
      throw new LinkRequiredError(
        "Your bank connection needs attention. Please reconnect to refresh your debts.",
      );
    }
    return out;
  },

  async disconnect(userId: string): Promise<void> {
    const conns = await storage.getDebtProviderConnections(userId, PROVIDER);
    for (const conn of conns) {
      if (conn.accessTokenEnc) {
        // Best-effort per item — one failed removal shouldn't block the rest.
        try {
          await plaidService.removeItem(decryptToken(conn.accessTokenEnc));
        } catch {
          // caller treats disconnect as best-effort
        }
      }
    }
  },
};
