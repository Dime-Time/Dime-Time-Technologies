---
name: Subscription billing (Stripe Billing, ENABLE_SUBSCRIPTIONS)
description: How the $2.99/mo plan works, entitlement policy, consent evidence, founder-run prod-enable steps, and the test-mode verify script.
---

# Subscription billing — Dime Time Debt plan

Locked decisions (founder, 2026-07-14): Stripe Billing (NOT Apple IAP — app is a
"financial services" exemption category), single plan "Dime Time Debt" $2.99/mo,
lookup_key `dime_time_debt_299_monthly`, ACH billing off the same linked bank
account as round-ups, anniversary billing, immediate first charge, no trial.
Free tier = debt tracking; paid = round-up automation. Ships OFF in iOS 207+.

## Entitlement policy — CORRECTED 2026-08-04
`shared/subscriptionPlans.ts#evaluateEntitlement(sub, now)` is the single
source of truth (`{state, entitled, reason, unexpected}`). The old broad
allowlist (active/trialing/incomplete/past_due all entitled) is GONE — do not
reintroduce `isSubscriptionEntitled`/status-only checks.
- **`active`** is the only status that entitles by itself.
- **`incomplete`** entitles ONLY while a server-persisted, unexpired
  `provisionalAccessUntil` exists. It is set once (never extended) by
  `buildSubscriptionRow` when `verifyProvisionalAchEligibility` confirms a
  real us_bank_account PaymentIntent in `processing` with matching
  invoice/customer ownership, AND `SUBSCRIPTION_PROVISIONAL_ACH_DAYS` > 0.
  **Default is 0 = NO provisional access** — the window length is a founder
  business decision (recommended 7); until he sets it, new subscribers wait
  for the first ACH debit to settle.
