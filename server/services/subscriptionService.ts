/**
 * Subscription billing service (Stripe Billing — gated by ENABLE_SUBSCRIPTIONS).
 *
 * Reuses the lazily-loaded Stripe client from stripeService (which is itself
 * gated by ENABLE_STRIPE_ACH — subscriptions REQUIRE that flag; see the boot
 * assert in server/routes.ts).
 *
 * Money-safety notes:
 *   - Stripe owns product/price objects. We find them by stable `lookup_key`
 *     (from shared/subscriptionPlans.ts) and create them lazily on first use,
 *     so no dashboard pre-setup is required and test/live modes each get
 *     their own copies.
 *   - Recurring off-session ACH debits require a reusable mandate. We confirm
 *     a SetupIntent server-side with `mandate_data` sourced from the user's
 *     recorded subscription consent (real IP + user agent) — the same Nacha
 *     "online" evidence rule as one-off debits in stripeService.createAchDebit.
 *   - Every Stripe write that creates money state takes an idempotency key.
 */

import { PLAN_CATALOG, type PlanId } from "@shared/subscriptionPlans";
import type { InsertSubscription } from "@shared/schema";
import { getStripe } from "./stripeService";

type StripeInstance = any;

/** Per-mode cache of resolved price ids, keyed by plan. */
const cachedPriceIds = new Map<PlanId, string>();

/**
 * Find (or lazily create) the Stripe price for a plan via its stable
 * lookup_key. Idempotent: the lookup runs first, and creation is guarded by
 * an idempotency key derived from the lookup_key so concurrent first-subscribes
 * can't mint duplicate products.
 */
export async function ensurePlanPrice(planId: PlanId): Promise<string> {
  const cached = cachedPriceIds.get(planId);
  if (cached) return cached;

  const stripe: StripeInstance = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const plan = PLAN_CATALOG[planId];
  const existing = await stripe.prices.list({
    lookup_keys: [plan.stripeLookupKey],
    active: true,
    limit: 1,
  });
  if (existing.data.length > 0) {
    cachedPriceIds.set(planId, existing.data[0].id);
    return existing.data[0].id;
  }

  const product = await stripe.products.create(
    {
      name: plan.name,
      metadata: { dimeTimePlanId: plan.id },
    },
    { idempotencyKey: `dt_sub_product_${plan.stripeLookupKey}` },
  );
  const price = await stripe.prices.create(
    {
      product: product.id,
      unit_amount: plan.priceCents,
      currency: "usd",
      recurring: { interval: plan.interval },
      lookup_key: plan.stripeLookupKey,
      transfer_lookup_key: true,
    },
    { idempotencyKey: `dt_sub_price_${plan.stripeLookupKey}` },
  );
  cachedPriceIds.set(planId, price.id);
  return price.id;
}

/**
 * Establish a reusable off-session ACH mandate for recurring billing:
 * confirm a SetupIntent server-side against the stored PaymentMethod with
 * Nacha "online" acceptance evidence, then make that PM the customer's
 * default for invoices. FC-sourced accounts are instantly verified — no
 * microdeposit round-trip.
 */
export async function createRecurringAchMandate(args: {
  customerId: string;
  paymentMethodId: string;
  /** Real client IP captured when the user accepted the subscription consent. */
  mandateIpAddress: string;
  /** Real browser User-Agent captured at consent time. */
  mandateUserAgent: string;
  idempotencyKey: string;
}): Promise<{ setupIntentId: string; status: string }> {
  const stripe: StripeInstance = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  if (!args.mandateIpAddress || !args.mandateUserAgent) {
    throw new Error("Recurring ACH mandate requires a real customer IP and user agent");
  }

  const si = await stripe.setupIntents.create(
    {
      customer: args.customerId,
      payment_method: args.paymentMethodId,
      payment_method_types: ["us_bank_account"],
      confirm: true,
      mandate_data: {
        customer_acceptance: {
          type: "online",
          online: {
            ip_address: args.mandateIpAddress,
            user_agent: args.mandateUserAgent,
          },
        },
      },
    },
    { idempotencyKey: `${args.idempotencyKey}_si` },
  );

  if (si.status !== "succeeded") {
    throw new Error(`SetupIntent did not succeed (status=${si.status})`);
  }

  await stripe.customers.update(args.customerId, {
    invoice_settings: { default_payment_method: args.paymentMethodId },
  });

  return { setupIntentId: si.id, status: si.status };
}

