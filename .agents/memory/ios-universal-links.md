---
name: iOS universal links (Plaid OAuth return)
description: How dime-time.com universal links reach the Capacitor app; entitlements wiring and native redirect-URI rule
---

**Rule:** the native Plaid OAuth return depends on three pieces that must stay in
lockstep: (1) AASA at https://dime-time.com/.well-known/apple-app-site-association
authorizing `8WZHH537SU.com.dimetime.mobile` for `/plaid/oauth`; (2) the
`applinks:dime-time.com` Associated Domains entitlement in
`ios/App/App/App.entitlements` (referenced via CODE_SIGN_ENTITLEMENTS in both
App-target configs); (3) the client-side listener that turns the delivered https
URL into an in-app wouter navigation.

**Why:** the native WebView origin is `capacitor://localhost`, so
`window.location.href` is NEVER the redirect URI Plaid expects. On native, the
resume page must reconstruct `https://dime-time.com` + pathname + search. Break
any of the three pieces and OAuth banks (Chase etc.) strand users in Safari.

**How to apply:**
- Entitlements are a build setting, not a resource — never add a
  PBXBuildFile/Resources entry for the .entitlements file, and never put
  associated-domains keys in Info.plist.
- When hand-editing project.pbxproj, grep the chosen 24-hex UUID FIRST — a reused
  UUID (collided with the PrivacyInfo build-file entry once) silently corrupts
  the project.
- The Codemagic "Inspect final IPA" step fails closed if
  `applinks:dime-time.com` is missing from the signed app's entitlements — the
  usual cause is Associated Domains not enabled on the App ID in the Apple
  Developer portal (founder-only, must precede the build; profile regeneration
  happens automatically via the portal integration).
- Universal-link listeners live at module scope (main.tsx → universalLinks.ts),
  not in a React effect — avoids duplicate listeners; duplicate OAuth callbacks
  are dropped when already on /plaid/oauth.
- The AASA deliberately claims ONLY `/plaid/oauth` (narrow scope). A generic
  https://dime-time.com link will NOT open the app — that is by design, not a
  bug. Device testing must use a `/plaid/oauth` link (e.g. pasted into Notes or
  Messages), and from multiple sources, not just Safari.
- Plaid public tokens are single-use at Plaid's end, so a duplicate
  exchange-token call cannot create a duplicate Item; the client double-guard
  (submitted ref + skip-if-already-on-page) is the first line, Plaid the second.
