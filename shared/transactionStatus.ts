/**
 * Canonical money-movement status used across every Dime Time surface
 * (debt payments, round-up collections, crypto purchases, transfers).
 *
 * Source-of-truth rules:
 *   - The DB tables keep their existing free-form `status` columns (no
 *     migration). The route layer normalises whatever string the DB stores
 *     into one of these five values via `mapToTransactionStatus()`.
 *   - The client never branches on raw DB strings — it consumes the
 *     canonical value and feeds it straight into `<StatusBadge/>`.
 *   - New flows (Stripe ACH, etc.) should accept additional raw strings
 *     in the mapper rather than introducing a sixth status — collapse to
 *     `processing` or `requires_action` first.
 */

export type TransactionStatus =
  | "pending"
  | "processing"
  | "completed"
  | "failed"
  | "requires_action";

export const TRANSACTION_STATUSES: readonly TransactionStatus[] = [
  "pending",
  "processing",
  "completed",
  "failed",
  "requires_action",
] as const;

/** Human-readable label for a canonical status — used by `<StatusBadge/>`. */
export const TRANSACTION_STATUS_LABELS: Record<TransactionStatus, string> = {
  pending: "Pending",
  processing: "Processing",
  completed: "Completed",
  failed: "Failed",
  requires_action: "Requires Action",
};

/**
 * Map a raw DB / provider status string into the canonical enum.
 *
 * Covers every status string currently stored across `payments`,
 * `cryptoPurchases`, `transfers`, `roundUpCollections`,
 * `distributionPayments`, `weeklyDispersals`. Unknown / null values fall
 * back to `pending` (the safest user-facing label — never silently shows
 * "completed" for an in-flight transfer).
 */
export function mapToTransactionStatus(
  raw: string | null | undefined,
): TransactionStatus {
  if (!raw) return "pending";
  const s = raw.trim().toLowerCase();

  // Completed / settled / posted
  if (
    s === "completed" ||
    s === "complete" ||
    s === "success" ||
    s === "succeeded" ||
    s === "settled" ||
    s === "posted" ||
    s === "delivered"
  ) {
    return "completed";
  }

  // In-flight: actively moving through the rails
  if (
    s === "processing" ||
    s === "authorized" ||
    s === "in_progress" ||
    s === "scheduled" ||
    s === "collected" ||
    s === "earning_interest" ||
    s === "dispersed" ||
    s === "sent"
  ) {
    return "processing";
  }

  // Permanent failure (includes ACH returns and refunds — in every case the
  // money was NOT collected and retained, so the honest user-facing label is
  // "failed" rather than a false "completed").
  if (
    s === "failed" ||
    s === "failure" ||
    s === "error" ||
    s === "returned" ||
    s === "refunded" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "declined"
  ) {
    return "failed";
  }

  // User action required (Plaid re-auth, micro-deposit verification, ACH
  // dispute that needs operator/user follow-up, etc.)
  if (
    s === "requires_action" ||
    s === "requires_authentication" ||
    s === "requires_verification" ||
    s === "requires_payment_method" ||
    s === "requires_confirmation" ||
    s === "requires_capture" ||
    s === "requires_source" ||
    s === "action_required" ||
    s === "disputed"
  ) {
    return "requires_action";
  }

  // Default: any unrecognized string (including "pending", "created",
  // "new", null) maps to pending so the user sees an honest in-flight
  // label rather than a false "completed".
  return "pending";
}

/**
 * Normalise a row that has a `status` field into the canonical shape.
 * Returns the original row with `status` replaced by the canonical value.
 */
export function withCanonicalStatus<T extends { status?: string | null }>(
  row: T,
): T & { status: TransactionStatus } {
  return { ...row, status: mapToTransactionStatus(row.status) };
}

/**
 * Plain-English description of each canonical status. Safe to render
 * directly to users — never references provider names, raw status codes,
 * or technical jargon. The optional `kind` parameter tightens the copy
 * for money-movement contexts (e.g. "Your transfer is on its way" vs.
 * the generic "Processing").
 */
