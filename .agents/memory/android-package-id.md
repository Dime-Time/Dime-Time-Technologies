---
name: Android package ID is intentionally different from iOS
description: Why Android applicationId differs from the iOS bundle id, and why it must not be "fixed"
---

# Android package ID: com.dimetime.app (intentional, permanent)

- **Android** `applicationId` / namespace: `com.dimetime.app`
- **iOS** bundle id: `com.dimetime.mobile`

These two **deliberately differ** and must NOT be reconciled.

**Why:** On 2026-06-03, with iOS already submitted to the App Store as
`com.dimetime.mobile`, the founder (Tim) was given the choice to either keep the
Android scaffold's existing `com.dimetime.app` or rename it to match iOS. He chose
to KEEP `com.dimetime.app` (lower risk — already wired through MainActivity path,
namespace, strings.xml). The two stores do not require matching IDs.

**How to apply:** Do not "fix" the mismatch by renaming Android to
`com.dimetime.mobile`. Once the Android app is uploaded to Google Play, the
`com.dimetime.app` package name becomes PERMANENT and can never be changed. Treat
any future "the IDs don't match" observation as expected, not a bug.