/**
 * Create the Stripe subscription. `allow_incomplete` + a default PM with an
 * active mandate lets Stripe attempt the first invoice off-session
 * immediately (anniversary billing = billing cycle anchors to "now").
 * The first ACH debit sits in `processing` for 2–4 business days; premium
 * unlocks immediately ("unlock on processing") and the webhook revokes it
 * if the payment fails.
 */
export async function createPlanSubscription(args: {
  customerId: string;
  paymentMethodId: string;
  planId: PlanId;
  priceId: string;
  userId: string;
  idempotencyKey: string;
}): Promise<any> {
  const stripe: StripeInstance = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  return stripe.subscriptions.create(
    {
      customer: args.customerId,
      items: [{ price: args.priceId }],
      default_payment_method: args.paymentMethodId,
      collection_method: "charge_automatically",
      payment_behavior: "allow_incomplete",
      payment_settings: {
        payment_method_types: ["us_bank_account"],
        save_default_payment_method: "off",
      },
      // dimeTimeUserId lets the webhook create/repair the local row even if
      // it arrives before our own DB write (upsert keyed on subscription id).
      metadata: { dimeTimeUserId: args.userId, dimeTimePlanId: args.planId },
      expand: ["latest_invoice.payment_intent"],
    },
    { idempotencyKey: args.idempotencyKey },
  );
}

/** Flip cancel_at_period_end — access continues until the paid period ends. */
export async function setCancelAtPeriodEnd(
  stripeSubscriptionId: string,
  cancel: boolean,
): Promise<any> {
  const stripe: StripeInstance = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: cancel,
  });
}

/**
 * Hard-cancel now (account deletion). Best-effort caller contract: a Stripe
 * failure here must NOT abort account deletion — but it must be loudly
 * logged, because an orphaned live subscription bills a deleted user.
 */
export async function cancelSubscriptionImmediately(stripeSubscriptionId: string): Promise<void> {
  const stripe: StripeInstance = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  await stripe.subscriptions.cancel(stripeSubscriptionId);
}

/**
 * Retrieve the live subscription object from Stripe (webhook resync +
 * reconciliation path). Expands the latest invoice's PaymentIntent so the
 * caller can authoritatively verify ACH payment state — provisional access
 * decisions are only ever made from this expanded, provider-fetched shape.
 */
export async function retrieveStripeSubscription(stripeSubscriptionId: string): Promise<any | null> {
  const stripe: StripeInstance = await getStripe();
  if (!stripe) return null;
  try {
    return await stripe.subscriptions.retrieve(stripeSubscriptionId, {
      expand: ["latest_invoice.payment_intent"],
    });
  } catch {
    return null;
  }
}

function tsFromUnix(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
}

/**
 * Authoritative provisional-ACH qualification. Runs against a subscription
 * object FETCHED FROM STRIPE with `latest_invoice.payment_intent` expanded —
 * never against client input. Every condition must hold:
 *
 *   - subscription status is `incomplete`
 *   - the latest invoice is an object belonging to THIS subscription and
 *     THIS customer
 *   - the PaymentIntent is an object belonging to the same invoice/customer
 *   - the payment method type is `us_bank_account`
 *   - the PaymentIntent status is authoritatively `processing`
 *
 * The ACH mandate precondition is structural: createRecurringAchMandate
 * throws unless the SetupIntent (with Nacha online acceptance evidence)
 * reached `succeeded` BEFORE the subscription is ever created, so a
 * processing us_bank_account PaymentIntent on our subscription implies a
 * confirmed mandate. Missing/failed/requires_* /canceled PaymentIntents,
 * cross-object mismatches, and unsupported methods all disqualify.
 */
