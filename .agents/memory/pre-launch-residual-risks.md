---
name: Pre-launch residual risks (2026-07 security review)
description: Known accepted risks left open after the July 2026 pre-launch security review — check before enabling new providers or flipping flags.
---

# Residual risks accepted at the 2026-07 pre-launch review (all else PASSED)

The full 9-point review (auth, authz/IDOR, money-movement fail-closed chain,
webhooks, error handling, headers, DB integrity) passed after a hardening pass.
These items were consciously deferred — re-check them when the trigger fires:

- **Idempotency not atomic outside Stripe ACH.** Only `POST /api/stripe/ach/debit`
  uses the atomic reservation helper. `/api/transactions`, `/api/payments`,
  `/api/accelerated-payment`, `/api/crypto-purchases`, and the Mercury
  collect-roundup / pay-debt routes use check-then-save `checkIdempotency`
  (race window under concurrent retries). Migrate them to the reservation
  pattern before any of those routes move real money.
- **Axos `collect-roundup` trusts client-supplied `userAccountId`/`userRoutingNumber`.**
  Auth'd now, but no ownership mapping exists. Axos is unconfigured (503,
  dormant). Add account-ownership validation BEFORE configuring Axos creds.
- **Coinbase `transactions/:accountId` has no accountId-ownership check**
  (service is demo mode). Same rule: ownership check before real Coinbase keys.
- **`PLAID_WEBHOOK_SECRET` must be set before Plaid transfers go live.**
  Prod now fails CLOSED without it — rejected webhooks return 200 and only log,
  so ledger status updates would silently stop.
- **npm audit debt:** 5 crit/27 high — mostly CLI tooling (eas-cli/ionic)
  misfiled as prod deps; runtime fixables: express/axios/multer/express-rate-limit
  (`fixAvailable`); drizzle-orm SQLi fix is semver-major 0.45.2 (planned upgrade);
  lodash crit has no fix. Deliberately not auto-fixed on the live app —
  schedule as maintenance.
- **CSP intentionally omitted** from prod security headers (Capacitor WebView +
  Stripe.js breakage risk). Revisit only with device testing.
- **`ENABLE_REAL_TRANSFERS` is defined twice** — as a global Secret AND as an
  env-scoped Configuration (deployment `true` / testing `false`; confirmed in
  founder's Secrets-pane screenshots 2026-07-26). Precedence between the two is
  UNVERIFIED; behavior in both envs is currently known-good. If consolidating
  (keep env-scoped pair, drop the Secret), first confirm precedence via Replit
  docs and re-verify the testing env still blocks — it gates real money, never
  delete casually.

**Why:** each was judged lower-risk than the fix's regression risk days before
the founder-only $1 live ACH test; every deferral has a concrete trigger above.
**How to apply:** before enabling a provider (Axos/Coinbase/Plaid transfers) or
flipping a money flag, scan this list for the matching trigger.
