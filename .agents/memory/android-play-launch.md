---
name: Android / Google Play launch
description: Play submission package location, App Links sequencing constraint, and founder-run vs agent-run split for the Android release
---

# Android / Google Play launch

## Submission package
`attached_assets/play-store-assets/` holds the complete first-submission kit: listing copy, Data Safety worksheet (evidence-based from code), financial/content-rating declarations, 512px icon, 1024x500 feature graphic. Screenshots must come from the real Android build on a real device during internal testing — never reuse iOS captures.

## App Links sequencing constraint (non-obvious)
Android App Links for Plaid OAuth (`assetlinks.json` + https intent filter) CANNOT be configured before the first Play upload: with Google Play App Signing, the app-signing certificate SHA-256 fingerprint only exists after the app first lands in Play Console (Setup → App integrity).
**Why:** Google re-signs the app with its own key; a fingerprint from the local upload keystore would be wrong and verification would silently fail.
**How to apply:** sequence = keystore → first internal-testing upload → copy SHA-256 from Play Console → add assetlinks.json to `.well-known` (next to apple-app-site-association) + intent filter to AndroidManifest → rebuild. Non-OAuth bank linking works without this.
**Status 2026-07-22:** DONE in code — assetlinks.json (app-signing + upload certs) served at /.well-known/, autoVerify intent filter added (scope ONLY /plaid/oauth, matching the AASA). Remaining: (1) republish so the file is live on dime-time.com BEFORE (2) the next Android build (versionCode ≥208) ships the intent filter; verification is silent-fail if ordered wrong. The client universal-link listener is platform-neutral — no Android-specific JS needed. Play Console fingerprint location: Protected with Play → Play Store protection row → Manage Play app signing.

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

## Release build must NOT minify (crash root cause, build 207)
Build 207 shipped with `minifyEnabled true` + `shrinkResources true` in `android/app/build.gradle` release block — app crashed instantly ("Dime Time keeps stopping") on BOTH the preview (16KB-page-size) emulator and a clean stable Android 16 (API 36, Google Play ARM64) emulator, proving the crash was the build, not the emulator image.
**Why:** minify/shrink was the ONLY delta from Capacitor's known-good default release config (template ships both OFF). Likely mechanism (unconfirmed — no stack trace captured): R8/shrinker interfering with Capacitor's reflective startup (Class.forName plugin loading, config.xml). Note @capacitor/android DOES ship consumer proguard rules, so the exact break point is unproven. iOS has no equivalent step — never affected.
**How to apply:** keep `minifyEnabled false` / `shrinkResources false` for release (fixed for versionCode 208). Never re-enable without a full on-device launch test of a signed release build. If a launch crash ever recurs, capture adb logcat / an emulator bug report BEFORE changing anything. The 16KB-page-size emulator variant was a red herring — prefer plain stable Google Play images for testing anyway.
