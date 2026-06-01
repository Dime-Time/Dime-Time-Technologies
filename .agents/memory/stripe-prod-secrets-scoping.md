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
