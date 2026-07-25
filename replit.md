# Dime Time - Fintech Debt Reduction App

## Overview
Dime Time is a live fintech app (Apple App Store, App ID 6755106723) that helps consumers get out of debt via automated round-up payments: everyday purchases are rounded up and the spare change is directed toward debt paydown through real ACH transfers. Stack: Capacitor iOS app + React/TypeScript web app + Express/PostgreSQL backend. Marketing site + web app at https://dime-time.com.

Detailed operational runbooks and subsystem specs live in `.agents/memory/` — see "Detailed Docs" at the bottom.

## User Preferences
- Focus on mobile-first experience
- Clean, intuitive UI with purple branding
- Real functioning app, not demo/website
- Proper user authentication and data separation
- Full fintech feature set accessible to users
- Communication style (per Tim's AI dossier, July 2026): direct, evidence-based, structured; include numbers, timelines, and decision frameworks; challenge assumptions respectfully; distinguish facts from speculation; no empty encouragement, flattery, or buzzwords
- Substantial content (specs, plans, checklists, handoffs) goes in plain-text copy/paste boxes — Tim cross-checks outputs between ChatGPT and Replit
- Known founder blind spot he wants flagged: optimizing instead of launching; push toward shipping when perfection-seeking delays release
- Say "Boom" when a task is complete — Tim's favorite word, signifies a finished task (requested 2026-07-23)
- Founder's AI dossier file was deleted from the project 2026-07-19 (project being shared with engineers/investors); the communication rules above are the surviving extract. Never re-add personal dossier/journal/profile files to the repo.

## Canonical Project Rules (locked — do not drift)

### Domain & Contact
- Official domain: **https://dime-time.com** (with hyphen). DO NOT use `dimetime.com` — Tim does not own it.
- All user-facing email references: **tim@dime-time.com**

### Compliance Language (use verbatim where contact/legal copy is needed)
- Positioning: *"Dime Time is a financial technology platform that helps consumers automate payments, manage ACH transfers, and build healthier financial habits through secure digital money tools."*
- Disclaimer: *"Dime Time is a financial technology platform and is not a bank. Banking services and payment infrastructure are provided through regulated financial partners."*
- DO NOT add Stripe / Plaid / Dwolla / Moov / Increase / bank partner logos until written approval is confirmed.

### Marketing Site Invariants (LandingPage.tsx, privacy.tsx, terms.tsx)
- Homepage is single-page scroll — no separate `/about`, `/contact`, or `/faq` routes
- **Web root `/` ALWAYS shows the marketing page** — even for logged-in users (their app lives at `/dashboard`; the header swaps to "My Dashboard" when authenticated). Native iOS exception: in the Capacitor app `/` remains the dashboard (marketing page never renders natively).
- `/privacy` and `/terms` are standalone pages scoped to the `.dt-marketing` wrapper (opts out of the in-app lavender theme)
- Legal effective date: **May 27, 2026** (`EFFECTIVE_DATE` constant — only bump when policy text actually changes)
- Contact form POSTs to `/api/contact` → `contact_submissions` table; fallback mailto → tim@dime-time.com
- "Get Started" CTAs route to `/signup` on desktop/Android; on iOS browsers (`IS_IOS_BROWSER` in LandingPage.tsx) they link to the App Store (`APP_STORE_URL`, App ID 6755106723) — founder decision 2026-07-08. The `apple-itunes-app` Smart Banner meta in `client/index.html` complements this.
- Use only the official logo (`@/assets/dime-time-app-icon.png`) and color `#918EF4` (`bg-dime-purple` / `text-dime-purple`)

### Backend Invariants
- `POST /api/contact` is rate-limited (`contactLimiter`, 5 req/min/IP) AND requires a valid Cloudflare Turnstile token when `TURNSTILE_SECRET_KEY` is set; in production a missing secret fails closed. Client widget renders only when `VITE_TURNSTILE_SITE_KEY` is set.
- Webhooks and ACH endpoints stay signature-verified, idempotent, and structured-logged with `correlationId`.
- The `transfers` ledger is provider-agnostic (Plaid/Mercury/Stripe write the same row shape); status strings are normalized via `shared/transactionStatus.ts` — UI never branches on raw provider statuses.
- Auth tokens encrypted at rest (AES-GCM WebCrypto) in localStorage; PIN lock with SHA-256 hash, auto-lock on background.

### Launch Status (as of 2026-07-23)
- App Store: **LIVE**; v1.0.5 (build 207) APPROVED & LIVE (2026-07-21). Next iOS build number must be ≥210.
- Google Play: first production release **SUBMITTED FOR REVIEW 2026-07-23** (versionCode 209, v1.0.5, US only, managed publishing off → auto-live on approval). Delete-account page https://dime-time.com/delete-account is on file with Google — must stay live. See `.agents/memory/android-play-launch.md`.
- Money loop proven bank-to-bank: $1.00 ACH debt payment (2026-07-07) settled via Stripe, $0.99 payout landed in Mercury (confirmed 2026-07-21). ACH settles in 2–4 business days via webhook.
- Stripe bank linking **END-TO-END LIVE-VERIFIED 2026-07-25**: FC registration approved 2026-07-24; founder completed the full flow on iPhone (authorize → session → Stripe picker → exchange), both Mercury accounts stored via the idempotent re-link path. Plaid in-app OAuth resume (Chase): web telemetry live since the 2026-07-25 republish; native needs build ≥210.
- Stripe account live; prod has `ENABLE_STRIPE_ACH` + `ENABLE_REAL_TRANSFERS` ON (founder decision; public protected by the default-false per-user allowlist).
- LinkedIn launch post is INTENTIONALLY HELD (founder decision 2026-07-09) until two milestones land: (1) real money movement working for users, (2) Plaid debt import live in production. BOTH external approvals are now DONE (Stripe FC live-verified 2026-07-24; Plaid Liabilities entitlement probe-verified LIVE 2026-07-25). Remaining: founder end-to-end proof — one completed Stripe bank link (Test A) + one real Plaid debt import.

## Architecture (summary)
- **Platform**: Capacitor 7.4.x hybrid app (iOS/Android) wrapping a React 18 + TypeScript SPA; Wouter routing; TanStack Query for API state
- **Backend**: Express.js on Node; PostgreSQL via Drizzle ORM; email/password auth (SHA256) with PostgreSQL session store; RESTful API
- **Styling**: Tailwind CSS + shadcn/ui, Dime Time purple `#918EF4`
- **Key integrations**: Plaid (bank linking), Stripe (Financial Connections + ACH), Coinbase (crypto round-ups), Resend (email), Sentry (error tracking), Codemagic (iOS CI/CD)
- **Features**: auth + PIN lock, debt tracking with payoff projections, round-up engine with multipliers, bank connections, real ACH payments behind a defense-in-depth gate, crypto round-ups, analytics, internal admin panel

## Feature Flags
Defined once in `shared/flags.ts`; server reads via `server/lib/flags.ts` (`getFlags()` / `isFlagEnabled()`, resolved at module load — restart to flip), client via `useFlag()` hook (values piggybacked on `/api/user` as `_flags`; NEVER read flags from `import.meta.env` on the client). Tolerant env parsing (`1/true/yes/on` etc). To add a flag: append to `FLAG_DEFINITIONS` and the table below — no other plumbing.

| Env var | Default | Purpose |
|---|---|---|
| `ENABLE_STRIPE_ACH` | OFF | Stripe FC + ACH debit code paths. OFF = Stripe SDK never loaded, routes return 404. |
| `ENABLE_REAL_TRANSFERS` | OFF | Master switch for real money movement. OFF = transfers recorded but never settled. |
| `ENABLE_CRYPTO` | **ON** | Crypto / Bitcoin round-up surfaces. |
| `ENABLE_BETA_BANNER` | OFF | In-app beta banner (TestFlight windows only). |
| `ENABLE_AUTO_ROUNDUP_SWEEPS` | OFF | Weekly auto round-up sweep dispersals. OFF = logged no-op even if triggered. |
| `ENABLE_DEBT_IMPORT` | OFF | Automatic debt-import routes + UI (fail-closed unmounted when OFF; rate-limited; audited). |
| `ENABLE_SUBSCRIPTIONS` | OFF | Stripe Billing $2.99/mo "Dime Time Debt" plan (round-up automation paywall). Requires `ENABLE_STRIPE_ACH` — boot throws otherwise. OFF = routes unmounted, all round-up gates pass (no behavior change). See `.agents/memory/subscription-billing.md` before enabling in prod. |

## Money-Movement Safety (invariants)
- `ENABLE_REAL_TRANSFERS` alone is NOT sufficient to move public money: every real ACH **transfer/debt-payment** debit passes through `storage.reserveRealStripeAchDebit()` — per-user allowlist (`users.realTransfersEnabled`, default false) + first transfer ≤ $1 + daily total ≤ $5 + daily count ≤ 1 + duplicate-pending guard, all inside one transaction with an advisory lock. Every approve AND block writes a `real_transfer_audit_logs` row. Blocks never call Stripe.
- Test key mode → simulation path (`status="simulated"`, no settlement). Admin can revoke a user's allowlist instantly via `/api/admin/users/:id/real-transfers` (takes effect on next attempt, no restart).
- Subscription billing debits ($2.99/mo, `ENABLE_SUBSCRIPTIONS`) are charged by Stripe Billing and intentionally do NOT pass the transfer allowlist gate; their own guards: consent-first ordering, Idempotency-Key + per-user subscribe lock, duplicate-sub 409, webhook-driven entitlement revocation.
- `PLAID_TOKEN_ENCRYPTION_KEY` (Replit Secret only) encrypts ALL at-rest provider credentials (Plaid access tokens + Stripe PM ids, AES-256-GCM).
- Agent guardrails: the agent never flips real-money flags, never sets live secrets, never runs live charges — founder-run steps only. Prod DB is read-only to agent tools.

## Internal Admin
Gated by `ADMIN_USER_IDS` secret (fails closed when empty). `/admin` page: Transfers, Stripe Webhooks, and Real Money (allowlist approve/revoke) tabs. `/api/user` piggybacks `_isAdmin`. Do NOT re-add the removed Stripe Diagnostics tab (verdict logic preserved in `shared/stripeVerdict.ts`).

## Android Release Rules
- `android/app/build.gradle` version policy: `versionName` = iOS marketing version, `versionCode` = iOS build number (currently 1.0.5 / 207). versionCode must strictly increase every Play upload.
- Manifest permissions are minimum-necessary (INTERNET, ACCESS_NETWORK_STATE, VIBRATE, USE_BIOMETRIC only). Never re-add a permission without a shipped feature that requires it.
- Release signing comes ONLY from env vars (KEYSTORE_FILE/KEYSTORE_PASSWORD/KEY_ALIAS/KEY_PASSWORD); keystores are never committed (.gitignore enforced). Debug builds work without credentials; release builds fail loudly without them.
- Before any .aab build: `npm run build && npx cap sync android` (same rule as iOS).
- Android package is `com.dimetime.app` (iOS is `com.dimetime.mobile`) — intentional, permanent, never reconcile.

## iOS Release Rules
- `ios/App/App/Info.plist` is the ONLY source of truth for version/build numbers; `codemagic.yaml` reads it and must never overwrite it. Never reintroduce any build phase that writes version values into the built product.
- Never set `server.url` in `capacitor.config.ts` (breaks cold-start). Before each Codemagic build: `npm run build && npx cap sync ios`.
- After Apple accepts an upload, update `LAST_ACCEPTED_BY_APPLE` in codemagic.yaml (two lines). Currently 207 (v1.0.5).

## Investor / Patent Materials
- `attached_assets/patent-application/` — USPTO provisional draft + 7 figures
- `attached_assets/patent-deck-slides/` — 12-slide investor patent deck (.pptx/.pdf/PNGs)
- `attached_assets/pitch-deck-slides/` — 14-slide pitch deck (with-ip variant adds 3 IP appendix pages); `attached_assets/business-plan-slides/` — 14-slide business plan

## Detailed Docs (in `.agents/memory/`)
- `plaid-key-rotation-runbook.md` — ordered steps to rotate `PLAID_TOKEN_ENCRYPTION_KEY`
- `stripe-ach-implementation.md` — Stripe ACH routes, secrets, flag-off guarantees, ledger contract
- `real-money-rollout-gate.md` — full gate spec, limits, audit trail, dev-only verification
- `sentry-config.md` — Sentry env vars, redaction guarantees, correlationId propagation
- `ios-build-versioning.md` — build-number history, rejection causes, Capacitor rules
- `internal-admin.md` — admin endpoint list and UI details
