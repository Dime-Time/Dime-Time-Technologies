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

## Open bug: native (in-app) OAuth resume fails after Chase round-trip (2026-07-24)

Founder's live iPhone test: Plaid Link in the app → Chase app OAuth → cdn.plaid.com in Safari → "Open in Dime Time?" → app opens, PIN lock (auto-lock on background), then the resume page shows the onExit-error card ("We couldn't resume your bank connection"). State WAS present (message is the exit-error variant, not no-state) — Link re-initialized and Plaid rejected the resume for an unknown reason; three link tokens were created that night with zero `exchange-token` calls.

**Diagnosis gap closed:** client now reports Link outcomes to `POST /api/plaid/link-event` (log-only, rate-limited, auth-optional) with stage/error_code/request_id/link_session_id/platform, and the error card shows the code + `ref <request_id>` for screenshots. Web picks this up on next republish; **native needs the next iOS build (≥210)**. Next failed attempt → grep prod logs for `link_client_event`, give request_id to Plaid support if the code is opaque. Suspects: PIN-lock delay between redirect and re-init, or web-based Link OAuth resume limits inside a Capacitor WebView (Plaid recommends native SDKs for webview apps).
