---
name: Stripe payout destination
description: Where Stripe payouts actually land — Stripe Balance storage account, NOT a bank — until founder links Mercury as external payout account
---

# Stripe payout destination (live account)

**Finding (2026-07-17):** The live Stripe account has **no external bank account on file**. Automatic payouts go to a **Stripe Balance storage financial account** (`fa_`-prefixed, v2 money_management, created during onboarding 2026-05-27) — not to Mercury or Chase.

- First real $1.00 ACH debt payment (settled 2026-07-14): Stripe fee $0.01, payout $0.99 marked "paid" 2026-07-15 → landed in Stripe Balance storage, where it sits (verified via v2 API, available balance $0.99).
- Payout objects show `destination: null`, `payout_method: fa_...`, `type: payout_method`, descriptor "Automatic balance transfer" — this pattern means Stripe Balance storage, not a bank transfer.

**Why:** Newer Stripe accounts get enrolled in Stripe Balance storage at onboarding; "paid" payout status then does NOT mean money reached a bank.

**How to apply:** If founder reports missing bank deposits from Stripe, check payouts for the `fa_` destination pattern first. Fix is founder-run in Dashboard: Settings → Bank accounts and currencies → link Mercury, pay out balance, set as default. (Reading the storage balance: GET /v2/money_management/financial_accounts with `Stripe-Version: 2025-05-28.preview` and Bearer auth.)

**Open item:** As of 2026-07-17 Tim had not yet linked Mercury — until he does, ALL user payment money accumulates inside Stripe Balance instead of reaching the business bank account.