export function verifyProvisionalAchEligibility(sub: any): {
  eligible: boolean;
  paymentIntentStatus: string | null;
  reason: string;
} {
  const fail = (reason: string, piStatus: string | null = null) => ({
    eligible: false,
    paymentIntentStatus: piStatus,
    reason,
  });
  if (!sub || sub.status !== "incomplete") return fail("not_incomplete");

  const subCustomer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
  const invoice = sub.latest_invoice;
  if (!invoice || typeof invoice !== "object") return fail("invoice_not_expanded");

  // Invoice must belong to this subscription (tolerate 2025 "basil" shape).
  const invoiceSubRaw =
    invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
  const invoiceSub = typeof invoiceSubRaw === "string" ? invoiceSubRaw : invoiceSubRaw?.id;
  if (!invoiceSub || invoiceSub !== sub.id) return fail("invoice_subscription_mismatch");
  const invoiceCustomer =
    typeof invoice.customer === "string" ? invoice.customer : invoice.customer?.id;
  if (!invoiceCustomer || invoiceCustomer !== subCustomer) return fail("invoice_customer_mismatch");

  // PaymentIntent must be an expanded object on this invoice.
  const pi = invoice.payment_intent;
  if (!pi || typeof pi !== "object") return fail("missing_payment_intent");
  const piStatus = typeof pi.status === "string" ? pi.status : null;
  const piCustomer = typeof pi.customer === "string" ? pi.customer : pi.customer?.id;
  if (!piCustomer || piCustomer !== subCustomer) {
    return fail("payment_intent_customer_mismatch", piStatus);
  }
  const piInvoice = typeof pi.invoice === "string" ? pi.invoice : pi.invoice?.id;
  if (piInvoice && invoice.id && piInvoice !== invoice.id) {
    return fail("payment_intent_invoice_mismatch", piStatus);
  }

  const methodTypes: string[] = Array.isArray(pi.payment_method_types)
    ? pi.payment_method_types
    : [];
  if (!methodTypes.includes("us_bank_account")) {
    return fail("unsupported_payment_method", piStatus);
  }
  if (!pi.payment_method) return fail("no_payment_method_attached", piStatus);

  // Only the single authoritative in-flight state qualifies. Explicitly NOT
  // qualifying: requires_payment_method, requires_confirmation,
  // requires_action, canceled, failed states, or anything unknown.
  if (piStatus !== "processing") return fail(`payment_intent_${piStatus ?? "unknown"}`, piStatus);

  return { eligible: true, paymentIntentStatus: piStatus, reason: "ach_processing_verified" };
}

/**
 * Event stamp for AUTHORITATIVE writes (subscribe response, invoice-driven
 * re-fetch, reconcile) — these carry state freshly fetched from Stripe and
 * must never be skipped by the out-of-order guard, even if the server clock
 * lags the row's newest webhook timestamp. Returns max(now, newest+1s).
 */
export function authoritativeEventAt(
  existing?: { lastStripeEventAt?: Date | null } | null,
  now: Date = new Date(),
): Date {
  const prev = existing?.lastStripeEventAt?.getTime() ?? 0;
  return new Date(Math.max(now.getTime(), prev + 1000));
}

/** Windows injected so tests stay pure; defaults come from server config. */
export interface EntitlementWindowConfig {
  provisionalDays: number;
  graceDays: number;
}

/**
 * Build the authoritative local row for a Stripe subscription, deriving the
 * server-persisted entitlement windows from the previous row state:
 *
 *   provisionalAccessUntil — set ONCE (never extended) when a verified ACH
 *     `processing` PaymentIntent qualifies AND a provisional window is
 *     configured (> 0 days); carried forward while still `incomplete` and
 *     not explicitly revoked; cleared on any other status or on revocation
 *     (payment failure / cancellation / dispute / refund / return).
 *
 *   graceUntil — set ONCE when a previously-ACTIVE subscription enters
 *     `past_due`; carried forward unchanged on duplicate/repeat past_due
 *     events (grace never resets); cleared when the subscription leaves
 *     past_due. A subscription that appears as past_due with no local
 *     active history gets NO grace (fail closed).
 */
