---
name: Gates before enabling real Stripe ACH transfers
description: what MUST be true/added before ever flipping ENABLE_REAL_TRANSFERS on
---

`ENABLE_REAL_TRANSFERS` is the kill-switch that lets money-movement endpoints actually settle. It must stay OFF until staged testing passes AND the founder gives explicit final go. The agent must never flip it, set live secrets, or run a live charge — those are founder-run steps. Dev resolves the Stripe key by mode: `STRIPE_SECRET_KEY_TEST` is used in development even though the global live `STRIPE_SECRET_KEY` exists (boot log `stripe_mode_resolved mode:"test"` proves it); the real path requires live key mode + flag ON + allowlist + valid mandate, otherwise the debit route takes the `status:"simulated"` no-Stripe path.

**Why:** Flipping the flag with gaps in the debit route would move real customer money on insufficiently-validated input.

**Current state (verified):** the server-side gate `reserveRealStripeAchDebit` now enforces (inside one txn + per-user advisory lock): allowlist flag, `stripe_accounts` row `isActive && status==="linked"`, `debtId` ownership+active, duplicate-pending guard, first≤$1, daily total≤$5, daily count≤1. Every approve AND block writes a `real_transfer_audit_logs` row. So the earlier "route only checks userId ownership / active-account only enforced in UI" gap is CLOSED — do not re-report it as a gap.

**Founder/config prerequisites still required before the live $1 test (not code):**
- Set `ADMIN_USER_IDS` (global Secret) to the founder's prod user UUID — without it the admin `/admin` "Real Money" approve/revoke tab has no admins (fails closed), so the founder can't allowlist themselves. Restart/republish after.
- Live Stripe webhook in the dashboard must point at `https://dime-time.com/webhooks/stripe` (NOT `/api/stripe/webhook`), subscribed to payment_intent.processing/succeeded/payment_failed/canceled + charge.dispute.created/closed, signing secret matching `STRIPE_WEBHOOK_SECRET`.

**Env-var naming decision (do NOT drift):** external "go-live" specs sometimes ask for `FIRST_TRANSFER_MAX_CENTS` / `DAILY_TRANSFER_MAX_CENTS` / `WEEKLY_TRANSFER_MAX_CENTS`. We deliberately KEEP the existing `REAL_FIRST_TRANSFER_MAX_DOLLARS`(=1) / `REAL_DAILY_TOTAL_MAX_DOLLARS`(=5) / `REAL_DAILY_COUNT_MAX`(=1). **Why:** the dollar-based limits are equal-or-stricter for the $1 test, there is intentionally no weekly cap (daily count of 1 is tighter), and renaming money-gate env vars is risky churn for zero functional gain. Don't rename to match a spec on future asks.
