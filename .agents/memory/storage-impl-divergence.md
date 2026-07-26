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

Signature drift is now closed: every convenience method services call
(getAllUsers, getUserDebts, getUserTransactions, getUserCryptoPurchases,
getUserNotifications, getDashboardSummary) is declared on `IStorage`, and
getDashboardSummary delegates to one shared `computeDashboardSummary` helper
returning a typed `DashboardSummary`. Behavioral drift can still happen:

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

## DB-backed parity tests need a synced dev schema
Behavioral parity for the debt-import bump rule is pinned by a dev-DB test
alongside the MemStorage one. The dev database can lag `shared/schema.ts`
(42703 "column does not exist"); run `npm run db:push -- --force` before
blaming the storage code when a DB-backed test fails that way.

## Write-path parity now pinned too
The parity suite also runs money-moving WRITES against both impls
(accelerated payment math + clamp + paidOffAt, archive/restore archivedAt,
permanent-delete cascade + round-up target nulling). It already caught real
drift: MemStorage stamped accelerated payments `source:'manual'` while
DatabaseStorage used `'accelerated'` (fixed 2026-07-26). Any new business rule
in a storage write should get a pin in the write-parity observation.

(The previously-noted `POST /api/payments` debtId IDOR was closed in the
2026-07 pre-launch security pass — ownership + isActive are now checked.)
