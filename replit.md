# Dime Time - Fintech Debt Reduction App

## Overview
Dime Time is an innovative fintech mobile application designed to make debt reduction engaging and user-friendly. It features real user authentication, bank account integration via Plaid, cryptocurrency functionalities, and automated round-up debt payment technology. The app aims to help users systematically reduce debt through automated financial tracking, micro-investment strategies, and consistent micro-payments. The project's ambition is to provide a fully functional, secure, and intuitive platform for financial well-being.

## User Preferences
- Focus on mobile-first experience
- Clean, intuitive UI with purple branding
- Real functioning app, not demo/website
- Proper user authentication and data separation
- Full fintech feature set accessible to users

## Canonical Project Rules (locked — do not drift)

### Domain & Contact
- Official domain: **https://dime-time.com** (with hyphen)
- Working business email: **tim@dime-time.com**
- DO NOT use `dimetime.com` (no hyphen) — Tim does not own that domain
- All user-facing email references must be `tim@dime-time.com` until further notice

### Compliance Language (use verbatim where contact/legal copy is needed)
- Positioning: *"Dime Time is a financial technology platform that helps consumers automate payments, manage ACH transfers, and build healthier financial habits through secure digital money tools."*
- Disclaimer: *"Dime Time is a financial technology platform and is not a bank. Banking services and payment infrastructure are provided through regulated financial partners."*
- DO NOT add Stripe / Plaid / Dwolla / Moov / Increase / bank partner logos until written approval/permission is confirmed.

### Marketing Site Invariants (LandingPage.tsx, privacy.tsx, terms.tsx)
- Homepage is single-page scroll — no separate `/about`, `/contact`, or `/faq` routes
- `/privacy` and `/terms` are standalone pages, scoped to `.dt-marketing` wrapper (opts out of in-app lavender theme)
- Legal effective date: **May 27, 2026** (constant `EFFECTIVE_DATE` — only bump when policy text actually changes)
- Contact form must POST to `/api/contact` and save to `contact_submissions` table
- Contact form fallback / mailto link → `tim@dime-time.com`
- All "Get Started" CTAs route to `/signup`
- Use only the official logo (`@/assets/dime-time-app-icon.png`) and color `#918EF4` (`bg-dime-purple` / `text-dime-purple`)

### Backend Invariants
- `POST /api/contact` is rate-limited via `contactLimiter` (5 req/min/IP) AND requires a valid Cloudflare Turnstile token (`turnstileToken` in body) when `TURNSTILE_SECRET_KEY` is configured. In production, missing `TURNSTILE_SECRET_KEY` causes the endpoint to fail closed (fails verification). The frontend reads `VITE_TURNSTILE_SITE_KEY` and renders the widget only when set. Required secrets before public launch: `TURNSTILE_SECRET_KEY` (server) + `VITE_TURNSTILE_SITE_KEY` (client build).
- Webhooks and ACH endpoints stay signature-verified, idempotent, and structured-logged with `correlationId` (see ACH Production Hardening below).

### External Infrastructure Status (as of 2026-05-27)
- Stripe account is **live**; Stripe Treasury review is **in progress**
- Business bank account is connected in Stripe
- Pursuing ACH infrastructure via Stripe, Dwolla, Moov, Increase, Plaid (Plaid previously rejected; pursuing alternates)
- Transfer adapter layer (transfers ledger + idempotency + encrypted access tokens) is provider-agnostic — swapping providers is adapter-level, not core work

### Next Development Priority
- Build the first end-to-end working ACH/payment flow:
  signup → bank account connect → schedule payment/transfer → transaction tracked in dashboard

## System Architecture

