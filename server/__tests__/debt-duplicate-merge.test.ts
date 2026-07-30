/**
 * Duplicate-debt merge / keep-both persistence across bank refreshes (Task 76 feature).
 *
 * Run locally:
 *   npx tsx --test server/__tests__/debt-duplicate-merge.test.ts
 *
 * Invariants pinned (route-level, against the real Express routes with the
 * storage singleton backed by MemStorage — kept in parity with DatabaseStorage
 * by storage-parity-db.test.ts):
 *
 *  1. A manual debt + freshly imported duplicate is flagged by
 *     GET /api/debts/duplicates.
 *  2. Merging archives the manual entry (mergedIntoDebtId set), drops it from
 *     active totals, and repoints the round-up target to the imported debt.
 *  3. A subsequent provider refresh (importDebtsFromProvider with the same
 *     providerAccountId) updates the imported row IN PLACE: it does NOT
 *     resurrect the merged manual debt, re-flag the pair, or create a second
 *     imported row. Payment history on the archived manual debt survives.
 *  4. "Keep both" (dismiss-duplicate) persists across refreshes and across
 *     fresh reads (re-login is just a re-query of the same rows).
 *  5. Restoring the archived manual debt clears mergedIntoDebtId and
 *     re-triggers the duplicate prompt.
 */
