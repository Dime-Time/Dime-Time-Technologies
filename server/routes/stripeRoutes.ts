/**
 * Stripe ACH routes (BETA — gated by `ENABLE_STRIPE_ACH`).
 *
 * These routes are only mounted when the flag is ON (see server/routes.ts).
 * They follow the same operational contract as `mercuryRoutes.ts`:
 *   - Auth-gated via `getUserIdFromRequest`
 *   - `Idempotency-Key` header required on money-movement endpoints, with
 *     the request/response cached in `idempotency_keys` AND forwarded to
 *     Stripe so a retry never double-charges.
 *   - Every transfer is written to the `transfers` ledger.
 *   - Structured JSON logs carry a `correlationId` that is also tagged on
 *     the Sentry isolation scope.
 *   - Webhook is signature-verified via Stripe SDK and deduped by event id.
 */

import type { Express, Request, Response } from "express";
import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { randomUUID } from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { getUserIdFromRequest } from "../middleware/authHelper";
import { setCorrelationTag } from "../lib/sentry";
import { isFlagEnabled } from "../lib/flags";
import { ACH_AUTHORIZATION_TEXT, ACH_AUTHORIZATION_VERSION } from "@shared/achAuthorization";
import {
  attachFcAccountAsPaymentMethod,
  createAchDebit,
  createFinancialConnectionsSession,
  isStripeAchEnabled,
  resolveStripeSecretKey,
  verifyStripeWebhook,
} from "../services/stripeService";

const MAX_DEBT_PAYMENT_DOLLARS = 500;

// Conservative real-money rollout limits. Enforced INSIDE the transactional
// gate (storage.reserveRealStripeAchDebit) so they hold even under concurrent
// retries. These cap blast radius even after ENABLE_REAL_TRANSFERS is flipped
// on for an allowlisted user.
const REAL_FIRST_TRANSFER_MAX_DOLLARS = 1.0;
const REAL_DAILY_TOTAL_MAX_DOLLARS = 5.0;
const REAL_DAILY_COUNT_MAX = 1;

const exchangeSchema = z.object({
  fcAccountId: z.string().min(3),
  customerId: z.string().min(3),
});

const debitSchema = z.object({
  stripeAccountId: z.string().min(1),
  amount: z.number().positive().max(MAX_DEBT_PAYMENT_DOLLARS),
  debtId: z.string().min(1).optional(),
  descriptor: z.string().max(22).optional(),
});

/**
 * Best-effort real client IP. `trust proxy` is set (server/replitAuth.ts) so
 * `req.ip` already reflects the X-Forwarded-For client behind Replit's proxy;
 * the fallbacks cover odd deployment topologies.
 */
function clientIp(req: Request): string {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return req.ip || fwd || req.socket?.remoteAddress || "unknown";
}

function stripeLog(correlationId: string, event: string, data?: Record<string, unknown>): void {
  setCorrelationTag(correlationId);
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    service: "StripeRoutes",
    correlationId,
    event,
    ...data,
  }));
}

/**
 * Atomic reservation. Returns true if the caller should STOP — either we
 * served a cached response, or a concurrent retry is mid-flight (409).
 * Returns false only when the caller has exclusively claimed the slot
 * and is responsible for calling `finalizeIdempotency` (or
 * `releaseIdempotencyKey` on early validation failures before any side
 * effect).
 */
async function reserveIdempotency(
  key: string,
  userId: string,
  endpoint: string,
  correlationId: string,
  res: Response,
): Promise<boolean> {
  const result = await storage.reserveIdempotencyKey(key, userId, endpoint);
  if (result.claimed) return false;
  if ((result as any).inFlight) {
    stripeLog(correlationId, "idempotency_in_flight", { endpoint, idempotencyKey: key, severity: "WARN" });
    res.status(409).json({
      message: "A request with this Idempotency-Key is already being processed. Retry shortly.",
      correlationId,
    });
    return true;
  }
  const cached = (result as any).cached as { status: number; body: string };
  stripeLog(correlationId, "idempotency_hit", { endpoint, idempotencyKey: key });
  let parsed: any = {};
  try { parsed = cached.body ? JSON.parse(cached.body) : {}; } catch { parsed = { raw: cached.body }; }
  res.status(cached.status).json({ ...parsed, _idempotencyReplay: true });
  return true;
}

