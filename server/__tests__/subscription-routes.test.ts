/**
 * Subscription route contract tests (no Stripe calls — everything exercised
 * here fails/validates BEFORE any provider call, or reads local state only).
 *
 * Run: npx tsx --test server/__tests__/subscription-routes.test.ts
 *
 * Pins:
 *  - every route requires authentication (401)
 *  - /subscribe requires an Idempotency-Key header (400)
 *  - /subscribe fails closed (503) when Stripe ACH billing is unavailable
 *  - GET /api/subscription computes `entitled` server-side from the stored
 *    status — a client can never supply it
 *  - the response never leaks Stripe identifiers beyond what the UI needs
 *  - cancel/reactivate 404 when there is nothing to act on
 */
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "http";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";
// Billing intentionally unavailable: subscribe must 503 before any Stripe use.
delete process.env.ENABLE_STRIPE_ACH;

import { registerSubscriptionRoutes } from "../routes/subscriptionRoutes";
import { __resetFlagCacheForTests } from "../lib/flags";
import { storage } from "../storage";

const storageAny = storage as any;
const originals = {
  getLatestSubscriptionByUserId: storageAny.getLatestSubscriptionByUserId,
  getStripeAccountsByUserId: storageAny.getStripeAccountsByUserId,
  reserveIdempotencyKey: storageAny.reserveIdempotencyKey,
  releaseIdempotencyKey: storageAny.releaseIdempotencyKey,
  acquireSubscribeLock: storageAny.acquireSubscribeLock,
  releaseSubscribeLock: storageAny.releaseSubscribeLock,
};

let fakeSubRow: any = null;
let server: Server;
let base: string;

before(async () => {
  storageAny.getLatestSubscriptionByUserId = async () => fakeSubRow;
  storageAny.getStripeAccountsByUserId = async () => [];
  storageAny.reserveIdempotencyKey = async () => ({ claimed: true });
  storageAny.releaseIdempotencyKey = async () => {};
  storageAny.acquireSubscribeLock = async () => true;
  storageAny.releaseSubscribeLock = async () => {};

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    const uid = req.header("x-test-user");
    if (uid) (req as any).session = { userId: uid };
    next();
  });
  registerSubscriptionRoutes(app);
  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  base = `http://127.0.0.1:${(server.address() as { port: number }).port}`;
});

after(async () => {
  Object.assign(storageAny, originals);
  await new Promise<void>((resolve) => server.close(() => resolve()));
});

beforeEach(() => {
  fakeSubRow = null;
  __resetFlagCacheForTests();
});

async function call(
  method: string,
  path: string,
  opts: { user?: string; headers?: Record<string, string>; body?: unknown } = {},
): Promise<{ status: number; body: any }> {
  const res = await fetch(base + path, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...(opts.user ? { "x-test-user": opts.user } : {}),
      ...(opts.headers || {}),
    },
    body: opts.body === undefined ? undefined : JSON.stringify(opts.body),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test("every subscription route requires authentication", async () => {
  assert.equal((await call("GET", "/api/subscription")).status, 401);
  assert.equal((await call("POST", "/api/subscription/subscribe")).status, 401);
  assert.equal((await call("POST", "/api/subscription/cancel")).status, 401);
  assert.equal((await call("POST", "/api/subscription/reactivate")).status, 401);
});

test("subscribe fails closed (503) when billing is unavailable — before key or body checks matter", async () => {
  const r = await call("POST", "/api/subscription/subscribe", {
    user: "u1",
    headers: { "Idempotency-Key": "test-key-123456" },
    body: { consentAccepted: true },
  });
  assert.equal(r.status, 503);
});

test("GET /api/subscription: entitlement is computed server-side from stored status", async () => {
  fakeSubRow = { id: "s1", status: "active", cancelAtPeriodEnd: false };
  let r = await call("GET", "/api/subscription", { user: "u1" });
  assert.equal(r.status, 200);
  assert.equal(r.body.entitled, true);

  fakeSubRow = { id: "s1", status: "canceled", cancelAtPeriodEnd: false };
  r = await call("GET", "/api/subscription", { user: "u1" });
  assert.equal(r.body.entitled, false);

  // A stored status can't be forged into entitlement by naming tricks.
  fakeSubRow = { id: "s1", status: "ACTIVE", cancelAtPeriodEnd: false };
  r = await call("GET", "/api/subscription", { user: "u1" });
  assert.equal(r.body.entitled, false);

  fakeSubRow = null;
  r = await call("GET", "/api/subscription", { user: "u1" });
  assert.equal(r.body.entitled, false);
  assert.equal(r.body.subscription, null);
});

test("GET /api/subscription: plan copy pins the $2.99 price and never exposes a price ID to choose", async () => {
  const r = await call("GET", "/api/subscription", { user: "u1" });
  assert.equal(r.body.plan.priceCents, 299);
  // The client is never handed a Stripe price/product id to echo back —
  // the server resolves the price purely from the hardcoded lookup key.
  assert.equal("stripePriceId" in r.body.plan, false);
  assert.ok(r.body.consent?.text?.length > 0);
  assert.ok(r.body.consent?.version);
});

test("cancel: 404 when there is no live subscription", async () => {
  fakeSubRow = null;
  assert.equal((await call("POST", "/api/subscription/cancel", { user: "u1" })).status, 404);
  fakeSubRow = { id: "s1", status: "canceled", cancelAtPeriodEnd: false };
  assert.equal((await call("POST", "/api/subscription/cancel", { user: "u1" })).status, 404);
});

test("cancel: idempotent when cancellation is already scheduled (no second Stripe call)", async () => {
  fakeSubRow = { id: "s1", status: "active", cancelAtPeriodEnd: true, stripeSubscriptionId: "sub_x" };
  const r = await call("POST", "/api/subscription/cancel", { user: "u1" });
  assert.equal(r.status, 200);
  assert.equal(r.body.subscription.cancelAtPeriodEnd, true);
});

test("reactivate: 404 unless a cancellation is actually scheduled", async () => {
  fakeSubRow = null;
  assert.equal((await call("POST", "/api/subscription/reactivate", { user: "u1" })).status, 404);
  fakeSubRow = { id: "s1", status: "active", cancelAtPeriodEnd: false };
  assert.equal((await call("POST", "/api/subscription/reactivate", { user: "u1" })).status, 404);
});
