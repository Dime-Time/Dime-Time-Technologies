/**
 * Weekly round-up disbursement engine.
 *
 * Business model: collected round-ups sit in the Mercury savings account
 * earning interest until Friday 00:00 America/New_York, when the accumulated
 * balance for each user is paid toward their target debt via a Mercury ACH
 * transfer.
 *
 * Safety model (all must hold before real money moves):
 *   - ENABLE_WEEKLY_DISBURSEMENT flag ON  (scheduler + real runs)
 *   - ENABLE_REAL_TRANSFERS flag ON       (global money-movement gate)
 *   - Mercury service configured
 *   - user NOT realTransfersBlocked
 *   - target debt has admin-set payee account + valid 9-digit routing number
 *   - disbursable amount >= $1.00
 * Anything failing a check is recorded as `skipped` with a reason — never a
 * silent drop. The run is idempotent per Friday boundary via the
 * weekly_distributions table (one row per Friday date).
 */
import { randomUUID } from "crypto";
import { storage } from "../storage";
import { mercuryService } from "./mercuryService";
import { isFlagEnabled } from "../lib/flags";
import type { Transfer } from "@shared/schema";

const MIN_DISBURSEMENT_DOLLARS = 1.0;
const DISBURSEMENT_TIMEZONE = "America/New_York";

function log(correlationId: string, event: string, data?: Record<string, unknown>) {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "WeeklyDisbursement",
      correlationId,
      event,
      ...data,
    }),
  );
}

/** Wall-clock parts of `date` in the disbursement timezone. */
function zonedParts(date: Date): { y: number; m: number; d: number; weekday: number } {
  const fmt = new Intl.DateTimeFormat("en-US", {
    timeZone: DISBURSEMENT_TIMEZONE,
    year: "numeric",
    month: "numeric",
    day: "numeric",
    weekday: "short",
  });
  const parts = fmt.formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const weekdayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
  return {
    y: Number(get("year")),
    m: Number(get("month")),
    d: Number(get("day")),
    weekday: weekdayMap[get("weekday")] ?? 0,
  };
}

/**
 * The most recent Friday date (as a UTC-midnight Date used purely as a
 * calendar key) whose 00:00 in America/New_York is <= `now`.
 *
 * "Friday at midnight" == the instant Thursday night rolls into Friday.
 */
export function getFridayBoundary(now: Date): Date {
  const p = zonedParts(now);
  // Days back to the most recent Friday (0 if today IS Friday in ET —
  // meaning Friday 00:00 ET has already passed).
  const daysBack = (p.weekday - 5 + 7) % 7;
  // Build a calendar date key at UTC midnight for stability.
  const key = new Date(Date.UTC(p.y, p.m - 1, p.d));
  key.setUTCDate(key.getUTCDate() - daysBack);
  return key;
}

const COLLECTION_TYPES = new Set(["roundup_collection", "stripe_ach_debit"]);
const SETTLED_STATUSES = new Set(["settled"]);
// Debt payments in these statuses do NOT reduce the balance (money never
// left). 'simulated' rows were written while ENABLE_REAL_TRANSFERS was off —
// no real money moved. Every OTHER status (including unknown future ones)
// counts as spent: fail-safe against double-paying, never against user funds.
const PAYMENT_VOID_STATUSES = new Set(["failed", "cancelled", "returned", "refunded", "simulated"]);

/**
 * Pure balance math: settled inbound collections minus all non-void prior
 * debt payments (pending ones count as spent — never double-disburse).
 */
export function computeDisbursableFromTransfers(transfers: Transfer[]): number {
  let collected = 0;
  let paid = 0;
  for (const t of transfers) {
    const amount = parseFloat(t.amount);
    if (!Number.isFinite(amount) || amount <= 0) continue;
    if (COLLECTION_TYPES.has(t.type) && SETTLED_STATUSES.has(t.status)) {
      collected += amount;
    } else if (t.type === "debt_payment" && !PAYMENT_VOID_STATUSES.has(t.status)) {
      paid += amount;
    }
  }
  const balance = collected - paid;
  return balance > 0 ? Math.round(balance * 100) / 100 : 0;
}

export interface DisbursementLineResult {
  userId: string;
  debtId: string | null;
  amount: number;
  status: "completed" | "skipped" | "failed" | "would_disburse";
  reason?: string;
  mercuryTransferId?: string;
}

export interface DisbursementRunResult {
  ran: boolean;
  dryRun: boolean;
  fridayDate: string; // YYYY-MM-DD calendar key
  alreadyProcessed?: boolean;
  totalDisbursed: number;
  lines: DisbursementLineResult[];
  correlationId: string;
}

/**
 * Compute what WOULD be disbursed right now, without touching anything.
 * Used by the admin preview endpoint and as phase one of a real run.
 */
