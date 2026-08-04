/**
 * Resend-verification cooldown invariants.
 * Run: npx tsx --test server/lib/__tests__/verification-cooldown.test.ts
 */
import { test, beforeEach } from "node:test";
import assert from "node:assert/strict";
import {
  RESEND_COOLDOWN_SECONDS,
  checkAndTouchResendCooldown,
  clearResendCooldown,
  _resetAllResendCooldowns,
} from "../verificationCooldown";

const T0 = 1_754_000_000_000; // fixed epoch ms

beforeEach(() => _resetAllResendCooldowns());

test("first request is allowed; immediate repeat is blocked with Retry-After", () => {
  assert.deepEqual(checkAndTouchResendCooldown("u1", T0), { allowed: true, retryAfterSeconds: 0 });
  const second = checkAndTouchResendCooldown("u1", T0 + 5_000);
  assert.equal(second.allowed, false);
  assert.equal(second.retryAfterSeconds, RESEND_COOLDOWN_SECONDS - 5);
});

test("request after the cooldown window is allowed again", () => {
  checkAndTouchResendCooldown("u1", T0);
  const later = checkAndTouchResendCooldown("u1", T0 + RESEND_COOLDOWN_SECONDS * 1000);
  assert.equal(later.allowed, true);
});

test("cooldowns are per-user", () => {
  checkAndTouchResendCooldown("u1", T0);
  assert.equal(checkAndTouchResendCooldown("u2", T0).allowed, true);
});

test("clearResendCooldown lets the user retry after a failed provider send", () => {
  checkAndTouchResendCooldown("u1", T0);
  clearResendCooldown("u1");
  assert.equal(checkAndTouchResendCooldown("u1", T0 + 1_000).allowed, true);
});
