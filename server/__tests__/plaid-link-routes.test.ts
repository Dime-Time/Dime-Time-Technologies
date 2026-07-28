/**
 * Route-level regression tests for the bank-linking (Plaid) endpoints.
 *
 * Run locally (no DB, no network):
 *   npx tsx --test server/__tests__/plaid-link-routes.test.ts
 *
 * Why these exist: the first multi-account bank login in production (checking
 * + loan under one Plaid item) hit the unique plaid_item_id constraint and
 * 500'd, because every earlier user had a single-account bank. Invariants:
 *
 *  1. POST /api/plaid/exchange-token with a multi-account payload stores
 *     exactly ONE bank-account row (the primary depository account) and
 *     returns the full account list.
 *  2. Re-linking the same Plaid item refreshes the existing row (new token,
 *     isActive=true) instead of inserting a duplicate.
 *  3. A Plaid item already owned by a DIFFERENT user → 409, and nothing is
 *     created or refreshed.
 *  4. Plaid returning zero accounts → 502 (not a 500, nothing stored).
 *  5. GET /api/plaid/balances must call Plaid with the DECRYPTED token from
 *     storage.getPlaidAccessToken(id) — never account.plaidAccessToken,
 *     which the storage layer masks to the literal '[encrypted]'.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import express from "express";
import type { Server } from "http";

// SESSION_SECRET must exist before authHelper verifies Bearer tokens.
process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";

import { registerRoutes } from "../routes";
import { storage, MemStorage } from "../storage";
import { plaidService } from "../services/plaidService";
import type { BankAccount } from "@shared/schema";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

// In-memory storage backing: reuse MemStorage's upsert/refresh semantics
// (kept in parity with DatabaseStorage) but expose it through the singleton
// the routes actually import.
const mem = new MemStorage();

// Like DatabaseStorage, mask tokens on any listing API. This is the contract
// under test: routes must treat listed rows' plaidAccessToken as opaque.
function masked(account: BankAccount): BankAccount {
  return { ...account, plaidAccessToken: "[encrypted]" };
}

const storageAny = storage as any;
const originals: Record<string, unknown> = {};
const OVERRIDES = [
  "getBankAccountsByUserId",
  "getBankAccountByPlaidItemId",
  "createBankAccount",
  "refreshBankAccount",
  "getPlaidAccessToken",
] as const;

// Mutable Plaid behavior per test.
let plaidExchange: () => Promise<{ accessToken: string; itemId: string }> = async () => {
  throw new Error("exchangePublicToken not stubbed");
};
let plaidAccounts: () => Promise<any[]> = async () => [];
const balanceCalls: string[] = [];

const plaidAny = plaidService as any;
const plaidOriginals: Record<string, unknown> = {};

let server: Server;
let baseUrl: string;

function bearerFor(userId: string): string {
  const timestamp = Date.now();
  const payload = `${userId}:${timestamp}`;
  const signature = createHash("sha256")
    .update(payload + process.env.SESSION_SECRET)
    .digest("hex")
    .substring(0, 16);
  return Buffer.from(`${userId}:${timestamp}:${signature}`).toString("base64");
}

async function api(method: string, path: string, userId: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerFor(userId)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

function listRows(): BankAccount[] {
  return Array.from((mem as any).bankAccounts.values());
}

before(async () => {
  // Route storage singleton → in-memory fake (no DB touched).
  for (const name of OVERRIDES) {
    originals[name] = storageAny[name];
  }
  storageAny.getBankAccountsByUserId = async (userId: string) =>
    (await mem.getBankAccountsByUserId(userId)).map(masked);
  storageAny.getBankAccountByPlaidItemId = async (itemId: string) => {
    const row = await mem.getBankAccountByPlaidItemId(itemId);
    return row ? masked(row) : undefined;
  };
  storageAny.createBankAccount = (account: any) => mem.createBankAccount(account);
  storageAny.refreshBankAccount = (id: string, updates: any) => mem.refreshBankAccount(id, updates);
  storageAny.getPlaidAccessToken = (id: string) => mem.getPlaidAccessToken(id);

  // Plaid service → deterministic stubs. getBalance enforces the masked-token
  // contract: the placeholder must never reach Plaid.
  for (const name of ["isServiceConfigured", "exchangePublicToken", "getAccounts", "getBalance"]) {
    plaidOriginals[name] = plaidAny[name];
  }
  plaidAny.isServiceConfigured = () => true;
  plaidAny.exchangePublicToken = () => plaidExchange();
  plaidAny.getAccounts = () => plaidAccounts();
  plaidAny.getBalance = async (token: string) => {
    balanceCalls.push(token);
    if (token === "[encrypted]") {
      throw new Error("REGRESSION: masked placeholder token sent to Plaid");
    }
    return [{ account_id: "acc-checking", balances: { available: 123.45, current: 123.45 } }];
  };

  const app = express();
  app.use(express.json());
  server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("no port");
  baseUrl = `http://127.0.0.1:${address.port}`;
});

after(async () => {
  for (const name of OVERRIDES) storageAny[name] = originals[name];
  for (const [name, fn] of Object.entries(plaidOriginals)) plaidAny[name] = fn;
  await new Promise((resolve) => server?.close(resolve));
});

beforeEach(() => {
  (mem as any).bankAccounts.clear();
  balanceCalls.length = 0;
});

const CHASE_ACCOUNTS = [
  { account_id: "acc-checking", name: "Chase Total Checking", type: "depository", subtype: "checking", mask: "1111" },
  { account_id: "acc-loan", name: "Chase Auto Loan", type: "loan", subtype: "auto", mask: "2222" },
];

// ---- Invariant 1: multi-account login stores exactly one row ----

test("exchange-token: multi-account payload (checking + loan) creates ONE row for the depository account", async () => {
  plaidExchange = async () => ({ accessToken: "access-chase-1", itemId: "item-chase" });
  plaidAccounts = async () => CHASE_ACCOUNTS;

  const res = await api("POST", "/api/plaid/exchange-token", "user-1", { publicToken: "public-1" });
  assert.equal(res.status, 200);
  assert.equal(res.body.success, true);
  // Full account list is returned to the client…
  assert.equal(res.body.accounts.length, 2);
  // …but exactly one connection row exists, keyed to the depository account.
  const rows = listRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].accountId, "acc-checking");
  assert.equal(rows[0].accountType, "depository");
  assert.equal(rows[0].plaidItemId, "item-chase");
  assert.equal(rows[0].userId, "user-1");
});

test("exchange-token: loan-only payload still links (falls back to first account)", async () => {
  plaidExchange = async () => ({ accessToken: "access-loan-only", itemId: "item-loan-only" });
  plaidAccounts = async () => [CHASE_ACCOUNTS[1]];

  const res = await api("POST", "/api/plaid/exchange-token", "user-1", { publicToken: "public-x" });
  assert.equal(res.status, 200);
  const rows = listRows();
  assert.equal(rows.length, 1);
  assert.equal(rows[0].accountId, "acc-loan");
});

// ---- Invariant 2: re-linking the same item refreshes, never duplicates ----

test("exchange-token: re-linking the same item refreshes the row (new token, active) — no duplicate", async () => {
  plaidExchange = async () => ({ accessToken: "access-old", itemId: "item-chase" });
  plaidAccounts = async () => CHASE_ACCOUNTS;
  assert.equal((await api("POST", "/api/plaid/exchange-token", "user-1", { publicToken: "p1" })).status, 200);
  const firstId = listRows()[0].id;

  // Simulate a broken login that was deactivated, then re-linked.
  await mem.updateBankAccountStatus(firstId, false);
  plaidExchange = async () => ({ accessToken: "access-new", itemId: "item-chase" });

  const res = await api("POST", "/api/plaid/exchange-token", "user-1", { publicToken: "p2" });
  assert.equal(res.status, 200);
  const rows = listRows();
  assert.equal(rows.length, 1, "re-link must not insert a second row for the same plaid item");
  assert.equal(rows[0].id, firstId);
  assert.equal(rows[0].plaidAccessToken, "access-new");
  assert.equal(rows[0].isActive, true);
});

// ---- Invariant 3: someone else's item → 409, nothing mutated ----

test("exchange-token: item owned by a different user → 409 and no writes", async () => {
  plaidExchange = async () => ({ accessToken: "access-1", itemId: "item-shared" });
  plaidAccounts = async () => CHASE_ACCOUNTS;
  assert.equal((await api("POST", "/api/plaid/exchange-token", "user-1", { publicToken: "p1" })).status, 200);
  const before = JSON.stringify(listRows());

  plaidExchange = async () => ({ accessToken: "access-2", itemId: "item-shared" });
  const res = await api("POST", "/api/plaid/exchange-token", "user-2", { publicToken: "p2" });
  assert.equal(res.status, 409);
  assert.equal(JSON.stringify(listRows()), before, "409 must not create or refresh anything");
});

// ---- Invariant 4: zero accounts from Plaid → clean 502 ----

test("exchange-token: empty accounts list → 502, nothing stored", async () => {
  plaidExchange = async () => ({ accessToken: "access-empty", itemId: "item-empty" });
  plaidAccounts = async () => [];

  const res = await api("POST", "/api/plaid/exchange-token", "user-1", { publicToken: "p1" });
  assert.equal(res.status, 502);
  assert.equal(listRows().length, 0);
});

test("exchange-token: missing publicToken → 400; unauthenticated → 401", async () => {
  assert.equal((await api("POST", "/api/plaid/exchange-token", "user-1", {})).status, 400);
  const res = await fetch(`${baseUrl}/api/plaid/exchange-token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ publicToken: "p" }),
  });
  assert.equal(res.status, 401);
});

// ---- Invariant 5: balances must use decrypted tokens, never '[encrypted]' ----

test("balances: uses storage.getPlaidAccessToken (decrypted), never the masked listing token", async () => {
  plaidExchange = async () => ({ accessToken: "access-real-token", itemId: "item-chase" });
  plaidAccounts = async () => CHASE_ACCOUNTS;
  assert.equal((await api("POST", "/api/plaid/exchange-token", "user-1", { publicToken: "p1" })).status, 200);

  // Sanity: the listing surface the route sees really is masked.
  const listed = await storageAny.getBankAccountsByUserId("user-1");
  assert.equal(listed[0].plaidAccessToken, "[encrypted]");

  const res = await api("GET", "/api/plaid/balances", "user-1");
  assert.equal(res.status, 200);
  assert.equal(res.body.accountErrors.length, 0);
  assert.equal(res.body.balances.length, 1);
  assert.deepEqual(balanceCalls, ["access-real-token"], "Plaid must be called with the decrypted token only");
});

test("balances: missing token reports TOKEN_MISSING with needsRelink instead of failing the request", async () => {
  plaidExchange = async () => ({ accessToken: "access-t", itemId: "item-t" });
  plaidAccounts = async () => CHASE_ACCOUNTS;
  assert.equal((await api("POST", "/api/plaid/exchange-token", "user-1", { publicToken: "p1" })).status, 200);
  const row = listRows()[0];
  storageAny.getPlaidAccessToken = async () => undefined;
  try {
    const res = await api("GET", "/api/plaid/balances", "user-1");
    assert.equal(res.status, 200);
    assert.equal(res.body.balances.length, 0);
    assert.deepEqual(res.body.accountErrors, [
      { bankAccountId: row.id, accountId: row.accountId, errorCode: "TOKEN_MISSING", needsRelink: true },
    ]);
  } finally {
    storageAny.getPlaidAccessToken = (id: string) => mem.getPlaidAccessToken(id);
  }
});
