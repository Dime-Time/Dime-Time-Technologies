---
name: Crypto preview & Coinbase integration plan
description: Why crypto is simulated, how preview pricing works, and the chosen architecture for making Coinbase integration real
---

## Status (decided 2026-07-25)
Crypto ships as a clearly labeled **PREVIEW** (founder decision). `demoMode = true` in the Coinbase service is **deliberate** — never flip it to "fix" crypto. The Crypto page carries a Preview/Simulated banner (`banner-crypto-preview`).

## Architecture rule (the important one)
Real crypto MUST be **per-user Coinbase OAuth** — buys execute inside the user's own Coinbase account with their own funds.
**Why:** the legacy design (all users' buys through one app-owned Coinbase account) makes the company a crypto custodian → money-transmitter/licensing territory. Unshippable for this company regardless of code readiness. Never build toward it.
**How to apply:** any "turn crypto on for real" work starts with an OAuth connect flow (mirror the Plaid pattern: connect → encrypted token at rest → per-user API calls). The legacy client targets Coinbase v2 `POST /accounts/:id/buys` (deprecated) — do not reuse it; build against current Coinbase Developer Platform OAuth2 docs (buy-related scopes still documented as of 2026-07). Expect a Coinbase app review wait, like Plaid/Stripe — start the registration clock early.

## Preview pricing contract
Demo mode serves **live** prices from Coinbase's public no-auth price API (60s cache, stale-while-revalidate, boot warm-up for BTC/ETH/ADA/SOL, static fallbacks).
**Why:** transaction POSTs await the round-up split path — a price lookup must NEVER add network latency or throw there. Old hardcoded prices were also badly wrong in both directions (43k and 95k in different files vs ~64k real).
**How to apply:** keep price lookups non-blocking (cached/fallback served instantly); contract is enforced by `server/__tests__/coinbase-preview-prices.test.ts` (run: `npx tsx --test <file>`). Keep static fallbacks aligned between coinbaseService and roundUpSplitService.

## Money-flow fact
The round-up "crypto %" split only writes bookkeeping rows (simulated purchase records + debt-portion payment records) — no real dollars move in that path. Real money remains Stripe ACH only.

## Rollout reminder
The Preview label reaches the website on next republish; native iPhone/Android users only get it with the next app build (rides with build ≥210).

## Alternatives evaluated (2026-07-25) — don't re-research
- **Kraken**: no consumer OAuth; per-user access = user-generated API keys pasted into the app (rejected: unshippable UX + key-custody liability for a consumer audience). Kraken **Embed** is the real fintech product (Kraken holds custody/licenses) but it's institutional: contact-sales form, partnership contracts.
- **Crypto.com**: OAuth exists only inside their institutional Exchange **Broker Programme** (apply/partnership); otherwise manual API keys. Same rejection.
- **Mesh (meshconnect)**: aggregator for users' existing exchange accounts (Coinbase supported), but current positioning is transfers/payments — buy-order support unverified; round-ups need USD→crypto BUYS, so not a confirmed fit.
- **Embedded brokerage (the Acorns model — partner holds licenses, users never leave the app):** strongest long-term fit because most debt-payoff users won't have exchange accounts at all. **Zero Hash** documents a literal fiat buy/sell API (round-up-shaped); **Alpaca Broker API** offers crypto via Kraken Embed rails with a self-serve sandbox (most startup-accessible entry); Bakkt/Paxos same category, enterprise-heavier. All require a commercial agreement + compliance onboarding to go live (weeks, real costs — never quote numbers without a current conversation).
- **Coinbase OAuth timing:** pause has NO published reopen date (checked 2026-07-25); treat as months-not-days and selective whitelisting via the developer-interest form. Don't promise the founder a date.
- **Verdict:** two real strategies — (A) wait for Coinbase OAuth (free, bridge; requires users to own Coinbase accounts), (B) embedded brokerage (better end-state UX, costs money, sales cycle). Running A's form + starting one B conversation in parallel wastes nothing.

## Founder's background action (non-blocking for launch)
As of 2026-07-25, Coinbase has new OAuth client creation **paused / partner-gated** — no self-serve registration. Path: submit the CDP developer-interest form (coinbase.com/developer-platform/developer-interest), wait for whitelisting; once approved, clients are created in CDP portal → API Keys → OAuth (redirect URI `https://dime-time.com/coinbase-callback`). The portal's "Verify your business / custodial APIs" banner is for Coinbase's payments/stablecoin products — NOT needed for per-user OAuth; don't send the founder through it. No sandbox exists: OAuth testing requires real KYC'd Coinbase accounts. Client id/secret go into Secrets only when the connect flow is built.
