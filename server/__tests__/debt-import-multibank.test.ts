/**
 * Multi-bank debt-import regression tests (no DB, no network).
 *
 * Run locally:
 *   npx tsx --test server/__tests__/debt-import-multibank.test.ts
 *
 * Why these exist: debt-provider connections are now keyed by
 * (user, provider, provider_item_id) so one user can link multiple banks
 * (e.g. Chase then USAA). The old single-connection design would have let a
 * second link overwrite the first bank's row and token. Invariants pinned:
 *
 *  1. completeLink for bank B must NOT touch bank A's connection row, token,
 *     or previously imported debts.
 *  2. fetchLiabilities aggregates liabilities across ALL active connections.
 *  3. A reauth failure (ITEM_LOGIN_REQUIRED) on one bank flips ONLY that row
 *     to 'error'; the healthy bank still imports and its data is returned.
 *  4. Legacy itemless rows (providerItemId null) are retired to
 *     'disconnected' on the next completeLink and are no longer fetched.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";

import { storage, MemStorage } from "../storage";
import { plaidService } from "../services/plaidService";
import { decryptToken, encryptToken } from "../services/encryptionService";
import { plaidLiabilityProvider } from "../services/debtImport/plaidLiabilityProvider";
import { LinkRequiredError } from "../services/debtImport/types";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

let mem = new MemStorage();

const storageAny = storage as any;
const originals: Record<string, unknown> = {};
const OVERRIDES = [
  "getDebtProviderConnections",
  "getDebtProviderConnection",
  "upsertDebtProviderConnection",
  "importDebtsFromProvider",
  "getDebtsByUserId",
] as const;

// Mutable Plaid behavior per test.
let exchangeResults: Record<string, { accessToken: string; itemId: string }> = {};
// Keyed by (decrypted) access token → liabilitiesGet payload or thrown error.
let liabilitiesByToken: Record<string, () => any> = {};
const liabilityCalls: string[] = [];

const plaidAny = plaidService as any;
const plaidOriginals: Record<string, unknown> = {};

function plaidError(code: string) {
  const err: any = new Error(code);
  err.response = { data: { error_code: code } };
  return err;
}

function creditPayload(accountId: string, name: string, balance: number) {
  return {
    accounts: [
      { account_id: accountId, name, mask: "1234", balances: { current: balance, limit: null, available: null } },
    ],
    liabilities: {
      credit: [
        {
          account_id: accountId,
          aprs: [{ apr_type: "purchase_apr", apr_percentage: 21.5 }],
          minimum_payment_amount: 35,
          next_payment_due_date: "2026-08-15",
          is_overdue: false,
        },
      ],
    },
  };
}

before(() => {
  for (const name of OVERRIDES) originals[name] = storageAny[name];
  for (const name of ["exchangePublicToken", "getLiabilities"]) {
    plaidOriginals[name] = plaidAny[name];
  }
  plaidAny.exchangePublicToken = async (publicToken: string) => {
    const r = exchangeResults[publicToken];
    if (!r) throw new Error(`exchangePublicToken not stubbed for ${publicToken}`);
    return r;
  };
  plaidAny.getLiabilities = async (accessToken: string) => {
    liabilityCalls.push(accessToken);
    const fn = liabilitiesByToken[accessToken];
    if (!fn) throw new Error(`getLiabilities not stubbed for token ${accessToken}`);
    return fn();
  };
});

after(() => {
  for (const name of OVERRIDES) storageAny[name] = originals[name];
  for (const [name, fn] of Object.entries(plaidOriginals)) plaidAny[name] = fn;
});

beforeEach(() => {
  mem = new MemStorage();
  storageAny.getDebtProviderConnections = (u: string, p: string) => mem.getDebtProviderConnections(u, p);
  storageAny.getDebtProviderConnection = (u: string, p: string) => mem.getDebtProviderConnection(u, p);
  storageAny.upsertDebtProviderConnection = (d: any) => mem.upsertDebtProviderConnection(d);
  storageAny.importDebtsFromProvider = (u: string, p: string, l: any[]) => mem.importDebtsFromProvider(u, p, l);
  storageAny.getDebtsByUserId = (u: string) => mem.getDebtsByUserId(u);
  exchangeResults = {};
  liabilitiesByToken = {};
  liabilityCalls.length = 0;
});

const USER = "user-multibank";

/** Link a bank via the real completeLink flow and return its connection row. */
async function linkBank(publicToken: string, accessToken: string, itemId: string, institution: string) {
  exchangeResults[publicToken] = { accessToken, itemId };
  await plaidLiabilityProvider.linkFlow!.completeLink(USER, publicToken, institution);
  const conns = await mem.getDebtProviderConnections(USER, "plaid");
  const row = conns.find((c) => c.providerItemId === itemId);
  assert.ok(row, `connection row for ${itemId} must exist`);
  return row!;
}

/** Run a full import: fetch via the provider, persist via storage (as runImport does). */
async function runImport() {
  const liabilities = await plaidLiabilityProvider.fetchLiabilities(USER);
  return await mem.importDebtsFromProvider(USER, "plaid", liabilities);
}

// ---- Invariant 1: second link never disturbs the first bank ----

