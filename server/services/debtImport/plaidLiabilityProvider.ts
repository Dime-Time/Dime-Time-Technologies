import type { LiabilityProvider } from "./types";

/**
 * Plaid Liabilities provider — STUB (not yet approved for production).
 *
 * Production activation checklist (mirrors replit.md):
 *   1. Obtain Plaid PRODUCTION approval + the Liabilities product entitlement.
 *   2. Add `Products.Liabilities` to createLinkToken (server/services/plaidService.ts).
 *   3. Implement `liabilitiesGet()` in plaidService and map its response to
 *      `NormalizedLiability[]` here.
 *   4. Set `PLAID_ENV=production` + production Plaid secrets, and
 *      `DEBT_IMPORT_PROVIDER=plaid`, then re-publish (autoscale snapshots env).
 *
 * Until then every method throws so a mis-set `DEBT_IMPORT_PROVIDER=plaid`
 * fails loudly instead of silently importing nothing.
 */
const NOT_APPROVED =
  "Plaid Liabilities is not yet approved for production. " +
  "Keep DEBT_IMPORT_PROVIDER=sandbox until Plaid grants production + Liabilities access.";

export const plaidLiabilityProvider: LiabilityProvider = {
  name: "plaid",
  async initializeConnection() {
    throw new Error(NOT_APPROVED);
  },
  async fetchLiabilities() {
    throw new Error(NOT_APPROVED);
  },
  async disconnect() {
    /* no-op while unimplemented */
  },
};
