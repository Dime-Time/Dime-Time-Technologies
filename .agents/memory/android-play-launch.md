---
name: Android / Google Play launch
description: Play submission package location, App Links sequencing constraint, and founder-run vs agent-run split for the Android release
---

# Android / Google Play launch

## Production submission (2026-07-23)
First production release SUBMITTED for Google review 2026-07-23: versionCode 209 (1.0.5), United States only (deliberate — US-ACH-only product; countries can be added later without new review). All 10 App content declarations completed. Managed publishing OFF → app goes live automatically on approval. Non-obvious form answers worth reusing on updates:
- Financial features: "Other" ONLY (no debt-management option exists; Banking/Money-transfer/Crypto/Advice would trigger licensing-proof requests). Documentation step = third-party providers (Stripe/Plaid), no own licenses.
- Data safety label: collected = Name/Email (Account management; Email is the only "required" type), User payment info/Purchase history/Other financial info (App functionality, optional); shared = User payment info only (App functionality). Nothing ephemeral, no other purposes (no analytics/ads SDKs). Delete URL: https://dime-time.com/delete-account (page must stay live — Google has it on file).
- Health apps = none; Government = No; Advertising ID = No (manifest has no AD_ID); Target audience = 18+ only (younger groups trigger child-safety requirements).

## Rejection #1 (enforced 2026-07-27): reviewer login failed — credentials issue, NOT policy
Google rejected v209 solely because the Sign-in-details credentials didn't authenticate ("Login credentials are incorrect"). ROOT CAUSE PINNED VIA PROD LOGS: exactly ONE reviewer login attempt (2026-07-27 08:56 UTC, correct email per zoomed evidence screenshot) → genuine 401, while the founder's own login the same day succeeded (200) with credentials he says were unchanged. So the password STRING stored in Play Console differs byte-for-byte from the real one — most likely an iPhone-keyboard paste/typing artifact (autocapitalize, smart quotes/dashes, trailing space) when the founder filled the console form on his phone; his own logins never caught it because Safari keychain autofills the true string. Rate limiting was NOT involved (authLimiter 10/15min, zero 429s in window); CORS verified fine (Android origin allowlisted in prod, live-probed).
**Lessons:** (1) reviewer credentials must be entered on DESKTOP, or retyped character-by-character — never trust a phone keyboard for console credential fields; unambiguous-character passwords (no O/0/l/1/I, no smart-punctuation-able chars) de-risk reviewer hand-typing too; (2) login email lookup is exact-match case-sensitive — keep reviewer email lowercase; (3) client shows the SAME "Invalid email or password" for 401/429/network errors (Login.tsx throws on any !ok) — misleading in reviewer evidence; candidate UX fix for build ≥210, not urgent; (4) fix path = incognito login test typing the exact strings → Play Console → App content → App access → pencil edit → resubmit from Publishing overview; any founder-password rotation must same-day update BOTH App Store Connect and Play Console. No new .aab, no appeal — administrative rejection, not a policy strike.

## Post-approval follow-ups (pending)
1. Rotate founder's prod password (exposed in chat screenshots TWICE — 2026-07 pre-launch and again 2026-07-27 in a Play Console form screenshot; exposed files deleted both times) → after rotation update reviewer-account credentials in BOTH App Store Connect and Play Console the same day.
2. Keystore cleanup (see below) once founder confirms 2 backups.

## Submission package
`attached_assets/play-store-assets/` holds the complete first-submission kit: listing copy, Data Safety worksheet (evidence-based from code), financial/content-rating declarations, 512px icon, 1024x500 feature graphic. Screenshots must come from the real Android build on a real device during internal testing — never reuse iOS captures.

## App Links sequencing constraint (non-obvious)
Android App Links for Plaid OAuth (`assetlinks.json` + https intent filter) CANNOT be configured before the first Play upload: with Google Play App Signing, the app-signing certificate SHA-256 fingerprint only exists after the app first lands in Play Console (Setup → App integrity).
**Why:** Google re-signs the app with its own key; a fingerprint from the local upload keystore would be wrong and verification would silently fail.
**How to apply:** sequence = keystore → first internal-testing upload → copy SHA-256 from Play Console → add assetlinks.json to `.well-known` (next to apple-app-site-association) + intent filter to AndroidManifest → rebuild. Non-OAuth bank linking works without this.
**Status 2026-07-26: CLOSED & LIVE-VERIFIED.** assetlinks.json (app-signing + upload certs) is live on dime-time.com (200, application/json), founder re-pulled the app-signing SHA-256 from Play Console and it matches the file exactly, and Google's Digital Asset Links API returns both statements for com.dimetime.app. v209 (in Play review) carries the autoVerify intent filter (scope ONLY /plaid/oauth, matching the AASA); ordering constraint satisfied — file went live before any public install. Nothing left to do; don't re-chase the fingerprint. The client universal-link listener is platform-neutral — no Android-specific JS needed. Play Console fingerprint location: Protected with Play → Play Store protection → Play app signing (or direct URL .../app/<appId>/keymanagement; the old App integrity page now redirects).

