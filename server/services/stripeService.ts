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

function isProductionEnv(): boolean {
  return process.env.NODE_ENV === "production";
}

export type StripeMode = "live" | "test";

export interface StripeSecretResolution {
  secretKey: string | null;
  mode: StripeMode | null;
  reason?: string;
}

/**
 * Resolve which Stripe secret key to use for the CURRENT environment, with a
 * hard mode guarantee:
 *   - production -> `STRIPE_SECRET_KEY`, which MUST be a live key (`sk_live_…`).
 *   - non-prod   -> `STRIPE_SECRET_KEY_TEST`, which MUST be a test key
 *     (`sk_test_…`).
 *
 * Any prefix mismatch returns a null key + reason so callers fail closed. This
 * makes it impossible to (a) use a live key in development, or (b) use a test
 * key in production — even though `STRIPE_SECRET_KEY` is a global secret that is
 * also present in the dev environment.
 */
export function resolveStripeSecretKey(): StripeSecretResolution {
  if (isProductionEnv()) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return { secretKey: null, mode: null, reason: "STRIPE_SECRET_KEY (live) is not set in production" };
    }
    if (!key.startsWith("sk_live_")) {
      return { secretKey: null, mode: null, reason: "Production requires a LIVE Stripe secret key (sk_live_…)" };
    }
    return { secretKey: key, mode: "live" };
  }

  const testKey = process.env.STRIPE_SECRET_KEY_TEST;
  if (!testKey) {
    return { secretKey: null, mode: null, reason: "STRIPE_SECRET_KEY_TEST (test) is not set in development" };
  }
  if (!testKey.startsWith("sk_test_")) {
    return { secretKey: null, mode: null, reason: "Development requires a TEST Stripe secret key (sk_test_…)" };
  }
  return { secretKey: testKey, mode: "test" };
}

/**
 * Resolve the webhook signing secret for the current environment. Production
 * verifies against the LIVE endpoint's secret (`STRIPE_WEBHOOK_SECRET`);
 * non-prod verifies against the TEST endpoint's secret
 * (`STRIPE_WEBHOOK_SECRET_TEST`). Never cross modes.
 */
export function resolveStripeWebhookSecret(): string | null {
  if (isProductionEnv()) {
    // Prefer the dedicated LIVE endpoint secret; fall back to the legacy
    // STRIPE_WEBHOOK_SECRET so existing production config keeps verifying.
    return process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET || null;
  }
  return process.env.STRIPE_WEBHOOK_SECRET_TEST || null;
}

export function isStripeAchEnabled(): boolean {
  return isFlagEnabled("ENABLE_STRIPE_ACH") && resolveStripeSecretKey().secretKey !== null;
}

/**
 * Boot-time guard. When `ENABLE_STRIPE_ACH` is ON, refuse to proceed if the
 * environment's Stripe secret key has the WRONG mode (a test key in production,
 * or a live key where a test key is required) — that is a dangerous
 * misconfiguration, so we throw to fail the boot loudly. A simply MISSING key
 * is a safe, fail-closed state: we log and let the caller skip mounting the
 * Stripe routes. No-op when the flag is OFF.
 */
export function assertStripeKeyModeSafeOnBoot(): void {
  if (!isFlagEnabled("ENABLE_STRIPE_ACH")) return;

  const prod = isProductionEnv();
  const resolution = resolveStripeSecretKey();

  if (resolution.secretKey && resolution.mode) {
    console.log(JSON.stringify({
      service: "StripeService",
      event: "stripe_mode_resolved",
      severity: "INFO",
      env: prod ? "production" : "development",
      mode: resolution.mode,
    }));
    return;
  }

  const envKeyRaw = prod ? process.env.STRIPE_SECRET_KEY : process.env.STRIPE_SECRET_KEY_TEST;
  console.error(JSON.stringify({
    service: "StripeService",
    event: "stripe_mode_misconfigured",
    severity: "ERROR",
    env: prod ? "production" : "development",
    reason: resolution.reason,
    keyPresentButWrongMode: Boolean(envKeyRaw),
  }));

  if (envKeyRaw) {
    throw new Error(
      `Stripe ACH enabled but the ${prod ? "production" : "development"} Stripe secret key has the wrong mode. ${resolution.reason}`,
    );
  }
}

/**
 * Build a Stripe client from `STRIPE_SECRET_KEY` alone. Internal — used by
 * the flag-gated `getStripe()`. The resulting client is cached so we never
 * construct more than one SDK instance regardless of which entry point first
 * loads it. Returns null when the secret is unset or the dynamic import fails
 * (logged once, never re-thrown so an SDK install issue can't crash the
 * server boot).
 */
async function loadStripeClient(): Promise<StripeInstance | null> {
  const { secretKey } = resolveStripeSecretKey();
  if (!secretKey) return null;
  if (cachedClient) return cachedClient;
  if (cachedClientPromise) return cachedClientPromise;

  cachedClientPromise = (async () => {
    try {
      const mod = (await import("stripe")) as StripeNs;
      const Stripe = mod.default;
      cachedClient = new Stripe(secretKey, {
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
    permissions: ["payment_method"],
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
  const secret = resolveStripeWebhookSecret();
  if (!secret) throw new Error("Stripe webhook secret is not set");
  if (!signature) throw new Error("Missing stripe-signature header");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}