export async function previewDisbursement(): Promise<DisbursementLineResult[]> {
  const settingsList = await storage.getAllEnabledRoundUpSettings();
  const lines: DisbursementLineResult[] = [];

  for (const settings of settingsList) {
    const userId = settings.userId;
    const base: DisbursementLineResult = {
      userId,
      debtId: settings.targetDebtId ?? null,
      amount: 0,
      status: "skipped",
    };

    const transfers = await storage.getTransfersByUserId(userId);
    const amount = computeDisbursableFromTransfers(transfers);
    base.amount = amount;

    if (amount < MIN_DISBURSEMENT_DOLLARS) {
      lines.push({ ...base, reason: "below_minimum" });
      continue;
    }
    if (!settings.targetDebtId) {
      lines.push({ ...base, reason: "no_target_debt" });
      continue;
    }
    const user = await storage.getUser(userId);
    if (!user) {
      lines.push({ ...base, reason: "user_not_found" });
      continue;
    }
    if (user.realTransfersBlocked) {
      lines.push({ ...base, reason: "user_blocked" });
      continue;
    }
    const debt = await storage.getDebt(settings.targetDebtId);
    if (!debt || debt.userId !== userId) {
      lines.push({ ...base, reason: "target_debt_missing" });
      continue;
    }
    if (!debt.payeeAccountNumber || !debt.payeeRoutingNumber) {
      lines.push({ ...base, reason: "payee_routing_not_set" });
      continue;
    }
    if (!/^\d{9}$/.test(debt.payeeRoutingNumber)) {
      lines.push({ ...base, reason: "invalid_payee_routing" });
      continue;
    }
    lines.push({ ...base, status: "would_disburse" });
  }
  return lines;
}

/**
 * Execute (or dry-run) the weekly disbursement for the current Friday
 * boundary. Idempotent: a completed/processing weekly_distributions row for
 * this Friday means the run is a no-op.
 */
