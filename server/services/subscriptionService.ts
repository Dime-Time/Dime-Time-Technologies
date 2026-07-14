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

/** Retrieve the live subscription object from Stripe (webhook resync path). */
export async function retrieveStripeSubscription(stripeSubscriptionId: string): Promise<any | null> {
  const stripe: StripeInstance = await getStripe();
  if (!stripe) return null;
  try {
    return await stripe.subscriptions.retrieve(stripeSubscriptionId);
  } catch {
    return null;
  }
}

function tsFromUnix(seconds: number | null | undefined): Date | null {
  return typeof seconds === "number" ? new Date(seconds * 1000) : null;
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
