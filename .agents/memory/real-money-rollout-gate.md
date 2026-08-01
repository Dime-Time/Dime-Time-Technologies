---
name: Real-money rollout gate spec
description: How the real Stripe ACH debit gate works — default-allow block list + conservative launch limits
---

**2026-08-01 change (founder decision, launch-day):** the per-user allowlist was INVERTED to a block list. Every user can make real transfers by default; an admin can block a specific user instantly via the admin Real Money tab.

- Columns: `users.realTransfersBlocked` (default false = allowed), `realTransfersBlockedAt`, `realTransfersBlockedBy`, `realTransfersNotes`. The old `real_transfers_enabled*` columns were DROPPED (not renamed — a rename would have inverted semantics).
- Gate `storage.reserveRealStripeAchDebit` still enforces, inside one transaction under a per-user advisory lock: user exists + not blocked, account ownership/active, debt ownership/active, duplicate-pending guard, first transfer ≤ $1, daily total ≤ $5, daily count ≤ 1. Blocks NEVER call Stripe. Full audit trail in `real_transfer_audit_logs` (reason string `not_allowlisted` kept for blocked users, for continuity).
- Admin API shape unchanged: response field `realTransfersEnabled` is computed as `!realTransfersBlocked`; `setUserRealTransfersEnabled(userId, enabled)` writes `blocked = !enabled` under the SAME advisory lock (block effective on very next attempt).
- **Prod migration hazard:** when publishing, the Replit schema diff may offer to RENAME `real_transfers_enabled` → `real_transfers_blocked`. That must be answered **create new column + drop old** — a rename carries old values and inverts access (founder's enabled=true account would become blocked). Founder was warned to pick "create".
- `ENABLE_REAL_TRANSFERS` master switch still required overall.