export async function runWeeklyDisbursement(opts: {
  dryRun: boolean;
  now?: Date;
  triggeredBy: string; // 'scheduler' | admin user id
}): Promise<DisbursementRunResult> {
  const correlationId = randomUUID();
  const now = opts.now ?? new Date();
  const boundary = getFridayBoundary(now);
  const fridayDate = boundary.toISOString().slice(0, 10);

  const result: DisbursementRunResult = {
    ran: false,
    dryRun: opts.dryRun,
    fridayDate,
    totalDisbursed: 0,
    lines: [],
    correlationId,
  };

  log(correlationId, "run_start", { fridayDate, dryRun: opts.dryRun, triggeredBy: opts.triggeredBy });

  if (opts.dryRun) {
    const existing = await storage.getWeeklyDistributionByDate(boundary);
    const lines = await previewDisbursement();
    result.lines = lines;
    result.alreadyProcessed = !!existing && ["processing", "completed"].includes(existing.status);
    log(correlationId, "dry_run_complete", {
      wouldDisburse: lines.filter((l) => l.status === "would_disburse").length,
      totalEligible: lines.reduce((s, l) => (l.status === "would_disburse" ? s + l.amount : s), 0),
      alreadyProcessed: result.alreadyProcessed,
    });
    return result;
  }

  // ---- Real run gates ----
  if (!isFlagEnabled("ENABLE_WEEKLY_DISBURSEMENT")) {
    log(correlationId, "blocked_flag_off", { flag: "ENABLE_WEEKLY_DISBURSEMENT" });
    throw new Error("ENABLE_WEEKLY_DISBURSEMENT is off — real runs are not permitted");
  }
  if (!isFlagEnabled("ENABLE_REAL_TRANSFERS")) {
    log(correlationId, "blocked_flag_off", { flag: "ENABLE_REAL_TRANSFERS" });
    throw new Error("ENABLE_REAL_TRANSFERS is off — real runs are not permitted");
  }
  if (!mercuryService.isServiceConfigured()) {
    log(correlationId, "blocked_mercury_unconfigured");
    throw new Error("Mercury service is not configured");
  }

  // ---- Atomic weekly claim (unique index on distribution_date) ----
  // Exactly one run per Friday can win the INSERT; every concurrent or later
  // invocation sees `undefined` and backs off. A crashed run leaves a
  // 'processing' row; it becomes resumable after a cool-off window — safe
  // because every attempted line already has a spent-counting ledger row,
  // so a resume recomputes balances and never re-pays anyone.
  const businessAccount = await storage.getOrCreateMercuryBusinessAccount();
  let distribution = await storage.claimWeeklyDistribution({
    distributionDate: boundary,
    scheduledDate: boundary,
    totalAmount: "0.00",
    paymentCount: 0,
    businessAccountId: businessAccount.id,
    provider: "mercury",
    status: "processing",
    lastClaimedAt: new Date(),
  });

  if (!distribution) {
    const existing = await storage.getWeeklyDistributionByDate(boundary);
    if (!existing) {
      // Claim lost but row not visible yet — another run is mid-claim. Back off.
      return { ...result, alreadyProcessed: true };
    }
    // Single-winner CAS: only resumes 'failed' rows or 'processing' rows whose
    // last claim is older than the cool-off. The winner's fresh last_claimed_at
    // makes every concurrent resumer's predicate fail — no double resume.
    const RESUME_AFTER_MS = 30 * 60 * 1000;
    const resumed = await storage.resumeWeeklyDistribution(
      existing.id,
      new Date(Date.now() - RESUME_AFTER_MS),
    );
    if (!resumed) {
      log(correlationId, "already_processed", {
        distributionId: existing.id,
        status: existing.status,
      });
      return { ...result, alreadyProcessed: true };
    }
    log(correlationId, "resuming_stalled_distribution", {
      distributionId: resumed.id,
      previousStatus: existing.status,
    });
    distribution = resumed;
  }

  // Compute AFTER the claim — balances include every ledger row written by
  // any earlier (crashed) attempt, so resumed runs skip already-paid users.
  const lines = await previewDisbursement();
  result.lines = lines;
  const eligible = lines.filter((l) => l.status === "would_disburse");

  let totalDisbursed = 0;

  for (const line of eligible) {
    const debt = await storage.getDebt(line.debtId!);
    if (!debt) {
      line.status = "skipped";
      line.reason = "target_debt_missing";
      continue;
    }

    // Ledger row first — money movement is always traceable. The key is
    // deterministic per {friday,user,debt} and globally UNIQUE, so a resumed
    // run must REUSE a prior attempt's row rather than insert a new one:
    // 'failed' (definitive 4xx rejection) → reset and retry; any other
    // status → another attempt already owns this line, skip it.
    const lineCorrelationId = randomUUID();
    const idempotencyKey = `weekly-disbursement:${fridayDate}:${line.userId}:${debt.id}`;
    const priorAttempt = await storage.getTransferByIdempotencyKey(idempotencyKey);
    let ledgerEntry: typeof priorAttempt;
    if (priorAttempt) {
      if (priorAttempt.status !== "failed") {
        line.status = "skipped";
        line.reason = `prior_attempt_${priorAttempt.status}`;
        log(correlationId, "line_skipped_prior_attempt", {
          userId: line.userId,
          debtId: debt.id,
          priorStatus: priorAttempt.status,
        });
        continue;
      }
      // Reset the failed attempt in place: fresh correlation id for tracing,
      // current amount (the balance may have changed since the failure).
      ledgerEntry = await storage.updateTransferStatus(priorAttempt.id, "created", {
        errorCode: null,
        errorMessage: null,
        amount: line.amount.toFixed(2),
        correlationId: lineCorrelationId,
        rawRequest: JSON.stringify({ fridayDate, distributionId: distribution.id, retryOf: priorAttempt.id }),
      });
      if (!ledgerEntry) {
        line.status = "skipped";
        line.reason = "retry_reset_failed";
        continue;
      }
    } else {
      try {
        ledgerEntry = await storage.createTransfer({
          userId: line.userId,
          type: "debt_payment",
          amount: line.amount.toFixed(2),
          status: "created",
          debtId: debt.id,
          provider: "mercury",
          correlationId: lineCorrelationId,
          idempotencyKey,
          rawRequest: JSON.stringify({ fridayDate, distributionId: distribution.id }),
        });
      } catch (err: any) {
        // Unique-key violation = a concurrent attempt won this line. Never
        // crash the batch; skip deterministically.
        line.status = "skipped";
        line.reason = "duplicate_idempotency_key";
        log(correlationId, "line_skipped_duplicate_key", {
          userId: line.userId,
          debtId: debt.id,
          error: err?.message,
        });
        continue;
      }
    }

    const paymentRecord = await storage.createDistributionPayment({
      distributionId: distribution.id,
      userId: line.userId,
      debtId: debt.id,
      amount: line.amount.toFixed(2),
      debtAccountId: debt.payeeAccountNumber!,
      debtRoutingNumber: debt.payeeRoutingNumber!,
      transferId: ledgerEntry.id,
      status: "scheduled",
    });

    try {
      const transferResult = await mercuryService.initiateTransfer({
        amount: line.amount,
        note: `Dime Time weekly round-up payment — ${debt.name}`,
        recipientAccountNumber: debt.payeeAccountNumber!,
        recipientRoutingNumber: debt.payeeRoutingNumber!,
        recipientName: debt.name,
        paymentMethod: "ach",
        correlationId: lineCorrelationId,
      });

      await storage.updateTransferStatus(ledgerEntry.id, "pending", {
        mercuryTransferId: transferResult.id,
        rawResponse: JSON.stringify(transferResult),
      });
      await storage.updateDistributionPaymentStatus(paymentRecord.id, "completed", {
        mercuryTransferId: transferResult.id,
      });

      line.status = "completed";
      line.mercuryTransferId = transferResult.id;
      totalDisbursed += line.amount;
      log(correlationId, "line_disbursed", {
        userId: line.userId,
        debtId: debt.id,
        amount: line.amount,
        mercuryTransferId: transferResult.id,
      });
    } catch (err: any) {
      const message = err?.response?.data?.errors
        ? JSON.stringify(err.response.data.errors)
        : err?.message || "Mercury ACH failed";
      // Only a DEFINITIVE rejection (Mercury answered with 4xx) is marked
      // 'failed' — void in balance math, so the money becomes disbursable
      // again next Friday. Anything ambiguous (timeout, network error, 5xx)
      // stays 'requires_action': Mercury may have accepted the transfer, so
      // the amount keeps counting as SPENT until an admin reconciles it
      // against the Mercury dashboard. Never risk paying twice.
      const httpStatus: number | undefined = err?.response?.status;
      const definitiveRejection = typeof httpStatus === "number" && httpStatus >= 400 && httpStatus < 500;
      const ledgerStatus = definitiveRejection ? "failed" : "requires_action";
      await storage.updateTransferStatus(ledgerEntry.id, ledgerStatus, {
        errorCode: definitiveRejection ? "MERCURY_ACH_REJECTED" : "MERCURY_OUTCOME_UNKNOWN",
        errorMessage: message,
        rawResponse: JSON.stringify(err?.response?.data || {}),
      });
      await storage.updateDistributionPaymentStatus(paymentRecord.id, "failed", {
        failureReason: `${definitiveRejection ? "rejected" : "outcome_unknown"}: ${message}`,
      });
      line.status = "failed";
      line.reason = message;
      log(correlationId, "line_failed", {
        userId: line.userId,
        debtId: debt.id,
        error: message,
        httpStatus: httpStatus ?? null,
        ledgerStatus,
      });
      // Continue with remaining users — one failure never blocks the batch.
    }
  }

  const anyFailed = eligible.some((l) => l.status === "failed");
  await storage.updateWeeklyDistribution(distribution.id, {
    status: anyFailed ? "failed" : "completed",
    totalAmount: totalDisbursed.toFixed(2),
    paymentCount: eligible.length,
    completedDate: new Date(),
  });

  result.ran = true;
  result.totalDisbursed = Math.round(totalDisbursed * 100) / 100;
  log(correlationId, "run_complete", {
    fridayDate,
    totalDisbursed: result.totalDisbursed,
    completed: eligible.filter((l) => l.status === "completed").length,
    failed: eligible.filter((l) => l.status === "failed").length,
    skipped: lines.filter((l) => l.status === "skipped").length,
  });
  return result;
}