### UI/UX Decisions
- **Styling**: Tailwind CSS with a custom Dime Time purple (#918EF4)
- **UI Components**: shadcn/ui for professional design
- **Branding**: Clean, intuitive UI with purple branding

### Technical Implementations
- **Platform**: Capacitor Hybrid App (iOS/Android)
  - **Web Framework**: React.js with TypeScript (runs in native WebView)
  - **Native Layer**: Capacitor 7.4.x (wraps web app for iOS/Android)
  - **Routing**: Wouter for SPA navigation
- **Frontend State Management**: TanStack Query (React Query) for API calls
- **Backend**: Express.js with Node.js
- **Database**: PostgreSQL with Drizzle ORM
- **Authentication**: Email/password with SHA256 hashing; PostgreSQL session store
- **API**: RESTful endpoints for all fintech features

### Feature Specifications
- **User Authentication**: Email/password signup, secure login with session management, real user accounts.
- **Debt Management**: View and track personal debts, interest rates, minimum payments, and accelerated payment options.
- **Roundup Technology**: Collect spare change from purchases, direct roundups to debt payments, customizable multiplier settings.
- **Banking Integration**: Connect real bank accounts, view actual transactions.
- **Crypto Features**: Coinbase integration, Bitcoin purchases via roundups, portfolio tracking.
- **Analytics & Insights**: Debt-free projections, payment tracking, financial progress visualization.

### System Design Choices
- **Security**: Auth tokens encrypted at rest using AES-GCM (WebCrypto API) and stored in localStorage. PIN lock with SHA-256 hash, auto-lock on background.
- **ACH Production Hardening**:
    - **Transfer Ledger**: `transfers` table tracks money movements with full lifecycle status.
    - **Idempotency**: `Idempotency-Key` header support for `collect-roundup` and `pay-debt` routes.
    - **Plaid Access Token Encryption**: Tokens stored AES-256-GCM encrypted at rest.
    - **Plaid Webhook Endpoint**: `POST /webhooks/plaid` for status updates, signature-verified and idempotent.
    - **Structured Reconciliation Logging**: JSON logs with `correlationId` for all transfer operations.
    - **Funding Account Validation**: Explicit failure if `MERCURY_PLAID_FUNDING_ID` is not set in production.
    - **Plaid Token Encryption Key Rotation**: `PLAID_TOKEN_ENCRYPTION_KEY` lives only as a Replit Secret (never in `.replit`). To rotate (e.g. after a suspected leak), perform steps in this order — the order matters, otherwise a token can be written with the old key after migration but before the Secret swap and become permanently unreadable:
        1. **Stop the `Start application` workflow.** This guarantees no new `bank_accounts` rows are inserted under the old key during or just after the migration. (The migration script also takes an `ACCESS EXCLUSIVE` table lock as defense-in-depth.)
        2. Generate a new key: `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`
        3. Dry run against prod to confirm every row decrypts cleanly:
           `PLAID_TOKEN_ENCRYPTION_KEY_OLD=<old> PLAID_TOKEN_ENCRYPTION_KEY_NEW=<new> DATABASE_URL=$PROD_DATABASE_URL DRY_RUN=1 npx tsx scripts/rotate-plaid-encryption-key.ts`
        4. Re-run without `DRY_RUN=1` to re-encrypt every `bank_accounts.plaid_access_token` in a single transaction (the script rolls back if any row fails).
        5. Update the `PLAID_TOKEN_ENCRYPTION_KEY` Replit Secret to the NEW key value.
        6. Restart the `Start application` workflow and verify a test user's balances/transactions still load end-to-end.
        7. Discard the old key value from any local shells / password manager entries.
- **Mobile Deployment**: CodeMagic CI/CD on Mac mini M2, distribution via App Store Connect (TestFlight → App Store) with Apple Developer Account certificates.
- **Capacitor Cold-Start Rule**: NEVER set `server.url` in `capacitor.config.ts`. Doing so makes the iOS WebView download the entire Vite bundle from `https://dime-time.com` on every cold launch (~10s delay observed in TestFlight). Bundled web assets must ship inside the IPA (`webDir: 'dist/public'` → `ios/App/App/public/`); API calls are routed to production via `Capacitor.isNativePlatform()` in `client/src/lib/queryClient.ts`. Before each Codemagic build, run `npm run build && npx cap sync ios` so `ios/App/App/public/` contains a fresh bundle (otherwise stale placeholders ship).
- **iOS Build Number Source of Truth**: `ios/App/App/Info.plist` is authoritative for BOTH `CFBundleShortVersionString` (marketing version, e.g. `1.0.3`) and `CFBundleVersion` (build number, e.g. `201`). `codemagic.yaml` READS from Info.plist and does NOT overwrite it. Two guards prevent Apple rejections: (1) the "Verify iOS build number from Info.plist" step fails the build if Info.plist's CFBundleVersion is `<= LAST_ACCEPTED_BY_APPLE`, (2) the "Inspect final IPA metadata" step unzips the built IPA and re-checks before upload. To bump the build number: edit `CFBundleVersion` in Info.plist, also bump `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` to match, commit, push, trigger Codemagic. After Apple accepts the upload, update `LAST_ACCEPTED_BY_APPLE` in `codemagic.yaml`. Historical rejections (do not repeat): build 110 hardcoded April 2026, build 200 hardcoded May 2026 — both caused by a prior agvtool step that OVERWROTE Info.plist.

## Feature Flags

All feature flags are defined once in `shared/flags.ts` and read on both sides:

- **Server**: `server/lib/flags.ts` exposes `getFlags()` / `isFlagEnabled(name)`. Resolved once at module load — flipping a flag requires restarting the `Start application` workflow (matches our env-var deployment model).
- **Client**: `useFlag(name)` hook in `client/src/hooks/useFlag.ts`. Values are piggybacked onto the `/api/user` bootstrap response as `_flags` (no extra round trip — important for iOS WebView cold-start latency). NEVER read flags from `import.meta.env` on the client; build-time env vars can't be flipped without a redeploy.

Flag env vars (all read with tolerant parsing — `1` / `true` / `yes` / `on` / `0` / `false` / `no` / `off`, case-insensitive):

| Env var | Default | Purpose |
|---|---|---|
| `ENABLE_STRIPE_ACH` | OFF | Gate Stripe Financial Connections + ACH debit code paths. OFF means the Stripe SDK is not initialized and Stripe routes are not mounted. |
| `ENABLE_REAL_TRANSFERS` | OFF | Allow money-movement endpoints to actually move money. OFF keeps the app in sandbox/no-op mode — transfers are recorded but never settled. |
| `ENABLE_CRYPTO` | **ON** | Enable the crypto / Bitcoin round-up surfaces. ON preserves current behavior. |
| `ENABLE_BETA_BANNER` | OFF | Render the in-app beta banner across every authed screen. Flip ON for the TestFlight beta window, OFF for the public launch build. |

To add a new flag: append to `FLAG_DEFINITIONS` in `shared/flags.ts` and add a row above. Server and client pick it up automatically — no other plumbing needed.

## Error Tracking (Sentry)

Production error visibility is provided by Sentry on both the Express server and the React client. Wiring lives in `server/lib/sentry.ts`, `client/src/lib/sentry.ts`, and the shared redactor in `shared/sentryRedact.ts`.

**Env vars (all optional — Sentry is silent if unset):**

| Env var | Side | Purpose |
|---|---|---|
| `SENTRY_DSN` | server + client | Single canonical DSN. The server reads it at runtime; `vite.config.ts` forwards it to the client bundle at build time as `VITE_SENTRY_DSN`. Missing → no SDK init on either side AND the `@sentry/node` / `@sentry/react` packages are never imported (dynamic `import()` is gated on the DSN being present), so neither the server process nor the client bundle pays SDK overhead beyond the tiny init shim. |
| `SENTRY_ENVIRONMENT` | both | Override the environment tag (defaults to `NODE_ENV` / Vite `MODE`). Also forwarded to the client bundle. |
| `SENTRY_RELEASE` | both | Release name (matched between client & server for cross-stack grouping). Also forwarded to the client bundle. |
| `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | build time | Required to enable client source-map upload via the Sentry Vite plugin (prod build only). |

**Redaction guarantees (enforced by `server/lib/__tests__/sentry-redact.test.ts`):**

- Query strings AND URL fragments are stripped from `request.url`, all `breadcrumbs[].data.url` (and `to` / `from`), and any string in `extra` / `contexts` / `request.data` that looks like an http(s) URL.
- Any field whose key matches `/token|password|secret|api[_-]?key|authorization|cookie|plaid[_-]?access[_-]?token|access[_-]?token|refresh[_-]?token/i` (case-insensitive) is replaced with the literal string `[Filtered]`.
- `Authorization`, `Cookie`, and `Set-Cookie` request headers are filtered.
- Free-form `message` and `exception.value` strings have `token=…` / `password=…` / `access_token=…` query-style params scrubbed.
- **Hard assertion:** `/verify-email` and `/reset-password` (and the corresponding POST endpoints) MUST NOT carry a query string in any captured event. The test suite asserts that the redacted `request.url` for these paths contains neither `?` nor `token=`.

**CorrelationId propagation:** the `transferLog` / `log` helpers in `server/routes/mercuryRoutes.ts`, `server/services/mercuryService.ts`, and `server/services/plaidService.ts` call `setCorrelationTag(correlationId)` on the current Sentry isolation scope, so any exception captured during a transfer / ACH request carries the same `correlationId` already present in our structured logs. On the client, `throwIfResNotOk` in `client/src/lib/queryClient.ts` parses the server's JSON error body and, if a `correlationId` is present, tags the current Sentry scope with it — so a client-side exception thrown from a failed API call carries the same id as the server's Sentry event.

**Source maps:** the Sentry Vite plugin uploads source maps only when `NODE_ENV=production` AND all three of `SENTRY_AUTH_TOKEN` / `SENTRY_ORG` / `SENTRY_PROJECT` are set. Generated `.map` files are deleted after upload (`sourcemaps.filesToDeleteAfterUpload: ["**/*.map"]`), and `server/index.ts` returns 404 for any request whose path ends in `.map` as a second layer of defense.

**Running the redaction test:** `npx tsx --test server/lib/__tests__/sentry-redact.test.ts`

## Investor / Patent Materials
- `attached_assets/patent-application/` — USPTO provisional draft (.pdf + .docx) and 7 black-and-white figures
- `attached_assets/patent-deck-slides/dime-time-patent-deck.pptx` — 12-slide investor patent overview deck (Google Slides-uploadable). PDF and per-slide PNG previews in same folder.
- `attached_assets/pitch-deck-slides/` — 13-slide pitch deck (.pptx + .pdf)
- `attached_assets/business-plan-slides/` — 14-slide business plan (.pptx + .pdf)

## External Dependencies
- **Plaid**: For banking integration and linking user bank accounts.
- **Coinbase**: For cryptocurrency features and Bitcoin purchases.
- **CodeMagic**: CI/CD for building and deploying iOS and Android applications.
- **PostgreSQL**: Primary database for application data.
- **Express.js**: Backend framework.
- **Node.js**: Backend runtime environment.
- **React.js**: Frontend framework.
- **TypeScript**: For type-safe development.
- **Tailwind CSS**: For styling.
- **Wouter**: For client-side routing.
- **shadcn/ui**: For UI components.
- **TanStack Query (React Query)**: For API data fetching and state management.
- **Drizzle ORM**: Object-Relational Mapper for PostgreSQL.