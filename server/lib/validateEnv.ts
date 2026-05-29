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

  console.log(
    JSON.stringify({
      service: "EnvValidation",
      event: "ok",
      stripeAchEnabled,
      realTransfersEnabled: isFlagEnabled("ENABLE_REAL_TRANSFERS"),
    }),
  );
}