test("linking bank B leaves bank A's connection row, token, and imported debts untouched", async () => {
  const chase = await linkBank("pub-chase", "access-chase", "item-chase", "Chase");
  liabilitiesByToken["access-chase"] = () => creditPayload("chase-card", "Chase Freedom", 1200);
  const first = await runImport();
  assert.equal(first.imported, 1);
  const chaseDebtBefore = JSON.stringify(
    (await mem.getDebtsByUserId(USER)).find((d) => d.providerAccountId === "chase-card"),
  );
  const chaseRowBefore = { ...chase };

  // Link a second bank (USAA) with a DIFFERENT itemId.
  const usaa = await linkBank("pub-usaa", "access-usaa", "item-usaa", "USAA");
  assert.notEqual(usaa.id, chase.id, "second bank must get its OWN connection row");

  const conns = await mem.getDebtProviderConnections(USER, "plaid");
  assert.equal(conns.length, 2, "both banks must have a row");
  const chaseAfter = conns.find((c) => c.providerItemId === "item-chase")!;
  assert.equal(chaseAfter.id, chaseRowBefore.id, "Chase row identity must be preserved");
  assert.equal(chaseAfter.status, "active");
  assert.equal(chaseAfter.institutionName, "Chase");
  assert.equal(
    decryptToken(chaseAfter.accessTokenEnc!),
    "access-chase",
    "Chase token must be untouched by the USAA link",
  );
  assert.equal(decryptToken(usaa.accessTokenEnc!), "access-usaa");

  // Chase's imported debt row is byte-for-byte untouched.
  const chaseDebtAfter = JSON.stringify(
    (await mem.getDebtsByUserId(USER)).find((d) => d.providerAccountId === "chase-card"),
  );
  assert.equal(chaseDebtAfter, chaseDebtBefore, "linking bank B must not disturb bank A's debts");
});

// ---- Invariant 2: fetchLiabilities aggregates all active banks ----

test("fetchLiabilities aggregates liabilities across both banks and imports both", async () => {
  await linkBank("pub-chase", "access-chase", "item-chase", "Chase");
  await linkBank("pub-usaa", "access-usaa", "item-usaa", "USAA");
  liabilitiesByToken["access-chase"] = () => creditPayload("chase-card", "Chase Freedom", 1200);
  liabilitiesByToken["access-usaa"] = () => creditPayload("usaa-card", "USAA Rewards", 800);

  const liabilities = await plaidLiabilityProvider.fetchLiabilities(USER);
  assert.equal(liabilities.length, 2);
  assert.deepEqual(
    liabilities.map((l) => l.institutionName).sort(),
    ["Chase", "USAA"],
    "each liability must carry its OWN bank's institution name",
  );
  assert.deepEqual(liabilityCalls.sort(), ["access-chase", "access-usaa"], "both tokens must be queried");

  const result = await mem.importDebtsFromProvider(USER, "plaid", liabilities);
  assert.equal(result.imported, 2);
});

// ---- Invariant 3: one bank's reauth failure never sinks the other ----

test("reauth failure on bank A flips only that row to 'error'; bank B still imports", async () => {
  await linkBank("pub-chase", "access-chase", "item-chase", "Chase");
  await linkBank("pub-usaa", "access-usaa", "item-usaa", "USAA");
  liabilitiesByToken["access-chase"] = () => {
    throw plaidError("ITEM_LOGIN_REQUIRED");
  };
  liabilitiesByToken["access-usaa"] = () => creditPayload("usaa-card", "USAA Rewards", 800);

  const result = await runImport();
  assert.equal(result.imported, 1, "healthy bank must still import");
  assert.equal(result.debts[0].providerAccountId, "usaa-card");

  const conns = await mem.getDebtProviderConnections(USER, "plaid");
  const chase = conns.find((c) => c.providerItemId === "item-chase")!;
  const usaa = conns.find((c) => c.providerItemId === "item-usaa")!;
  assert.equal(chase.status, "error", "broken bank flips to error");
  assert.equal(usaa.status, "active", "healthy bank stays active");
  assert.equal(decryptToken(chase.accessTokenEnc!), "access-chase", "token kept for later reconnect");

  // Both banks broken → LinkRequiredError (no silent empty import).
  liabilitiesByToken["access-usaa"] = () => {
    throw plaidError("ITEM_LOGIN_REQUIRED");
  };
  // Chase is already 'error' so only USAA is fetched; it now fails too.
  await assert.rejects(() => plaidLiabilityProvider.fetchLiabilities(USER), LinkRequiredError);
});

// ---- Invariant 4: legacy itemless rows are retired, not reused ----

test("completeLink retires a legacy null-item row to 'disconnected' and never fetches it again", async () => {
  // Seed the pre-multibank shape: one active row with NO providerItemId.
  await mem.upsertDebtProviderConnection({
    userId: USER,
    provider: "plaid",
    providerItemId: null,
    accessTokenEnc: encryptToken("access-legacy"),
    institutionName: "Legacy Bank",
    status: "active",
  });

  await linkBank("pub-chase", "access-chase", "item-chase", "Chase");

  const conns = await mem.getDebtProviderConnections(USER, "plaid");
  assert.equal(conns.length, 2);
  const legacy = conns.find((c) => !c.providerItemId)!;
  const chase = conns.find((c) => c.providerItemId === "item-chase")!;
  assert.equal(legacy.status, "disconnected", "legacy itemless row must be retired");
  assert.equal(chase.status, "active");

  // Fetch only touches the item-keyed row — the legacy token is never queried.
  liabilitiesByToken["access-chase"] = () => creditPayload("chase-card", "Chase Freedom", 1200);
  const liabilities = await plaidLiabilityProvider.fetchLiabilities(USER);
  assert.equal(liabilities.length, 1);
  assert.deepEqual(liabilityCalls, ["access-chase"], "retired legacy row must not be double-fetched");
});

test("no active connections at all → LinkRequiredError", async () => {
  await assert.rejects(() => plaidLiabilityProvider.fetchLiabilities(USER), LinkRequiredError);
});
