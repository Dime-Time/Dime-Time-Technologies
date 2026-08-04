/**
 * Production startup must NOT silently guess REQUIRE_EMAIL_VERIFICATION.
 * Run: npx tsx --test server/lib/__tests__/validate-env-verification-flag.test.ts
 *
 * We run validateProductionSecrets in a subprocess-free way by mutating
 * process.env around each call. All other required prod secrets are supplied
 * as dummies so the ONLY variable under test is REQUIRE_EMAIL_VERIFICATION.
 */
import { test, beforeEach, after } from "node:test";
import assert from "node:assert/strict";
import { validateProductionSecrets } from "../validateEnv";
import { __resetFlagCacheForTests } from "../flags";

const saved = { ...process.env };

function primeProdEnv() {
  process.env.NODE_ENV = "production";
  process.env.PLAID_TOKEN_ENCRYPTION_KEY = "test-key";
  process.env.PLAID_ENV = "sandbox";
  process.env.ENABLE_STRIPE_ACH = "false"; // skip the Stripe trio for this test
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
  __resetFlagCacheForTests();
}

beforeEach(primeProdEnv);

after(() => {
  process.env = { ...saved };
  __resetFlagCacheForTests();
});

test("production boot FAILS when REQUIRE_EMAIL_VERIFICATION is unset", () => {
  assert.throws(() => validateProductionSecrets(), /REQUIRE_EMAIL_VERIFICATION/);
});

test("production boot FAILS on an unparseable value", () => {
  process.env.REQUIRE_EMAIL_VERIFICATION = "maybe";
  assert.throws(() => validateProductionSecrets(), /REQUIRE_EMAIL_VERIFICATION/);
});

test("production boot succeeds with explicit 'false'", () => {
  process.env.REQUIRE_EMAIL_VERIFICATION = "false";
  assert.doesNotThrow(() => validateProductionSecrets());
});

test("production boot succeeds with explicit 'true'", () => {
  process.env.REQUIRE_EMAIL_VERIFICATION = "true";
  assert.doesNotThrow(() => validateProductionSecrets());
});

test("non-production is unaffected (dev workflow still boots with nothing set)", () => {
  process.env.NODE_ENV = "development";
  delete process.env.REQUIRE_EMAIL_VERIFICATION;
  assert.doesNotThrow(() => validateProductionSecrets());
});
