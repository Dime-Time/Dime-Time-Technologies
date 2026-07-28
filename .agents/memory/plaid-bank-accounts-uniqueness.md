---
name: bank_accounts uniqueness is per (item, account)
description: Why bank_accounts uniqueness must be composite, and that prod needs the same constraint migration on next deploy.
---

# bank_accounts uniqueness: per (plaid_item_id, account_id)

Rule: one Plaid Item spans many accounts. `bank_accounts` uniqueness is the composite `(plaid_item_id, account_id)` (`bank_accounts_item_account_unique`), never `plaid_item_id` alone. Insert path is an upsert on that pair (refreshes access token + metadata on re-link) in BOTH storage implementations.

**Why:** the original `plaid_item_id UNIQUE` constraint made linking any multi-account bank 500 on the second account insert — every /bank-setup and /banking Plaid link to a normal bank failed (found via sandbox e2e 2026-07-28).

**How to apply:** the dev DB was migrated in place (DROP `bank_accounts_plaid_item_id_unique`, ADD composite). The PRODUCTION database still has the old constraint until the schema change is pushed at the next deploy — if prod bank linking reports "Failed to exchange token" with a 23505 on plaid_item_id, this migration hasn't reached prod yet. Apply: `ALTER TABLE bank_accounts DROP CONSTRAINT IF EXISTS bank_accounts_plaid_item_id_unique; ALTER TABLE bank_accounts ADD CONSTRAINT bank_accounts_item_account_unique UNIQUE (plaid_item_id, account_id);`
