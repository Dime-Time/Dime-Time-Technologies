/**
 * Subscription routes (gated by `ENABLE_SUBSCRIPTIONS`).
 *
 * Only mounted when the flag is ON (see server/routes.ts) — the boot assert
 * there also guarantees ENABLE_STRIPE_ACH is on, so the Stripe client and
 * the user's linked bank account (stripe_accounts) are available.
 *
 * Operational contract (mirrors stripeRoutes.ts):
 *   - Auth-gated via `getUserIdFromRequest`
 *   - `Idempotency-Key` header required on /subscribe (money-creating), with
 *     the reservation cached in `idempotency_keys` AND the key forwarded to
 *     Stripe so a retry never double-subscribes.
 *   - Consent (ToS + recurring ACH mandate acceptance) is written to
 *     `subscription_consents` BEFORE any Stripe write; the mandate evidence
 *     (IP + user agent) comes from that row.
 *   - Structured JSON logs carry a `correlationId`.
 */

import type { Express, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { randomUUID } from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { getUserIdFromRequest } from "../middleware/authHelper";
import { setCorrelationTag } from "../lib/sentry";
import {
  PLAN_CATALOG,
  DEFAULT_PLAN_ID,
  evaluateEntitlement,
  isSubscriptionTerminal,
} from "@shared/subscriptionPlans";
import {
  SUBSCRIPTION_CONSENT_TEXT,
  SUBSCRIPTION_CONSENT_VERSION,
} from "@shared/subscriptionAuthorization";
import { isStripeAchEnabled } from "../services/stripeService";
import {
  ensurePlanPrice,
  createRecurringAchMandate,
  createPlanSubscription,
  setCancelAtPeriodEnd,
  buildSubscriptionRow,
  retrieveStripeSubscription,
  authoritativeEventAt,
} from "../services/subscriptionService";
import { provisionalAchWindowDays, pastDueGraceDays } from "../lib/entitlementWindows";

function entitlementWindows() {
  return { provisionalDays: provisionalAchWindowDays(), graceDays: pastDueGraceDays() };
}

const subscribeSchema = z.object({
  // Explicit re-statement that the user checked the consent box. The
  // authoritative evidence row is written server-side with server-observed
  // IP/UA — the client can't forge those.
  consentAccepted: z.literal(true),
  // Optional: pick a specific linked bank account; defaults to the first
  // active linked one.
  stripeAccountId: z.string().min(1).optional(),
});

function clientIp(req: Request): string {
  const fwd = (req.headers["x-forwarded-for"] as string | undefined)?.split(",")[0]?.trim();
  return req.ip || fwd || req.socket?.remoteAddress || "unknown";
}

function subLog(correlationId: string, event: string, data?: Record<string, unknown>): void {
  setCorrelationTag(correlationId);
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    service: "SubscriptionRoutes",
    correlationId,
    event,
    ...data,
  }));
}

