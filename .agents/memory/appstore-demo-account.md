---
name: App Store reviewer/demo account & data-seeding constraints
description: Which account to give Apple's reviewer and why fresh demo accounts can't be populated with debts
---

# App Store demo / screenshot account

**Use `tim@dime-time.com` (the founder's own prod account) as the Apple reviewer demo account AND the account to screenshot from.**
- It already holds 2 clean, presentable sample debts (Student Loan, Credit Card) → Dashboard + Debt Management screens look full.
- It has NO connected bank account, so giving Apple the login exposes no real financial data.

**Why a fresh/dedicated demo account can't be seeded:**
- There is **no debt-creation path** in the product: no `POST /api/debts` route, and the "Add Debt Account" button in `debts.tsx` is a stub (`onCtaClick` is a TODO). So a brand-new account stays empty on Dashboard/Debts.
- The agent **cannot write to production**: the database skill's `executeSql` is READ-ONLY against prod (SELECT only). Dev and prod are **separate** databases, so seeding dev does not reach the iPhone (which talks to prod via dime-time.com).
- Only existing real accounts have debts; among prod users, 4 have 2 debts each; only `tim@dime-time.com` has debts AND no bank link.

**How to apply:** For any App Store submission/screenshot task, point the user at `tim@dime-time.com`. Screenshots must be taken on a real iPhone (TestFlight) for correct Apple portrait dimensions — the agent's `screenshot` tool only captures desktop/landscape and can't authenticate.

**Latent review risk (guideline 2.1):** because "Add Debt" is a stub, a reviewer who taps it sees nothing happen. Flag this before submission; fixing it (route + UI) requires a new iOS build.
