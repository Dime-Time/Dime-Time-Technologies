/**
 * Progressive trust limits for real Stripe ACH debits.
 *
 * Every user starts at the conservative launch limits and earns higher daily
 * caps automatically as real transfers settle cleanly:
 *
 *   Tier "new"        — no settled transfer yet:            $5/day,   1/day
 *   Tier "settled"    — first settlement < 7 days ago:      $25/day,  3/day
 *   Tier "trusted"    — ≥ 7 days since first settlement:    $100/day, 5/day
 *   Tier "established"— ≥ 30 days since first settlement:   $250/day, 10/day
 *
 * The very first transfer is always capped at $1 regardless of tier.
 *
 * Risk demotion: any returned or disputed transfer drops the user back to the
 * base limits (flagged=true) until an admin reviews and sets a manual
 * override or the admin blocks/unblocks the account.
 *
 * An admin-set daily-cap override always wins (raise OR lower), except that a
 * flagged user's automatic demotion still applies unless the override was set
 * (the override is the "manual review" release valve).
 */

export type RealTransferTrustTier = "new" | "settled" | "trusted" | "established";

export interface TransferHistoryRow {
  status: string;
  createdAt: Date | null;
  /** Last status-transition time; for a terminal `settled` row this is the
   * settlement time. Used (over createdAt) to age the trust tiers. */
  updatedAt?: Date | null;
}

export interface RealTransferTrust {
  tier: RealTransferTrustTier;
  flagged: boolean;
  dailyTotalMaxDollars: number;
  dailyCountMax: number;
  firstTransferMaxDollars: number;
  overrideApplied: boolean;
  firstSettledAt: Date | null;
}

export const BASE_LIMITS = { firstTransferMaxDollars: 1, dailyTotalMaxDollars: 5, dailyCountMax: 1 };

const TIER_LIMITS: Record<RealTransferTrustTier, { dailyTotalMaxDollars: number; dailyCountMax: number }> = {
  new: { dailyTotalMaxDollars: 5, dailyCountMax: 1 },
  settled: { dailyTotalMaxDollars: 25, dailyCountMax: 3 },
  trusted: { dailyTotalMaxDollars: 100, dailyCountMax: 5 },
  established: { dailyTotalMaxDollars: 250, dailyCountMax: 10 },
};

/** Statuses that indicate money came back / was contested — risk signals. */
const RISK_STATUSES = new Set(["returned", "disputed"]);

export function computeRealTransferTrust(
  history: TransferHistoryRow[],
  dailyCapOverride: number | null,
  now: Date = new Date(),
): RealTransferTrust {
  const flagged = history.some((r) => RISK_STATUSES.has(r.status));

  const settledDates = history
    .filter((r) => r.status === "settled" && (r.updatedAt || r.createdAt))
    .map((r) => (r.updatedAt ?? r.createdAt) as Date);
  const firstSettledAt = settledDates.length
    ? new Date(Math.min(...settledDates.map((d) => d.getTime())))
    : null;

  let tier: RealTransferTrustTier = "new";
  if (firstSettledAt) {
    const days = (now.getTime() - firstSettledAt.getTime()) / 86_400_000;
    tier = days >= 30 ? "established" : days >= 7 ? "trusted" : "settled";
  }

  // Flagged users are demoted to the base limits regardless of tier…
  let { dailyTotalMaxDollars, dailyCountMax } = flagged
    ? { dailyTotalMaxDollars: BASE_LIMITS.dailyTotalMaxDollars, dailyCountMax: BASE_LIMITS.dailyCountMax }
    : TIER_LIMITS[tier];

  // …but an explicit admin override always wins (manual-review release valve,
  // and also the way an admin lowers a specific user's cap).
  const overrideApplied = dailyCapOverride !== null && Number.isFinite(dailyCapOverride);
  if (overrideApplied) dailyTotalMaxDollars = dailyCapOverride as number;

  return {
    tier,
    flagged,
    dailyTotalMaxDollars,
    dailyCountMax,
    firstTransferMaxDollars: BASE_LIMITS.firstTransferMaxDollars,
    overrideApplied,
    firstSettledAt,
  };
}
