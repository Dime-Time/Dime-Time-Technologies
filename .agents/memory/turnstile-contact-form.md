---
name: Turnstile contact form
description: How the dime-time.com contact form captcha is configured and how to test it
---

The public contact form is protected by Cloudflare Turnstile scoped to
`dime-time.com` + `www.dime-time.com` ONLY (keys: `TURNSTILE_SECRET_KEY` server,
`VITE_TURNSTILE_SITE_KEY` client build — both global Replit Secrets).

**Why:** the endpoint fails closed in production, so before the keys existed the
live contact form rejected every submission ("Captcha verification failed") —
a silent-looking outage found only by probing prod directly.

**How to apply / test:**
- In the dev workspace the widget always shows Turnstile error `110200`
  (unknown domain) because the replit.dev host is not in the widget's hostname
  list. This is EXPECTED and correct — do not "fix" it by adding dev domains.
- Server-side wiring is provable without a browser: `POST /api/contact` with no
  `turnstileToken` must return 400 "Captcha verification failed" (fail closed).
- Full end-to-end proof only works on the live site: founder submits the real
  form, then check the `contact_submissions` table in the prod DB (read-only).
- A curl probe of prod CANNOT distinguish "keys missing" from "keys present"
  (both 400 without a token) — check the `contact_submissions` table for recent
  rows or have the founder submit the form to verify.
