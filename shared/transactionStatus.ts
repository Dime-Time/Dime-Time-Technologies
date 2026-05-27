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

  // Permanent failure
  if (
    s === "failed" ||
    s === "failure" ||
    s === "error" ||
    s === "returned" ||
    s === "cancelled" ||
    s === "canceled" ||
    s === "declined"
  ) {
    return "failed";
  }

  // User action required (Plaid re-auth, micro-deposit verification, etc.)
  if (
    s === "requires_action" ||
    s === "requires_authentication" ||
    s === "requires_verification" ||
    s === "action_required"
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
