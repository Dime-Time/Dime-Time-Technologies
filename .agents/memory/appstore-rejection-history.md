---
name: App Store status, rejection vectors & beta-banner gotcha
description: Dime Time iOS is now APPROVED & LIVE; plus the Apple rejection reasons seen across cycles and the non-obvious BetaModeBanner flag gap that re-triggers Guideline 2.2.
---

# STATUS: APPROVED & LIVE (as of 2026-06-29)
"Dime Time Mobile" is published on the US App Store: App ID `6755106723`, under the founder's Apple developer account, Finance category, Free, 16+, iPhone+iPad, ~8.9 MB, subtitle "Smart debt reduction assistant". Privacy policy links to dime-time.com/privacy. Approval happened despite a ~50% pre-submission risk estimate — the holding pattern ("no code changes while waiting on Apple") is OVER. Posture shifts from "waiting on Apple" to "live → user acquisition + funding". The rejection vectors below are HISTORICAL (kept for future update cycles); the beta-banner gotcha still applies to any future submission.

# Apple App Store rejection vectors (Dime Time iOS)

Rejection reasons Apple has cited across submission cycles (most recent first):
- **4.3(a) duplicate-app spam** — a legacy "Dime Time Technologies" record (`com.dimetime.app`) collided with current `com.dimetime.mobile`. Addressed via Resolution Center reconsideration + removing/explaining the old record.
- **2.2 Beta Testing** — "beta" labels/features in a production submission (belongs on TestFlight, not the App Store).
- **2.1 Performance** — app unresponsive on iPad Air (5th gen) / iPadOS. Capacitor WebView iPad responsiveness is a recurring risk; consider iPhone-only device family if iPad isn't a target.
- **2.3.10** — references to "Android" in the iOS binary/metadata.
- **1.5 Safety** — non-functional Support/Privacy URL.
- **2.3.3 Accurate Metadata** — screenshots didn't show real UI/functionality.

# Non-obvious gotcha: two beta banners, only one is flag-gated
**`BetaBanner.tsx` IS gated** by `useFlag("ENABLE_BETA_BANNER")` (default OFF) → hidden in prod.
**`BetaModeBanner.tsx` is NOT gated** — it renders the literal text "Beta Mode: No live transfers are currently being processed…" unconditionally wherever it's mounted: Onboarding (first-run), payment-modal, AcceleratedPayment, BankSetupFlow, settings.

**Why this matters:** flipping `ENABLE_BETA_BANNER` off does NOT remove the word "Beta" from the app — a reviewer still sees "Beta Mode" on core flows, which directly re-triggers Guideline 2.2.

**How to apply (only when Apple rejects / requests changes — no code changes while waiting):** reword `BETA_TEXT` in `BetaModeBanner.tsx` to drop "Beta," but KEEP the honest substance ("No live transfers are processed; payment/ACH features operate in sandbox/testing mode") + the compliance line. Hiding the simulated nature would itself risk a "misleading" rejection, so reword rather than remove.

# Orphaned-but-routed risky pages (reachable only by direct URL, not in nav)
Routed in `App.tsx` but NOT linked from primary navigation (Home/Banking/Crypto/Insights): `/business-analytics` (growth projections + TikTok marketing strategy — looks like internal pitch material), `/dime-token`, `/stats` (shows "Web, iOS, Android" → 2.3.10 risk), `/admin` (backend `requireAdmin`-gated). `ComingSoon.tsx` and lowercase `landing.tsx` ("Coming soon!" + `alert()` CTA) are imported but NOT routed → currently unreachable. Low discoverability, but a stray nav link or reviewer deep-link would expose them.

# Upload failure: CONTRACT_NOT_VALID (2026-07-08, resolved)
Codemagic step "Upload IPA to App Store Connect" fails with altool 403 `FORBIDDEN_ERROR.CONTRACT_NOT_VALID` ("You do not have required contracts") when Apple has a pending Program License Agreement (or Paid Apps agreement) awaiting Account Holder acceptance, or the $99 membership lapsed.
**Why:** Apple periodically pushes updated agreements; ALL uploads freeze account-wide until accepted. Not a code/build issue — the IPA builds fine.
**How to apply:** founder logs into App Store Connect → Business / "Agreements, Tax, and Banking" → accept; then simply re-run the same Codemagic build (no push, no code change needed).
