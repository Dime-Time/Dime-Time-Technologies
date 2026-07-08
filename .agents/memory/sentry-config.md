---
name: Sentry wiring and redaction guarantees
description: env vars, PII redaction rules (test-enforced), correlationId propagation, source-map policy
---

Wiring: `server/lib/sentry.ts`, `client/src/lib/sentry.ts`, shared redactor `shared/sentryRedact.ts`. All env vars optional — Sentry is silent if unset, and the `@sentry/node`/`@sentry/react` packages are never even imported without a DSN (dynamic `import()` gated on DSN presence).

**Env vars:**
- `SENTRY_DSN` — single canonical DSN; server reads at runtime, `vite.config.ts` forwards to client bundle at build time as `VITE_SENTRY_DSN`.
- `SENTRY_ENVIRONMENT`, `SENTRY_RELEASE` — optional tags, forwarded to client too (matched release enables cross-stack grouping).
- `SENTRY_AUTH_TOKEN` + `SENTRY_ORG` + `SENTRY_PROJECT` — build-time trio required for client source-map upload (prod build only).

**Redaction guarantees (enforced by `server/lib/__tests__/sentry-redact.test.ts`; run with `npx tsx --test server/lib/__tests__/sentry-redact.test.ts`):**
- Query strings AND fragments stripped from `request.url`, all `breadcrumbs[].data.url`/`to`/`from`, and any http(s)-looking string in `extra`/`contexts`/`request.data`.
- Any key matching `/token|password|secret|api[_-]?key|authorization|cookie|plaid[_-]?access[_-]?token|access[_-]?token|refresh[_-]?token/i` → literal `[Filtered]`.
- `Authorization`, `Cookie`, `Set-Cookie` headers filtered.
- Free-form `message`/`exception.value` have `token=…`/`password=…`/`access_token=…` params scrubbed.
- **Hard assertion:** `/verify-email` and `/reset-password` (and POST endpoints) must never carry a query string in any captured event (test asserts no `?` and no `token=`).

**CorrelationId propagation:** `transferLog`/`log` helpers in `server/routes/mercuryRoutes.ts`, `server/services/mercuryService.ts`, `server/services/plaidService.ts` call `setCorrelationTag(correlationId)` on the isolation scope. Client: `throwIfResNotOk` in `client/src/lib/queryClient.ts` parses the server's JSON error body and tags the Sentry scope with any `correlationId` — client exception carries the same id as the server event.

**Source maps:** uploaded only when `NODE_ENV=production` AND the auth-token trio is set; `.map` files deleted after upload (`filesToDeleteAfterUpload`), and `server/index.ts` 404s any `.map` request as second-layer defense.
