---
name: App Store rejection vectors & beta-banner gotcha
description: Apple iOS rejection reasons seen for Dime Time and the non-obvious BetaModeBanner flag gap that re-triggers Guideline 2.2.
---

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
