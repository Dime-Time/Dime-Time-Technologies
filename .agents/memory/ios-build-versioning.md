---
name: iOS build versioning + Capacitor cold-start rules
description: Info.plist is the ONLY version source of truth; historical overwrite vectors caused Apple rejections; never set server.url
---

**Info.plist is authoritative** for BOTH `CFBundleShortVersionString` (marketing version) and `CFBundleVersion` (build number). `codemagic.yaml` READS from Info.plist and does NOT overwrite it. Two guards prevent Apple rejections:
1. "Verify iOS build number from Info.plist" step fails the build if `CFBundleVersion <= LAST_ACCEPTED_BY_APPLE` (in codemagic.yaml).
2. "Inspect final IPA metadata" step unzips the built IPA and re-checks before upload.

**To bump:** edit `CFBundleVersion` in `ios/App/App/Info.plist`, bump `CURRENT_PROJECT_VERSION` in `ios/App/App.xcodeproj/project.pbxproj` to match, commit, push, trigger Codemagic. After Apple accepts, update `LAST_ACCEPTED_BY_APPLE` in codemagic.yaml (it appears on TWO lines).

**Why (historical rejections — do not repeat):** build 110 and build 200 were rejected because a prior agvtool step OVERWROTE Info.plist with stale hardcoded values. A second overwrite vector — an Xcode `Force App Version` `PBXShellScriptBuildPhase` running PlistBuddy to hardcode version values onto the built app — was removed from project.pbxproj (2026-05-30). NEVER reintroduce any build phase that writes version values into the built product's Info.plist.

**Capacitor cold-start rule:** NEVER set `server.url` in `capacitor.config.ts` — it makes the iOS WebView download the entire Vite bundle from https://dime-time.com on every cold launch (~10s delay observed in TestFlight). Bundled assets must ship inside the IPA (`webDir: 'dist/public'` → `ios/App/App/public/`); API calls route to production via `Capacitor.isNativePlatform()` in `client/src/lib/queryClient.ts`. **Before each Codemagic build:** `npm run build && npx cap sync ios` so `ios/App/App/public/` has a fresh bundle (otherwise stale placeholders ship).

Deployment chain: Codemagic CI/CD (Mac mini M2) → App Store Connect (TestFlight → App Store), Apple Developer certs.

**Approved version closes the train (2026-07-30):** once Apple approves a marketing version (CFBundleShortVersionString), that train is CLOSED — altool rejects any new build for it (errors 90062/90186). A new upload needs BOTH a higher marketing version and a new build number; bump Android versionCode/versionName in lockstep.
