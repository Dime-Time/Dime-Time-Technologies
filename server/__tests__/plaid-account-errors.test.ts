/**
 * Reconnect-prompt contract tests (no DB, no network).
 *
 * Run locally:
 *   npx tsx --test server/__tests__/plaid-account-errors.test.ts
 *
 * Why these exist: the banking page shows a Reconnect prompt (Plaid update
 * mode) when GET /api/plaid/balances or /api/plaid/transactions reports a
 * per-account error with needsRelink: true. That contract was previously
 * verified only by typecheck. These tests pin it at the route level:
 *
 *  1. A Plaid failure with ITEM_LOGIN_REQUIRED yields
 *     { balances|transactions, accountErrors: [{ needsRelink: true, ... }] }
 *     with HTTP 200 — never a 500 that would hide the Reconnect path.
 *  2. One broken account does NOT sink a healthy one: the healthy account's
 *     data is still returned alongside the error entry.
 *  3. Non-relink Plaid errors surface with needsRelink: false (retry, not
 *     Reconnect).
 *  4. A missing stored token is reported as TOKEN_MISSING with
 *     needsRelink: true.
 *  5. /api/plaid/create-update-link-token enforces ownership (404 for a
 *     foreign/unknown account) and returns a link token for a valid one.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import express from "express";
import type { Server } from "http";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";

import { registerRoutes } from "../routes";
import { storage } from "../storage";
import { plaidService } from "../services/plaidService";

// ---------------------------------------------------------------------------
// Test doubles
// ---------------------------------------------------------------------------

const storageAny = storage as any;
const plaidAny = plaidService as any;
const originals: Record<string, unknown> = {};
const plaidOriginals: Record<string, unknown> = {};
const STORAGE_OVERRIDES = ["getBankAccountsByUserId", "getPlaidAccessToken"] as const;
const PLAID_OVERRIDES = ["isServiceConfigured", "getBalance", "getTransactions", "createUpdateLinkToken"] as const;

const USER = "plaid-errors-user";

// Mutable per-test state.
let bankAccounts: Array<{ id: string; userId: string; accountId: string }> = [];
let tokensByBankAccountId: Record<string, string | null> = {};
// Keyed by access token → returns data or throws.
let balancesByToken: Record<string, () => any[]> = {};
let transactionsByToken: Record<string, () => any[]> = {};

function plaidError(code: string) {
  const err: any = new Error(code);
  err.response = { data: { error_code: code } };
  return err;
}

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

async function api(method: string, path: string, body?: unknown) {
  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${bearerFor(USER)}`,
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: await res.json().catch(() => ({})) };
}

before(async () => {
  for (const name of STORAGE_OVERRIDES) originals[name] = storageAny[name];
  for (const name of PLAID_OVERRIDES) plaidOriginals[name] = plaidAny[name];

  storageAny.getBankAccountsByUserId = async (userId: string) =>
    bankAccounts.filter((a) => a.userId === userId);
  storageAny.getPlaidAccessToken = async (bankAccountId: string) =>
    tokensByBankAccountId[bankAccountId] ?? null;

  plaidAny.isServiceConfigured = () => true;
  plaidAny.getBalance = async (token: string) => {
    const fn = balancesByToken[token];
    if (!fn) throw new Error(`getBalance not stubbed for ${token}`);
    return fn();
  };
  plaidAny.getTransactions = async (token: string) => {
    const fn = transactionsByToken[token];
    if (!fn) throw new Error(`getTransactions not stubbed for ${token}`);
    return fn();
  };
  plaidAny.createUpdateLinkToken = async () => "link-update-sandbox-token";

  const app = express();
  app.use(express.json());
  server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

after(async () => {
  for (const name of STORAGE_OVERRIDES) storageAny[name] = originals[name];
  for (const name of PLAID_OVERRIDES) plaidAny[name] = plaidOriginals[name];
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

beforeEach(() => {
  bankAccounts = [
    { id: "ba-healthy", userId: USER, accountId: "plaid-acct-healthy" },
    { id: "ba-broken", userId: USER, accountId: "plaid-acct-broken" },
  ];
  tokensByBankAccountId = { "ba-healthy": "tok-healthy", "ba-broken": "tok-broken" };
  balancesByToken = {
    "tok-healthy": () => [{ accountId: "plaid-acct-healthy", available: 250.75 }],
    "tok-broken": () => {
      throw plaidError("ITEM_LOGIN_REQUIRED");
    },
  };
  transactionsByToken = {
    "tok-healthy": () => [{ transactionId: "tx-1", amount: 4.25 }],
    "tok-broken": () => {
      throw plaidError("ITEM_LOGIN_REQUIRED");
    },
  };
});

// ---- Balances: broken login → accountErrors with needsRelink, healthy data kept ----

test("balances: ITEM_LOGIN_REQUIRED yields needsRelink accountErrors without sinking the healthy account", async () => {
  const res = await api("GET", "/api/plaid/balances");
  assert.equal(res.status, 200, "per-account failures must never become a 500");
  assert.deepEqual(res.body.balances, [{ accountId: "plaid-acct-healthy", available: 250.75 }]);
  assert.deepEqual(res.body.accountErrors, [
    {
      bankAccountId: "ba-broken",
      accountId: "plaid-acct-broken",
      errorCode: "ITEM_LOGIN_REQUIRED",
      needsRelink: true,
    },
  ]);
});

// ---- Transactions: same contract ----

test("transactions: ITEM_LOGIN_REQUIRED yields needsRelink accountErrors without sinking the healthy account", async () => {
  const res = await api("GET", "/api/plaid/transactions");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.transactions, [{ transactionId: "tx-1", amount: 4.25 }]);
  assert.deepEqual(res.body.accountErrors, [
    {
      bankAccountId: "ba-broken",
      accountId: "plaid-acct-broken",
      errorCode: "ITEM_LOGIN_REQUIRED",
      needsRelink: true,
    },
  ]);
});

// ---- Other relink-class codes also flag needsRelink ----

test("every relink-class Plaid error code sets needsRelink: true", async () => {
  for (const code of [
    "PENDING_EXPIRATION",
    "PENDING_DISCONNECT",
    "ITEM_NOT_FOUND",
    "ACCESS_NOT_GRANTED",
    "INVALID_ACCESS_TOKEN",
  ]) {
    balancesByToken["tok-broken"] = () => {
      throw plaidError(code);
    };
    const res = await api("GET", "/api/plaid/balances");
    assert.equal(res.status, 200);
    assert.equal(res.body.accountErrors.length, 1, code);
    assert.equal(res.body.accountErrors[0].errorCode, code);
    assert.equal(res.body.accountErrors[0].needsRelink, true, `${code} must trigger the Reconnect prompt`);
  }
});

// ---- Transient errors are NOT a Reconnect ----

test("a non-relink Plaid error surfaces with needsRelink: false (retry, not Reconnect)", async () => {
  balancesByToken["tok-broken"] = () => {
    throw plaidError("RATE_LIMIT_EXCEEDED");
  };
  const res = await api("GET", "/api/plaid/balances");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.accountErrors, [
    {
      bankAccountId: "ba-broken",
      accountId: "plaid-acct-broken",
      errorCode: "RATE_LIMIT_EXCEEDED",
      needsRelink: false,
    },
  ]);
});

// ---- Missing stored token → TOKEN_MISSING, needsRelink ----

test("a missing stored token is reported as TOKEN_MISSING with needsRelink: true", async () => {
  tokensByBankAccountId["ba-broken"] = null;
  const res = await api("GET", "/api/plaid/balances");
  assert.equal(res.status, 200);
  assert.deepEqual(res.body.accountErrors, [
    {
      bankAccountId: "ba-broken",
      accountId: "plaid-acct-broken",
      errorCode: "TOKEN_MISSING",
      needsRelink: true,
    },
  ]);
});

// ---- Update-mode link token: ownership enforced, then repairs ----

test("create-update-link-token: 404 for unknown account, link token for an owned one", async () => {
  const foreign = await api("POST", "/api/plaid/create-update-link-token", {
    bankAccountId: "ba-not-mine",
  });
  assert.equal(foreign.status, 404, "must not mint update tokens for accounts the user does not own");

  const ok = await api("POST", "/api/plaid/create-update-link-token", {
    bankAccountId: "ba-broken",
  });
  assert.equal(ok.status, 200);
  assert.equal(ok.body.linkToken, "link-update-sandbox-token");

  // No usable stored credentials → 409 (remove & re-add), not a crash.
  tokensByBankAccountId["ba-broken"] = null;
  const gone = await api("POST", "/api/plaid/create-update-link-token", {
    bankAccountId: "ba-broken",
  });
  assert.equal(gone.status, 409);
});
