/**
 * DB-backed multi-bank connection tests for
 * DatabaseStorage.upsertDebtProviderConnection.
 *
 * Run locally (DEV DB only — throwaway user, cleaned up after each test):
 *   npm run test:db          (syncs the dev schema first — preferred)
 *   npx tsx --test server/__tests__/debt-provider-connection-db.test.ts
 *
 * Why this exists: server/__tests__/debt-import-multibank.test.ts pins the
 * multi-bank invariants at the MemStorage level, but MemStorage and
 * DatabaseStorage have silently drifted before. DatabaseStorage has its own
 * item-matching logic (find by providerItemId vs first null-item row), so
 * these tests pin the SAME row-keying rules against real Postgres:
 *  1. Two different providerItemIds create two SEPARATE rows.
 *  2. Re-upserting one itemId updates ONLY that row; the other bank's row,
 *     token, and institution are byte-for-byte untouched.
 *  3. A null-item upsert matches only the null-item (legacy) row — it never
 *     steals or clobbers an item-keyed row.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { users, debtProviderConnections } from "../../shared/schema";

async function makeUser(): Promise<string> {
  const userId = "conn-db-test-" + randomUUID();
  await db.insert(users).values({ id: userId, email: userId + "@example.com" });
  return userId;
}

async function cleanup(userId: string): Promise<void> {
  await db.delete(debtProviderConnections).where(eq(debtProviderConnections.userId, userId));
  await db.delete(users).where(eq(users.id, userId));
}

function conn(userId: string, itemId: string | null, token: string, institution: string) {
  return {
    userId,
    provider: "plaid",
    providerItemId: itemId,
    accessTokenEnc: token,
    institutionName: institution,
    status: "active",
  };
}

/** Read the user's rows straight from Postgres (persisted truth, not returned values). */
async function rows(userId: string) {
  return db
    .select()
    .from(debtProviderConnections)
    .where(eq(debtProviderConnections.userId, userId));
}

test("DB: two different providerItemIds create two separate rows", async () => {
  const userId = await makeUser();
  try {
    const chase = await storage.upsertDebtProviderConnection(conn(userId, "item-chase", "tok-chase", "Chase"));
    const usaa = await storage.upsertDebtProviderConnection(conn(userId, "item-usaa", "tok-usaa", "USAA"));

    assert.notEqual(usaa.id, chase.id, "second bank must get its OWN row");
    const all = await rows(userId);
    assert.equal(all.length, 2, "both banks must be persisted");
    const chaseRow = all.find((r) => r.providerItemId === "item-chase")!;
    const usaaRow = all.find((r) => r.providerItemId === "item-usaa")!;
    assert.equal(chaseRow.accessTokenEnc, "tok-chase");
    assert.equal(chaseRow.institutionName, "Chase");
    assert.equal(usaaRow.accessTokenEnc, "tok-usaa");
    assert.equal(usaaRow.institutionName, "USAA");
  } finally {
    await cleanup(userId);
  }
});

test("DB: re-upserting one itemId updates only that row; the other bank is untouched", async () => {
  const userId = await makeUser();
  try {
    const chase = await storage.upsertDebtProviderConnection(conn(userId, "item-chase", "tok-chase", "Chase"));
    const usaa = await storage.upsertDebtProviderConnection(conn(userId, "item-usaa", "tok-usaa", "USAA"));
    const usaaBefore = JSON.stringify((await rows(userId)).find((r) => r.id === usaa.id));

    // Reauth/relink of Chase: same itemId, new token.
    const updated = await storage.upsertDebtProviderConnection(
      conn(userId, "item-chase", "tok-chase-v2", "Chase"),
    );
    assert.equal(updated.id, chase.id, "re-upsert must reuse the SAME row, not insert");

    const all = await rows(userId);
    assert.equal(all.length, 2, "re-upsert must never create a third row");
    const chaseRow = all.find((r) => r.providerItemId === "item-chase")!;
    assert.equal(chaseRow.accessTokenEnc, "tok-chase-v2", "token must be refreshed in place");
    assert.equal(chaseRow.status, "active");

    const usaaAfter = JSON.stringify(all.find((r) => r.id === usaa.id));
    assert.equal(usaaAfter, usaaBefore, "the other bank's row must be byte-for-byte untouched");
  } finally {
    await cleanup(userId);
  }
});

test("DB: a null-item upsert matches only the null-item row, never an item-keyed row", async () => {
  const userId = await makeUser();
  try {
    // One legacy itemless row + one real item-keyed row.
    const legacy = await storage.upsertDebtProviderConnection(conn(userId, null, "tok-legacy", "Legacy Bank"));
    const chase = await storage.upsertDebtProviderConnection(conn(userId, "item-chase", "tok-chase", "Chase"));
    const chaseBefore = JSON.stringify((await rows(userId)).find((r) => r.id === chase.id));

    // Itemless upsert (e.g. sandbox provider) must hit ONLY the legacy row.
    const updated = await storage.upsertDebtProviderConnection(conn(userId, null, "tok-legacy-v2", "Legacy Bank"));
    assert.equal(updated.id, legacy.id, "null-item upsert must reuse the null-item row");

    const all = await rows(userId);
    assert.equal(all.length, 2, "null-item upsert must not insert a new row");
    const legacyRow = all.find((r) => r.id === legacy.id)!;
    assert.equal(legacyRow.providerItemId, null, "legacy row stays itemless");
    assert.equal(legacyRow.accessTokenEnc, "tok-legacy-v2");

    const chaseAfter = JSON.stringify(all.find((r) => r.id === chase.id));
    assert.equal(chaseAfter, chaseBefore, "item-keyed row must be untouched by a null-item upsert");

    // And the reverse: an item-keyed upsert never steals the legacy row.
    const chase2 = await storage.upsertDebtProviderConnection(conn(userId, "item-chase", "tok-chase-v2", "Chase"));
    assert.equal(chase2.id, chase.id, "item-keyed upsert matches by itemId only");
    const legacyFinal = (await rows(userId)).find((r) => r.id === legacy.id)!;
    assert.equal(legacyFinal.accessTokenEnc, "tok-legacy-v2", "legacy token untouched by item-keyed upsert");
  } finally {
    await cleanup(userId);
  }
});
