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
