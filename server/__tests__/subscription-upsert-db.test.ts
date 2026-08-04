/**
 * DB-level tests for the subscription upsert out-of-order guard.
 * Run (throwaway dev DB only): npm run test:db
 *
 * Verifies that storage.upsertSubscription:
 *  - inserts new rows and stamps lastStripeEventAt
 *  - REJECTS updates carrying an older lastStripeEventAt (stale webhook)
 *    and returns the current row unchanged
 *  - accepts equal-or-newer timestamps (Stripe events in order, plus
 *    authoritative re-fetch stamps)
 */
import { test, after } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { storage } from "../storage";
import { db } from "../db";
import { subscriptions, users } from "@shared/schema";
import { eq } from "drizzle-orm";

const suffix = randomUUID().slice(0, 8);
const email = `upsert-test-${suffix}@example.test`;
let userId: string;
const subId = `sub_test_${suffix}`;

const T1 = new Date("2026-08-04T10:00:00Z");
const T2 = new Date("2026-08-04T11:00:00Z");
const T3 = new Date("2026-08-04T12:00:00Z");

function baseRow(overrides: Partial<typeof subscriptions.$inferInsert> = {}) {
  return {
    userId,
    stripeSubscriptionId: subId,
    stripeCustomerId: `cus_test_${suffix}`,
    stripePriceId: `price_test_${suffix}`,
    plan: "debt",
    status: "incomplete",
    cancelAtPeriodEnd: false,
    ...overrides,
  } as any;
}

test("setup: create throwaway user", async () => {
  const user = await storage.createUser({
    email,
    password: "x".repeat(60),
    firstName: "Upsert",
    lastName: "Test",
  } as any);
  userId = user.id;
});

test("insert stamps lastStripeEventAt", async () => {
  const row = await storage.upsertSubscription(baseRow({ lastStripeEventAt: T2 }));
  assert.equal(row.stripeSubscriptionId, subId);
  assert.equal(row.status, "incomplete");
  assert.equal(row.lastStripeEventAt?.getTime(), T2.getTime());
});

test("stale event (older timestamp) is skipped and current row returned", async () => {
  const row = await storage.upsertSubscription(
    baseRow({ status: "canceled", lastStripeEventAt: T1 }),
  );
  // The stale 'canceled' must NOT have been applied.
  assert.equal(row.status, "incomplete");
  assert.equal(row.lastStripeEventAt?.getTime(), T2.getTime());
  const [persisted] = await db.select().from(subscriptions)
    .where(eq(subscriptions.stripeSubscriptionId, subId));
  assert.equal(persisted.status, "incomplete");
});

test("equal timestamp applies (idempotent redelivery may update)", async () => {
  const row = await storage.upsertSubscription(
    baseRow({ status: "incomplete", lastPaymentIntentStatus: "processing", lastStripeEventAt: T2 }),
  );
  assert.equal(row.lastPaymentIntentStatus, "processing");
});

test("newer event applies; provisional/grace columns round-trip", async () => {
  const until = new Date("2026-08-11T12:00:00Z");
  const row = await storage.upsertSubscription(
    baseRow({ status: "active", provisionalAccessUntil: null, graceUntil: null, lastStripeEventAt: T3 }),
  );
  assert.equal(row.status, "active");
  assert.equal(row.lastStripeEventAt?.getTime(), T3.getTime());
  const row2 = await storage.upsertSubscription(
    baseRow({ status: "past_due", graceUntil: until, lastStripeEventAt: new Date(T3.getTime() + 1000) }),
  );
  assert.equal(row2.status, "past_due");
  assert.equal(row2.graceUntil?.getTime(), until.getTime());
});

after(async () => {
  await db.delete(subscriptions).where(eq(subscriptions.stripeSubscriptionId, subId));
  if (userId) await db.delete(users).where(eq(users.id, userId));
});
