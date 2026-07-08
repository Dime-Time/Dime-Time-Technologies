import { test } from "node:test";
import assert from "node:assert/strict";
import { computeStripeVerdict, type StripeDiagnostics } from "../stripeVerdict";

function diag(overrides: {
  capabilities?: Record<string, string>;
  currentlyDue?: string[];
  disabledReason?: string | null;
} = {}): StripeDiagnostics {
  return {
    accountId: "acct_test123",
    chargesEnabled: true,
    payoutsEnabled: true,
    detailsSubmitted: true,
    capabilities: overrides.capabilities ?? {},
    requirements: {
      currentlyDue: overrides.currentlyDue ?? [],
      eventuallyDue: [],
      pastDue: [],
      pendingVerification: [],
      disabledReason: overrides.disabledReason ?? null,
    },
    futureRequirements: {
      currentlyDue: [],
      eventuallyDue: [],
    },
  };
}

test("ACH active → 1 — ACH ready", () => {
  const v = computeStripeVerdict(
    diag({
      capabilities: {
        us_bank_account_ach_payments: "active",
        financial_connections: "active",
        treasury: "active",
      },
    }),
  );
  assert.equal(v.code, "ach_ready");
  assert.equal(v.conclusion, "1 — ACH ready");
  assert.equal(v.severity, "ok");
  assert.equal(v.detail, "us_bank_account_ach_payments is ACTIVE — ACH debit is approved.");
});

test("ACH active + treasury pending → 4 — Treasury pending but ACH available", () => {
  const v = computeStripeVerdict(
    diag({
      capabilities: {
        us_bank_account_ach_payments: "active",
        financial_connections: "active",
        treasury: "pending",
      },
    }),
  );
  assert.equal(v.code, "treasury_pending_ach_available");
  assert.equal(v.conclusion, "4 — Treasury pending but ACH available");
  assert.equal(v.severity, "ok");
  assert.match(v.detail, /Treasury is still PENDING review/);
  assert.match(v.detail, /not required for basic ACH debit/);
});

test("currently_due populated → 3 — Additional information required (wins over ACH active)", () => {
  const v = computeStripeVerdict(
    diag({
      capabilities: {
        us_bank_account_ach_payments: "active",
        financial_connections: "active",
        treasury: "active",
      },
      currentlyDue: ["external_account", "business_profile.url"],
    }),
  );
  assert.equal(v.code, "action_required");
  assert.equal(v.conclusion, "3 — Additional information required");
  assert.equal(v.severity, "action");
  assert.match(v.detail, /requirements\.currently_due is populated/);
});

test("disabled_reason populated → 3 — Additional information required, reason quoted", () => {
  const v = computeStripeVerdict(
    diag({
      capabilities: { us_bank_account_ach_payments: "pending" },
      disabledReason: "requirements.past_due",
    }),
  );
  assert.equal(v.code, "action_required");
  assert.equal(v.conclusion, "3 — Additional information required");
  assert.equal(v.severity, "action");
  assert.match(v.detail, /disabled_reason="requirements\.past_due"/);
  assert.match(v.detail, /capability restriction/);
});

test("ACH pending, no requirements → 2 — ACH pending Stripe review", () => {
  const v = computeStripeVerdict(
    diag({
      capabilities: {
        us_bank_account_ach_payments: "pending",
        financial_connections: "active",
      },
    }),
  );
  assert.equal(v.code, "ach_pending_review");
  assert.equal(v.conclusion, "2 — ACH pending Stripe review");
  assert.equal(v.severity, "warning");
  assert.match(v.detail, /is PENDING — Stripe's review is still in progress/);
  assert.match(v.detail, /No action is currently required/);
});

test("ACH inactive with no requirements → 2 — ACH pending Stripe review (inactive wording)", () => {
  const v = computeStripeVerdict(diag({ capabilities: {} }));
  assert.equal(v.code, "ach_pending_review");
  assert.equal(v.conclusion, "2 — ACH pending Stripe review");
  assert.equal(v.severity, "warning");
  assert.match(v.detail, /is INACTIVE with no outstanding requirements/);
  assert.match(v.detail, /No action is currently required/);
});

test("ACH active but financial_connections not active → secondary FC note appended", () => {
  const v = computeStripeVerdict(
    diag({
      capabilities: {
        us_bank_account_ach_payments: "active",
        financial_connections: "pending",
        treasury: "active",
      },
    }),
  );
  assert.equal(v.code, "ach_ready");
  assert.match(v.detail, /Note: financial_connections is PENDING/);
  assert.match(v.detail, /bank linking via Financial Connections may not work until it is ACTIVE/);
});

test("FC note also appended on verdict 4 (ACH active + treasury pending + FC missing)", () => {
  const v = computeStripeVerdict(
    diag({
      capabilities: {
        us_bank_account_ach_payments: "active",
        treasury: "pending",
      },
    }),
  );
  assert.equal(v.code, "treasury_pending_ach_available");
  assert.match(v.detail, /Note: financial_connections is INACTIVE/);
});

test("no FC note when ACH is not active", () => {
  const v = computeStripeVerdict(
    diag({
      capabilities: {
        us_bank_account_ach_payments: "pending",
        financial_connections: "inactive",
      },
    }),
  );
  assert.doesNotMatch(v.detail, /financial_connections/);
});

test("capability casing is normalized (ACTIVE → active)", () => {
  const v = computeStripeVerdict(
    diag({
      capabilities: {
        us_bank_account_ach_payments: "ACTIVE",
        financial_connections: "Active",
      },
    }),
  );
  assert.equal(v.code, "ach_ready");
  assert.doesNotMatch(v.detail, /Note: financial_connections/);
});
