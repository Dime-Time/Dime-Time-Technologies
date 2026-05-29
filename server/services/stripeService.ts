/**
 * Stripe ACH provider adapter (BETA — gated by `ENABLE_STRIPE_ACH`).
 *
 * Design rules:
 *   - Lazy import of `stripe`: the SDK is only required at runtime when both
 *     `ENABLE_STRIPE_ACH` is ON and `STRIPE_SECRET_KEY` is set. When OFF the
 *     module's `getStripe()` returns null and callers no-op so the SDK is
 *     never loaded into memory and the package never appears in the
 *     server's import graph at startup.
 *   - All errors are structured-logged with the caller's correlationId.
 *   - This file does NOT touch the Plaid encryption path. The PaymentMethod
 *     id is encrypted via the shared `encryptionService` (same AES-256-GCM
 *     key as Plaid access tokens) before storage.
 */

import { isFlagEnabled } from "../lib/flags";

type StripeNs = typeof import("stripe");
type StripeInstance = InstanceType<StripeNs["default"]>;

let cachedClient: StripeInstance | null = null;
let cachedClientPromise: Promise<StripeInstance | null> | null = null;

export function isStripeAchEnabled(): boolean {
  return isFlagEnabled("ENABLE_STRIPE_ACH") && Boolean(process.env.STRIPE_SECRET_KEY);
}

/**
 * Build a Stripe client from `STRIPE_SECRET_KEY` alone. Internal — used by
 * both the flag-gated `getStripe()` and the key-only diagnostics path. The
 * resulting client is cached so we never construct more than one SDK
 * instance regardless of which entry point first loads it. Returns null
 * when the secret is unset or the dynamic import fails (logged once, never
 * re-thrown so an SDK install issue can't crash the server boot).
 */
async function loadStripeClient(): Promise<StripeInstance | null> {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  if (cachedClient) return cachedClient;
  if (cachedClientPromise) return cachedClientPromise;

  cachedClientPromise = (async () => {
    try {
      const mod = (await import("stripe")) as StripeNs;
      const Stripe = mod.default;
      cachedClient = new Stripe(process.env.STRIPE_SECRET_KEY as string, {
        // Pin a recent API version. Bumping requires a code review since
        // Stripe occasionally renames PaymentMethod / FC fields.
        apiVersion: "2024-06-20" as any,
        typescript: true,
        appInfo: {
          name: "Dime Time",
          url: "https://dime-time.com",
        },
        maxNetworkRetries: 2,
      });
      return cachedClient;
    } catch (err) {
      console.error(JSON.stringify({
        service: "StripeService",
        event: "stripe_sdk_load_failed",
        severity: "ERROR",
        error: err instanceof Error ? err.message : String(err),
      }));
      cachedClientPromise = null;
      return null;
    }
  })();

  return cachedClientPromise;
}

/**
 * Lazily load the Stripe SDK for ACH money-movement. Returns null when the
 * flag is off or the secret is unset — keeps the SDK out of the import graph
 * in the default (flag OFF) production posture.
 */
export async function getStripe(): Promise<StripeInstance | null> {
  if (!isStripeAchEnabled()) return null;
  return loadStripeClient();
}

