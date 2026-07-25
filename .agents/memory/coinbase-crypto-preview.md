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

## Founder's background action (non-blocking for launch)
Register an OAuth application in the Coinbase Developer Platform portal (redirect URI on dime-time.com; client id/secret go into Secrets only when the connect flow is built).