// Subscribe creates Stripe customers/mandates/subscriptions — throttle like
// the FC session endpoint (per-user, IP fallback).
const subscribeLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = getUserIdFromRequest(req);
    return uid ? `u:${uid}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
  message: { message: "Too many subscription attempts. Try again in a minute." },
});

export function registerSubscriptionRoutes(app: Express): void {
  // Current subscription state + everything the client needs to render the
  // subscribe screen (plan copy, price, consent text, linked-bank presence).
  app.get("/api/subscription", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const [subscription, accounts] = await Promise.all([
        storage.getLatestSubscriptionByUserId(userId),
        storage.getStripeAccountsByUserId(userId),
      ]);
      const linkedAccounts = accounts.filter((a) => a.isActive && a.status === "linked");
      const entitlement = evaluateEntitlement(subscription ?? null);
      if (entitlement.unexpected) {
        subLog(randomUUID(), "unexpected_entitlement_state", {
          severity: "WARN", userId, reason: entitlement.reason, status: subscription?.status,
        });
      }

      return res.json({
        plan: PLAN_CATALOG[DEFAULT_PLAN_ID],
        subscription: subscription ?? null,
        entitled: entitlement.entitled,
        entitlementState: entitlement.state,
        bankLinked: linkedAccounts.length > 0,
        bankAccounts: linkedAccounts.map((a) => ({
          id: a.id,
          institutionName: a.institutionName,
          last4: a.last4,
        })),
        consent: {
          text: SUBSCRIPTION_CONSENT_TEXT,
          version: SUBSCRIPTION_CONSENT_VERSION,
        },
      });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });

  // Subscribe: consent row → price → mandate → subscription → local upsert.
  app.post("/api/subscription/subscribe", subscribeLimiter, async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    if (!isStripeAchEnabled()) {
      return res.status(503).json({ message: "Billing is not available right now" });
    }

    const idempotencyKey = req.headers["idempotency-key"] as string | undefined;
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      return res.status(400).json({
        message: "Idempotency-Key header (8-128 chars) is required",
        correlationId,
      });
    }

    const endpoint = "/api/subscription/subscribe";
    const reservation = await storage.reserveIdempotencyKey(idempotencyKey, userId, endpoint);
    if (!reservation.claimed) {
      if ((reservation as any).inFlight) {
        subLog(correlationId, "idempotency_in_flight", { endpoint, idempotencyKey, severity: "WARN" });
        return res.status(409).json({
          message: "A request with this Idempotency-Key is already being processed. Retry shortly.",
          correlationId,
        });
      }
      const cached = (reservation as any).cached as { status: number; body: string };
      subLog(correlationId, "idempotency_hit", { endpoint, idempotencyKey });
      let parsed: any = {};
      try { parsed = cached.body ? JSON.parse(cached.body) : {}; } catch { parsed = { raw: cached.body }; }
      return res.status(cached.status).json({ ...parsed, _idempotencyReplay: true });
    }

    // Per-user lock: two concurrent requests with DIFFERENT Idempotency-Keys
    // (two tabs/devices) would otherwise both pass the duplicate-subscription
    // check below during the multi-second Stripe round-trip and create two
    // live subscriptions. Held for the whole critical section, always
    // released (stale locks self-expire after 2 minutes on crash).
    const lockAcquired = await storage.acquireSubscribeLock(userId);
    if (!lockAcquired) {
      await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
      subLog(correlationId, "subscribe_lock_busy", { userId, severity: "WARN" });
      return res.status(409).json({
        message: "A subscription request is already in progress. Retry shortly.",
        code: "subscribe_in_progress",
        correlationId,
      });
    }

    // We own the slot from here. Validation failures BEFORE side effects
    // release the key; anything after the consent write finalizes it.
    try {
      const parsedBody = subscribeSchema.safeParse(req.body);
      if (!parsedBody.success) {
        await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
        return res.status(400).json({
          message: "You must accept the subscription authorization to subscribe.",
          correlationId,
        });
      }

      // Duplicate-subscription guard (local ledger; webhook keeps it fresh).
      const existing = await storage.getLatestSubscriptionByUserId(userId);
      if (existing && !isSubscriptionTerminal(existing.status)) {
        await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
        return res.status(409).json({
          message: "You already have a subscription.",
          code: "already_subscribed",
          correlationId,
        });
      }

      // Linked bank account with a debitable PaymentMethod is required.
      const accounts = await storage.getStripeAccountsByUserId(userId);
      const account = parsedBody.data.stripeAccountId
        ? accounts.find((a) => a.id === parsedBody.data.stripeAccountId)
        : accounts.find((a) => a.isActive && a.status === "linked");
      if (!account || !account.isActive || account.status !== "linked") {
        await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
        return res.status(400).json({
          message: "Link a bank account before subscribing.",
          code: "bank_account_required",
          correlationId,
        });
      }
      const paymentMethodId = await storage.getStripePaymentMethodId(account.id);
      if (!paymentMethodId) {
        await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
        return res.status(400).json({
          message: "Your linked bank account is missing a payment method. Re-link and try again.",
          code: "bank_account_required",
          correlationId,
        });
      }

      subLog(correlationId, "subscribe_start", {
        userId,
        stripeAccountId: account.id,
        plan: DEFAULT_PLAN_ID,
      });

      // 1. Durable consent evidence FIRST — the mandate below cites this row.
      const consent = await storage.createSubscriptionConsent({
        userId,
        plan: DEFAULT_PLAN_ID,
        priceCentsAtConsent: PLAN_CATALOG[DEFAULT_PLAN_ID].priceCents,
        version: SUBSCRIPTION_CONSENT_VERSION,
        text: SUBSCRIPTION_CONSENT_TEXT,
        ipAddress: clientIp(req),
        userAgent: (req.headers["user-agent"] as string) || "unknown",
      });
      subLog(correlationId, "consent_recorded", { consentId: consent.id });

      // 2. Price (find-or-create by lookup_key).
      const priceId = await ensurePlanPrice(DEFAULT_PLAN_ID);

      // 3. Reusable off-session ACH mandate (SetupIntent, server-confirmed).
      const mandate = await createRecurringAchMandate({
        customerId: account.stripeCustomerId,
        paymentMethodId,
        mandateIpAddress: consent.ipAddress,
        mandateUserAgent: consent.userAgent,
        idempotencyKey,
      });
      subLog(correlationId, "mandate_ready", { setupIntentId: mandate.setupIntentId });

      // 4. Subscription — Stripe attempts the first invoice immediately
      // (anniversary billing anchors to now; first ACH debit processes 2-4
      // business days; status transitions arrive via webhook).
      const stripeSub = await createPlanSubscription({
        customerId: account.stripeCustomerId,
        paymentMethodId,
        planId: DEFAULT_PLAN_ID,
        priceId,
        userId,
        idempotencyKey,
      });

      // 5. Local ledger (upsert keyed on stripeSubscriptionId — webhook-safe).
      // The subscribe response included `latest_invoice.payment_intent`
      // expanded, so provisional-ACH qualification runs against the
      // authoritative provider object: access is granted ONLY if the first
      // debit is verifiably `processing` on a us_bank_account AND a finite
      // provisional window is configured. Otherwise the response is a
      // truthful "payment pending" state with no access.
      const row = await storage.upsertSubscription(buildSubscriptionRow({
        stripeSub,
        userId,
        existing: null,
        eventAt: authoritativeEventAt(null),
        windows: entitlementWindows(),
      }));
      const entitlement = evaluateEntitlement(row);
      subLog(correlationId, "subscribe_complete", {
        subscriptionId: row.id,
        stripeSubscriptionId: row.stripeSubscriptionId,
        status: row.status,
        entitlementState: entitlement.state,
      });

      const body = {
        subscription: row,
        entitled: entitlement.entitled,
        entitlementState: entitlement.state,
        correlationId,
      };
      await storage.finalizeIdempotencyKey(idempotencyKey, userId, endpoint, 201, JSON.stringify(body));
      return res.status(201).json(body);
    } catch (err: any) {
      subLog(correlationId, "subscribe_failed", { severity: "ERROR", error: err?.message });
      // Release so the user can retry with the SAME key — Stripe-side
      // idempotency (key forwarded on every create) plus the upsert keyed on
      // subscription id make the retry safe, never a double-charge.
      try { await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint); } catch {}
      return res.status(502).json({
        message: "We couldn't start your subscription. No charge was made — please try again.",
        correlationId,
      });
    } finally {
      try { await storage.releaseSubscribeLock(userId); } catch {}
    }
  });

  // Cancel at period end — premium continues until the paid month runs out.
  app.post("/api/subscription/cancel", async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const sub = await storage.getLatestSubscriptionByUserId(userId);
      if (!sub || isSubscriptionTerminal(sub.status)) {
        return res.status(404).json({ message: "No active subscription to cancel." });
      }
      if (sub.cancelAtPeriodEnd) {
        return res.json({ subscription: sub, correlationId });
      }

      const updated = await setCancelAtPeriodEnd(sub.stripeSubscriptionId, true);
      const row = await storage.upsertSubscription(buildSubscriptionRow({
        stripeSub: updated, userId, existing: sub, eventAt: authoritativeEventAt(sub), windows: entitlementWindows(),
      }));
      subLog(correlationId, "subscription_cancel_scheduled", {
        userId,
        stripeSubscriptionId: sub.stripeSubscriptionId,
      });
      return res.json({ subscription: row, correlationId });
    } catch (err: any) {
      subLog(correlationId, "subscription_cancel_failed", { severity: "ERROR", error: err?.message });
      return res.status(502).json({ message: "Failed to cancel subscription. Please try again.", correlationId });
    }
  });

  // Undo a scheduled cancellation before the period ends.
  app.post("/api/subscription/reactivate", async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const sub = await storage.getLatestSubscriptionByUserId(userId);
      if (!sub || isSubscriptionTerminal(sub.status) || !sub.cancelAtPeriodEnd) {
        return res.status(404).json({ message: "No cancellation to undo." });
      }

      const updated = await setCancelAtPeriodEnd(sub.stripeSubscriptionId, false);
      const row = await storage.upsertSubscription(buildSubscriptionRow({
        stripeSub: updated, userId, existing: sub, eventAt: authoritativeEventAt(sub), windows: entitlementWindows(),
      }));
      subLog(correlationId, "subscription_reactivated", {
        userId,
        stripeSubscriptionId: sub.stripeSubscriptionId,
      });
      return res.json({ subscription: row, correlationId });
    } catch (err: any) {
      subLog(correlationId, "subscription_reactivate_failed", { severity: "ERROR", error: err?.message });
      return res.status(502).json({ message: "Failed to resume subscription. Please try again.", correlationId });
    }
  });

  // Reconciliation: pull the authoritative subscription state from Stripe
  // for the AUTHENTICATED user only (no provider-wide scans), verify
  // ownership, and converge the local row through the same single write
  // path (the out-of-order guard prevents regressing newer state). Used to
  // repair missed/delayed webhooks. Rate-limited; never exposes Stripe
  // objects to the client; a provider outage changes nothing locally.
  const reconcileLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 3,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      const uid = getUserIdFromRequest(req);
      return uid ? `u:${uid}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
    },
    message: { message: "Too many refresh attempts. Try again in a minute." },
  });
  app.post("/api/subscription/reconcile", reconcileLimiter, async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      const local = await storage.getLatestSubscriptionByUserId(userId);
      if (!local) return res.status(404).json({ message: "No subscription to refresh." });

      const fresh = await retrieveStripeSubscription(local.stripeSubscriptionId);
      if (!fresh) {
        // Provider unavailable — local state stands; no new entitlement.
        return res.status(502).json({ message: "Couldn't reach billing. Try again shortly.", correlationId });
      }
      // Ownership integrity: the provider object must reference OUR user
      // (metadata) when present AND our stored customer. Fail closed.
      const freshCustomer = typeof fresh.customer === "string" ? fresh.customer : fresh.customer?.id;
      const metaUser = fresh.metadata?.dimeTimeUserId as string | undefined;
      if ((metaUser && metaUser !== userId) || freshCustomer !== local.stripeCustomerId) {
        subLog(correlationId, "reconcile_ownership_mismatch", {
          severity: "ERROR", userId, stripeSubscriptionId: local.stripeSubscriptionId,
        });
        return res.status(409).json({ message: "Subscription ownership mismatch. Contact support.", correlationId });
      }

      const row = await storage.upsertSubscription(buildSubscriptionRow({
        stripeSub: fresh, userId, existing: local, eventAt: authoritativeEventAt(local), windows: entitlementWindows(),
      }));
      const entitlement = evaluateEntitlement(row);
      subLog(correlationId, "subscription_reconciled", {
        userId, stripeSubscriptionId: row.stripeSubscriptionId,
        status: row.status, entitlementState: entitlement.state,
      });
      return res.json({
        subscription: row,
        entitled: entitlement.entitled,
        entitlementState: entitlement.state,
        correlationId,
      });
    } catch (err: any) {
      subLog(correlationId, "subscription_reconcile_failed", { severity: "ERROR", error: err?.message });
      return res.status(502).json({ message: "Failed to refresh subscription.", correlationId });
    }
  });
}
