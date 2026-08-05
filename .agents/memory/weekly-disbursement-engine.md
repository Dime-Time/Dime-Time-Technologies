---
name: Weekly Friday disbursement engine
description: Design decisions + money-safety invariants of the Mercury weekly round-up disbursement; read before touching disbursement, transfers-ledger balance math, or Mercury payouts.
---

Round-ups accumulate in Tim's Mercury **savings** account (earns interest); every Friday 00:00 America/New_York accumulated per-user balances are ACH'd from Mercury to each user's target debt's creditor.

**Why savings:** interest-on-float is part of the revenue model (needs fintech-attorney review before marketing it). `resolveFundingAccountId` in mercuryService intentionally matches MERCURY_ACCOUNT_NUMBER regardless of account kind — do not re-add a checking preference.

**Money-safety invariants (architect-review hardened, 4 rounds):**
- Balance = settled `roundup_collection`/`stripe_ach_debit` minus non-void `debt_payment` rows in the transfers ledger. Void deny-list: failed/cancelled/returned/refunded/**simulated**. Unknown statuses COUNT as spent — fail-safe against double-pay, never against a second payout.
- One run per Friday: unique index on `weekly_distributions.distribution_date`; runs claim via INSERT..ON CONFLICT DO NOTHING. Crashed 'processing' runs resume only through a single-winner CAS (`resumeWeeklyDistribution`, 30-min cool-off on `last_claimed_at`).
- `transfers.idempotency_key` is globally UNIQUE (nulls exempt). Weekly line keys are deterministic (`weekly-disbursement:<friday>:<user>:<debt>`), so retries must REUSE the failed row (reset in place), never insert; unique violations skip the line, never crash the batch.
- Ambiguous Mercury errors (timeout/5xx) → `requires_action` + MERCURY_OUTCOME_UNKNOWN, still counts as spent until admin reconciles against Mercury dashboard. Only definitive 4xx → `failed` (re-eligible next Friday).
- Ledger row written BEFORE the Mercury call; preview/balances recomputed AFTER the claim, so resumes skip already-paid users.

**Gates:** ENABLE_WEEKLY_DISBURSEMENT (default OFF; scheduler doesn't even start) AND ENABLE_REAL_TRANSFERS AND Mercury configured AND user not blocked AND debt has admin-entered payeeAccountNumber + 9-digit payeeRoutingNumber AND ≥$1. Admin endpoints: preview (GET) and run (POST, dryRun defaults TRUE).

**Scheduler:** in-process, 15-min tick + 30s boot check, catch-up semantics (Autoscale sleeps at midnight). All claim/resume gating lives in runWeeklyDisbursement — schedulerTick only short-circuits `completed`.

**Biggest operational gap:** payouts need creditor ACH details per debt, admin-entered; debts without them are skipped with reason recorded.

**How to apply:** any new debt-payment writer must pick a status deliberately (void vs spent); any change to weekly line semantics must preserve the reuse-not-reinsert retry rule.
