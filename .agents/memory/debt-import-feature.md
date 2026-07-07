---
name: Automatic debt import (provider-agnostic)
description: How the flag-gated debt-import feature is wired and the constraints future work must respect.
---

# Automatic debt import

Provider-agnostic "automatic debt import" pulls a user's liabilities (balances, APR,
min payment) into the `debts` table. Built against a SANDBOX provider; designed to
swap to a real liability provider (Plaid Liabilities / Method) with no redesign.

## Key decisions / constraints (not obvious from code)

- **Sandbox-only until a real provider is approved.** The app moves NO money in this
  feature — it only imports debt metadata. Plaid is sandbox-only (no Liabilities/prod
  approval); real money movement is Stripe's job, kept entirely separate.
  **Why:** hard guardrail — no live liability provider is approved yet.
  **How to apply:** the active provider is chosen by the `DEBT_IMPORT_PROVIDER` env var
  (default `sandbox`). Swapping providers is env-var-level: implement the
  `LiabilityProvider` interface + return it from `getLiabilityProvider()`. The rest of
  the app only ever touches that factory and the `NormalizedLiability` type — never a
  concrete provider. Do NOT special-case a provider anywhere else.

- **Fail-closed flag gating.** Routes are mounted only inside
  `if (isFlagEnabled("ENABLE_DEBT_IMPORT"))` (default OFF), same pattern as Stripe. When
  OFF the routes don't exist. In dev a POST to an unmounted `/api/*` route returns the
  Vite SPA `index.html` (200) — that's the dev catch-all, NOT a mounted route. Confirm
  gating via the boot log line (`debt_import_routes_mounted`) or a JSON 401, not the
  HTTP status alone.

- **Provider-owned columns are omitted from `insertDebtSchema`** so a user can't forge an
  `source:"imported"` debt via `POST /api/debts` (mass-assignment protection). Any new
  provider/import column added to `debts` must also be added to that `.omit(...)` list.

- **`userEditedFields` is currently write-never.** Refresh skips any field listed there so
  a re-import won't clobber a user's manual edit. But there is no debt-edit endpoint yet
  that populates it. **When a debt-edit UI/endpoint is added it MUST append the edited
  field names to `userEditedFields`, or refresh will silently overwrite the user's edits.**

- **Idempotency:** dedupe is on `(userId, provider, providerAccountId)` — enforced in the
  upsert loop AND by the `debts_provider_account_uq` unique index (Postgres NULLS DISTINCT
  leaves manual debts, which have null provider, unaffected). Concurrent imports could race
  on the unique index (one 502s) but never duplicate.
