---
name: Real-money ACH rollout gate spec
description: per-user allowlist + dollar/count limits enforced by reserveRealStripeAchDebit; defense-in-depth on top of ENABLE_REAL_TRANSFERS
---

`ENABLE_REAL_TRANSFERS` is the master switch, but flipping it ON is NOT sufficient to move public money. A per-user gate fronts every real ACH debit — only explicitly allowlisted users under conservative limits, with full audit trail and instant revoke, can trigger a real charge. The public can never be auto-enrolled.

**Per-user allowlist (`users` table):** `realTransfersEnabled` (bool, default `false`), `realTransfersEnabledAt`, `realTransfersEnabledBy` (admin user id), `realTransfersNotes`.

**The gate — `storage.reserveRealStripeAchDebit()`** (`server/storage.ts`): single DB transaction holding a per-user advisory lock; re-reads live state (allowlist, active/linked `stripe_accounts`, debt ownership, in-flight transfers) INSIDE the lock so concurrent requests or a just-revoked allowlist can't race past. Enforces in order:
1. Allowlist → else `not_allowlisted` 403. **Route never calls Stripe on a block.**
2. First transfer ≤ $1 (`REAL_FIRST_TRANSFER_MAX_DOLLARS=1`) → else `over_first_transfer_limit` 422.
3. Daily total ≤ $5 (`REAL_DAILY_TOTAL_MAX_DOLLARS=5`, UTC day) → else `over_daily_total` 422.
4. Daily count ≤ 1 (`REAL_DAILY_COUNT_MAX=1`) → else `over_daily_count` 429.
5. Duplicate-pending guard (non-terminal transfer for same debt) → `duplicate_pending` 409.

On pass: writes `real_transfer_audit_logs` row AND `transfers` row (`status="created"`) atomically, returns `{ok:true, ledger, auditId, isFirst}`. Limit math counts only consumed statuses (`created/authorized/pending/processing/posted/settled/requires_action`); `simulated/failed/refunded/disputed` excluded. Every decision — approve AND block — writes an audit row.

**Simulation vs real split in `POST /api/stripe/ach/debit`:** test key mode (or real transfers off) → simulation path: no allowlist check, `status="simulated"`, Stripe never called for settlement. Real path (live key mode) requires valid mandate, then `reserveRealStripeAchDebit`; block → finalize with `gate.httpStatus`, Stripe never called; approve → `gate.ledger` + Stripe + outcome audit logs.

**Emergency disable (admin):** `POST /api/admin/users/:id/real-transfers` (`requireAdmin`, `{enabled, notes?≤500}`) flips the allowlist; gate re-reads live inside the lock so revoke takes effect on the very next attempt — no restart. Also `GET /api/admin/users/:id/real-transfers` and `GET /api/admin/real-transfer-audit`.

**Auto sweeps blocked by default:** `sweepService.processWeeklyDispersals` gated behind `ENABLE_AUTO_ROUNDUP_SWEEPS` (default OFF) → logged no-op. `sweepRoutes` is unmounted dead code, hardened (demo-user fallback removed, requires auth + requireAdmin).

**Verifying the gate (DEV ONLY):** call `reserveRealStripeAchDebit` directly against dev DB with a throwaway allowlisted user (allowlist→403, first-$1→422, approve, duplicate→409, daily-count→429, revoke, audit trail, delete-cascade). Never flips prod flags, never calls Stripe. **Agent never runs a live charge** — see real-money-gate-testing.md.