- **`past_due`** entitles ONLY while `graceUntil` is unexpired; set once on a
  local active→past_due transition (`SUBSCRIPTION_PAST_DUE_GRACE_DAYS`,
  default 14, bounds Stripe's retry cycle), never reset by duplicate events.
- **`trialing` fails closed** (no approved trial exists) and is flagged
  `unexpected`; unknown/malformed statuses and non-catalog prices
  (`plan: "unsupported"` via lookup_key check) also fail closed.
Revocation: invoice.payment_failed, charge.refunded/failed, dispute.created
all clear `provisionalAccessUntil` via a fresh Stripe re-fetch. Out-of-order
webhooks are dropped by `upsertSubscription`'s `lastStripeEventAt` setWhere
guard; authoritative writes (subscribe/reconcile/invoice re-fetch) stamp
`authoritativeEventAt()` (max(now, stored+1s)) so clock skew can't skip them.
`POST /api/subscription/reconcile` (auth, rate-limited, ownership-checked)
lets a user force a fresh Stripe sync.
DB: 4 nullable columns (provisional_access_until, grace_until,
last_payment_intent_status, last_stripe_event_at) — pushed to dev only;
**prod needs a schema push at deploy time before this code runs there.**
Terminal (a NEW subscription may be created): `canceled`, `incomplete_expired`,
`unpaid`.

## Consent evidence chain
Consent row (`subscription_consents`: version, verbatim text, IP, UA, price at
consent) is written BEFORE any Stripe call; the SetupIntent mandate cites that
row's IP/UA as `mandate_data.customer_acceptance`. Bump
`SUBSCRIPTION_CONSENT_VERSION` (shared/subscriptionAuthorization.ts) whenever
the text changes — never edit text in place without a version bump.

## Gate behavior (flag OFF = zero change)
`server/lib/subscriptionGate.ts` returns access=true when the flag is OFF, so
the round-up gates (transaction split, round-up-settings enable, apply-round-ups)
are no-ops until launch. Client paywall UI is likewise driven by `_flags` +
`/api/subscription` `entitled` — flag OFF renders nothing.

## Launch verification (2026-07-28) — CLOSED
Founder's first live subscribe verified in prod (read-only): consent row written
before the Stripe call, subscription row `active` via upsertSubscription, and
`customer.subscription.created` webhook delivered + deduped in
`stripe_webhook_events` (signature-verified, no 400) — proving live-dashboard
subscription-event registration works. `invoice.paid` won't arrive until the
first ACH debit settles (2–4 business days) — its absence right after subscribe
is NOT a failure. Gate verified in dev: entitled user access=true, non-subscriber
=false, full status matrix per subscriptionPlans. One pre-launch user has
round-ups enabled with no subscription → hits the silent-skip path (transaction
recorded, split skipped); Settings shows the "Unlock round-up automation"
banner, but nothing surfaces per-transaction.

## Founder-run steps before enabling in production (agent never does these)
1. In BOTH Stripe dashboards (test + live), add these events to the existing
   webhook endpoint: `customer.subscription.created`, `customer.subscription.updated`,
   `customer.subscription.deleted`, `invoice.paid`, `invoice.payment_failed`.
   (Handler already accepts them; without registration, entitlement revocation
   on failed renewals never arrives.) Keep the endpoint's pinned API version at
   the SDK pin (2024-06-20) — the handler tolerates the 2025 "basil" field moves
   (invoice.parent.subscription_details, item-level periods) but matching
   versions is the tested path.
2. Set `ENABLE_SUBSCRIPTIONS=1` in production env scope and republish.
   `ENABLE_STRIPE_ACH` must already be ON (it is) or boot throws.
3. First live subscribe should be the founder's own account.

## Test-mode verification
`scripts/verify-subscription-flow.ts` (uses STRIPE_SECRET_KEY_TEST) proves the
whole service path: price find-or-create, mandate, subscribe, cancel-at-period-
end, hard cancel. Gotcha: raw test-mode us_bank_account PMs need microdeposit
pre-verification (descriptor `SM11AA`) before they can be debited — production
Financial Connections PMs are instantly verified, so the app never does this.
The script self-cleans (cancels sub, deletes customer); the test-mode
product/price it creates is reused forever via lookup_key.

## Double-billing defenses (both required)
- Caller `Idempotency-Key` (reserved in idempotency_keys, forwarded to Stripe)
  covers same-key retries.
- Per-user subscribe lock (`storage.acquireSubscribeLock`, a never-finalized
  idempotency_keys row, stale-expired after 2 min) covers concurrent requests
  with DIFFERENT keys (two tabs/devices) — without it both pass the
  duplicate-sub check during the multi-second Stripe round-trip and create two
  live subscriptions.
- Subscription debits intentionally bypass `reserveRealStripeAchDebit` (that
  gate is scoped to transfer/debt-payment debits — replit.md wording updated).

## Webhook write-path rule
Subscribe route and webhook both land on `storage.upsertSubscription()` keyed
on `stripeSubscriptionId`, so delivery order can't race. Invoice events
re-fetch the subscription from Stripe rather than trusting event ordering.
User resolution: `metadata.dimeTimeUserId` first, local row second.

## Native store compliance (2026-08-04)
Native (Capacitor) builds must NEVER show the subscribe flow, price-with-CTA,
or a link out to a purchase page (Apple 3.1.1 / Play Payments policy).
Implementation: `Capacitor.isNativePlatform()` branches in subscription.tsx
(informational card, testid card-native-unavailable), settings.tsx and
RoundUpPausedBanner.tsx (CTA hidden, informational text kept). Existing
subscribers still see status + cancel/reactivate on native — managing an
already-purchased subscription is permitted. Web purchase + native
entitlement recognition = the compliant "multiplatform services" pattern.
**Why:** the founder's locked decision is Stripe-only (no StoreKit/Play
Billing products exist); exposing web-processor purchase inside native apps
is a rejection/removal vector.
**How to apply:** any new upsell surface (banner, notification, onboarding)
must either omit price+purchase-CTA on native or be gated the same way.
