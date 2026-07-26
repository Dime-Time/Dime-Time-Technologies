/**
 * Regression tests for the real-money ACH rollout gate's concurrency guarantees.
 *
 * Run locally (DEV DB only — no Stripe, no money ever moves):
 *   npm run test:db          (syncs the dev schema first — preferred)
 *   npx tsx --test server/__tests__/real-transfer-gate.test.ts
 *
 * Covers:
 *  1. Emergency revoke is effective immediately — once an admin disables a user,
 *     the very next reservation is rejected (not_allowlisted / 403).
 *  2. setUserRealTransfersEnabled serializes on the SAME per-user advisory lock
 *     as reserveRealStripeAchDebit, so a revoke can never race past an in-flight
 *     reservation. Proven by holding that lock in a separate transaction and
 *     asserting the setter blocks until the lock is released. On the pre-fix code
 *     (setter without the lock) the setter completes immediately and this fails.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "crypto";
import { sql, eq } from "drizzle-orm";
import { db } from "../db";
import { storage } from "../storage";
import { users, stripeAccounts, debts } from "../../shared/schema";

const LIMITS = { firstTransferMaxDollars: 1, dailyTotalMaxDollars: 5, dailyCountMax: 1 };

async function makeUser(enabled: boolean): Promise<string> {
  const userId = "gate-reg-" + randomUUID();
  await db.insert(users).values({ id: userId, email: userId + "@example.com", realTransfersEnabled: enabled });
  return userId;
}

test("emergency revoke blocks the next reservation immediately", async () => {
  const userId = await makeUser(true);
  try {
    const [acct] = await db
      .insert(stripeAccounts)
      .values({
        userId,
        stripeCustomerId: "cus_reg",
        stripeFcAccountId: "fca_" + randomUUID(),
        status: "linked",
        isActive: true,
      })
      .returning();
    const [debt] = await db
      .insert(debts)
      .values({
        userId,
        name: "Reg Card",
        accountNumber: "0000",
        originalBalance: "100.00",
        currentBalance: "100.00",
        interestRate: "10.00",
        minimumPayment: "10.00",
        dueDate: 1,
        isActive: true,
      })
      .returning();

    const base = {
      userId,
      stripeAccountId: acct.id,
      debtId: debt.id,
      stripeMode: "test" as string,
      environment: "development",
      limits: LIMITS,
    };

    const ok = await storage.reserveRealStripeAchDebit({
      ...base,
      amount: 1,
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });
    assert.equal(ok.ok, true, "allowlisted first $1 should be approved");

    await storage.setUserRealTransfersEnabled(userId, false, "tester", "revoke");

    const blocked = await storage.reserveRealStripeAchDebit({
      ...base,
      amount: 1,
      idempotencyKey: randomUUID(),
      correlationId: randomUUID(),
    });
    assert.equal(blocked.ok, false, "revoked user must be blocked");
    assert.equal((blocked as any).reason, "not_allowlisted");
    assert.equal((blocked as any).httpStatus, 403);
  } finally {
    await storage.deleteUserAccount(userId);
  }
});

test("setUserRealTransfersEnabled serializes on the per-user advisory lock", async () => {
  const userId = await makeUser(true);
  let releaseHeld: (() => void) | undefined;
  const heldReleased = new Promise<void>((r) => {
    releaseHeld = r;
  });
  let lockAcquired = false;

  // Hold the SAME advisory lock the gate uses, in a separate transaction.
  const holder = db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
    lockAcquired = true;
    await heldReleased;
  });

  try {
    const deadline = Date.now() + 10_000;
    while (!lockAcquired) {
      if (Date.now() > deadline) throw new Error("holder transaction never acquired the advisory lock within 10s");
      await new Promise((r) => setTimeout(r, 10));
    }

    let revokeDone = false;
    const revoke = storage
      .setUserRealTransfersEnabled(userId, false, "tester", "lock test")
      .then(() => {
        revokeDone = true;
      });

    // While the lock is held, the setter must NOT complete.
    await new Promise((r) => setTimeout(r, 500));
    assert.equal(revokeDone, false, "setter completed despite advisory lock held — it is not taking the lock");

    // Release the lock; the setter must now complete.
    releaseHeld!();
    await holder;
    await revoke;
    assert.equal(revokeDone, true);

    const [row] = await db.select().from(users).where(eq(users.id, userId));
    assert.equal(row.realTransfersEnabled, false);
  } finally {
    if (releaseHeld) releaseHeld();
    await holder.catch(() => {});
    await storage.deleteUserAccount(userId);
  }
});