export interface StripeCapabilityReport {
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

/**
 * Read-only Stripe account capability snapshot for the admin diagnostics
 * page. Intentionally NOT gated by `ENABLE_STRIPE_ACH` — the whole point is
 * to inspect which capabilities are active BEFORE flipping the flag. Only
 * requires `STRIPE_SECRET_KEY`. Returns null when the key is unset.
 *
 * Returns ONLY booleans/enums/string arrays already public in the Stripe
 * dashboard — no secrets, no tokens, no PII.
 */
export async function retrieveAccountDiagnostics(): Promise<StripeCapabilityReport | null> {
  const stripe = await loadStripeClient();
  if (!stripe) return null;

  // No-arg retrieve hits GET /v1/account (the account behind the secret key).
  // The typed overloads require an id, so call through `any`.
  const acct: any = await (stripe.accounts as any).retrieve();
  const req = acct.requirements ?? {};
  const fut = acct.future_requirements ?? {};

  return {
    accountId: acct.id,
    chargesEnabled: Boolean(acct.charges_enabled),
    payoutsEnabled: Boolean(acct.payouts_enabled),
    detailsSubmitted: Boolean(acct.details_submitted),
    capabilities: (acct.capabilities ?? {}) as Record<string, string>,
    requirements: {
      currentlyDue: req.currently_due ?? [],
      eventuallyDue: req.eventually_due ?? [],
      pastDue: req.past_due ?? [],
      pendingVerification: req.pending_verification ?? [],
      disabledReason: req.disabled_reason ?? null,
    },
    futureRequirements: {
      currentlyDue: fut.currently_due ?? [],
      eventuallyDue: fut.eventually_due ?? [],
    },
  };
}

export interface CreateFcSessionResult {
  clientSecret: string;
  sessionId: string;
  customerId: string;
}

/**
 * Create (or reuse) a Stripe Customer for this user, then start a Financial
 * Connections session. The client uses the returned `clientSecret` with
 * Stripe.js to render the connect modal.
 */
export async function createFinancialConnectionsSession(args: {
  userEmail: string | null;
  userId: string;
  existingCustomerId: string | null;
}): Promise<CreateFcSessionResult> {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  let customerId = args.existingCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: args.userEmail ?? undefined,
      metadata: { dimeTimeUserId: args.userId },
    });
    customerId = customer.id;
  }

  const session = await (stripe as any).financialConnections.sessions.create({
    account_holder: { type: "customer", customer: customerId },
    permissions: ["payment_method", "balances"],
    filters: { countries: ["US"] },
  });

  return {
    clientSecret: session.client_secret,
    sessionId: session.id,
    customerId,
  };
}

/**
 * After the user finishes the Financial Connections modal, the client sends
 * back the linked FC account id(s). We materialise each one into a
 * PaymentMethod so we can later debit via PaymentIntent.
 */
export async function attachFcAccountAsPaymentMethod(args: {
  fcAccountId: string;
  customerId: string;
}): Promise<{ paymentMethodId: string; last4: string | null; institutionName: string | null }> {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  const account = await (stripe as any).financialConnections.accounts.retrieve(args.fcAccountId);

  // Create a us_bank_account PaymentMethod from the FC account.
  const pm = await stripe.paymentMethods.create({
    type: "us_bank_account" as any,
    us_bank_account: { financial_connections_account: args.fcAccountId } as any,
  } as any);

  await stripe.paymentMethods.attach(pm.id, { customer: args.customerId });

  return {
    paymentMethodId: pm.id,
    last4: (account?.last4 as string) || (pm as any).us_bank_account?.last4 || null,
    institutionName: (account?.institution_name as string) || null,
  };
}

/**
 * Create an ACH debit PaymentIntent against a stored PaymentMethod. The
 * caller is responsible for ledger / idempotency bookkeeping.
 *
 * `idempotencyKey` is forwarded to Stripe so a retried request never
 * double-charges the user — this is in addition to our own idempotency
 * table check.
 */
export async function createAchDebit(args: {
  amountCents: number;
  customerId: string;
  paymentMethodId: string;
  idempotencyKey: string;
  /** Real client IP captured when the user accepted the ACH authorization. */
  mandateIpAddress: string;
  /** Real browser User-Agent captured at authorization time. */
  mandateUserAgent: string;
  descriptor?: string;
  metadata?: Record<string, string>;
}): Promise<{ id: string; status: string; chargeId: string | null }> {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");

  // Nacha "online" mandate evidence MUST reflect the actual customer who
  // authorized the debit — never hardcoded server values. The caller pulls
  // these from the stored `ach_authorizations` row and fails closed if no
  // authorization is on file.
  if (!args.mandateIpAddress || !args.mandateUserAgent) {
    throw new Error("ACH mandate requires a real customer IP and user agent");
  }

  const intent = await stripe.paymentIntents.create(
    {
      amount: args.amountCents,
      currency: "usd",
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
      } as any,
      statement_descriptor_suffix: (args.descriptor || "DIME TIME").slice(0, 22),
      metadata: args.metadata,
    },
    { idempotencyKey: args.idempotencyKey },
  );

  return {
    id: intent.id,
    status: intent.status,
    chargeId: (intent.latest_charge as string) || null,
  };
}

/**
 * Verify a Stripe webhook signature and return the parsed event. Throws if
 * the signature is missing/invalid or the secret is unset — caller MUST
 * surface a 400.
 */
export async function verifyStripeWebhook(rawBody: Buffer | string, signature: string | undefined) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) throw new Error("STRIPE_WEBHOOK_SECRET is not set");
  if (!signature) throw new Error("Missing stripe-signature header");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