export function describeTransactionStatus(
  status: TransactionStatus,
  kind: "transfer" | "generic" = "generic",
): string {
  if (kind === "transfer") {
    switch (status) {
      case "pending":
        return "We've queued this transfer. It'll start moving shortly.";
      case "processing":
        return "Your transfer is moving through the bank network. ACH transfers typically settle in 1–3 business days.";
      case "completed":
        return "This transfer has settled.";
      case "failed":
        return "This transfer didn't go through. Your funds were not moved.";
      case "requires_action":
        return "We need a quick action from you to finish this transfer.";
    }
  }
  switch (status) {
    case "pending":
      return "Waiting to start.";
    case "processing":
      return "In progress.";
    case "completed":
      return "All set.";
    case "failed":
      return "This didn't go through.";
    case "requires_action":
      return "Action required to continue.";
  }
}

/**
 * Map a raw provider error code (Stripe `code`, ACH return code like
 * "R01", Plaid error code, etc.) into a user-friendly explanation plus
 * a suggested next step. Returns null when the code isn't one we have
 * tailored copy for — callers should fall back to
 * `describeTransactionStatus(status, "transfer")`.
 *
 * Codes covered:
 *   - Common Stripe ACH error codes (insufficient_funds, account_closed,
 *     no_account, debit_not_authorized, etc.)
 *   - NACHA return codes (R01..R10) we expect to see on ACH debits
 *   - Plaid item-error families we surface from round-up flows
 */
export function describeTransferError(
  errorCode: string | null | undefined,
): { headline: string; suggestion: string } | null {
  if (!errorCode) return null;
  const code = errorCode.trim().toLowerCase();

  // NACHA / Stripe insufficient-funds family
  if (
    code === "insufficient_funds" ||
    code === "r01" ||
    code === "insufficient-funds"
  ) {
    return {
      headline: "Your bank reported insufficient funds.",
      suggestion:
        "Add money to the connected account or pick a different funding source, then retry the transfer.",
    };
  }

  // Account closed / frozen / unable to locate
  if (
    code === "account_closed" ||
    code === "r02" ||
    code === "no_account" ||
    code === "r03" ||
    code === "r04"
  ) {
    return {
      headline: "Your bank couldn't accept this transfer.",
      suggestion:
        "The connected account may be closed or have the wrong details. Re-link the bank account from Banking → Connected Accounts.",
    };
  }

  // Authorization revoked / not authorized
  if (
    code === "debit_not_authorized" ||
    code === "r07" ||
    code === "r08" ||
    code === "r10" ||
    code === "authorization_revoked"
  ) {
    return {
      headline: "Your bank reported that this debit isn't authorized.",
      suggestion:
        "Contact your bank to clear the block, or re-link the account in Banking and authorize ACH debits again.",
    };
  }

  // Item login required / Plaid re-auth
  if (
    code === "item_login_required" ||
    code === "login_required" ||
    code === "user_setup_required"
  ) {
    return {
      headline: "Your bank needs you to sign in again.",
      suggestion:
        "Open Banking → Connected Accounts and re-link the account so we can keep syncing transactions.",
    };
  }

  // Duplicate detected by Stripe / our own idempotency
  if (
    code === "duplicate_transaction" ||
    code === "idempotency_in_flight" ||
    code === "r24"
  ) {
    return {
      headline: "We already saw this exact transfer.",
      suggestion:
        "Give it a moment to finish — refreshing this page will show the live status. Don't retry unless it stays stuck for more than a few minutes.",
    };
  }

  // Generic Stripe API / network classes we don't want to leak raw
  if (code === "stripe_error" || code === "api_connection_error" || code === "api_error") {
    return {
      headline: "Our bank provider couldn't process this request.",
      suggestion:
        "This is almost always temporary. Wait a minute and try again — your funds were not moved.",
    };
  }

  return null;
}
