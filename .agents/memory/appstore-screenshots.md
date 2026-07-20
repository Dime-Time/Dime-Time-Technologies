---
name: App Store screenshot prep
description: How to turn the founder's iPhone SE screenshots into Apple-ready App Store images
---

- Source device is an iPhone SE producing 1170×2532 PNGs. Target Apple "6.7-inch" iPhone size 1290×2796 (portrait). Aspect ratios are nearly identical, so resize-COVER + tiny center-crop is lossless-looking — never stretch.
- **Never fake demo numbers or copy into the images.** Screenshots must match the shipped build (Apple accuracy rule 2.3). The fix for an empty review account is a client-side demo dataset gated to the review email (see `demo-review-account.md`), shipped in the build and retaken — NOT pixel-editing numbers onto images.
- **TestFlight breadcrumb** ("◀ TestFlight" in the status bar) appears only when the app is opened from inside the TestFlight app. Cleanest fix going forward: open the app from the HOME-SCREEN icon, then the status bar is native/clean. After-the-fact fix: paste a solid strip over the top ~162px filled with the background color sampled just below the status bar.
- Avoid empty-state screens ("No transactions yet", "No spending data", "No monthly data") — Apple can reject empty screens.
- Apple requires **min 1, max 10** iPhone screenshots — 5–8 strong ones is ideal; do not pad to 10 with weak screens.
- Output lives in `attached_assets/appstore-screenshots/` (regenerated from `attached_assets/IMG_07xx_*.png`).

## Headless-capture pipeline (v1.0.5 sets, July 2026)
- Both device sets can be captured agent-side with headless Chromium (nix chromium + playwright-core): iPhone 6.9" = viewport 430×932 @ DPR 3 → exactly 1290×2796; iPad 13" = 1024×1366 @ DPR 2 → exactly 2048×2732. No simulator needed.
- Always verify PNG color type byte (offset 25): must be 2 (RGB). Apple rejects alpha-channel PNGs; Chromium viewport captures are RGB (safe).
- Headless env has NO emoji font → emoji render as tofu boxes. The durable fix (also better cross-device): never use raw emoji for UI icons — use Lucide icons. Emoji were replaced app-wide in dashboard/insights tips.
- Translucent nav bars (`bg-*/95 backdrop-blur`) show blurred content bleed-through in screenshots that reviewers read as a rendering defect — bottom nav was made fully opaque as a real UI fix.
- **Screenshots must mirror PRODUCTION flag state**, not dev. Flag-gated UI (e.g. the debts Import button under `ENABLE_DEBT_IMPORT`) must be hidden by intercepting `/api/user` in Playwright and forcing the flag false — never by changing env/code.
- "Beta Mode"/"Demo Mode" language anywhere in frame = Apple 2.2 risk. Beta banner sits inside every debt-card payment section → iPad (tall viewport) cannot frame the debts page without it; iPhone framing keeps it below the fold. Crypto page's honest Demo Mode badge stays in-app but its screenshot is excluded from the listing.
- If capture tooling touched `package.json`/`replit.nix` (playwright-core, chromium), those commits must be pushed before triggering the CI build only if app code changed too — sequence: UI fixes → push → Codemagic.
