/**
 * Pure verdict mapping for the Stripe capability diagnostics surface.
 *
 * This encodes the decision-critical copy a non-technical operator relies on
 * when reading Stripe account capability/requirements state ahead of an ACH
 * go-live call. The temporary admin "Stripe Diagnostics" tab that rendered
 * this verdict was removed after the ACH go/no-go decision was made, but the
 * mapping itself is locked here (with a test matrix in
 * shared/__tests__/stripeVerdict.test.ts) so it can be reinstated or reused
 * without regressing the operator-facing conclusions.
 */

export interface StripeDiagnostics {
  accountId: string;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  capabilities: Record<string, string>;
  requirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
    pastDue: string[];
    pendingVerification: string[];
    disabledReason: string | null;
  };
  futureRequirements: {
    currentlyDue: string[];
    eventuallyDue: string[];
  };
}

export type StripeVerdictCode =
  | "ach_ready"
  | "ach_pending_review"
  | "action_required"
  | "treasury_pending_ach_available";

export type StripeVerdictSeverity = "ok" | "warning" | "action";

export interface StripeVerdict {
  code: StripeVerdictCode;
  conclusion: string;
  detail: string;
  severity: StripeVerdictSeverity;
}

/**
 * Maps Stripe capability/requirements state into exactly four canonical
 * conclusions — every branch resolves to one of them:
 *   1. ACH ready
 *   2. ACH pending Stripe review
 *   3. Additional information required
 *   4. Treasury pending but ACH available
 * Precedence: an outstanding action (#3) wins, then ACH-active outcomes
 * (#4 / #1), then anything still in review or not yet enabled maps to #2.
 */
export function computeStripeVerdict(d: StripeDiagnostics): StripeVerdict {
  const ach = (d.capabilities["us_bank_account_ach_payments"] ?? "inactive").toLowerCase();
  const fc = (d.capabilities["financial_connections"] ?? "inactive").toLowerCase();
  const treasury = (d.capabilities["treasury"] ?? "inactive").toLowerCase();

  let code: StripeVerdictCode;
  let conclusion: string;
  let detail: string;
  let severity: StripeVerdictSeverity;

  const actionRequired =
    Boolean(d.requirements.disabledReason) || d.requirements.currentlyDue.length > 0;

  if (actionRequired) {
    code = "action_required";
    conclusion = "3 — Additional information required";
    detail = d.requirements.disabledReason
      ? `Stripe set disabled_reason="${d.requirements.disabledReason}", which is a capability restriction. Resolve the items in the Requirements section before ACH will activate.`
      : "requirements.currently_due is populated — Stripe needs more information from you before capabilities activate. See the Requirements section below.";
    severity = "action";
  } else if (ach === "active" && treasury === "pending") {
    code = "treasury_pending_ach_available";
    conclusion = "4 — Treasury pending but ACH available";
    detail =
      "us_bank_account_ach_payments is ACTIVE so ACH debit is approved. Treasury is still PENDING review, but Treasury is a separate product not required for basic ACH debit.";
    severity = "ok";
  } else if (ach === "active") {
    code = "ach_ready";
    conclusion = "1 — ACH ready";
    detail = "us_bank_account_ach_payments is ACTIVE — ACH debit is approved.";
    severity = "ok";
  } else {
    // ACH pending OR inactive, with no outstanding requirement → still under
    // review / not yet enabled. Both collapse to canonical #2.
    code = "ach_pending_review";
    conclusion = "2 — ACH pending Stripe review";
    detail =
      ach === "pending"
        ? "us_bank_account_ach_payments is PENDING — Stripe's review is still in progress. No action is currently required."
        : "us_bank_account_ach_payments is INACTIVE with no outstanding requirements — the capability is not enabled yet, typically because Stripe's review is not complete. No action is currently required.";
    severity = "warning";
  }

  if (ach === "active" && fc !== "active") {
    detail += ` Note: financial_connections is ${fc.toUpperCase()} — bank linking via Financial Connections may not work until it is ACTIVE.`;
  }

  return { code, conclusion, detail, severity };
}
