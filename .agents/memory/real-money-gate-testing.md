---
name: Real-money ACH gate — safe verification
description: How to verify money-movement gates in this fintech app without ever moving real money or touching prod.
---

# Verifying money-movement gates safely

This app is LIVE on the App Store and will move real ACH money. Real-money paths are
guarded by a master flag (`ENABLE_REAL_TRANSFERS`, default OFF) PLUS a per-user allowlist
gate. The gate — not the master flag — is the real safety boundary.

## Rule: verify the gate at the storage layer, on the dev DB, never through Stripe.
Drive the gate logic directly (allowlist, limits, duplicate guard, revoke, audit, cascade)
with a throwaway allowlisted user against the dev DB. Never call the Stripe SDK to "test"
it and never run a live charge.

**Why:** SDK/live-charge testing of a published fintech app is irreversible and regulated;
the gate's decision happens entirely inside our DB transaction, so provider calls add no
coverage but real risk.

**How to apply:**
- The agent must NEVER flip `ENABLE_REAL_TRANSFERS` in prod, run a live charge, or handle
  live secrets. The first real-money $1 test is a FOUNDER-run runbook step, not an agent step.
- Regression coverage lives in `server/__tests__/real-transfer-gate.test.ts` (dev DB, no Stripe).
- The committed reservation (created under the per-user advisory lock) is the authorization
  boundary: a revoke that commits afterward stops future debits, not one already reserved.
