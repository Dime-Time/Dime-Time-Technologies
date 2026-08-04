---
name: Email verification enforcement
description: REQUIRE_EMAIL_VERIFICATION flag design — centralized middleware, prefix list, prod-boot explicitness, rollout order
---

# Email verification enforcement (built Aug 4, 2026; NOT yet active in prod)

Rule: all server-side verification gating lives in ONE middleware
(`requireVerifiedEmail`) with ONE prefix list — never scatter per-route
checks. The flag `REQUIRE_EMAIL_VERIFICATION` defaults OFF, and production
boot FAILS unless it is explicitly set (`validateEnv`) — it is never guessed.

**Why:** the Aug 2026 audit found only 4/24 prod users verified with full
access; enforcement had to be added without breaking existing users or the
next deploy silently.

**How to apply:**
- Next production deploy REQUIRES setting `REQUIRE_EMAIL_VERIFICATION=false`
  in the prod env first (deploy fails to boot otherwise, by design). Flip to
  `true` only after smoke-testing resend/verify on prod web.
- The middleware only ADDS a 403 for logged-in unverified users; anonymous
  requests pass through (route auth owns the 401). Webhooks (`/webhooks/stripe`,
  `/webhooks/plaid`) exempt. Recovery surface (user/logout/resend/verify/
  contact/account-delete) is unlisted, hence never gated.
- Gotchas learned: token routes are `/api/dime-token/*` (NOT `/api/tokens`);
  Stripe webhook is `/webhooks/stripe` (NOT `/api/stripe/webhook`). Tests pin
  both.
- Client mirror: full-screen `VerificationRequired` card in
  AuthenticatedLayout — server enforcement is the real gate.
- 2FA/Apple-demo-account exemption must be considered before flipping ON
  (demo review account must stay verified or exempt).
