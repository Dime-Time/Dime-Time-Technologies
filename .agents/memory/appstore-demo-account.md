---
name: App Store reviewer/demo account & data-seeding constraints
description: Which account to give Apple's reviewer and why fresh demo accounts can't be populated from agent tooling
---

# App Store demo / screenshot account

**Use the founder's own production account (the support email in `replit.md`) as the Apple reviewer demo account AND the account to screenshot from.**
- It already holds clean, presentable sample debts (e.g. Student Loan, Credit Card) → Dashboard + Debt Management screens look full.
- It has NO connected bank account, so giving Apple the login exposes no real financial data.

**Why the agent can't just seed a fresh demo account:**
- The agent **cannot write to production**: the database skill's `executeSql` is READ-ONLY against prod (SELECT only). Dev and prod are **separate** databases, so seeding dev does not reach the iPhone (which talks to prod via dime-time.com).
- **Why:** any "just create a demo account with debts" plan has to run against prod, which is not writable from here — so reuse an existing prod account that already has presentable data and no bank link.

**How to apply:** For any App Store submission/screenshot task, point the user at the founder's prod account. Screenshots must be taken on a real iPhone (TestFlight) for correct Apple portrait dimensions — the agent's `screenshot` tool only captures desktop/landscape and can't authenticate.
