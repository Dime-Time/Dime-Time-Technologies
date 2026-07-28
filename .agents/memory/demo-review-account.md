---
name: Demo data for the App Store review account
description: Why a client-side sample dataset exists for the review account and the rules it must obey
---

The iOS build talks to the PRODUCTION API, and the agent's DB tools are read-only on production — so the agent CANNOT seed sample data into the review account's prod database. Apple reviewers (and marketing screenshots) need a populated app, but the review account has real debts entered and no linked bank, so every round-up/spending analytic computes to $0.00 (analytics are derived entirely client-side from `/api/transactions` + `/api/dashboard-summary`).

**Solution:** a deterministic, internally-consistent sample dataset injected CLIENT-SIDE, gated to the review account email, shipping inside the build. Lives in `client/src/lib/demoData.ts`; consumed via react-query `select` transforms in the dashboard / insights / transactions pages.

**Rules that must never be broken:**
- **Real data always wins.** Only inject when the server response is genuinely empty — transactions: `length === 0`; summary: ALL round-up/payment fields zero. Never override individual zero fields (a real $0 is valid business data).
- **Never persist transformed demo values** into any shared/global client cache — a later session for a different account could read them back. (The dashboard cache write is guarded with `!isDemo`.)
- Gating is by review email only; never enable for arbitrary users.

**Why:** this is the App-Store-legitimate alternative to pixel-editing fake numbers onto screenshots (which violates Apple accuracy rule 2.3). It also gives reviewers a non-empty app, which Apple expects.

## 2026-07-28 decision
Founder confirmed the Insights numbers were sample data and chose to KEEP the injection until Apple approves build 210, then remove it (tracked as a project task). Do not remove earlier.
