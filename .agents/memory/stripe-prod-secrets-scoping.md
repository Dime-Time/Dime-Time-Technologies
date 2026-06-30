---
name: Stripe/Plaid production secret scoping
description: Where live Stripe/Plaid credentials belong (global Secrets, NOT .replit env vars) and why
---

# Stripe/Plaid production secret scoping

**Rule:** Sensitive provider credentials — `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
`PLAID_TOKEN_ENCRYPTION_KEY` — MUST be stored as **global Replit Secrets** (the encrypted
Secrets store), never as per-environment env vars. Only non-sensitive config belongs in
env scope: the feature flags `ENABLE_STRIPE_ACH` / `ENABLE_REAL_TRANSFERS` and the
**public** `VITE_STRIPE_PUBLISHABLE_KEY` (pk_*) live as **production**-scoped env vars.

**Why:** Per-environment env vars (`environment:"production"`/development/shared) are
written to `.replit` under `[userenv.*]` in **plaintext**, and `.replit` is git-tracked.
Putting a live secret there commits it to the repo history (local checkpoints + the
`gitsafe-backup` remote, and to GitHub `origin` if ever pushed). This already happened
once and required removal + rotation. `replit.md` already documents this ("all live as
Replit Secrets — never in .replit or codemagic.yaml") — follow it.

**How to apply:**
- Request sensitive values with `requestEnvVar({ requestType: "secret", keys: [...] })`.
- Keep `ENABLE_STRIPE_ACH` production-only so the dev workspace stays fail-closed
  (`isStripeAchEnabled()` = flag AND key; flag absent in dev → Stripe never initializes),
  even though the global secret key technically exists in dev too.
- If a secret ever lands in a per-environment env var, treat it as leaked: delete it from
  the env scope, re-add via the Secrets store, and rotate the credential at the provider.

**Validation:** `server/lib/validateEnv.ts` enforces these only when `NODE_ENV=production`
and `process.exit(1)`s on any missing one while `ENABLE_STRIPE_ACH` is on.

## Env-aware test vs live key separation (the dev workspace must NOT touch the live account)

**Rule:** The server resolves Stripe credentials by `NODE_ENV`. **Production** uses the live
pair (`STRIPE_SECRET_KEY` = `sk_live_…`, `STRIPE_WEBHOOK_SECRET`). **Non-production** (the dev
workspace) uses a **separate test pair** that must be created as their own global Secrets:
`STRIPE_SECRET_KEY_TEST` = `sk_test_…` and `STRIPE_WEBHOOK_SECRET_TEST`. The publishable key is
public, so dev gets a **development-scoped** env var `VITE_STRIPE_PUBLISHABLE_KEY` = `pk_test_…`
(prod keeps its production-scoped `pk_live_…`). Never store a `pk_test` publishable key as a
global secret — it would shadow the prod `pk_live` env var in production builds.

**Why:** Secrets are global, so the live `STRIPE_SECRET_KEY` is also present in the dev
container. Without env-aware resolution a dev build could transact on the LIVE Stripe account.
The resolver therefore **ignores** the live `STRIPE_SECRET_KEY` entirely when not in production
and reads only `STRIPE_SECRET_KEY_TEST`; a boot assertion **throws** if the resolved key has the
wrong mode (live-where-test-expected or vice-versa), while a *missing* key just fails closed
(routes mount but return 503). Both layers exist so a misconfiguration cannot silently move
money on the wrong account.

**How to apply (run Stripe ACH in dev safely):**
1. Set global Secrets `STRIPE_SECRET_KEY_TEST` (`sk_test_…`) and `STRIPE_WEBHOOK_SECRET_TEST`.
2. Set **development**-scoped env vars: `ENABLE_STRIPE_ACH=true`, `ENABLE_REAL_TRANSFERS=false`,
   `VITE_STRIPE_PUBLISHABLE_KEY=pk_test_…`. Restart the workflow (flags resolve once at boot).
3. With `ENABLE_REAL_TRANSFERS=false` the debit route records a `status:"simulated"` transfers
   ledger row and **never** calls Stripe / creates a PaymentIntent — the whole UI→ledger flow is
   exercised with zero money movement. Verify via `/admin/transfers`.
4. NEVER flip `ENABLE_REAL_TRANSFERS` on without staged testing + the founder's explicit go.
