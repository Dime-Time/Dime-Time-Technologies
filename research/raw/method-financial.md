Research complete on Method Financial (methodfi.com) for Dime Time. Report below.

## Key Facts (with URLs)

**What Method does (Q1).** Method is a B2B "financial connectivity" infrastructure API for consumer *liability* data + payments. It discovers a user's debts via identity verification + a **soft credit pull** (no score impact) — NOT bank-login/credential aggregation — then normalizes balances, due dates, APRs, and enables **push payments directly to creditors**. Covered debt types explicitly include **credit cards, auto loans, student loans, mortgages, and personal loans** across 15,000+ institutions. [docs.methodfi.com/guides/overview]. Auth is a two-step IDV: (1) **phone-number verification** ("something you have"), then (2) **KYC identity verification**; both required before any account discovery or payment. US individuals only (needs US credit history + US phone). [docs.methodfi.com/guides/identity-verification/overview]

**Payment funding model (Q4 — critical for Dime Time).** Payments flow **from your company's corporate ACH bank account (the "funding account" = source) → to the user's liability (destination)**. Yes: payments are funded from the *platform's* bank account, exactly Dime Time's model. Funding account is created via API with routing+account number and must be verified via **micro-deposits (1–2 day delay) or instant via Plaid/MX/Teller**. One verified corporate funding account serves all users' payments. Note: Method does NOT hold end-user round-up balances — Dime Time still must collect/custody round-ups itself and hold sufficient balance in the funding account at payment time. [docs.methodfi.com/guides/accounts/funding, /guides/accounts/overview, /guides/payments/overview]

**Settlement & webhooks.** Processing typically **2–3 business days**; payments run in defined daily windows (submissions outside windows held to next window). Final posting is controlled by the creditor, not Method. Payment lifecycle statuses: Pending → Processing → Sent → Posted; plus Canceled, Failed, Reversal Processing, Reversed. Async — you MUST consume webhooks. Failures (NSF, closed/invalid account, creditor rejection) and reversals (post-send NSF or creditor return) emit webhook events. [docs.methodfi.com/guides/payments/lifecycle]

**Entities/Accounts API.** Data model: **Entity** (your user; name+phone+PII) → **Accounts** (liabilities discovered via "Connect" credit pull, or created manually; also funding accounts). Each account has a `products` array (e.g. `payment`, `balance`, `payoff`) — **not all liabilities support `payment`**, so you must check `products` before paying. Payment object: `{source, destination, amount, status,...}`. [docs.methodfi.com/guides/accounts/overview, /2026-03-30/reference/payments/overview]

## Developer Access & Pricing

**Access (Q2): NOT fully self-serve — sales-gated.** There's a Dashboard (dashboard.methodfi.com) with three envs: **Development** (fully mocked, free building), **Sandbox** (live data but **entities limited to a CSM-managed whitelist; payments capped at 20 txns/month, $1/txn limit**; products limited to *contracted* products), and **Production** (billed, requires contract). "Contact your Method CSM" and "book a demo" language throughout → you must sign a contract and be provisioned before real use. IDV/KYC and a verified corporate funding account are onboarding prerequisites. [docs.methodfi.com/2026-03-30/reference/environments, /guides/quickstart]

**Pricing (Q3): NO published price numbers.** Pricing is "usage-based" / "contact sales" per third-party directories (Cubbie, Shyft). Method's own blog confirms per-**payment fees** exist ("Payment fees" feature) but no dollar figures are public. I found **no reliable reported per-payment or platform-fee ranges** — treat pricing as an unknown to obtain directly via sales. [methodfi.com/blog/what-s-new..., cubbie.com/products/method-financial]

## API Integration Sketch for a Weekly-Batch Payout Engine

1. Onboard each Dime Time user once → create **Entity**, run phone verification + KYC IDV. Persist entity_id.
2. Run **Connect** to discover the user's credit card / loan → get liability **Account** id(s). Check `products` includes `payment`.
3. One-time: create + verify Dime Time's **corporate funding Account** (Plaid instant recommended).
4. Weekly job: for each user, having collected round-ups into the funding bank account, POST a **Payment** `{source: funding_acct, destination: user_liability, amount}`. Respect $1/20-txn sandbox caps during testing.
5. Subscribe to **webhooks**; drive UI off lifecycle (Pending→Sent→Posted) and handle Failed/Reversed (NSF/return) with retry + user messaging. Don't promise exact posting dates.
6. Ensure the funding account has cleared balance before batch (2–3 day settlement + reversal risk if NSF post-send).

