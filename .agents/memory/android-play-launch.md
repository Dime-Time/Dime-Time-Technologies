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

## Founder-run vs agent-run
- Founder: keystore generation on his Mac (keytool, backed up forever, base64 → Codemagic `android_build_info` group with KEYSTORE_PASSWORD/KEY_ALIAS/KEY_PASSWORD + VITE_STRIPE_PUBLISHABLE_KEY), Play Console phone verification, app creation (package `com.dimetime.app` — permanent), .aab upload. Keystore/passwords never in chat or repo.
- Agent: listing content, declarations drafts, graphics, manifest/App Links code work after fingerprint exists.

## Data Safety gotcha
Crash-log/diagnostics declaration is conditional on whether a Sentry DSN is actually set in the production deployment at submission time — verify then, don't guess. No analytics/ads SDKs exist, so everything except personal info + financial info is "not collected."

## Version policy for Play
versionCode 207 (= iOS build) is valid for the FIRST upload; only subsequent uploads must strictly increase. Keep versionCode locked to the iOS build number per the locked rule in replit.md.
