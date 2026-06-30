---
name: Gates before enabling real Stripe ACH transfers
description: what MUST be true/added before ever flipping ENABLE_REAL_TRANSFERS on
---

`ENABLE_REAL_TRANSFERS` is the kill-switch that lets money-movement endpoints actually settle. It must stay OFF until staged testing passes AND the founder gives explicit final go. "Stage 1" only validated the SIMULATION path (debit returns `status:"simulated"`, writes one `transfers` ledger row, never calls Stripe / no PaymentIntent, idempotent replay via `Idempotency-Key`). Dev resolves the Stripe key by mode: `STRIPE_SECRET_KEY_TEST` is used in development even though the global live `STRIPE_SECRET_KEY` exists (boot log `stripe_mode_resolved mode:"test"` proves it).

**Why:** Flipping the flag with gaps in the debit route would move real customer money on insufficiently-validated input.

**How to apply — before flipping ENABLE_REAL_TRANSFERS to ON:**
- In `POST /api/stripe/ach/debit`, enforce SERVER-SIDE that the chosen `stripe_accounts` row is `isActive && status === "linked"` (today it only checks `userId` ownership; active-account selection is enforced only in the UI).
- Validate `debtId` belongs to the caller and is active before debiting (route currently accepts any `debtId` string).
- Provide `STRIPE_WEBHOOK_SECRET_TEST` before real test charges (deferred in Stage 1 — no webhooks fire in simulation).
- Re-run the staged end-to-end test with real test-mode charges (not just simulation) and confirm the webhook updates the ledger row by `stripePaymentIntentId`.