## Upload keystore (generated in Replit 2026-07-22 — founder refused Terminal)
Agent-generated `dimetime-upload.keystore` at repo root with keytool (RSA 2048, alias `dimetime`, PKCS12, valid to 2053), password only via `-storepass:env ANDROID_KEYSTORE_PASSWORD` (Replit secret) — never echoed. Keystore + zip are git-ignored and were verified untracked. This is only the UPLOAD key (Play App Signing on → Google can reset it if lost/compromised).
**Signing method:** Codemagic "Code signing identities" → Android keystores, reference name exactly `dimetime_upload` (matched by `android_signing:` in codemagic.yaml). Codemagic injects CM_KEYSTORE_* vars; script maps them to KEYSTORE_FILE etc. for build.gradle. Gotcha: if the identity is missing in Codemagic, the build fails at the PREPARE stage before any script runs — the script's FATAL message never prints.
**Cleanup after founder uploads to Codemagic + backs up in 2 places:** delete the keystore + zip from the workspace AND delete the ANDROID_KEYSTORE_PASSWORD secret (no runtime purpose; workspace is shared with engineers/investors).

## Founder-run vs agent-run
- Founder: Play Console phone verification, app creation (package `com.dimetime.app` — permanent), Codemagic keystore upload + `VITE_STRIPE_PUBLISHABLE_KEY` in `android_build_info` group, .aab upload, post-upload keystore cleanup. Passwords never in chat or repo.
- Agent: keystore generation (done), listing content, declarations drafts, graphics, manifest/App Links code work after fingerprint exists.

## Data Safety gotcha
Crash-log/diagnostics declaration is conditional on whether a Sentry DSN is actually set in the production deployment at submission time — verify then, don't guess. No analytics/ads SDKs exist, so everything except personal info + financial info is "not collected."

## Version policy for Play
versionCode 207 (= iOS build) was the FIRST upload; every subsequent upload must strictly increase. 2026-07-22: Android bumped to versionCode 208 for the minify-crash fix while iOS is still at 207 — a deliberate temporary divergence from the "versionCode = iOS build number" lock. Next iOS build must be ≥208 anyway (replit.md), so alignment resumes naturally; if the counters drift again, "strictly increasing per store" beats exact parity.

## Launch-crash root cause (builds 207/208): duplicate domain in network_security_config.xml
The instant "Dime Time keeps stopping" crash on every Android launch was caused by `localhost` being declared in TWO `<domain-config>` blocks of `android/app/src/main/res/xml/network_security_config.xml`. Android's parser treats a duplicate domain as fatal: `android.security.net.config.XmlConfigSource$ParserException: localhost has already been declared` (thrown in `parseDomain`), killing the process before any UI. Fixed for versionCode 209 by removing the duplicate (kept only in the dev cleartext block) — CONFIRMED: 209 launches to the login screen on the Play-delivered internal-testing install (2026-07-23).
**Why:** the config had shipped broken since it was written — Android had simply never been launched before internal testing. iOS/web unaffected (Android-only file). The earlier minification theory was DISPROVEN: build 208 (minify/shrink off) crashed identically; keep minify off anyway (Capacitor template default, one less variable).
**How to apply:** a domain may appear in at most ONE domain-config block. Any instant pre-splash launch crash → get the logcat FATAL block FIRST (filter `package:com.dimetime.app`); two builds were burned on guesses before the log named the one-line cause. 16KB-page-size emulator variant was a red herring — test on plain stable Google Play images.

## Android WebView origin ≠ iOS origin (CORS)
Native WebView origins differ per platform: iOS = `capacitor://localhost`, Android = `https://localhost` (androidScheme "https"). The server CORS allowlist must contain BOTH or that platform gets "Failed to fetch" on every API call while the app otherwise renders fine.
**Why:** build 209 launched but signup failed with "Failed to fetch" — prod allowlist had only the iOS origin. Server-side fix; requires a production republish, NOT a new app build (client code unchanged).
**How to apply:** any "app renders but all API calls fail on one platform" symptom → check the server CORS allowlist against that platform's WebView origin before touching native code.
