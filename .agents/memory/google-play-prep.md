---
name: Google Play prep status & decisions
description: Android/Play submission decisions, what's done, and the remaining founder-run steps
---

# Google Play prep (as of 2026-07-21)

## Decisions (locked)
- **versionCode = iOS build number** (207 for v1.0.5), versionName = iOS marketing version. **Why:** one mental model — "build 207 = 1.0.5" on both stores; Play only requires strict increase, so future iOS bumps (208+) flow through cleanly.
- **Minimum-permission manifest**: only INTERNET, ACCESS_NETWORK_STATE, VIBRATE (haptics plugin), USE_BIOMETRIC (WebAuthn unlock). Camera/location/contacts/storage/notifications/background permissions were removed 2026-07-21 after grep-verified evidence no feature uses them. **Why:** unused permissions are a top fintech Play-rejection cause and force false Data Safety answers. Re-adding requires a shipped feature.
- **Release signing is env-var only** (KEYSTORE_FILE/KEYSTORE_PASSWORD/KEY_ALIAS/KEY_PASSWORD). Conditional config: debug builds work without credentials; assembleRelease/bundleRelease throw at execution time without them. Never soften this to allow unsigned release artifacts.
- Plaid production accepts `com.dimetime.app` (android_package_name registered + verified via link/token/create 200, 2026-07-21).

## Remaining steps (in order)
1. **Founder**: Google Play ORGANIZATION account signup (D-U-N-S 128458968, "Dime Time Technologies LLC", ~$25) → Google verification queue (days–2 weeks). Org type skips the 12-tester/14-day rule.
2. **Founder-present**: generate upload keystore (outside repo), enroll in Play App Signing, set 4 signing env vars in Codemagic.
3. Plaid Android OAuth + App Links: needs `assetlinks.json` served at https://dime-time.com/.well-known/ (doesn't exist yet) — do NOT touch the iOS OAuth flow.
4. Play listing assets, Data Safety form, device testing.
5. Before every .aab: `npm run build && npx cap sync android` — bundled assets in android/app/src/main/assets/public/ go stale otherwise.

## How to apply
Read this before any Android build, Play submission, or manifest/version change. Version + permission + signing policies are also summarized in replit.md "Android Release Rules".
