---
name: Plaid OAuth resume page
description: Web OAuth resume flow at /plaid/oauth — state contract, redirect URI, and the onExit-on-init-failure gotcha
---

# Plaid OAuth resume page (/plaid/oauth)

- Exact registered redirect URI: `https://dime-time.com/plaid/oauth` (no trailing slash, no query). Server reads `PLAID_REDIRECT_URI` secret; prod requires the https://dime-time.com prefix.
- Resume state lives in localStorage key `dimetime_plaid_oauth` = `{linkToken, flow: "bank"|"debt_import", ts}`, 30-min max age (`client/src/lib/plaidOauth.ts`).

## Gotcha: react-plaid-link fires onExit on INIT FAILURE, not just user cancel

**Why:** When the resume state is missing/expired/invalid (token null or bad), Link fails to initialize and still invokes `onExit`. An unconditional `navigate()` in onExit silently dumped session-lost users onto /banking → marketing landing page with zero explanation. Found only via real-browser (Playwright) testing — screenshots looked like a routing bug but the page mounted fine.

**How to apply:** In any Plaid Link exit handler, discriminate: `(!state || error)` → stay put and show a calm recovery card; only a genuine cancel (state present, error null) may navigate. Reuse this same discrimination in the native Capacitor universal-link resume path (Bucket B).
