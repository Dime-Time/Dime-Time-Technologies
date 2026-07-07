---
name: Stripe Financial Connections registration
description: Live-mode Stripe blocks Financial Connections until the account submits a registration; blocks the bank-connect (beta) flow.
---

# Stripe Financial Connections requires live-mode registration

The Stripe "Connect bank account (beta)" flow (`StripeConnectButton` →
`POST /api/stripe/financial-connections/session` → `collectFinancialConnectionsAccounts`)
depends on Stripe **Financial Connections**, which is **not** automatically enabled on a
live Stripe account.

**Symptom:** `POST /api/stripe/financial-connections/session` returns **502** and the
structured log shows `event:"fc_session_failed"` with:
> "You are not registered to use Financial Connections. Please submit your registration
> at https://dashboard.stripe.com/financial-connections/application"

**This is NOT a code bug.** The app correctly reached Stripe and surfaced Stripe's own
rejection. Nothing to fix in `stripeRoutes.ts` / `stripeService.ts`.

**Fix (founder action, not agent):** the founder must submit the Financial Connections
registration/application in the **live** Stripe dashboard
(https://dashboard.stripe.com/financial-connections/application). Approval may require
Stripe review before the bank-connect flow succeeds.

**Why:** this surfaced during the real-money $1 ACH go-live test — self-approval + ACH
authorization both succeeded, but bank-linking is hard-blocked until FC is registered.

**How to apply:** if the Stripe bank-connect (beta) flow 502s during any go-live/test,
check for `fc_session_failed` in deployment logs before touching code — it is almost
certainly the FC registration gap, an external account-onboarding step.

**Fallback path (only if FC approval stalls):** Stripe `us_bank_account` PaymentMethods
can also be created via manual account+routing entry (micro-deposit / instant verify),
which does NOT require Financial Connections — but that is a separate code path the app
does not currently implement.
