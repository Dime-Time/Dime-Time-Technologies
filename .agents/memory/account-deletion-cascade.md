---
name: Account deletion cascade completeness
description: deleteUserAccount must delete every user-scoped FK table, atomically, or deletion 500s
---

Account deletion (`storage.deleteUserAccount`) deletes child rows then the `users` row, and must cover EVERY table whose `userId` is a NOT NULL FK to `users.id`, all inside a single `db.transaction(...)`.

**Why:** When the Stripe ACH feature added the `stripe_accounts` and `ach_authorizations` tables (both `userId` NOT NULL FK to `users.id`), neither was added to the deletion cascade. Any user who linked a Stripe bank or signed an ACH authorization could then no longer delete their account — the final `delete(users)` threw a Postgres FK violation → 500. The deletes were also non-transactional, so a mid-sequence failure left orphaned partial state (a `users` row with most children already gone). For a fintech app, account deletion (a data-rights guarantee) must be all-or-nothing.

**How to apply:** Whenever you add a table with a `userId` FK to `users.id`, also add its delete to `deleteUserAccount` BEFORE the `users` delete. To find gaps, grep `shared/schema.ts` for `references(() => users.id)` and diff the table list against the deletes in `deleteUserAccount`. Tables with DB-level `onDelete: cascade` (e.g. password/email verification tokens) and non-FK `userId` columns (e.g. `contact_submissions`, retained for support history) do NOT block deletion. The DB driver is `@neondatabase/serverless` Pool (drizzle `neon-serverless`), which supports interactive transactions.
