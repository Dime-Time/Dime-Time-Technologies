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
import { randomUUID } from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { getUserIdFromRequest } from "../middleware/authHelper";
import { setCorrelationTag } from "../lib/sentry";
import {
  attachFcAccountAsPaymentMethod,
  createAchDebit,
  createFinancialConnectionsSession,
  isStripeAchEnabled,
  verifyStripeWebhook,
} from "../services/stripeService";

const MAX_DEBT_PAYMENT_DOLLARS = 500;

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
  app.post("/api/stripe/financial-connections/session", async (req: Request, res: Response) => {
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

      const ledger = await storage.createTransfer({
        userId,
        type: debtId ? "debt_payment" : "stripe_ach_debit",
        amount: amount.toFixed(2),
        status: "created",
        provider: "stripe",
        debtId: debtId || null,
        correlationId,
        idempotencyKey,
        rawRequest: JSON.stringify({ stripeAccountId, amount, debtId }),
      });

      stripeLog(correlationId, "ach_debit_start", {
        ledgerId: ledger.id,
        stripeAccountId,
        amount,
      });

      try {
        const intent = await createAchDebit({
          amountCents: Math.round(amount * 100),
          customerId: stripeAccount.stripeCustomerId,
          paymentMethodId,
          idempotencyKey,
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
        return res.status(400).json({ message: "Validation error", errors: err.errors });
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
