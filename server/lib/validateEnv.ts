/**
 * Production secret validation — fail fast at boot rather than at the first
 * money-movement request.
 *
 * Scoped to `NODE_ENV === "production"` so the dev workflow (which legitimately
 * runs without live Stripe / encryption secrets) still boots. In production:
 *   - `PLAID_TOKEN_ENCRYPTION_KEY` is ALWAYS required (it encrypts every
 *     at-rest bank credential — Plaid access tokens AND Stripe PaymentMethod
 *     ids). Without it, linking or debiting throws at runtime.
 *   - The Stripe trio is required only when `ENABLE_STRIPE_ACH` is ON, since
 *     that is the only posture in which the Stripe routes are mounted and the
 *     SDK is loaded.
 *
 * A missing secret prints `FATAL: <NAME> missing` and throws, which the
 * top-level boot catch turns into `process.exit(1)`.
 */

import { isFlagEnabled } from "./flags";

export function validateProductionSecrets(): void {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    console.log(
      JSON.stringify({
        service: "EnvValidation",
        event: "skipped_non_production",
        nodeEnv: process.env.NODE_ENV ?? null,
      }),
    );
    return;
  }

  const missing: string[] = [];

  if (!process.env.PLAID_TOKEN_ENCRYPTION_KEY) {
    missing.push("PLAID_TOKEN_ENCRYPTION_KEY");
  }

  // REQUIRE_EMAIL_VERIFICATION must be EXPLICITLY configured in production —
  // never silently guessed. Set it to "false" for the initial controlled
  // deployment, smoke-test resend/verify, then flip to "true" to activate
  // server-side enforcement. Any of 1/true/yes/on/0/false/no/off is valid.
  const remv = (process.env.REQUIRE_EMAIL_VERIFICATION ?? "").trim().toLowerCase();
  const remvValid = ["1", "true", "yes", "on", "0", "false", "no", "off"].includes(remv);
  if (!remvValid) {
    missing.push("REQUIRE_EMAIL_VERIFICATION (must be explicitly 'true' or 'false' in production)");
  }

  // Plaid production mode requires its own secret (Plaid issues different
  // secrets per environment). Fail boot hard rather than letting every Plaid
  // feature 500 at runtime with only a console warning.
  const plaidEnv = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  if (plaidEnv === "production") {
    if (!process.env.PLAID_SECRET_PRODUCTION) missing.push("PLAID_SECRET_PRODUCTION");
    if (!process.env.PLAID_CLIENT_ID) missing.push("PLAID_CLIENT_ID");
  }

  const stripeAchEnabled = isFlagEnabled("ENABLE_STRIPE_ACH");
  if (stripeAchEnabled) {
    for (const key of [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "VITE_STRIPE_PUBLISHABLE_KEY",
    ]) {
      if (!process.env[key]) missing.push(key);
    }
  }

  if (missing.length > 0) {
    for (const key of missing) {
      console.error(`FATAL: ${key} missing`);
    }
    throw new Error(
      `Production startup aborted — missing required secrets: ${missing.join(", ")}`,
    );
  }

  // Prefix validation — a present-but-wrong-mode key is as dangerous as a
  // missing one. The secret key's `sk_live_` mode is enforced separately by
  // `assertStripeKeyModeSafeOnBoot`; here we harden the webhook signing secret
  // and the publishable key so a test-mode value can never silently ship to
  // production.
  if (stripeAchEnabled) {
    const invalid: string[] = [];
    const webhookSecret =
      process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
      invalid.push("STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret (whsec_…)");
    }
    const publishableKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (publishableKey && !publishableKey.startsWith("pk_live_")) {
      invalid.push("VITE_STRIPE_PUBLISHABLE_KEY must be a LIVE publishable key (pk_live_…)");
    }
    if (invalid.length > 0) {
      for (const msg of invalid) console.error(`FATAL: ${msg}`);
      throw new Error(
        `Production startup aborted — invalid Stripe key configuration: ${invalid.join("; ")}`,
      );
    }
  }

  console.log(
    JSON.stringify({
      service: "EnvValidation",
      event: "ok",
      stripeAchEnabled,
      realTransfersEnabled: isFlagEnabled("ENABLE_REAL_TRANSFERS"),
    }),
  );
}
