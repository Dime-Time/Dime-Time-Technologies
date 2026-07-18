---
name: Plaid plan downgrade before prod reapplication
description: The Plaid plan should be downgraded to pay-as-you-go before the production/Liabilities reapplication; factor plan status into any burn or timeline discussion.
---

# Plaid billing plan (operational lesson)

- The project was on a committed Plaid plan while pre-revenue and before debt import was live in production. The agreed goal is to switch to Plaid's pay-as-you-go tier before reapplying for production access.
- Delinquency with Plaid could jeopardize the **production + Liabilities reapplication** (the previous application was rejected — see debt-import-feature.md).

**Why:** a committed-minimum plan at pre-revenue stage is the wrong tier and dominates operating costs; billing standing affects Plaid's approval decisions.

**How to apply:**
- When discussing burn, runway, or the Plaid reapplication, first check whether the downgrade to pay-as-you-go has happened — don't assume either way.
- Billing/negotiation specifics are founder-run; the agent's role is to flag the dependency, not to store or restate contract figures. Personal financial details live in the founder's own documents, not in memory.
- Related cost caution: hosting is Replit-only; the domain registrar should be domains-only (no paid hosting add-ons), and no additional domain purchases are needed (dime-time.com is canonical).
