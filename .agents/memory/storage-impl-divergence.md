---
name: MemStorage vs DatabaseStorage divergence
description: The two IStorage implementations can silently diverge in read/filter logic — keep them in sync, especially for soft-delete/isActive filtering.
---

# MemStorage vs DatabaseStorage can silently diverge

`server/storage.ts` ships two `IStorage` implementations: `MemStorage` (dev/tests)
and `DatabaseStorage` (the exported `storage`, Postgres/Drizzle). They are edited
independently and **have drifted** — e.g. `MemStorage.getDebtsByUserId` filtered
`isActive` for a long time while `DatabaseStorage.getDebtsByUserId` did **not**,
so a soft-delete (isActive=false) would hide a debt in dev but not in prod.

**Why:** TypeScript only checks that both satisfy the interface (method
signatures), not that their *behavior* matches. A filter added to one class is
not enforced on the other.

**How to apply:** Whenever you add or change filtering/ordering/soft-delete
semantics on any storage read, grep for the method name and update BOTH classes
in the same edit. Don't assume the DB implementation mirrors the in-memory one.

## Soft-delete over hard-delete for debts
`payments.debtId` is a NOT-NULL FK → `debts.id`, so hard-deleting a debt with
payment history 500s on the FK and destroys the money trail. Debts are removed
via soft-delete (`isActive=false`) and hidden by the `getDebtsByUserId` filter.
Same lesson family as the account-deletion cascade note.

## Known adjacent gap (found in review, left out of scope)
`POST /api/payments` performs **no ownership check on `debtId`** — an
authenticated user can pass another user's debt id and mutate that victim's
`currentBalance` (cross-tenant IDOR; no real money moves while
`ENABLE_REAL_TRANSFERS` is off). The fix is the same getDebt→userId-match→404
pattern used by `PATCH`/`DELETE /api/debts/:id`. Worth closing next.
