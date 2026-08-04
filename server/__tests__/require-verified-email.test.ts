/**
 * Email-verification enforcement middleware (flag: REQUIRE_EMAIL_VERIFICATION).
 *
 * Run: npx tsx --test server/__tests__/require-verified-email.test.ts
 *
 * Invariants pinned here (P1 remediation, Aug 2026 audit):
 *  1. Flag OFF → pure pass-through: verified, unverified, and anonymous
 *     requests all reach the route unchanged (today's production posture).
 *  2. Flag ON → an authenticated-but-unverified user gets 403
 *     EMAIL_VERIFICATION_REQUIRED on EVERY protected prefix.
 *  3. Flag ON → a verified user retains normal access.
 *  4. Flag ON → the recovery surface (/api/user, /api/auth/send-verification,
 *     /api/auth/verify-email, /api/logout, /api/account, /api/contact,
 *     /api/service-status) is never gated.
 *  5. Webhook endpoints (Stripe/Plaid) are exempt.
 *  6. Anonymous requests pass through — each route's own auth owns the 401,
 *     so the middleware can never weaken or alter the auth contract.
 *  7. Storage failure while the flag is ON fails CLOSED (503), never open.
 */
import { test, before, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import express from "express";
import type { Server } from "http";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "test-session-secret";
process.env.REQUIRE_EMAIL_VERIFICATION = "true"; // resolved at first flag read

import {
  requireVerifiedEmail,
  VERIFICATION_PROTECTED_PREFIXES,
  EMAIL_VERIFICATION_REQUIRED_RESPONSE,
} from "../middleware/requireVerifiedEmail";
import { __resetFlagCacheForTests } from "../lib/flags";
import { storage } from "../storage";

const storageAny = storage as any;
const originalGetUser = storageAny.getUser;

type FakeUser = { id: string; emailVerifiedAt: Date | null } | undefined;
let fakeUser: FakeUser;
let getUserThrows = false;

let server: Server;
let base: string;

before(async () => {
  storageAny.getUser = async (_id: string) => {
    if (getUserThrows) throw new Error("db down");
    return fakeUser;
  };

  const app = express();
  app.use(express.json());
  // Simulated auth: `x-test-user` header → authenticated as that user id
  // (mirrors getUserIdFromRequest which the real middleware consults; we
  // stub the session instead of minting real tokens).
  app.use((req, _res, next) => {
    const uid = req.header("x-test-user");
    if (uid) (req as any).session = { userId: uid };
    next();
  });
  app.use(requireVerifiedEmail);
  // Catch-all target route AFTER the middleware.
  app.all("*", (_req, res) => res.status(200).json({ reached: true }));

  await new Promise<void>((resolve) => {
    server = app.listen(0, resolve);
  });
  const addr = server.address() as { port: number };
  base = `http://127.0.0.1:${addr.port}`;
});

after(async () => {
  storageAny.getUser = originalGetUser;
  await new Promise<void>((resolve) => server.close(() => resolve()));
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
  __resetFlagCacheForTests();
});

beforeEach(() => {
  fakeUser = undefined;
  getUserThrows = false;
  process.env.REQUIRE_EMAIL_VERIFICATION = "true";
  __resetFlagCacheForTests();
});

async function hit(path: string, userId?: string): Promise<{ status: number; body: any }> {
  const res = await fetch(base + path, {
    headers: userId ? { "x-test-user": userId } : {},
  });
  return { status: res.status, body: await res.json().catch(() => null) };
}

test("flag OFF: unverified user passes through every protected prefix", async () => {
  process.env.REQUIRE_EMAIL_VERIFICATION = "false";
  __resetFlagCacheForTests();
  fakeUser = { id: "u1", emailVerifiedAt: null };
  for (const prefix of VERIFICATION_PROTECTED_PREFIXES) {
    const r = await hit(prefix, "u1");
    assert.equal(r.status, 200, `expected pass-through for ${prefix}`);
  }
});

test("flag ON: unverified user is blocked (403) on EVERY protected prefix", async () => {
  fakeUser = { id: "u1", emailVerifiedAt: null };
  for (const prefix of VERIFICATION_PROTECTED_PREFIXES) {
    const r = await hit(prefix, "u1");
    assert.equal(r.status, 403, `expected 403 for ${prefix}`);
    assert.equal(r.body.code, EMAIL_VERIFICATION_REQUIRED_RESPONSE.code);
  }
  // Nested paths under a prefix are also blocked.
  const nested = await hit("/api/plaid/create-link-token", "u1");
  assert.equal(nested.status, 403);
  // Dime Time Token routes use the /api/dime-token prefix — pin the exact
  // mounted paths so a prefix rename can never silently un-gate them.
  assert.equal((await hit("/api/dime-token/balance", "u1")).status, 403);
  assert.equal((await hit("/api/dime-token/award", "u1")).status, 403);
});

test("flag ON: verified user retains access to every protected prefix", async () => {
  fakeUser = { id: "u1", emailVerifiedAt: new Date() };
  for (const prefix of VERIFICATION_PROTECTED_PREFIXES) {
    const r = await hit(prefix, "u1");
    assert.equal(r.status, 200, `expected access for ${prefix}`);
  }
});

test("flag ON: recovery surface is never gated for unverified users", async () => {
  fakeUser = { id: "u1", emailVerifiedAt: null };
  for (const path of [
    "/api/user",
    "/api/logout",
    "/api/auth/send-verification",
    "/api/auth/verify-email",
    "/api/account",
    "/api/contact",
    "/api/service-status",
  ]) {
    const r = await hit(path, "u1");
    assert.equal(r.status, 200, `recovery path gated: ${path}`);
  }
});

test("flag ON: webhook endpoints are exempt", async () => {
  fakeUser = { id: "u1", emailVerifiedAt: null };
  assert.equal((await hit("/webhooks/stripe", "u1")).status, 200);
  assert.equal((await hit("/webhooks/plaid")).status, 200);
});

test("flag ON: anonymous requests pass through (route auth owns the 401)", async () => {
  const r = await hit("/api/debts");
  assert.equal(r.status, 200); // catch-all route reached; real routes 401 themselves
});

test("flag ON: storage failure fails CLOSED (503), never open", async () => {
  getUserThrows = true;
  const r = await hit("/api/transfers", "u1");
  assert.equal(r.status, 503);
});

test("unknown user id passes through to the route's own auth handling", async () => {
  fakeUser = undefined;
  const r = await hit("/api/debts", "ghost");
  assert.equal(r.status, 200);
});