async function finalizeIdempotency(
  key: string,
  userId: string,
  endpoint: string,
  status: number,
  body: object,
): Promise<void> {
  await storage.finalizeIdempotencyKey(key, userId, endpoint, status, JSON.stringify(body));
}

// Per-user + IP rate limit for the Financial Connections session endpoint.
// Each session call creates / reuses a Stripe Customer and opens a session
// against Stripe's API, so unthrottled invocation is both an upstream-cost
// risk and a credential-probing risk. Keyed on the authenticated userId
// when present (falls back to IP) so a logged-in client can't bypass the
// limit by rotating cookies.
const fcSessionLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = getUserIdFromRequest(req);
    return uid ? `u:${uid}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
  message: { message: "Too many Stripe Connect attempts. Try again in a minute." },
});

export function registerStripeRoutes(app: Express): void {
  app.get("/api/stripe/status", async (req: Request, res: Response) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const accounts = await storage.getStripeAccountsByUserId(userId);
    return res.json({
      configured: isStripeAchEnabled(),
      accounts: accounts.map((a) => ({
        id: a.id,
        institutionName: a.institutionName,
        last4: a.last4,
        status: a.status,
        isActive: a.isActive,
        createdAt: a.createdAt,
      })),
    });
  });

  // Begin Financial Connections — returns a client_secret the browser feeds
  // into Stripe.js to render the connect modal.
  app.post("/api/stripe/financial-connections/session", fcSessionLimiter, async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!isStripeAchEnabled()) {
        return res.status(503).json({ message: "Stripe ACH is not enabled" });
      }

      const user = await storage.getUser(userId);
      const existing = await storage.getStripeAccountsByUserId(userId);
      const existingCustomerId = existing[0]?.stripeCustomerId ?? null;

      stripeLog(correlationId, "fc_session_start", { userId, hasCustomer: !!existingCustomerId });

      const session = await createFinancialConnectionsSession({
        userEmail: user?.email ?? null,
        userId,
        existingCustomerId,
      });

      stripeLog(correlationId, "fc_session_created", { sessionId: session.sessionId });
      return res.json({
        clientSecret: session.clientSecret,
        sessionId: session.sessionId,
        customerId: session.customerId,
        correlationId,
      });
    } catch (err: any) {
      stripeLog(correlationId, "fc_session_failed", {
        severity: "ERROR",
        error: err?.message,
      });
      return res.status(502).json({
        message: "Failed to start Stripe Financial Connections session",
        correlationId,
      });
    }
  });

  // Exchange the FC account id for a PaymentMethod we can debit, and
  // persist the encrypted reference.
  app.post("/api/stripe/financial-connections/exchange", async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!isStripeAchEnabled()) {
        return res.status(503).json({ message: "Stripe ACH is not enabled" });
      }

      const { fcAccountId, customerId } = exchangeSchema.parse(req.body);

      stripeLog(correlationId, "fc_exchange_start", { userId, fcAccountId });

      const { paymentMethodId, last4, institutionName } = await attachFcAccountAsPaymentMethod({
        fcAccountId,
        customerId,
      });

      const saved = await storage.createStripeAccount({
        userId,
        stripeCustomerId: customerId,
        stripeFcAccountId: fcAccountId,
        paymentMethodIdPlaintext: paymentMethodId,
        institutionName,
        last4,
      });

      stripeLog(correlationId, "fc_exchange_success", {
        stripeAccountId: saved.id,
        institutionName,
      });

      return res.status(201).json({
        success: true,
        stripeAccountId: saved.id,
        institutionName,
        last4,
        correlationId,
      });
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      stripeLog(correlationId, "fc_exchange_failed", {
        severity: "ERROR",
        error: err?.message,
      });
      return res.status(502).json({
        message: "Failed to link Stripe bank account",
        correlationId,
      });
    }
  });

  // Record the user's explicit ACH debit authorization (Nacha "online"
  // mandate consent). Captures the REAL client IP + User-Agent at the moment
  // of consent and the exact wording version. The most recent row feeds
  // `mandate_data.customer_acceptance.online` on every subsequent debit.
  app.post("/api/stripe/ach/authorize", async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!isStripeAchEnabled()) {
        return res.status(503).json({ message: "Stripe ACH is not enabled" });
      }

      const ipAddress = clientIp(req);
      const userAgent = (req.headers["user-agent"] as string | undefined)?.slice(0, 1024) || "unknown";

      const auth = await storage.createAchAuthorization({
        userId,
        version: ACH_AUTHORIZATION_VERSION,
        text: ACH_AUTHORIZATION_TEXT,
        ipAddress,
        userAgent,
      });

      stripeLog(correlationId, "ach_authorization_recorded", {
        userId,
        authorizationId: auth.id,
        version: auth.version,
      });

      return res.status(201).json({
        success: true,
        authorizationId: auth.id,
        version: auth.version,
        authorizedAt: auth.createdAt,
        correlationId,
      });
    } catch (err: any) {
      stripeLog(correlationId, "ach_authorization_failed", {
        severity: "ERROR",
        error: err?.message,
      });
      return res.status(500).json({ message: "Failed to record ACH authorization", correlationId });
    }
  });

  // ACH debit against a saved Stripe PaymentMethod. Writes to the transfers
  // ledger before calling Stripe; updates ledger on response.
  app.post("/api/stripe/ach/debit", async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    const endpoint = "/api/stripe/ach/debit";

    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!isStripeAchEnabled()) {
        return res.status(503).json({ message: "Stripe ACH is not enabled" });
      }
      if (!idempotencyKey) {
        return res.status(400).json({
          message: "Idempotency-Key header is required for money-movement endpoints",
        });
      }
      // Atomic claim FIRST — this is the single race-free gate. A
      // duplicate retry either returns the cached response or 409s,
      // never falls through to createTransfer.
      if (await reserveIdempotency(idempotencyKey, userId, endpoint, correlationId, res)) return;

      // From this point on, any early return MUST either finalize (so the
      // cached response is replayable) or release the reservation (so the
      // client can legitimately retry after fixing input).
      let validatedInput: z.infer<typeof debitSchema>;
      try {
        validatedInput = debitSchema.parse(req.body);
      } catch (e) {
        await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
        throw e;
      }
      const { stripeAccountId, amount, debtId, descriptor } = validatedInput;

      const stripeAccount = await storage.getStripeAccountById(stripeAccountId);
      if (!stripeAccount || stripeAccount.userId !== userId) {
        const body = { message: "Stripe account not found" };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 404, body);
        return res.status(404).json(body);
      }

      const paymentMethodId = await storage.getStripePaymentMethodId(stripeAccountId);
      if (!paymentMethodId) {
        const body = {
          message: "Stripe account is missing payment method credentials. Please re-link.",
        };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 422, body);
        return res.status(422).json(body);
      }

      // PRIORITY 1 — real-money kill switch. When ENABLE_REAL_TRANSFERS is
      // OFF we never create a PaymentIntent and never move money; we record a
      // `simulated` ledger row and return a simulated success so the rest of
      // the flow (UI, idempotency, ledger) can be exercised safely.
      const realTransfers = isFlagEnabled("ENABLE_REAL_TRANSFERS");
      const stripeMode = resolveStripeSecretKey().mode;

      // ---- SIMULATION PATH (default / public) ----
      // Simulate unless BOTH the master flag is ON *and* the resolved Stripe key
      // is a LIVE key. A test/sandbox key (or no key at all) can never reach
      // Stripe's real-money path — a live key is a required second factor for any
      // real charge. No allowlist needed here — nothing moves.
      if (!realTransfers || stripeMode !== "live") {
        const ledger = await storage.createTransfer({
          userId,
          type: debtId ? "debt_payment" : "stripe_ach_debit",
          amount: amount.toFixed(2),
          status: "simulated",
          provider: "stripe",
          debtId: debtId || null,
          correlationId,
          idempotencyKey,
          rawRequest: JSON.stringify({ stripeAccountId, amount, debtId, simulated: true }),
        });
        console.log("[SIMULATION MODE] ACH transfer simulated (real transfers off or non-live Stripe key)");
        stripeLog(correlationId, "ach_debit_simulated", {
          severity: "WARN",
          ledgerId: ledger.id,
          stripeAccountId,
          amount,
          realTransfers,
          stripeMode,
          message: "[SIMULATION MODE] ACH transfer simulated (real transfers off or non-live Stripe key)",
        });
        const body = {
          success: true,
          simulated: true,
          ledgerId: ledger.id,
          status: "simulated",
          correlationId,
        };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 201, body);
        return res.status(201).json(body);
      }

      // ---- REAL-MONEY PATH (allowlisted users only) ----
      // PRIORITY 2 — a REAL debit requires Nacha mandate evidence on file.
      // Fail closed if the user never authorized ACH (no fabricated IP/UA).
      const latest = await storage.getLatestAchAuthorization(userId);
      if (!latest) {
        const body = {
          message: "ACH authorization required before debiting. Please authorize ACH in the app.",
        };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 422, body);
        return res.status(422).json(body);
      }
      const mandate = { ipAddress: latest.ipAddress, userAgent: latest.userAgent };

      const environment = process.env.NODE_ENV === "production" ? "production" : "development";

      // PRIORITY 3 — the transactional rollout GATE. Re-reads the allowlist,
      // account, debt, and prior-transfer state under a per-user advisory lock,
      // enforces the conservative launch limits, writes an audit row for the
      // decision, and only on success commits a `created` ledger row. A
      // non-allowlisted user is rejected HERE — Stripe is never called.
      const gate = await storage.reserveRealStripeAchDebit({
        userId,
        stripeAccountId,
        amount,
        debtId: debtId || null,
        idempotencyKey,
        correlationId,
        stripeMode,
        environment,
        limits: {
          firstTransferMaxDollars: REAL_FIRST_TRANSFER_MAX_DOLLARS,
          dailyTotalMaxDollars: REAL_DAILY_TOTAL_MAX_DOLLARS,
          dailyCountMax: REAL_DAILY_COUNT_MAX,
        },
      });

      if (!gate.ok) {
        stripeLog(correlationId, "ach_debit_blocked", {
          severity: "WARN",
          reason: gate.reason,
          auditId: gate.auditId,
          stripeAccountId,
          amount,
        });
        const body = { message: gate.message, reason: gate.reason, correlationId };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, gate.httpStatus, body);
        return res.status(gate.httpStatus).json(body);
      }

      const ledger = gate.ledger;

      stripeLog(correlationId, "ach_debit_start", {
        ledgerId: ledger.id,
        stripeAccountId,
        amount,
        isFirstRealTransfer: gate.isFirst,
      });

      try {
        const intent = await createAchDebit({
          amountCents: Math.round(amount * 100),
          customerId: stripeAccount.stripeCustomerId,
          paymentMethodId,
          idempotencyKey,
          mandateIpAddress: mandate.ipAddress,
          mandateUserAgent: mandate.userAgent,
          descriptor,
          metadata: {
            dimeTimeUserId: userId,
            dimeTimeLedgerId: ledger.id,
            dimeTimeCorrelationId: correlationId,
            ...(debtId ? { dimeTimeDebtId: debtId } : {}),
          },
        });

        await storage.updateTransferStatus(ledger.id, intent.status, {
          stripePaymentIntentId: intent.id,
          stripeChargeId: intent.chargeId || undefined,
          rawResponse: JSON.stringify(intent),
        });

        // Money-audit: the real debit was successfully handed to Stripe.
        try {
          await storage.createRealTransferAuditLog({
            userId,
            action: "ach_debit_outcome",
            result: "initiated",
            reason: intent.status,
            amount: amount.toFixed(2),
            debtId: debtId || null,
            stripeAccountId,
            stripePaymentIntentId: intent.id,
            transferId: ledger.id,
            stripeMode,
            environment,
            allowlistEnabled: true,
            idempotencyKey,
            correlationId,
          });
        } catch (auditErr: any) {
          stripeLog(correlationId, "audit_write_failed", { severity: "ERROR", error: auditErr?.message });
        }

        stripeLog(correlationId, "ach_debit_initiated", {
          ledgerId: ledger.id,
          paymentIntentId: intent.id,
          stripeStatus: intent.status,
        });

        const body = {
          success: true,
          ledgerId: ledger.id,
          paymentIntentId: intent.id,
          status: intent.status,
          correlationId,
        };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 201, body);
        return res.status(201).json(body);
      } catch (stripeErr: any) {
        const errCode = stripeErr?.code || stripeErr?.type || "stripe_error";
        await storage.updateTransferStatus(ledger.id, "failed", {
          errorCode: errCode,
          errorMessage: stripeErr?.message || "Stripe ACH debit failed",
          rawResponse: JSON.stringify(stripeErr?.raw || {}),
        });
        try {
          await storage.createRealTransferAuditLog({
            userId,
            action: "ach_debit_outcome",
            result: "failed",
            reason: errCode,
            amount: amount.toFixed(2),
            debtId: debtId || null,
            stripeAccountId,
            transferId: ledger.id,
            stripeMode,
            environment,
            allowlistEnabled: true,
            idempotencyKey,
            correlationId,
          });
        } catch (auditErr: any) {
          stripeLog(correlationId, "audit_write_failed", { severity: "ERROR", error: auditErr?.message });
        }
        stripeLog(correlationId, "ach_debit_failed", {
          severity: "ERROR",
          ledgerId: ledger.id,
          errCode,
        });
        const failBody = {
          message: "Stripe ACH debit could not be initiated",
          code: errCode,
          correlationId,
        };
        // Finalize with 502 so a client retry with the same Idempotency-Key
        // gets the SAME failure response back (and never creates a second
        // ledger row). Operator can issue a fresh key to genuinely retry.
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 502, failBody);
        return res.status(502).json(failBody);
      }
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        // The Zod path already released the reservation before re-throwing.
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      // Unexpected (likely transient, e.g. DB) failure AFTER the slot was
      // reserved but BEFORE we finalized a deterministic response. Release the
      // reservation so the same Idempotency-Key can legitimately retry rather
      // than being stranded in-flight and 409ing forever.
      const cleanupUserId = getUserIdFromRequest(req);
      if (idempotencyKey && cleanupUserId) {
        try {
          await storage.releaseIdempotencyKey(idempotencyKey, cleanupUserId, endpoint);
        } catch (releaseErr: any) {
          stripeLog(correlationId, "idempotency_release_failed", {
            severity: "ERROR",
            error: releaseErr?.message,
          });
        }
      }
      stripeLog(correlationId, "ach_debit_unexpected_error", {
        severity: "ERROR",
        error: err?.message,
      });
      return res.status(500).json({ message: "Internal error", correlationId });
    }
  });
}

/**
 * Webhook mounted separately so we can install `express.raw` ONLY on this
 * path — Stripe's signature is computed over the raw request body, so
 * `express.json` must not have parsed it first.
 */
export function registerStripeWebhook(app: Express): void {
  app.post(
    "/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req: Request, res: Response) => {
      const correlationId = randomUUID();
      const signature = req.headers["stripe-signature"] as string | undefined;
      let event: any;
      try {
        event = await verifyStripeWebhook(req.body as Buffer, signature);
      } catch (err: any) {
        stripeLog(correlationId, "webhook_signature_failed", {
          severity: "WARN",
          error: err?.message,
        });
        return res.status(400).send(`Webhook signature verification failed: ${err?.message}`);
      }

      // Atomic dedup by event.id — Stripe is at-least-once. The insert
      // returns true only on the first delivery; duplicates short-circuit
      // here so the downstream ledger update never runs twice.
      const claimed = await storage.recordStripeWebhookEvent(event.id, event.type);
      if (!claimed) {
        stripeLog(correlationId, "webhook_duplicate", { eventId: event.id, type: event.type });
        return res.status(200).json({ received: true, duplicate: true });
      }

      stripeLog(correlationId, "webhook_received", { eventId: event.id, type: event.type });

      try {
        if (
          event.type === "payment_intent.succeeded" ||
          event.type === "payment_intent.processing" ||
          event.type === "payment_intent.payment_failed" ||
          event.type === "payment_intent.canceled" ||
          event.type === "payment_intent.requires_action"
        ) {
          const pi = event.data.object;
          const ledger = await storage.getTransferByStripePaymentIntentId(pi.id);
          if (!ledger) {
            stripeLog(correlationId, "webhook_ledger_miss", {
              severity: "WARN",
              paymentIntentId: pi.id,
            });
          } else {
            const newStatus =
              event.type === "payment_intent.succeeded"
                ? "settled"
                : event.type === "payment_intent.payment_failed"
                  ? "failed"
                  : event.type === "payment_intent.canceled"
                    ? "cancelled"
                    : event.type === "payment_intent.requires_action"
                      ? "requires_action"
                      : "processing";

            if (ledger.status !== newStatus) {
              await storage.updateTransferStatus(ledger.id, newStatus, {
                stripeChargeId: (pi.latest_charge as string) || undefined,
                errorCode: pi.last_payment_error?.code,
                errorMessage: pi.last_payment_error?.message,
                rawResponse: JSON.stringify({ eventId: event.id, type: event.type, status: pi.status }),
              });
              stripeLog(correlationId, "ledger_updated", {
                ledgerId: ledger.id,
                previousStatus: ledger.status,
                newStatus,
              });
            }
          }
        } else if (event.type === "charge.refunded") {
          // ACH debit was refunded/reversed — the money is no longer ours.
          // Look the ledger up by the PaymentIntent the charge belongs to.
          const charge = event.data.object;
          // Prefer the PaymentIntent (our canonical key) but fall back to the
          // charge id so refunds on rows that only ever recorded a charge id
          // (or where the PI lookup misses) are still reconciled.
          let ledger = charge.payment_intent
            ? await storage.getTransferByStripePaymentIntentId(charge.payment_intent as string)
            : undefined;
          if (!ledger && charge.id) {
            ledger = await storage.getTransferByStripeChargeId(charge.id as string);
          }
          if (!ledger) {
            stripeLog(correlationId, "webhook_ledger_miss", {
              severity: "WARN",
              chargeId: charge.id,
              paymentIntentId: charge.payment_intent,
            });
          } else if (ledger.status !== "refunded") {
            await storage.updateTransferStatus(ledger.id, "refunded", {
              stripeChargeId: charge.id as string,
              rawResponse: JSON.stringify({ eventId: event.id, type: event.type, amountRefunded: charge.amount_refunded }),
            });
            stripeLog(correlationId, "ledger_updated", {
              ledgerId: ledger.id,
              previousStatus: ledger.status,
              newStatus: "refunded",
            });
          }
        } else if (event.type === "charge.failed") {
          // ACH debit failed, or a late ACH return after the charge was
          // created. Map to terminal `failed` so the user sees funds were NOT
          // collected and retained.
          const charge = event.data.object;
          let ledger = charge.payment_intent
            ? await storage.getTransferByStripePaymentIntentId(charge.payment_intent as string)
            : undefined;
          if (!ledger && charge.id) {
            ledger = await storage.getTransferByStripeChargeId(charge.id as string);
          }
          if (!ledger) {
            stripeLog(correlationId, "webhook_ledger_miss", {
              severity: "WARN",
              chargeId: charge.id,
              paymentIntentId: charge.payment_intent,
            });
          } else if (ledger.status !== "failed") {
            await storage.updateTransferStatus(ledger.id, "failed", {
              stripeChargeId: charge.id as string,
              errorCode: charge.failure_code || "charge_failed",
              errorMessage: charge.failure_message || "ACH charge failed",
              rawResponse: JSON.stringify({ eventId: event.id, type: event.type, failureCode: charge.failure_code }),
            });
            stripeLog(correlationId, "ledger_updated", {
              ledgerId: ledger.id,
              previousStatus: ledger.status,
              newStatus: "failed",
            });
          }
        } else if (event.type === "charge.dispute.created") {
          // ACH return/dispute (e.g. R10 unauthorized). Flag for operator
          // follow-up — collapses to `requires_action` in the status mapper.
          const dispute = event.data.object;
          const ledger = await storage.getTransferByStripeChargeId(dispute.charge as string);
          if (!ledger) {
            stripeLog(correlationId, "webhook_ledger_miss", {
              severity: "WARN",
              chargeId: dispute.charge,
              disputeId: dispute.id,
            });
          } else if (ledger.status !== "disputed") {
            await storage.updateTransferStatus(ledger.id, "disputed", {
              stripeChargeId: dispute.charge as string,
              errorCode: dispute.reason,
              errorMessage: `ACH dispute: ${dispute.reason}`,
              rawResponse: JSON.stringify({ eventId: event.id, type: event.type, disputeId: dispute.id, status: dispute.status }),
            });
            stripeLog(correlationId, "ledger_updated", {
              ledgerId: ledger.id,
              previousStatus: ledger.status,
              newStatus: "disputed",
            });
          }
        } else if (event.type === "charge.dispute.closed") {
          // Dispute resolved. Stripe closes a dispute as won / lost /
          // warning_closed. Won => our charge stands and the funds are
          // retained (revert the row to settled). Lost => the funds were
          // pulled back to the customer, so the money is no longer ours
          // (treat as refunded/reversed). Any other close state leaves the
          // row flagged for operator follow-up.
          const dispute = event.data.object;
          const outcome = dispute.status as string | undefined;
          const resolvedStatus =
            outcome === "won" ? "settled" : outcome === "lost" ? "refunded" : null;
          const ledger = await storage.getTransferByStripeChargeId(dispute.charge as string);
          if (!ledger) {
            stripeLog(correlationId, "webhook_ledger_miss", {
              severity: "WARN",
              chargeId: dispute.charge,
              disputeId: dispute.id,
            });
          } else if (resolvedStatus && ledger.status !== resolvedStatus) {
            await storage.updateTransferStatus(ledger.id, resolvedStatus, {
              stripeChargeId: dispute.charge as string,
              errorCode: dispute.reason,
              errorMessage: `ACH dispute closed: ${outcome}`,
              rawResponse: JSON.stringify({ eventId: event.id, type: event.type, disputeId: dispute.id, status: dispute.status }),
            });
            stripeLog(correlationId, "ledger_updated", {
              ledgerId: ledger.id,
              previousStatus: ledger.status,
              newStatus: resolvedStatus,
            });
          } else {
            stripeLog(correlationId, "webhook_noop_acknowledged", {
              eventId: event.id,
              type: event.type,
              disputeStatus: outcome,
            });
          }
        } else if (
          event.type === "setup_intent.succeeded" ||
          event.type === "payment_method.attached"
        ) {
          // No ledger row to mutate — these confirm bank linkage. Log for
          // operational visibility / correlation only.
          stripeLog(correlationId, "webhook_noop_acknowledged", {
            eventId: event.id,
            type: event.type,
            objectId: event.data.object?.id,
          });
        } else {
          stripeLog(correlationId, "webhook_unhandled", { eventId: event.id, type: event.type });
        }
        return res.status(200).json({ received: true });
      } catch (err: any) {
        stripeLog(correlationId, "webhook_processing_error", {
          severity: "ERROR",
          eventId: event.id,
          error: err?.message,
        });
        // Return 200 anyway so Stripe doesn't retry forever for our bugs —
        // the event is already recorded for replay via the dashboard.
        return res.status(200).json({ received: true, error: true });
      }
    },
  );
}
