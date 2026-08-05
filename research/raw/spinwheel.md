Research complete on Spinwheel (Spinwheel Solutions, Inc., spinwheel.io) for Dime Time's round-up debt-payoff use case.

## Key Facts (with URLs)

- **What it is:** A low-code "embedded debt solutions" API platform with two core products relevant to Dime Time: **Connect** (verify + link a user's liabilities) and **Pay / Embedded Payments** (bill pay to creditors). It positions as consumer-credit-data + payments infrastructure (an "open banking for liabilities" play). Sources: https://spinwheel.io/ , https://spinwheel.io/products/pay , https://docs.spinwheel.io/docs/embedded-payments
- **Debt/liability types supported (payable via allocation):** student loans, home loans (mortgage/HELOC), auto loans, plus credit cards and misc loans. Payment API examples show `studentLoanId`, `homeLoanId`, `autoLoanId` allocations. Full subtype list confirms Credit Cards (CreditCard, SecuredCreditCard, ChargeAccount, etc.), Auto, Home, Misc. Sources: https://docs.spinwheel.io/reference/create-request-1 , https://docs.spinwheel.io/docs/liability-subtypes
- **Phone-number-based auth: YES.** Users are connected with just a **US mobile phone number + date of birth** via SMS OTP; alternatives are KBA and a "Pre-Verified (Phone)" flow, plus a cross-partner Network Token. Debt data is Equifax-backed. Source: https://docs.spinwheel.io/docs/user-connect
- **Company health:** Raised **$30M Series A (announced late June/July 2025), led by F-Prime**, with Fika Ventures, Foundation Capital, QED Investors, and Citi Ventures. Founded 2019. Claims 15M+ users, 165M accounts, $1.5T debt tracked. Customers named: **Monarch, NerdWallet, NASA Federal Credit Union**; 2025 partnerships with Oscilar and Algebrik AI. No incidents/outages/lawsuits found. Sources: https://www.fintechfutures.com/venture-capital-funding/spinwheel-raises-30m-series-a-led-by-f-prime , https://spinwheel.io/blog/spinwheel-raises-30-million-series-a...

## Developer Access & Pricing

- **Self-serve SANDBOX, sales-gated PRODUCTION.** You can self-register at https://developer.spinwheel.io with email/Google, instantly get **Sandbox API keys**, and all endpoints/functionality are available in sandbox with test users. But: *"If you are ready to proceed with a production integration, please contact your Spinwheel representative."* Connection strategy (SMS/KBA/pre-verified) must be aligned with a Spinwheel rep, and the Pre-Verified phone flow explicitly requires rep approval. Base URLs: sandbox-api.spinwheel.io / api.spinwheel.io. Source: https://docs.spinwheel.io/docs/getting-started-1
- **Pricing: NOT published. Contract-based, sales-led.** No public price list. Third-party FinOps profile confirms "billed through a sales-led partner agreement rather than a public price list," usage-metered on 5 drivers: credit-report pulls (Equifax-backed, primary cost driver), liability refreshes, refresh subscriptions, **payment transactions**, and connected users. No reported dollar ranges were found. Expect an MSA + minimums typical of credit-bureau-backed platforms. Sources: https://apis.io/finops/spinwheel/spinwheel-finops/ , https://spinwheel.io/legal/master-services-agreement/
- Implication for a solo founder: no credit card / instant production onboarding — you'll go through a sales cycle and sign an MSA before touching real money.

## API Integration Sketch for a Weekly-Batch Payout Engine

Flow to pay users' creditors from collected round-ups:
1. **Connect each user** once via SMS OTP (phone + DOB) → get `userId` and their liabilities. Check each liability's **capabilities matrix**; only `SUPPORTED` liabilities are payable. (docs/user-connect, docs/payments-process)
2. **Create + verify a Partner Payer** (your funding entity) via micro-deposit verification (verify 2 transactions). This is your source of funds. (payments-process)
3. **Fund the platform FBO account**: call *Payment to Platform* (ACH into a Spinwheel FBO/for-benefit-of account). You get a `PLATFORM_PAYMENT_STATUS` webhook. This is where Dime Time's collected ACH round-ups would land before disbursement.
4. **Create Payment requests** to each user's liability: `POST /v1/payments/requests` with `amount`, `payerId`, `userId`, `requestType` (ONE_TIME or recurring), and `useOfFunds.allocation` (by loanId/percentage). Subscribe to `USER_PAYMENT_STATUS` webhook.
- **Rails & settlement:** Liability (creditor) payments run over **RPPS** with **STANDARD settlement only**, cut-off **2:00pm PT**. Bank-account payments run over ACH (SAME_DAY cutoff 7:00am PT / NEXT_DAY 5:30pm PT). Platform funding is ACH (same-day 7am PT / next-day 5:30pm PT). So a weekly batch: fund FBO early in the week (account for 1–2 day ACH), then fire liability payment requests before the 2pm PT RPPS cutoff; STANDARD settlement to creditors is not instant — build in several business days lag. (docs/payments-process, reference/create-request-1)
- **Webhooks:** subscribe to `PLATFORM_PAYMENT_STATUS` and `USER_PAYMENT_STATUS`; reconcile via `extRequestId` idempotency key you supply. (docs/webhooks)

## Risks & Unknowns

- **No public pricing** — cannot size unit economics without a sales conversation; per-payment/credit-pull fees unknown. Credit-report pulls (Equifax) are called out as the main variable cost, which matters if you pull data frequently.
- **Production is gated** — a solo pre-revenue founder may face onboarding friction, minimums, and diligence (BSA/AML, use-of-funds).
- **Compliance posture (needs confirmation from Spinwheel):** The docs strongly imply **Spinwheel (via a bank/processor partner) holds the money-transmission/FBO plumbing** — you fund an FBO account and they originate RPPS/ACH to creditors, which suggests you may not need your own MT licenses. But this is NOT explicitly stated in public docs; the licensing/BIN-sponsor bank and whether Dime Time is a "third-party sender" vs. relying on Spinwheel's licenses must be confirmed contractually (MSA + Business Terms). Do NOT assume you're license-exempt without written confirmation. Sources: https://spinwheel.io/legal/business-terms-of-service , https://spinwheel.io/legal/master-services-agreement/
- **RPPS STANDARD-only settlement** to creditors means no instant/same-day payoff to cards/loans — UX must set expectations.
- Round-up collection (debiting users' bank accounts via ACH) may be OUTSIDE Spinwheel's scope — their payments are FBO-funded bill-pay, not the consumer-facing ACH pull. You may still need a separate ACH-debit provider (e.g., Dwolla/Plaid/Astra/Increase) to collect round-ups, then feed Spinwheel for payout. Confirm with Spinwheel.

## Brief Competitor Comparison
- **Method Financial (methodfi.com):** closest direct competitor — also liability connectivity + embedded payments to credit/loan accounts, phone-first. Frequently benchmarked head-to-head with Spinwheel; Method is often cited as the incumbent leader for debt-account payments. Worth a parallel eval. (https://methodfi.com/ , docs.methodfi.com)
- **Astra:** ACH/instant transfer + round-up automation infrastructure — better fit for the *round-up collection* leg than the *creditor payoff* leg.
- **Dots:** general multi-rail payouts, not debt-specialized; weaker fit for paying specific credit-card/loan accounts.
- **Net:** Spinwheel and Method are the two debt-native choices for paying creditors directly; Astra fits the round-up collection side.

## Sources (numbered)
1. https://spinwheel.io/ — Spinwheel homepage / product overview — Aug 2026 (accessed) — Tier: vendor/primary
2. https://docs.spinwheel.io/docs/payments-process — Payment process, rails, cut-off times — updated May 2026 — Tier: vendor/primary docs
3. https://docs.spinwheel.io/reference/create-request-1 — Create a Payment API (allocation, settlement speeds) — updated May 2026 — Tier: vendor/primary docs
4. https://docs.spinwheel.io/docs/user-connect — Phone/DOB SMS+KBA connect flows — Tier: vendor/primary docs
5. https://docs.spinwheel.io/docs/getting-started-1 — Self-serve sandbox keys, sales-gated production — updated Jul 2026 — Tier: vendor/primary docs
6. https://docs.spinwheel.io/docs/webhooks — Webhook events — Tier: vendor/primary docs
7. https://docs.spinwheel.io/docs/liability-subtypes — Debt/liability types — updated Jun 2026 — Tier: vendor/primary docs
8. https://www.fintechfutures.com/venture-capital-funding/spinwheel-raises-30m-series-a-led-by-f-prime — $30M Series A, investors, customers — Jul 1 2025 — Tier: trade press
9. https://apis.io/finops/spinwheel/spinwheel-finops/ — Pricing model (contract-based, usage meters) — Tier: third-party analysis
10. https://spinwheel.io/legal/master-services-agreement/ & https://spinwheel.io/legal/business-terms-of-service — Commercial/compliance terms — Tier: vendor/primary
11. https://methodfi.com/ — Method Financial (competitor) — Tier: vendor/primary

Note: I could not find any explicit public statement of which entity holds money-transmitter licenses or names the sponsor bank — flagged as an Unknown to resolve directly with Spinwheel sales/legal.