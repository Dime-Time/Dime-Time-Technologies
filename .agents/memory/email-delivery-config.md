---
name: Production email delivery config
description: What must be configured for verification / password-reset emails to actually send in production, and why partial config silently fails.
---

# Production email delivery (Resend)

Transactional email (email verification + password reset) runs through Resend.
Getting it working in **production** needs ALL of the following — any one missing
makes sending fail, and some fail silently/confusingly:

1. **`RESEND_API_KEY`** (global Secret). The email service **fails closed** in
   production: with no key it returns `{ok:false}` and the app surfaces a 503
   ("We couldn't send the verification email right now"). This is intentional so
   reset links (which contain secret tokens) are never logged to stdout in prod.
2. **`PUBLIC_APP_URL`** = `https://dime-time.com` (production env var). Verify/reset
   links are built from this. In production the base-URL resolver returns `null`
   when it's unset (it refuses to trust the request Host header for security), so
   emails fail with reason `misconfigured` (503) **even when the Resend key is
   present**. This trap bit us once — set it in the `production` scope only (dev
   synthesizes the base URL from the request host, so dev links stay local).
3. **Domain verification + `EMAIL_FROM`** to reach real users. The default sender
   `Dime Time <onboarding@resend.dev>` is Resend's **shared** sender and can only
   deliver to the Resend account owner's own address until you verify the
   `dime-time.com` domain in Resend (add its DNS records). After the domain is
   verified, set `EMAIL_FROM="Dime Time <noreply@dime-time.com>"`. Do NOT set
   `EMAIL_FROM` to a dime-time.com address before the domain is verified — sends
   will be rejected.
4. **Republish** after changing any of the above — production picks up new
   secrets/env vars only at deploy time.

**Why:** a founder set only the API key, tested with their own inbox (worked), and
assumed it was fixed — but other users (unverified domain) and/or the missing
`PUBLIC_APP_URL` kept it broken. Verify the whole loop with a NON-owner email
before declaring done.

**Status as of 2026-07-18:** FULLY CONFIGURED. Domain `dime-time.com` is VERIFIED
in Resend (us-east-1), `EMAIL_FROM="Dime Time <noreply@dime-time.com>"` (shared env
var), key + `PUBLIC_APP_URL` live in prod. Test send from the verified sender
succeeded end-to-end. Remaining prod pickup happens at Republish.

**Gotcha — send-only API key lies about domains:** the stored `RESEND_API_KEY` is
restricted to sending. `GET /domains` with it returns an EMPTY list (not an error),
and `POST /domains` returns 401 `restricted_api_key`. Never conclude "domain not
registered" from an empty list with this key — check the Resend dashboard (or do a
real test send from the domain sender) instead. Probe delivery safely via Resend's
`delivered@resend.dev` sink when you don't want to hit a real inbox.

**Client UX:** `getApiErrorMessage()` in `client/src/lib/queryClient.ts` unwraps
the server's JSON `message` so toasts never show a raw `503: {json}` blob; the
`throwIfResNotOk` error keeps its `"<status>: <body>"` message shape so
`isUnauthorizedError` (`/^401: .*Unauthorized/`) still works.

**Contact-form notifications (added 2026-07-16):** contact/feedback submissions
previously only landed in `contact_submissions` — nobody was notified, and real
beta signups sat unseen for months. Now every submission also fire-and-forgets a
notification email to the founder's business contact address (see replit.md;
it is the Resend account-owner address, which delivers even while the domain
is unverified), with Reply-To set to the submitter. A failed notification never fails the request (submission is already
saved); result is logged as `contact_notification_sent`/`_failed`. Lesson: any
"store a message" feature needs a delivery path to a human, or verify the owner
actually checks the table.
