# Dime Time — Go-Live Runbook (Real-Money $1 Test)

**Purpose:** turn on real ACH money movement safely and prove it with a single $1 charge to your own bank, then decide how to open it up.

**Who does what:** Steps marked 👤 **YOU** are founder-only (live keys + the real charge). Steps marked 🤝 **AGENT CAN HELP** I can do or guide if you ask. Do the steps in order — the order matters.

---

## What's already true (good news)
- Stripe has approved your account for real ACH ✅ (you confirmed this).
- The safety system is built and tested: even after you flip the master switch, **only people you personally approve can move real money**, capped at **$1 first / $5 per day / 1 transfer per day**, with a full audit trail and an instant kill switch.
- The app's "pay" buttons already send everything the backend needs (including the retry-safety key).

## The safety limits you'll see during the test (by design)
- Your **first** real transfer must be **$1 or less**.
- **$5 max per day**, **1 transfer per day** while you're the only approved user.
- No two pending charges to the same debt at once.

These are intentional guardrails. They stay on until you decide to raise them.

---

## PHASE 1 — One-time setup (before any money can move)

### Step 1 ⚙️ The new safety fields go into the LIVE database **automatically when you Publish**
The live database needs a few new fields plus one new audit table (already added in development). Here's the important part: **you don't do anything for this step, and neither do I.** When you Publish (Step 6), Replit automatically compares the development database to production, shows you a confirmation of the new fields, and adds them for you.
- It's safe and additive — **no existing data is deleted.**
- Nobody runs a database command. Replit does **not** allow pushing schema directly to the live database from here (that's by design — it prevents mistakes), so this is handled entirely by the Publish flow.
- ✅ Already verified: the development schema has all the required fields and the new audit table, so the Publish diff will carry them over cleanly.

### Step 2 👤 Set the LIVE secrets
In Replit → **Secrets** (the padlock), set these as account-wide Secrets (never paste them into chat or any file):

| Secret name | Value | Notes |
|---|---|---|
| `STRIPE_SECRET_KEY` | your **live** secret key, starts `sk_live_…` | This is what flips the backend into real "live" mode. |
| `STRIPE_WEBHOOK_SECRET_LIVE` | the **live** webhook signing secret, starts `whsec_…` | You'll get this in Step 5. |
| `ADMIN_USER_IDS` | **your user ID** (a long UUID) | Makes you an admin so you can approve yourself. Ask me — I can look your ID up from your email (read-only). |

Leave `STRIPE_SECRET_KEY_TEST` as-is (that's the test key used in development).

### Step 3 👤 Confirm the live publishable key
In your **production** environment settings, confirm:
- `VITE_STRIPE_PUBLISHABLE_KEY` = your **live** publishable key (`pk_live_…`). *(This is already set to a `pk_live_` value — just confirm it's the right account.)*
- `ENABLE_STRIPE_ACH` = `true` *(already set).*

### Step 4 👤 Flip the master money switch ON (production only)
In your **production** environment settings:
- `ENABLE_REAL_TRANSFERS` = `true`

⚠️ This is THE switch that allows real money. Nothing moves money until this is `true` **and** the live key from Step 2 is in place — both are required.

### Step 5 👤 Register the live Stripe webhook
In the **Stripe Dashboard** (make sure you're in **Live mode**, not Test):
1. Developers → Webhooks → Add endpoint.
2. Endpoint URL: `https://dime-time.com/webhooks/stripe`
3. Subscribe to payment events (at minimum: `payment_intent.succeeded`, `payment_intent.payment_failed`, `charge.failed`).
4. Copy the endpoint's **Signing secret** (`whsec_…`) and put it in `STRIPE_WEBHOOK_SECRET_LIVE` (Step 2).

### Step 6 🤝 Publish the backend
Publish so production runs the new code + flags. **Ask me and I'll start the publish**, or click Publish yourself. (No new App Store build is needed for any of this — it's all backend/server-side.)

---

## PHASE 2 — The $1 test (you, on your own phone/account)

### Step 7 👤 Link your REAL bank account
In the app, go through the bank-connection flow with your **real** bank and **accept the ACH authorization (mandate)** when prompted. The backend records your consent — a real charge is refused without it.

### Step 8 👤 Approve yourself for real transfers (now one click)
Open `https://dime-time.com/admin` in a browser and sign in (you're an admin from Step 2). Click the **Real Money** tab → under **Your account**, press **"Approve for real money."** That's the whole step.
- ✅ This one-click toggle is now built into your admin page (no App Store build was needed — it's a web page).
- The same tab lets you approve other testers later (paste their user ID and press Look up) and **revoke anyone instantly** — the "Revoke" button takes effect on their very next attempt.

### Step 9 👤 Send exactly $1
In the app, pick one of your debts and pay **$1** with your linked bank.
- The gate will allow it (first transfer ≤ $1). It writes a real charge to Stripe and a ledger entry.
- If you accidentally try more than $1 the first time, it will safely refuse — that's expected.

---

## PHASE 3 — Verify it actually worked

### Step 10 👤/🤝 Check the trail
- **Admin page** (`/admin` → Transfers): you should see one transfer, provider `stripe`, moving from `processing` → `completed`.
- **Stripe Dashboard** (Live → Payments): the $1 ACH payment appears.
- **Audit log**: the decision is recorded (ask me to pull `real-transfer-audit` if you want to see it).
- **Your bank**: ACH takes ~1–4 business days to actually settle, so the $1 will leave your account a few days later — that's normal for ACH, not a bug.

If anything looks wrong, the **instant kill switch** is: un-approve yourself on the admin page (takes effect on the very next attempt), or set `ENABLE_REAL_TRANSFERS` back to `false`.

---

## PHASE 4 — After the $1 test succeeds (separate decisions)

1. **Open it up gradually:** approve a few more real testers (same low limits), watch the audit log, then raise the limits when you're confident. I can guide each step.
2. **Remove the "Beta Mode" wording:** the "Beta Mode: No live transfers…" notices are baked into the app's screens. Removing them is a change to the phone app, so it needs a **new App Store build** (Codemagic + Apple submission). Do this **only after** real money genuinely works — otherwise the app would claim to be live while still simulating.

---

## Quick reference

- **Master switch:** `ENABLE_REAL_TRANSFERS` (must be `true`, production)
- **Live key gate:** `STRIPE_SECRET_KEY` must start `sk_live_`
- **Webhook URL:** `https://dime-time.com/webhooks/stripe`
- **Admin page:** `https://dime-time.com/admin`
- **Limits (early rollout):** first ≤ $1, ≤ $5/day, 1/day, no duplicate pending
- **Kill switch:** un-approve the user (instant) or set `ENABLE_REAL_TRANSFERS=false`
- **No App Store build needed** for Phases 1–3 (all server-side). Only Phase 4's beta-wording removal needs one.