export function buildSubscriptionRow(args: {
  stripeSub: any;
  userId: string;
  existing?: {
    status?: string | null;
    provisionalAccessUntil?: Date | null;
    graceUntil?: Date | null;
    lastPaymentIntentStatus?: string | null;
  } | null;
  /** Stripe event timestamp (event.created) or "now" for authoritative re-fetches. */
  eventAt: Date;
  /** Force-revoke provisional access (payment failed/canceled/disputed/refunded/returned). */
  revokeProvisional?: boolean;
  windows: EntitlementWindowConfig;
  now?: Date;
}): InsertSubscription {
  const { stripeSub, userId, existing, eventAt, revokeProvisional, windows } = args;
  const now = args.now ?? new Date();
  const base = subscriptionRowFromStripe(stripeSub, userId);

  // Product/price integrity: the approved plan's lookup_key must match when
  // the provider includes one. A mismatch marks the row's plan as
  // "unsupported", which the central evaluator fails closed on.
  const item = stripeSub.items?.data?.[0];
  const lookupKey: string | undefined = item?.price?.lookup_key ?? undefined;
  const approved = PLAN_CATALOG[(base.plan as PlanId) ?? "debt"];
  if (!approved || (lookupKey !== undefined && lookupKey !== null && lookupKey !== approved.stripeLookupKey)) {
    base.plan = "unsupported" as any;
  }

  // Verified PaymentIntent status (only available when the invoice+PI were
  // expanded by a provider fetch; otherwise carry the last verified value).
  const verification = verifyProvisionalAchEligibility(stripeSub);
  const piExpanded =
    typeof stripeSub.latest_invoice === "object" &&
    typeof stripeSub.latest_invoice?.payment_intent === "object";
  const lastPaymentIntentStatus = piExpanded
    ? verification.paymentIntentStatus
    : existing?.lastPaymentIntentStatus ?? null;

  // --- provisionalAccessUntil ---
  let provisionalAccessUntil: Date | null = null;
  if (base.status === "incomplete" && !revokeProvisional) {
    if (existing?.provisionalAccessUntil) {
      // Never extended — duplicates/out-of-order events keep the original.
      provisionalAccessUntil = existing.provisionalAccessUntil;
    } else if (verification.eligible && windows.provisionalDays > 0) {
      provisionalAccessUntil = new Date(
        now.getTime() + windows.provisionalDays * 24 * 60 * 60 * 1000,
      );
    }
    // No configured window (founder decision pending) or not verified → null.
  }

  // --- graceUntil ---
  let graceUntil: Date | null = null;
  if (base.status === "past_due") {
    if (existing?.graceUntil) {
      // Grace never resets on duplicate/repeat events.
      graceUntil = existing.graceUntil;
    } else if (existing?.status === "active" && windows.graceDays > 0) {
      graceUntil = new Date(now.getTime() + windows.graceDays * 24 * 60 * 60 * 1000);
    }
    // past_due without a previously-active local history → no grace.
  }

  return {
    ...base,
    provisionalAccessUntil,
    graceUntil,
    lastPaymentIntentStatus,
    lastStripeEventAt: eventAt,
  };
}

/**
 * Map a Stripe subscription object to our local row shape. Used by BOTH the
 * subscribe route and the webhook handler so the two write paths can never
 * diverge (single upsert keyed on stripeSubscriptionId).
 */
export function subscriptionRowFromStripe(
  sub: any,
  userId: string,
): InsertSubscription {
  const item = sub.items?.data?.[0];
  const latestInvoice = sub.latest_invoice;
  const paymentError =
    typeof latestInvoice === "object" && latestInvoice?.payment_intent?.last_payment_error
      ? String(latestInvoice.payment_intent.last_payment_error.message || latestInvoice.payment_intent.last_payment_error.code)
      : null;

  return {
    userId,
    plan: (sub.metadata?.dimeTimePlanId as PlanId) || "debt",
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripeSubscriptionId: sub.id,
    stripePriceId: item?.price?.id ?? "",
    status: sub.status,
    // Stripe API versions 2025+ ("basil") moved the period fields from the
    // subscription onto its items — tolerate both shapes so a dashboard
    // webhook endpoint pinned to a newer version can't upsert null periods.
    currentPeriodStart: tsFromUnix(sub.current_period_start ?? item?.current_period_start),
    currentPeriodEnd: tsFromUnix(sub.current_period_end ?? item?.current_period_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    canceledAt: tsFromUnix(sub.canceled_at),
    latestInvoiceId:
      typeof latestInvoice === "string" ? latestInvoice : latestInvoice?.id ?? null,
    lastPaymentError: paymentError,
  };
}
