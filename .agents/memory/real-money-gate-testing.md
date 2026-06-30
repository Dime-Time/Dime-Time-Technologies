---
name: Real-money ACH gate — safe verification
description: How to verify money-movement gates in this fintech app without ever moving real money or touching prod.
---

# Verifying money-movement gates safely

This app is LIVE on the App Store and moves (or will move) real ACH money. Real-money
code paths are protected by a master flag (`ENABLE_REAL_TRANSFERS`, default OFF) **plus**
a per-user allowlist gate (`storage.reserveRealStripeAchDebit`). The gate is the real
safety boundary; the master flag alone is not enough to charge the public.

## Rule: verify the gate at the storage layer, against the dev DB, never through Stripe.
The gate's logic (allowlist, first-$1 / daily-$5 / 1-per-day limits, duplicate-pending
guard, instant revoke, audit-row-on-every-decision, delete cascade) is fully provable by
calling `reserveRealStripeAchDebit` directly with a throwaway allowlisted user on the dev
DB. A throwaway `tsx` script doing exactly this passed all branches (403/422/409/429 +
approve + revoke + cascade) with zero Stripe calls.

**Why:** SDK-level / live-charge testing of a published fintech app is irreversible and
regulated; the limit math and allowlist re-read happen entirely in our transaction, so
provider calls add no coverage but huge risk.

**How to apply:**
- Agent must NEVER flip `ENABLE_REAL_TRANSFERS` in prod, run a live charge, or handle live
  secrets. The first real-money $1 test is a **founder-run** runbook step, not an agent step.
- Limit math counts only consumed statuses (`created/authorized/pending/processing/posted/
  settled/requires_action`); `simulated/failed/refunded/disputed` are excluded; daily window
  is UTC. Mark a transfer `settled` (not `failed`) to simulate a consumed-but-not-pending row.
- The `test`-key path is the simulation path (`status="simulated"`, no allowlist, no Stripe
  settlement); the allowlist gate only engages on the live-key real path.