import { test, before, after, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import express from "express";
import type { Server } from "http";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";

import { registerRoutes } from "../routes";
import { storage, MemStorage } from "../storage";
import type { NormalizedLiability } from "../services/debtImport/types";
import type { Debt } from "@shared/schema";
import { debtDismissalFingerprint } from "@shared/debtDuplicates";

// ---------------------------------------------------------------------------
// Storage singleton → in-memory fake (no DB touched)
// ---------------------------------------------------------------------------

let mem = new MemStorage();

const storageAny = storage as any;
const originals: Record<string, unknown> = {};
const OVERRIDES = [
  "getDebtsByUserId",
  "getArchivedDebtsByUserId",
  "getDebt",
  "updateDebt",
  "getRoundUpSettings",
  "createOrUpdateRoundUpSettings",
] as const;

let server: Server;
let baseUrl: string;

const USER = "dup-merge-user";

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

// A Chase credit-card liability as the sandbox/Plaid provider would return it.
function chaseLiability(balance: number): NormalizedLiability {
  return {
    provider: "plaid",
    providerAccountId: "acct-chase-cc-1",
    institutionName: "Chase",
    creditorName: "CREDIT CARD",
    accountType: "credit_card",
    mask: "4321",
    currentBalance: balance,
    interestRateApr: 22.99,
    minimumPayment: 35,
    dueDate: 15,
    creditLimit: 10000,
    availableCredit: 10000 - balance,
  };
}

/** Simulate a bank refresh: same provider account, possibly new balance. */
async function refresh(balance: number) {
  return mem.importDebtsFromProvider(USER, "plaid", [chaseLiability(balance)]);
}

async function activeDebts(): Promise<Debt[]> {
  return mem.getDebtsByUserId(USER);
}

before(async () => {
  for (const name of OVERRIDES) {
    originals[name] = storageAny[name];
    storageAny[name] = (...args: any[]) => (mem as any)[name](...args);
  }

  const app = express();
  app.use(express.json());
  server = await registerRoutes(app);
  await new Promise<void>((resolve) => server.listen(0, resolve));
  const addr = server.address();
  baseUrl = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});

after(async () => {
  for (const name of OVERRIDES) storageAny[name] = originals[name];
  await new Promise<void>((resolve, reject) =>
    server.close((err) => (err ? reject(err) : resolve())),
  );
});

// Fresh world per test: a manual "JP Morgan Credit Card" debt with a payment,
// round-ups targeting it, and one imported Chase duplicate.
let manual: Debt;
let imported: Debt;

beforeEach(async () => {
  mem = new MemStorage();

  manual = await mem.createDebt({
    userId: USER,
    name: "JP Morgan Credit Card",
    accountNumber: "****4321",
    originalBalance: "4000.00",
    currentBalance: "3600.00",
    interestRate: "22.99",
    minimumPayment: "35.00",
    dueDate: 15,
  } as any);

  await mem.createPayment({
    userId: USER,
    debtId: manual.id,
    amount: "400.00",
    paymentDate: new Date("2026-07-01"),
    status: "completed",
  } as any);

  await mem.createOrUpdateRoundUpSettings({
    userId: USER,
    isEnabled: true,
    targetDebtId: manual.id,
  } as any);

  const result = await refresh(3843.25);
  assert.equal(result.imported, 1);
  imported = result.debts[0];
});

// ---- Invariant 1: the pair is flagged ----

test("manual + imported duplicate is flagged with the manual/imported ids", async () => {
  const dups = await api("GET", "/api/debts/duplicates");
  assert.equal(dups.status, 200);
  assert.equal(dups.body.length, 1);
  assert.equal(dups.body[0].manualDebtId, manual.id);
  assert.equal(dups.body[0].importedDebtId, imported.id);
});

// ---- Invariants 2 + 3: merge, then refresh must not undo it ----

test("merge archives the manual debt, repoints round-ups, and survives two refreshes", async () => {
  const merge = await api("POST", `/api/debts/${manual.id}/merge`, {
    importedDebtId: imported.id,
  });
  assert.equal(merge.status, 200);

  // Manual is archived with the merge marker; totals now count only the import.
  let active = await activeDebts();
  assert.equal(active.length, 1);
  assert.equal(active[0].id, imported.id);
  const archivedManual = await mem.getDebt(manual.id);
  assert.equal(archivedManual!.isActive, false);
  assert.equal(archivedManual!.mergedIntoDebtId, imported.id);

  // Round-up target repointed to the imported debt.
  const roundUp = await mem.getRoundUpSettings(USER);
  assert.equal(roundUp!.targetDebtId, imported.id);

  // No more duplicate prompt.
  let dups = await api("GET", "/api/debts/duplicates");
  assert.deepEqual(dups.body, []);

  // Two bank refreshes with changing balances.
  await refresh(3700.5);
  const second = await refresh(3650.0);
  assert.equal(second.imported, 0, "refresh must update in place, never insert a second row");
  assert.equal(second.updated, 1);

  // Still exactly one active debt, balance refreshed in place.
  active = await activeDebts();
  assert.equal(active.length, 1);
  assert.equal(active[0].id, imported.id);
  assert.equal(active[0].currentBalance, "3650.00");

  // Merged manual debt stays archived with its marker and payment history.
  const after = await mem.getDebt(manual.id);
  assert.equal(after!.isActive, false);
  assert.equal(after!.mergedIntoDebtId, imported.id);
  const payments = await mem.getPaymentsByDebtId(manual.id);
  assert.equal(payments.length, 1);
  assert.equal(payments[0].amount, "400.00");

  // And the prompt does not come back.
  dups = await api("GET", "/api/debts/duplicates");
  assert.deepEqual(dups.body, []);
});

// ---- Invariant 4: keep both persists across refreshes and fresh reads ----

test("keep both (dismiss) persists across refreshes and re-reads", async () => {
  const dismiss = await api("POST", `/api/debts/${manual.id}/dismiss-duplicate`, {
    importedDebtId: imported.id,
  });
  assert.equal(dismiss.status, 200);

  // Both stay active; the pair is no longer flagged.
  assert.equal((await activeDebts()).length, 2);
  let dups = await api("GET", "/api/debts/duplicates");
  assert.deepEqual(dups.body, []);

  // Refresh must not clear notDuplicateOf (it lives on the manual debt,
  // which the provider refresh never touches). The dismissal stores the id
  // PLUS a stable fingerprint so it survives a disconnect + relink.
  await refresh(3900.0);
  const manualAfter = await mem.getDebt(manual.id);
  const fp = debtDismissalFingerprint(imported);
  assert.ok(fp, "imported debt must have a dismissal fingerprint");
  assert.deepEqual(manualAfter!.notDuplicateOf, [imported.id, fp]);

  // A fresh read (what a re-login does) still shows no duplicates and both debts.
  dups = await api("GET", "/api/debts/duplicates");
  assert.deepEqual(dups.body, []);
  assert.equal((await activeDebts()).length, 2);

  // Dismissing again is idempotent — no duplicate array entries.
  await api("POST", `/api/debts/${manual.id}/dismiss-duplicate`, {
    importedDebtId: imported.id,
  });
  assert.deepEqual((await mem.getDebt(manual.id))!.notDuplicateOf, [imported.id, fp]);
});

// ---- Invariant 4b: keep both survives a bank disconnect + relink ----

test("keep both survives disconnect + relink (new row ids, new provider account ids)", async () => {
  const dismiss = await api("POST", `/api/debts/${manual.id}/dismiss-duplicate`, {
    importedDebtId: imported.id,
  });
  assert.equal(dismiss.status, 200);
  assert.deepEqual((await api("GET", "/api/debts/duplicates")).body, []);

  // Disconnect: the imported row disappears entirely (worst case — hard
  // delete). A relink with a new Plaid Item then re-imports the SAME card
  // under a brand-new provider account id, creating a NEW row with a new id.
  await mem.deleteDebtPermanently(imported.id);
  const relinked = await mem.importDebtsFromProvider(USER, "plaid", [
    { ...chaseLiability(3843.25), providerAccountId: "acct-chase-cc-NEW-ITEM" },
  ]);
  assert.equal(relinked.imported, 1, "relink must create a fresh imported row");
  const reimported = relinked.debts[0];
  assert.notEqual(reimported.id, imported.id);

  // The old dismissal must still silence the prompt: the stored fingerprint
  // (last-four + institution) identifies the same physical card.
  const dups = await api("GET", "/api/debts/duplicates");
  assert.deepEqual(dups.body, [], "user must not be re-asked about a pair they already answered");
  assert.equal((await activeDebts()).length, 2, "both debts stay active after relink");
});

// ---- Invariant 5: restore un-merges and re-triggers the prompt ----

test("restoring the merged manual debt clears the marker and re-flags the pair", async () => {
  await api("POST", `/api/debts/${manual.id}/merge`, { importedDebtId: imported.id });
  await refresh(3800.0); // a refresh in between must not matter

  const restore = await api("POST", `/api/debts/${manual.id}/restore`);
  assert.equal(restore.status, 200);
  assert.equal(restore.body.isActive, true);
  assert.equal(restore.body.mergedIntoDebtId, null);

  const dups = await api("GET", "/api/debts/duplicates");
  assert.equal(dups.body.length, 1);
  assert.equal(dups.body[0].manualDebtId, manual.id);
  assert.equal(dups.body[0].importedDebtId, imported.id);
});

// ---- Guard: merge rejects wrong directions so refresh semantics stay sound ----

test("merge refuses imported→manual direction and archived participants", async () => {
  const wrongWay = await api("POST", `/api/debts/${imported.id}/merge`, {
    importedDebtId: manual.id,
  });
  assert.equal(wrongWay.status, 400);

  await api("POST", `/api/debts/${manual.id}/merge`, { importedDebtId: imported.id });
  const again = await api("POST", `/api/debts/${manual.id}/merge`, {
    importedDebtId: imported.id,
  });
  assert.equal(again.status, 400, "an already-archived manual debt cannot merge again");
});