/**
 * Scheduler tick: run the real disbursement if Friday 00:00 ET has passed
 * and this week's run hasn't happened. Catch-up semantics — if the server
 * was asleep at midnight, the first tick afterwards disburses.
 */
export async function schedulerTick(now: Date = new Date()): Promise<void> {
  if (!isFlagEnabled("ENABLE_WEEKLY_DISBURSEMENT")) return;
  try {
    const boundary = getFridayBoundary(now);
    // Cheap short-circuit for the common case only. 'processing' is NOT
    // short-circuited here — runWeeklyDisbursement owns all claim/resume
    // gating, so a crashed run gets picked up after the cool-off window.
    const existing = await storage.getWeeklyDistributionByDate(boundary);
    if (existing && existing.status === "completed") return;
    await runWeeklyDisbursement({ dryRun: false, now, triggeredBy: "scheduler" });
  } catch (err: any) {
    console.error("Weekly disbursement scheduler tick failed:", err?.message || err);
  }
}

const TICK_INTERVAL_MS = 15 * 60 * 1000;

export function startWeeklyDisbursementScheduler(): void {
  if (!isFlagEnabled("ENABLE_WEEKLY_DISBURSEMENT")) {
    console.log("Weekly disbursement scheduler NOT started (ENABLE_WEEKLY_DISBURSEMENT off)");
    return;
  }
  console.log("Weekly disbursement scheduler started (15-minute tick, Friday 00:00 ET boundary)");
  // First check shortly after boot (catch-up), then every 15 minutes.
  setTimeout(() => void schedulerTick(), 30 * 1000);
  setInterval(() => void schedulerTick(), TICK_INTERVAL_MS).unref?.();
}
