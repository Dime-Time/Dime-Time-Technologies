---
name: Masked Plaid token contract
description: Bank-account reads return '[encrypted]' placeholder tokens; live tokens only via getPlaidAccessToken
---
Storage bank-account list/read methods mask `plaidAccessToken` as `'[encrypted]'`. Any code that passes `account.plaidAccessToken` to Plaid silently fails (Plaid rejects the placeholder, errors get swallowed per-account).

**Why:** 2026-07-28 the balances and transactions routes did exactly this — Banking page showed $N/A balances for a correctly linked account. Both routes fixed to call `storage.getPlaidAccessToken(account.id)`.

**How to apply:** any new route or job needing a live Plaid token must call `getPlaidAccessToken(bankAccountId)` (DB impl decrypts; MemStorage returns plaintext). Never use the token field off a listed account object.
