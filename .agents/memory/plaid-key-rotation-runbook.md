---
name: PLAID_TOKEN_ENCRYPTION_KEY rotation runbook
description: exact ordered steps to rotate the at-rest encryption key for Plaid tokens AND Stripe PM ids; order matters or tokens become unreadable
---

`PLAID_TOKEN_ENCRYPTION_KEY` lives only as a Replit Secret (never in `.replit`). It is the single canonical secret for ALL at-rest provider credentials: `bank_accounts.plaid_access_token` AND `stripe_accounts.stripe_payment_method_enc` (both use `encryptToken`/`decryptToken` from `server/services/encryptionService.ts`).

**Why the order matters:** a token written with the old key after migration but before the Secret swap becomes permanently unreadable.

**Rotation steps (in order):**
1. **Stop the `Start application` workflow** — guarantees no new `bank_accounts` rows are inserted under the old key during/after migration. (The migration script also takes an `ACCESS EXCLUSIVE` table lock as defense-in-depth.)
2. Generate a new key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
3. Dry run against prod to confirm every row decrypts cleanly:
   `PLAID_TOKEN_ENCRYPTION_KEY_OLD=<old> PLAID_TOKEN_ENCRYPTION_KEY_NEW=<new> DATABASE_URL=$PROD_DATABASE_URL DRY_RUN=1 npx tsx scripts/rotate-plaid-encryption-key.ts`
4. Re-run without `DRY_RUN=1` — re-encrypts every row in a single transaction (rolls back if any row fails). Stripe PM ids re-encrypt as part of the same migration.
5. Update the `PLAID_TOKEN_ENCRYPTION_KEY` Replit Secret to the NEW value.
6. Restart the workflow and verify a test user's balances/transactions load end-to-end.
7. Discard the old key from any local shells / password managers.
