---
name: Stripe/Plaid production secret scoping
description: Where live Stripe/Plaid credentials and ACH flags are stored, and why production-scope (not global secrets)
---

# Stripe/Plaid production secret scoping

Live credentials and ACH feature flags for Dime Time are stored as **production-scoped
env vars**, not global Replit Secrets:

- `STRIPE_SECRET_KEY` (sk_live), `VITE_STRIPE_PUBLISHABLE_KEY` (pk_live),
  `STRIPE_WEBHOOK_SECRET` (whsec), `PLAID_TOKEN_ENCRYPTION_KEY` — production scope.
- `ENABLE_STRIPE_ACH=true`, `ENABLE_REAL_TRANSFERS=false` — production scope.
- The development scope is intentionally kept empty of Stripe vars.

**Why:** Global secrets apply to both dev and prod. A dev workspace running with a live
`sk_live` key would hit live Stripe on every FC-session / customer-creation call and
could create real Stripe objects. Production-scoped env vars keep live credentials out
of the always-running dev sandbox while still powering the deployed web app, the
`dime-time.com/webhooks/stripe` endpoint, and the iOS app (which reads feature flags
from the production `/api/user` response).

**How to apply:** When adding/rotating live provider credentials, request them as
`requestType:"env"` with `environment:"production"`. Never put live financial keys in
global secrets or the development scope. Consequence: runtime verification of live
boot / FC session / Stripe customer creation can only happen on the deployed app, since
those keys are absent from the dev workspace by design.

**Validation behavior:** `server/lib/validateEnv.ts` only enforces these in
`NODE_ENV=production` (skipped in dev) and `process.exit(1)`s on any missing one when
`ENABLE_STRIPE_ACH` is on — so a misconfigured production deploy fails fast at boot,
not at the first money-movement request.
