/**
 * Regression tests for the forgot-password non-enumeration contract.
 *
 * Run locally (no DB, no network):
 *   npx tsx --test server/__tests__/forgot-password-contract.test.ts
 *
 * Invariant under test: the response to POST /api/auth/forgot-password must be
 * identical regardless of whether the account exists, across ALL scenarios —
 * healthy provider, production misconfiguration, and provider failure.
 *
 * Enforced two ways:
 *  1. decideForgotPasswordResponse takes NO account-existence or per-send
 *     inputs — its signature makes leaking impossible by construction. These
 *     tests pin that contract so a future "helpful" refactor that adds a
 *     userExists/sendOk parameter breaks loudly.
 *  2. The provider health gate (emailService) converts individual send
 *     failures into a global degraded state, so outages surface as the SAME
 *     503 for every caller instead of only for known accounts.
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  decideForgotPasswordResponse,
  EMAIL_OUTAGE_MESSAGE,
  FORGOT_PASSWORD_GENERIC_SUCCESS,
} from "../lib/passwordResetContract";
import {
  isEmailServiceDegraded,
  recordEmailSendOutcome,
  EMAIL_DEGRADED_WINDOW_MS,
} from "../services/emailService";

test("healthy provider: single generic 200 for every request", () => {
  const d = decideForgotPasswordResponse({
    emailProvided: true,
    misconfigured: false,
    degraded: false,
  });
  assert.equal(d.status, 200);
  assert.deepEqual(d.body, { ...FORGOT_PASSWORD_GENERIC_SUCCESS });
});

test("misconfigured production: same generic 503 for every request", () => {
  const d = decideForgotPasswordResponse({
    emailProvided: true,
    misconfigured: true,
    degraded: false,
  });
  assert.equal(d.status, 503);
  assert.deepEqual(d.body, { message: EMAIL_OUTAGE_MESSAGE });
});

test("degraded provider: same generic 503 for every request", () => {
  const d = decideForgotPasswordResponse({
    emailProvided: true,
    misconfigured: false,
    degraded: true,
  });
  assert.equal(d.status, 503);
  assert.deepEqual(d.body, { message: EMAIL_OUTAGE_MESSAGE });
});

test("missing email input: 400 independent of service health", () => {
  for (const misconfigured of [false, true]) {
    for (const degraded of [false, true]) {
      const d = decideForgotPasswordResponse({
        emailProvided: false,
        misconfigured,
        degraded,
      });
      assert.equal(d.status, 400);
    }
  }
});

test("contract signature admits no account-existence input (enumeration-proof by construction)", () => {
  // Exhaustive: for every reachable input combination the decision is a pure
  // function of (emailProvided, misconfigured, degraded). If a refactor adds
  // an account-dependent input, the parameter object type changes and this
  // test (plus tsc) fails.
  const seen = new Map<string, string>();
  for (const emailProvided of [false, true]) {
    for (const misconfigured of [false, true]) {
      for (const degraded of [false, true]) {
        const d = decideForgotPasswordResponse({ emailProvided, misconfigured, degraded });
        const key = `${emailProvided}|${misconfigured}|${degraded}`;
        seen.set(key, JSON.stringify(d));
        // Statuses limited to the documented contract.
        assert.ok([200, 400, 503].includes(d.status));
        // Body never varies beyond the two generic messages + validation.
        assert.ok(
          d.body.message === EMAIL_OUTAGE_MESSAGE ||
            d.body.message === FORGOT_PASSWORD_GENERIC_SUCCESS.message ||
            d.body.message === "Email is required",
        );
      }
    }
  }
  // Determinism: same inputs always produce byte-identical responses.
  for (const [key, value] of Array.from(seen)) {
    const [e, m, g] = key.split("|").map((v) => v === "true");
    const again = decideForgotPasswordResponse({ emailProvided: e, misconfigured: m, degraded: g });
    assert.equal(JSON.stringify(again), value);
  }
});

test("health gate: a send failure trips degraded state for ALL subsequent requests", () => {
  const t0 = 1_000_000;
  recordEmailSendOutcome(true, t0);
  assert.equal(isEmailServiceDegraded(t0), false);

  // Provider starts failing (e.g. Resend outage / unverified domain).
  recordEmailSendOutcome(false, t0);
  assert.equal(isEmailServiceDegraded(t0 + 1), true, "degraded immediately after a failure");

  // While degraded, the route 503s BEFORE any user lookup — identical for
  // known and unknown emails.
  const d = decideForgotPasswordResponse({
    emailProvided: true,
    misconfigured: false,
    degraded: isEmailServiceDegraded(t0 + 1),
  });
  assert.equal(d.status, 503);

  // Still degraded just before the window closes; clears after it.
  assert.equal(isEmailServiceDegraded(t0 + EMAIL_DEGRADED_WINDOW_MS - 1), true);
  assert.equal(isEmailServiceDegraded(t0 + EMAIL_DEGRADED_WINDOW_MS), false);

  // A successful send clears the gate immediately.
  recordEmailSendOutcome(false, t0);
  recordEmailSendOutcome(true, t0 + 5);
  assert.equal(isEmailServiceDegraded(t0 + 6), false);

  // Leave the module-level gate clean for any tests that follow.
  recordEmailSendOutcome(true);
});
