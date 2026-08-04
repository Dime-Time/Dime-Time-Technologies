/**
 * Password-hashing invariants (P1 remediation, Aug 2026 audit).
 *
 * Run: npx tsx --test server/lib/__tests__/passwords.test.ts
 *
 * The production standard is bcrypt (adaptive, cost 12) for every new or
 * changed password. Legacy unsalted SHA-256 hashes are verify-only and are
 * migrated to bcrypt on the next successful login. These tests pin:
 *   1. New hashes are bcrypt with the expected cost.
 *   2. Correct/incorrect verification for both algorithms.
 *   3. Malformed stored hashes fail closed (false, never a throw).
 *   4. The SHA-256 path is only ever taken for non-bcrypt algo values.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  BCRYPT_COST,
  CURRENT_PASSWORD_ALGO,
  hashPasswordBcrypt,
  hashPasswordSha256,
  verifyPassword,
} from "../passwords";

test("current algorithm is bcrypt", () => {
  assert.equal(CURRENT_PASSWORD_ALGO, "bcrypt");
  assert.equal(BCRYPT_COST, 12);
});

test("new hashes are bcrypt (cost 12) and never plaintext or sha256-shaped", async () => {
  const hash = await hashPasswordBcrypt("correct horse battery staple");
  assert.match(hash, /^\$2[aby]\$12\$/);
  assert.notEqual(hash, "correct horse battery staple");
  assert.notEqual(hash, hashPasswordSha256("correct horse battery staple"));
});

test("bcrypt verification: correct password passes, wrong fails", async () => {
  const hash = await hashPasswordBcrypt("s3cret-pass");
  assert.equal(await verifyPassword("s3cret-pass", hash, "bcrypt"), true);
  assert.equal(await verifyPassword("wrong-pass", hash, "bcrypt"), false);
});

test("legacy sha256 verification: correct passes, wrong fails", async () => {
  const legacyHash = hashPasswordSha256("legacy-password-1");
  assert.equal(await verifyPassword("legacy-password-1", legacyHash, "sha256"), true);
  assert.equal(await verifyPassword("nope", legacyHash, "sha256"), false);
  // null algo (pre-migration rows default to sha256 semantics)
  assert.equal(await verifyPassword("legacy-password-1", legacyHash, null), true);
});

test("a legacy sha256 hash NEVER verifies via the bcrypt path", async () => {
  const legacyHash = hashPasswordSha256("legacy-password-2");
  assert.equal(await verifyPassword("legacy-password-2", legacyHash, "bcrypt"), false);
});

test("malformed stored hashes fail closed without throwing", async () => {
  for (const bad of ["", "not-a-hash", "$2b$xx$corrupt", "\u0000\u0001"]) {
    assert.equal(await verifyPassword("anything", bad, "bcrypt"), false);
    assert.equal(await verifyPassword("anything", bad, "sha256"), false);
  }
});

test("two hashes of the same password differ (salted), unlike legacy sha256", async () => {
  const a = await hashPasswordBcrypt("same-password");
  const b = await hashPasswordBcrypt("same-password");
  assert.notEqual(a, b); // salted
  assert.equal(hashPasswordSha256("same-password"), hashPasswordSha256("same-password")); // why legacy is being retired
  assert.equal(await verifyPassword("same-password", a, "bcrypt"), true);
  assert.equal(await verifyPassword("same-password", b, "bcrypt"), true);
});
