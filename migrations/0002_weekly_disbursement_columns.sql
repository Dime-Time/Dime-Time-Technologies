-- Weekly round-up disbursement (Mercury live path).
-- Additive, nullable columns only — safe to apply to production.

ALTER TABLE weekly_distributions
  ADD COLUMN IF NOT EXISTS provider text;

ALTER TABLE distribution_payments
  ADD COLUMN IF NOT EXISTS mercury_transfer_id text;

ALTER TABLE distribution_payments
  ADD COLUMN IF NOT EXISTS transfer_id varchar;

ALTER TABLE weekly_distributions
  ADD COLUMN IF NOT EXISTS last_claimed_at timestamp;

-- One distribution per Friday — the atomic claim that prevents concurrent
-- runs from double-paying (insert-on-conflict-do-nothing against this).
CREATE UNIQUE INDEX IF NOT EXISTS uq_weekly_distributions_date
  ON weekly_distributions (distribution_date);

-- Defense-in-depth: duplicate ledger rows for the same idempotency key fail
-- loudly. NULLs are exempt (Postgres default), so legacy rows are unaffected.
CREATE UNIQUE INDEX IF NOT EXISTS uq_transfers_idempotency_key
  ON transfers (idempotency_key);