## Risks & Unknowns

- **Money transmission (Q6): Method does NOT fully remove the burden — partial de-risking only.** Per Method's own OCC/Fed/FDIC RFI comment letter, Method is a **B2B PaaS operating within a bank-fintech (bank-partner) arrangement**; it does not position itself as a consumer-facing licensed MT and deliberately restricts platform functionality to liability *repayment* use cases to limit MT/risk exposure. It runs the rails/compliance controls for the movement it supports, but **Dime Time still owns: its own consumer relationship, its collection/custody of user round-ups (the ACH debits pulling money from users into Dime Time's account — Method does NOT do this leg), its own state MTL analysis for holding/moving user funds, KYC of its users, Reg E/consumer disclosures, and NACHA/ACH origination compliance for the round-up pulls.** Get written confirmation from Method counsel on exactly which legs are covered under their bank partner vs. what Dime Time must license. This is the single biggest open item.
- **No public pricing** — per-payment economics unknown; could be material for micro-payment round-up model (small payments × fee). Confirm minimums.
- **Sandbox is gated/whitelisted** — solo founder can build in Development free, but real testing needs a CSM/contract; expect KYB + contract friction for a pre-revenue solo founder.
- **2–3 day settlement + creditor-controlled posting + reversal risk** complicate a round-up UX; you eat NSF/reversal risk on the funding account.
- Enterprise-oriented (SoFi, Aven, Happy Money as customers) — may be less eager to onboard a tiny solo shop; minimums possible (unverified).
- Doc "published" dates render as 2026 (site templating artifact) — treat cautiously; changelog/news are the reliable dated anchors.

## Company Health / Customers (Q5)
Founded 2019–2021, Austin TX, ~49 employees. **$41.5M Series B (Jan 2025, led by Emergence Capital; avra, Samsung Next, a16z, Y Combinator, Truist)**, total raised ~$60M, reported ~$218M valuation. Customers include **SoFi ($1B+ loan payoffs via Method Direct Pay), Aven, Happy Money**. No public data-breach/incident found; they run a SafeBase Trust Center and added message-level encryption (2025). Appears healthy/growing post-2024.

## Sources
1. docs.methodfi.com/guides/overview — What Method is, debt types, soft-pull model — (Tier 1, primary/official; accessed current)
2. docs.methodfi.com/guides/payments/overview & /guides/payments/lifecycle — funding source = corporate ACH, 2–3 day timing, statuses, webhooks — (Tier 1)
3. docs.methodfi.com/guides/accounts/overview & /guides/accounts/funding — Entity/Account model, funding account creation+verification (micro-deposit/Plaid/MX/Teller) — (Tier 1)
4. docs.methodfi.com/2026-03-30/reference/environments & /guides/quickstart & /guides/identity-verification/overview — sandbox gating/caps, phone+KYC auth, contract/CSM — (Tier 1)
5. methodfi.com/legal (OCC/Fed/FDIC RFI comment letter) — bank-fintech PaaS structure, compliance posture, MT scope — (Tier 1, primary/official regulatory filing)
6. businesswire.com/.../20250123779662 & methodfi.com/blog/series-b — $41.5M Series B, investors, Jan 23 2025 — (Tier 1 press release / official blog)
7. techcrunch.com/2025/01/23/method-is-helping-fintech-companies-like-sofi... — Jan 23 2025, SoFi use case, funding — (Tier 2 reputable media)
8. methodfi.com/customers/sofi, /aven..., /happy-money — customer list — (Tier 1 official; marketing tone)
9. cbinsights.com/company/method-financial & pitchbook/premieralts — funding/valuation/headcount — (Tier 2 aggregators)
10. cubbie.com & shyft.ai Method Financial listings — "usage-based / contact sales" pricing signal — (Tier 3 directories, corroborating only)