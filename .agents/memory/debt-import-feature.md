---
name: Automatic debt import (provider-agnostic)
description: How the flag-gated debt-import feature is wired and the constraints future work must respect.
---

# Automatic debt import

Provider-agnostic "automatic debt import" pulls a user's liabilities (balances, APR,
min payment) into the `debts` table. Ships with a SANDBOX provider AND a real Plaid
Liabilities provider; both implement the same `LiabilityProvider` interface. Designed
to add more real providers (Method, etc.) with no redesign.

## Key decisions / constraints (not obvious from code)

- **Real Plaid provider exists, but production is env-gated OFF.** The feature moves NO
  money — it only imports debt metadata (`liabilitiesGet` → `NormalizedLiability`).
  A real `plaidLiabilityProvider` is fully implemented and VERIFIED end-to-end against
  Plaid SANDBOX (link-token → Plaid Link → exchange → AES-256-GCM-encrypt access token →
  `liabilitiesGet` → import; idempotent re-import). Promotion to real user data is
  **config-only** (set prod Plaid creds + `PLAID_ENV=production` + Liabilities
  entitlement) — no code change. Do NOT flip any of those; Plaid production/Liabilities
  approval is a founder step that was previously rejected.
  **Why:** hard guardrail — real liability data is blocked on Plaid prod approval.
  **How to apply:** active provider chosen by `DEBT_IMPORT_PROVIDER` env var
  (default `sandbox`; `plaid` selects the real provider, still sandbox until PLAID_ENV
  flips). Swapping providers is env-var-level: implement `LiabilityProvider` + return it
  from `getLiabilityProvider()`. Rest of app only touches that factory and
  `NormalizedLiability` — never a concrete provider. Do NOT special-case a provider.

- **Client-connect providers use `linkFlow` + `LinkRequiredError`.** A provider that
  needs a browser handshake (Plaid Link) sets an optional `linkFlow` (`createLinkToken`
  + `completeLink`) on the provider and throws `LinkRequiredError` (code `link_required`)
  from `initializeConnection`/`fetchLiabilities` when there's no active connection+token.
  Routes map that to **HTTP 409 `{code:"link_required"}`** (control flow, NOT an error —
  no error audit row) so the client launches Plaid Link, then calls the exchange route.
  Sandbox provider has no `linkFlow` → `status.requiresLink=false` → direct-import path,
  unchanged. Plaid re-auth codes (`ITEM_LOGIN_REQUIRED`/`PENDING_EXPIRATION`/
  `PENDING_DISCONNECT`) are also mapped to `LinkRequiredError` so a broken item prompts
  reconnect instead of a dead-end 502.

- **Never log raw Plaid/axios errors.** Plaid SDK errors are axios errors whose `config`
  carries the request body (public_token/access_token) and the `PLAID-SECRET` header.
  `plaidService.redactPlaidError()` logs only `error_code`/`error_type`/`request_id`.
  Any new Plaid call MUST redact before logging — mandatory before PLAID_ENV=production.

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
