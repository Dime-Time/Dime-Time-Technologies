---
name: Stripe Financial Connections registration + permission scope
description: FC bank-connect (beta) has FOUR independent 502 failure modes — unregistered account, unactivated scope, exchange omitting billing_details[name], and duplicate re-link of an already-linked FC account.
---

# Stripe Financial Connections: registration AND permission-scope must both line up

## STATUS 2026-07-25: LOOP CLOSED — full link flow live-verified end to end
Founder completed the flow on iPhone at 12:08 UTC (after the Stage-4 fix was republished
at 12:02): authorize → fc_session_created → Stripe picker → BOTH Mercury accounts exchanged
via `fc_exchange_relinked` → 200 in ~0.5s each. Both accounts had rows since 2026-07-10,
which is why the pre-fix blind insert 502'd (08:08 UTC attempt) and why both took the
refresh path post-fix. Nothing left to verify in this flow.

## STATUS 2026-07-24: registration APPROVED and live-verified
Founder's on-device test (live prod): `fc_session_created` logged in live mode and the
Stripe FC modal fully rendered in the iOS app — Link phone verification, saved-account
picker (his Mercury accounts), institution list, Chase hand-off. The old "not registered"
502 is gone. Remaining to fully prove the loop: complete one link through
`/financial-connections/exchange` (fastest: pick already-saved Link accounts → "Connect
accounts"; no bank OAuth needed). **Gotcha found:** choosing Chase inside the FC modal in
the native WebView shows Stripe's "Copy the link below and open it in your browser"
fallback (app-to-app OAuth can't launch from the WebView); the modal polls and proceeds
after the user authorizes in Safari — clunky but functional. Selecting saved Link accounts
avoids it entirely.

The Stripe "Connect bank account (beta)" flow (`StripeConnectButton` →
`POST /api/stripe/financial-connections/session` → `createFinancialConnectionsSession`
in `server/services/stripeService.ts` → `collectFinancialConnectionsAccounts`) depends on
Stripe **Financial Connections**. It can 502 for FOUR distinct reasons — fix them in order:

## Stage 1 — account not registered (external, founder action)
**Symptom:** 502, log `event:"fc_session_failed"` with
> "You are not registered to use Financial Connections. Please submit your registration
> at https://dashboard.stripe.com/financial-connections/application"

**Fix:** founder submits the FC registration in the **live** Stripe dashboard. Choose use
case **"Accept bank payments"** and data type **"Tokenized account and routing number"**
(= the `payment_method` scope). Skipping balances/ownership keeps review fast. Not a code bug.

## Stage 2 — code requests a scope the account didn't activate (CODE bug)
After Stage 1 clears, the session still 502s if the code requests permissions beyond what
was registered.
**Symptom:** 502, log `fc_session_failed` with
> "You cannot request the ['balances'] permissions ... without first activating this
> product ... only request payment_method to simply collect bank account details."

**Fix:** trim the `permissions` array in `createFinancialConnectionsSession` to exactly the
registered scope. We request only `["payment_method"]`. Nothing downstream needs FC
`balances`/`transactions`/`ownership` — `attachFcAccountAsPaymentMethod` only reads
`last4`/`institution_name` (ships with `payment_method`), `createAchDebit` operates on the
stored PaymentMethod, and the app's balance/transaction UI is Plaid-backed, separate from
Stripe FC. **Rule: the requested FC permission scope must never exceed the account's
activated FC scope.**

## Stage 3 — exchange omits billing_details[name] (CODE bug)
After Stages 1 & 2 clear, the FC modal completes and the client posts each linked account to
`POST /api/stripe/financial-connections/exchange` → `attachFcAccountAsPaymentMethod`. This
502s on `stripe.paymentMethods.create` for a `us_bank_account`.
**Symptom:** 502, log `event:"fc_exchange_failed"` with
> "Missing required param: billing_details[name]."

No `stripe_accounts` row is written, so the app shows "no accounts connected" even though the
bank link succeeded on Stripe's side. **Fix:** Stripe REQUIRES `billing_details.name` when
creating a `us_bank_account` PaymentMethod. Source it from the app user
(firstName+lastName → email → placeholder) and pass `billing_details: { name }`. Stripe does
NOT verify this name against the bank's holder record (ownership is proven by the bank login
in the FC modal), so the app user's name is acceptable. **Before wider beta:** replace the
literal placeholder fallback with a 422 "complete your profile" so real-money ACH mandate
evidence always carries a real name.

## Stage 4 — re-linking an already-linked account hits the unique index (CODE bug, fixed 2026-07-25)
**Symptom:** 502, log `fc_exchange_failed` with
> duplicate key value violates unique constraint "stripe_accounts_stripe_fc_account_id_unique"

Stripe Link remembers saved bank accounts, so re-picking an already-linked account is the
NORMAL returning-user path — the exchange route blind-inserted into `stripe_accounts`.
**Fix:** exchange is idempotent: lookup by `stripe_fc_account_id` first — same user → attach a
fresh PaymentMethod and refresh the EXISTING row in place (same row id, so funding-account
selection and transfer history stay valid); different user → 409 (`fc_exchange_conflict`);
insert race → catch 23505/constraint-name and fall back to the refresh path. Old
PaymentMethods stay attached to the Stripe customer (harmless clutter — deliberate, no detach).

**UX gotcha (not a bug):** a successful link surfaces on the **Debts page** (each debt's
"Pay with linked bank (beta)" button reads `/api/stripe/status`), NOT the Banking page — the
Banking page only lists Plaid `bank_accounts`. Expect a false "no accounts connected" report
if you point the founder at the Banking page after a successful Stripe link.

## Deploy note
All fixes only take effect in production after a **re-publish** — dime-time.com is an
autoscale deployment that snapshots code+secrets at publish time. Code edits in the
workspace do NOT reach prod until the founder republishes.

**Fallback (only if FC approval stalls):** `us_bank_account` PaymentMethods can also be
created via manual account+routing entry (micro-deposit / instant verify), which needs no
FC — but that is a separate code path not currently implemented.
