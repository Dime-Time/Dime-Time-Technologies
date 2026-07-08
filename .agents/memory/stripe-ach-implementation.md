---
name: Stripe ACH implementation contract
description: flag-off guarantees, required secrets, route list, ledger contract, and status mapping for Stripe Financial Connections + ACH
---

Stripe FC + ACH debit lives behind `ENABLE_STRIPE_ACH`. When OFF, **none** of the Stripe code paths exist at runtime:
- `server/services/stripeService.ts` uses `await import("stripe")` gated on `isStripeAchEnabled()` — the `stripe` package never enters the boot import graph.
- `server/routes.ts` skips `registerStripeRoutes` / `registerStripeWebhook` so `/api/stripe/*` and `/webhooks/stripe` return **404, not 401** — no attack surface to probe.
- `StripeConnectButton` returns `null` when the flag is off; `@stripe/stripe-js` is only fetched on click when on.

**Required secrets when flag ON** (Replit Secrets only — never `.replit` or `codemagic.yaml`):
- `STRIPE_SECRET_KEY` (server) — mandatory; `isStripeAchEnabled()` fails closed without it even if the env flag is true.
- `STRIPE_WEBHOOK_SECRET` (server) — mandatory; `verifyStripeWebhook` throws (→400) if missing, so unsigned events can never mutate the ledger.
- `VITE_STRIPE_PUBLISHABLE_KEY` (client build) — read by `StripeConnectButton` for `loadStripe()` at click time.

**Routes (only mounted when flag ON):**
- `POST /api/stripe/financial-connections/session` — auth-gated; creates/reuses Stripe Customer, starts FC session, returns `clientSecret`.
- `POST /api/stripe/financial-connections/exchange` — auth-gated; FC account id → `us_bank_account` PaymentMethod, attach, AES-256-GCM-encrypt PM id (same key as Plaid tokens), write `stripe_accounts` row.
- `POST /api/stripe/ach/debit` — auth-gated, **requires `Idempotency-Key` header**; key stored in `idempotency_keys` AND forwarded to Stripe (retry never double-charges). Writes `transfers` ledger row (`provider="stripe"`, `stripePaymentIntentId`) before calling Stripe.
- `POST /webhooks/stripe` — signature-verified via `Stripe.webhooks.constructEvent`, deduped on `event.id` in `stripe_webhook_events`, updates `transfers` by `stripePaymentIntentId`. Mounted with `express.raw({type:"application/json"})` on this single path (signature is over the raw body).

**Ledger contract:** `transfers` is provider-agnostic; Stripe writes the same row shape as Plaid/Mercury. Canonical status mapper in `shared/transactionStatus.ts`: `succeeded`→`completed`, `processing`→`processing`, `requires_payment_method`/`requires_action`→`requires_action`, `canceled`→`failed`. UI never branches on raw Stripe strings.

**Sentry/correlationId:** every route's `stripeLog(correlationId, ...)` calls `setCorrelationTag(correlationId)` so captured exceptions carry the same id as the structured log line and ledger row.
