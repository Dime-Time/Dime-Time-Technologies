# Mercury Float / Interest Revenue Model — Compliance & Architecture Analysis for Dime Time

**Research Date:** August 5, 2026 (Revision 2 — same date)
**Revision note:** Rev 2 corrects a material error in the original: FinCEN Ruling 2004-4 held the debt-management company was **NOT** an MSB (its transmission was ancillary to a substantive debt-plan negotiation service). The corrected authority for Dime Time's fact pattern is FIN-2009-R004, whose no-creditor-contract branch classifies the activity **as** money transmission. Rev 2 also adds a code-level trace of the actual production money flow and a restructured conclusion (§A–F). The overall conclusions are unchanged in direction but now rest on the correct rulings.
**Depth:** Deep (6 parallel research workstreams, cross-referenced)
**Sources Consulted:** 40+ (regulators, statutes, court filings, Mercury's own legal documents, law-firm analyses)
**Standard applied:** Conservative — nothing assumed permitted unless supported by documentation.

---

## Executive Summary

The proposed architecture — pooling customer round-ups in a Dime Time-owned Mercury savings account, holding them until the Friday sweep, and keeping the ~3.25% APY as revenue — is **not feasible as designed**, for three independent reasons, any one of which is disqualifying:

1. **Mercury's own Terms of Use prohibit it.** Mercury's Terms (updated June 25, 2026) list "Use the Account or the Services for any third parties" as a prohibited use [1], and Mercury's support documentation lists "using your Mercury account to facilitate payments for third parties" as an account-closure trigger [3]. Mercury offers standard business deposit accounts through partner banks — it does not offer FBO, custodial, or omnibus structures to its customers [2]. Continuing the current flow risks sudden account closure of the company's primary bank account.

2. **The flow is very likely unlicensed money transmission.** Accepting consumer funds by ACH, holding them, and forwarding them to a third party is the textbook federal definition of money transmission (31 CFR §1010.100(ff)) [9]. The directly analogous authority is FIN-2009-R004: FinCEN held that a bill-payment provider transmitting consumer payments to billers **with whom it has no contractual relationship** "qualif[ies] as [a] money transmitter" — because "there is no transaction 'other than a money transmission itself'" [42]. Dime Time contracts only with the consumer and has no creditor agreements, which is exactly that fact pattern. The exemptions all fail for the same reason: the payment-processor / payee-agent exemptions (FIN-2014-R009, FIN-2008-R006, Ruling 2003-8) require an agreement with the *creditor*, and the "integral part of another service" exemption that saved the debt-management company in Ruling 2004-4 requires a substantive non-payment service (there, negotiating debt plans and creditor concessions) that Dime Time's forward-the-round-ups flow does not provide [10][11][12][42][43]. 49 states now regulate money transmission and coordinate enforcement (e.g., the 2024–2025 multistate Kraken and Block/Cash App actions) [26][27][28].

3. **The interest presumptively belongs to the users, not Dime Time.** The controlling rule is the Supreme Court's "interest follows principal" doctrine (Phillips v. Washington Legal Foundation, 1998): interest earned on funds held for others is the property of the funds' owners [15]. The only well-documented model where a fintech keeps float (PayPal/Venmo) rests on being a licensed money transmitter, investing customer funds only in statutorily permissible investments, segregating them from corporate funds, and explicitly disclosing "you will not receive interest; we own the interest" in the user agreement [19][20][21]. A ToS line alone, without licensing and proper custody, does not replicate that model.

**The closest compliant alternative that preserves the weekly round-up model:** become the *creditors'* agent (agent-of-payee structure) or move to an FBO account at a sponsor bank via a BaaS provider — and until either is in place with counsel sign-off, run the sweep as an immediate or near-immediate pass-through with no retained interest. Details in the Recommendations section.

---

## Background

Dime Time collects spare-change round-ups from users' linked bank accounts via ACH into a company Mercury account, accumulates them, and (with the newly built engine) disburses each user's balance to their chosen creditor every Friday at midnight ET. The company currently banks with Mercury, a fintech whose banking services are provided by partner banks (Choice Financial Group, Column N.A., Patriot Bank; Evolve Bank & Trust being phased out since March 2025) [4]. The founder is evaluating holding accumulated funds in Mercury's savings product (~3.25% APY) and retaining the interest as revenue. This report answers the 27 questions in the research request, grouped by theme.

---

## Key Findings

### Finding 1: Mercury does not support this business model (Questions 1–4, 14–16)

Mercury's Terms of Use §1.4 (Prohibitions) explicitly bans using the account "for any third parties," and §9 ("No Money Transmission") states Mercury "does not accept funds from you for the purpose of sending them to another person or entity" [1]. Mercury's account-closure documentation independently lists "using your Mercury account to facilitate payments for third parties" and "using Mercury services to avoid federal or state regulatory obligations" as closure grounds [3]. Pooling end-user funds and disbursing them to users' creditors is squarely third-party fund handling.

Mercury does **not** offer FBO or custodial account structures to its customers. Its own educational blog distinguishes FBO/omnibus structures (which a fintech would open at a sponsor bank) from what Mercury actually provides: standard business demand-deposit accounts [2]. There is no Mercury product — checking, savings, or Treasury — designed to hold pooled customer funds. Mercury Treasury is a brokerage money-market product (SIPC, not FDIC) and is even less appropriate for customer funds [5].

On savings vs. checking (Q16): Mercury's documents impose no rule requiring customer-facing floats to sit in checking — because *neither* account type is permitted to hold third-party funds at all. The question is moot under Mercury's terms.

There is also a structural fragility worth naming: Mercury is itself a fintech layered on partner banks. Pooled customer money in a Mercury account is effectively an FBO-inside-an-FBO — precisely the layered-ledger dependency that failed in the 2024 Synapse collapse, where a middleware ledger mismatch left an $85M shortfall and froze end-user funds for months [23][24][25].

**Answer to Q1–4:** No, Mercury does not support this model; its terms affirmatively prohibit it. The required structure would be an FBO/custodial account at a sponsor bank (via a BaaS provider) or direct licensure — neither of which Mercury provides.

### Finding 2: The flow likely constitutes money transmission (Questions 10–13)

Federally, a "money transmitter" is one who accepts funds from one person and transmits them to another location or person by any means — expressly including ACH [9]. Dime Time's accept → hold → forward flow fits the definition on its face.

**The FinCEN ruling taxonomy (corrected in Rev 2) — four categories, and where Dime Time falls:**

1. **Debt-management company negotiating substantive repayment plans with creditors — NOT an MSB (Ruling 2004-4).** FinCEN's actual conclusion: "The general service that [the business] provides is to help debtors create a plan for payment and/or adjustment of their debts, and to obtain the agreement of creditors to accept payment under that plan. FinCEN views the money transmission that [the business] conducts as ancillary to the debt management service… To the extent that the money transmission conducted by [the business] is limited to submitting payments to creditors on behalf of debtors in conjunction with a debt management plan, FinCEN would not deem [the business] a money transmitter" [11]. The exemption (now 31 CFR 1010.100(ff)(5)(ii)(F)) turned on a *genuine separate service* — plan creation and negotiated creditor concessions — to which payment was incidental.
2. **Bill-payment provider WITH creditor/biller contracts — NOT a money transmitter (FIN-2009-R004 "Contract Clients" branch; FIN-2008-R006; Ruling 2003-8).** An agent processing payments "as an agent of the merchant to whom the consumers owe money – rather than on behalf of the consumers themselves" is exempt [42][43].
3. **Bill-payment provider WITHOUT creditor contracts — IS a money transmitter (FIN-2009-R004 non-contract branch).** FinCEN's words: "when the Companies transmit any given payment from a bill payer to a Biller, there is no transaction 'other than a money transmission itself'… because the Companies do not have an ongoing contractual relationship with the Billers… that exception does not apply… To the extent that they transmit such payments, therefore, the Companies qualify as money transmitters" [42].
4. **Dime Time's actual architecture:** contracts only with the consumer; collects round-ups by ACH; holds up to 7+ days; forwards to creditors with whom it has no agreement; provides no debt-plan negotiation or creditor-concession service (the app tracks and pays — it does not negotiate). **This is category 3.** Dime Time cannot claim 2004-4's ancillary-service exemption (no substantive non-payment service; payment *is* the service) and cannot claim the payee-agent line (no creditor contracts). The conservative conclusion is that the flow is money transmission, and the 7-day interest-earning hold only strengthens that characterization.

This taxonomy also shows the fix: **moving to category 1 or 2 changes the federal answer.** Creditor agency agreements (category 2) or routing payments through a provider that holds those relationships (e.g., a bill-pay rail with creditor connectivity) is the structural cure — consistent with the agent-of-payee analysis below.

The state-law escape hatches likely fail for the same structural reason:

- **Federal payment-processor exemption** (FIN-2014-R009): requires, among four conditions, a formal agreement with the *seller or creditor that receives the funds*. Dime Time's agreement is with the consumer, not the creditor [10].
- **State agent-of-payee exemption**: exempts an agent appointed by the *payee* to collect on its behalf; California's DFPI has specifically indicated consumer-appointed bill-pay does not qualify [12][13]. Roughly half the states have some version of this exemption, with varying language; Montana aside, 49 states now regulate money transmission, 26+ under the harmonizing Model Money Transmission Modernization Act as of early 2025 [14][29].

Holding funds for up to seven days does not create a safe harbor — the receipt-and-forward activity, not the holding period, triggers the definition [14]. And the automatic forwarding to a user-chosen creditor (Q12) does not materially change the analysis, because the consumer — not the creditor — directs the payment; that is exactly the payer-side posture the exemptions exclude.

Retaining interest **worsens** the analysis (Q11): state money-transmitter statutes impose a statutory trust over customer funds and restrict them to "permissible investments" [16]; earning company revenue from pooled customer balances in a company-titled savings account strengthens the argument that Dime Time holds customer funds as principal rather than as a conduit [8].

Enforcement is real and coordinated: Oregon, Texas, Ohio, Arkansas and Maine issued parallel orders against Payward/Kraken in 2024 for money-transmission licensing deficiencies [26][27]; a CSBS-coordinated multistate consent order and a separate $40M NY DFS order hit Block/Cash App in 2025 [28]. The CFPB additionally supervises large payment apps (50M+ transactions/year — far above Dime Time's scale) but retains UDAAP enforcement authority at any size [17].

### Finding 3: The interest presumptively belongs to users (Questions 5–9)

The default rule of US law is that **interest follows principal**: the Supreme Court held in Phillips v. Washington Legal Foundation (1998) that interest earned on client funds held by a third party is the property of the client [15]. State statutes governing analogous held-consumer-funds contexts (escrow regimes in Maryland, Ohio, Oregon) route interest to the consumer or a public fund, not the holder [18]. Absent a clear, enforceable contractual reallocation, the ~3.25% belongs to the users.

Can contract reallocate it? The documented precedent is PayPal/Venmo: their current user agreements state plainly "You will not receive any interest… We own the interest or other earnings on these investments" [19][20]. But that model rests on four legs together: (1) state money transmitter licenses, (2) funds segregated from corporate funds, (3) investment only in statutorily permissible investments, and (4) explicit, conspicuous user-agreement disclosure [19][20][21]. The CFPB has acknowledged float revenue exists "subject to applicable law" — with money-transmitter licensing as the applicable law [21].

On disclosure alone (Q7–8): a buried ToS line is the weakest possible posture. CFPB UDAAP enforcement has turned on gaps between disclosures and actual practice, and a debt-payoff brand quietly earning yield on customers' debt payments is a natural deception/unfairness theory [22]. The conservative bar is affirmative, conspicuous, specific consent — and even that does not cure the licensing and custody defects. No regulator has ever blessed float retention on an unlicensed, company-titled pooled account; the absence of any such precedent is itself the answer under a conservative standard.

Mercury's documents are silent on retaining interest from customer funds (Q9) — but silence plus an affirmative third-party-funds prohibition reads as *not permitted* [1][3].

There is also an FDIC insurance problem: pass-through insurance for the users requires custodial titling of the account plus per-beneficiary records meeting 12 CFR §§330.5/330.7 — a company-titled savings account gives users no pass-through coverage if the underlying bank fails [6][7]. Post-Synapse, the FDIC has proposed a custodial-account recordkeeping rule specifically targeting this structure [25]. Separately, marketing FDIC coverage improperly is itself regulated (12 CFR Part 328) [7].

### Finding 4: How comparable fintechs actually do it (Questions 17–20)

- **PayPal/Venmo** — the float-keepers. Licensed money transmitters; customer balances segregated and invested in permissible investments; user agreements explicitly assign interest to the company; balances swept to named program banks (Goldman Sachs Bank USA, Wells Fargo, JPMorgan) only for pass-through coverage in specific cases [19][20][30].
- **Qoins** (defunct round-up debt-payoff app — the closest structural comparable): court filings show it used custodial accounts at its partner bank titled "for the benefit of Customers," contractually barred from use in Qoins's operations, separate from its operating and reserve accounts [31]. Even the direct competitor did not commingle customer round-ups with company funds.
- **Acorns** — non-comparable by design: round-ups accumulate in the user's own checking account until $5+, then move straight into SEC-registered brokerage custody. No float pool exists [32].
- **Robinhood and Wise** — the opposite model: they *pass the yield to the customer* via program-bank sweeps [33][34]. This is the emerging consumer expectation.
- **BaaS deposit economics** — Unit and peers market "a share of deposit economics" to fintech programs: the sponsor bank earns on FBO deposits and shares revenue with the program [35]. This is the one documented route where a program legitimately earns revenue from customer balances — the bank, not the fintech, holds and invests the funds, and the revenue share is contractual with the bank rather than skimmed from customers.

### Finding 5: Compliant architecture options, ranked by risk (Questions 21–23, 27)

**Option A — Immediate/near-immediate pass-through (no float). Lowest risk; zero float revenue.**
Disburse each user's collected round-ups as soon as they settle (or keep the weekly batch but hold funds only days, in checking, earning nothing and claiming nothing). Minimizes custody, insolvency, licensing, and Mercury-terms exposure, though even transient holding retains some money-transmission color. This is the right default *today*, until counsel signs off on something better.

**Option B — Agent-of-payee restructuring. Strongest licensing fix; interest still not Dime Time's.**
Sign agency agreements with creditors (or use a bill-pay aggregator that has them) so Dime Time legally receives funds *as the creditor's agent* — receipt by Dime Time then equals receipt by the creditor, taking the flow outside "money for transmission" in the ~half of states with the exemption [12][13]. Two catches: coverage is state-by-state, and once funds constructively belong to the creditor, the float arguably belongs to the *creditor* — this path fixes licensing, not yield capture.

**Option C — FBO account at a sponsor bank via a BaaS provider (Unit, Treasury Prime, Synctera, Column, Increase, Stripe Treasury). The institutional-grade path.**
Customer funds sit in a bank-titled FBO account with per-user sub-ledgering; users can get pass-through FDIC coverage; Dime Time negotiates a *deposit revenue share with the bank* — the one documented, defensible way to earn money from customer balances [35]. Costs: provider fees, sponsor-bank diligence, and post-Synapse daily-reconciliation obligations that are demanding for a solo founder [23][25]. Whether any provider's economics work at Dime Time's current scale requires term sheets.

**Option D — Become a licensed money transmitter (the PayPal model). Not realistic at this scale.**
Per-state licenses, surety bonds, net-worth minimums, permissible-investment rules, and BSA/AML programs across every operating state [14]. This is the only path where "we own the interest" language has precedent — and it is a multi-year, high-cost program.

### Finding 6: Complete risk register (Questions 24–26)

**Compliance risks:** unlicensed money transmission (state civil enforcement; 49 states; coordinated multistate actions) [26][27][28]; FinCEN MSB registration failure [36]; UDAAP exposure for undisclosed float retention [22]; statutory-trust/permissible-investment violations [16]; improper FDIC-coverage representations [7]; state escrow/consumer-funds interest statutes [18].

**Contractual risks with Mercury:** §1.4 third-party-use prohibition; account closure for "facilitating payments for third parties"; closure for "using Mercury services to avoid federal or state regulatory obligations" — i.e., losing the company's operating bank account with little notice, mid-sweep, with customer funds inside [1][3].

**Operational/accounting implications:** company-titled pooled funds are Dime Time's asset and its liability — they sit on the company books, are exposed to Dime Time's creditors in insolvency, and defeat users' FDIC pass-through [6][7]; interest earned is taxable corporate income even if the model is later unwound; per-user reconciliation of a pooled account is exactly the ledger burden that destroyed Synapse's end-users [23][24]; the app's transfers ledger becomes a de facto system of record requiring bank-grade accuracy.

---

## Traced Production Money Flow (Rev 2 — from deployed code, not intended architecture)

Code inspection (source of truth: `server/`, `shared/`, `client/`; the git-tracked `server-dist/` build artifact was excluded). Answers to the specific questions:

| Question | Answer (with code basis) |
|---|---|
| ACH originator when a round-up is debited | **Stripe**, via ACH debit PaymentIntents (`payment_method_types: ["us_bank_account"]`, `server/services/stripeService.ts`). Stripe is the processor/originator of record through its bank partners; Dime Time is the merchant of record. |
| ACH authorization & statement descriptor | Stripe's ACH mandate framework; statement descriptor configured as **"DIME TIME"** (22-char cap) in `stripeService.ts`. |
| Where funds settle first | **Stripe balance** (standard ACH settlement, ~3–5 business days). |
| Do they enter a Stripe balance? | Yes — all collected round-ups pass through it. |
| Do they enter a Dime Time Mercury account? | Yes — Stripe auto-payouts (dashboard-configured, not in code) sweep the Stripe balance to the Mercury account matched by `MERCURY_ACCOUNT_NUMBER`. Per code comments and account-type records, this is the **business savings** account, held to earn interest until disbursement. |
| Mercury: operating account or pooled end-user funds? | **It receives pooled end-user funds.** The savings account is both the payout destination for customer round-ups and the funding source for creditor payments — it is not a mere operating account. |
| Who initiates the final creditor payment | Dime Time's own scheduler (`weeklyDisbursementService.runWeeklyDisbursement`), calling `mercuryService.initiateTransfer` — Mercury ACH from the company savings account to the creditor. |
| Same money or separately funded? | **Same commingled pool.** Creditor payments draw on the accumulated round-up balance in the savings account; there is no separate corporate funding + reimbursement pattern. |
| What does the transfers ledger represent? | **Accounting records of processor events**, not custodial balances. Per-user "balance" is computed by summing settled collections minus non-void payments; there is **no automated reconciliation against the actual bank balance**. It is best characterized as a receivable owed by Dime Time to each user. |
| Commingled with subscription revenue / operating funds? | **Yes.** Subscription revenue (Stripe Billing, $2.99/mo) settles into the *same* Stripe balance and the *same* Mercury payout destination as customer round-ups. No segregation exists in code or configuration. |
| How long can customer funds remain under Dime Time's control? | Minimum: until the next Friday 00:00 ET run (up to ~7 days after settlement). **Maximum: indefinitely** — users skipped for any reason (balance under $1, missing creditor payment details, failed transfers) roll over week after week with no upper bound. |
| Insolvency exposure | If **Dime Time** fails: funds in the company-titled savings account are corporate assets available to Dime Time's general creditors; users hold unsecured claims. If **Stripe** fails mid-settlement: in-flight funds are subject to Stripe's own custodial arrangements. If **Mercury/its partner bank** fails: FDIC coverage runs to *Dime Time* as the deposit owner (up to applicable limits) — users have **no pass-through coverage** because the account is not custodially titled with per-beneficiary records (12 CFR §§330.5/330.7). |

**Transaction-flow diagram (every entity, account, and ledger step):**

```
[User]                  [Stripe (processor)]           [Dime Time]                     [Creditor]
User's checking acct    Stripe platform balance        Mercury *savings* acct           Creditor's bank
at user's bank          (Dime Time merchant acct)      (company-titled, ~3.25% APY)     (e.g., card issuer)
      │                        │                              │                              │
      │ 1. ACH DEBIT           │                              │                              │
      │ (Stripe originates;    │                              │                              │
      │ descriptor "DIME TIME")│                              │                              │
      ├───────────────────────►│                              │                              │
      │   ledger: transfers row (roundup collection,          │                              │
      │   created→pending→settled via Stripe webhooks)        │                              │
      │                        │ 2. Stripe AUTO-PAYOUT (batch,│                              │
      │                        │ commingles round-ups +       │                              │
      │                        │ subscription revenue)        │                              │
      │                        ├─────────────────────────────►│                              │
      │                        │                              │ 3. HOLD ≥0–7+ days           │
      │                        │                              │ (interest accrues to company)│
      │                        │                              │ 4. Friday 00:00 ET:          │
      │                        │                              │ weekly_distributions claim,  │
      │                        │                              │ per-user balance = Σ settled │
      │                        │                              │ collections − non-void       │
      │                        │                              │ payments (app ledger only,   │
      │                        │                              │ unreconciled to bank)        │
      │                        │                              │ 5. Mercury ACH CREDIT        │
      │                        │                              │ (Dime Time originates via    │
      │                        │                              │ Mercury API; idempotency-    │
      │                        │                              │ keyed transfers + distribution│
      │                        │                              │ _payments rows)              │
      │                        │                              ├─────────────────────────────►│
Legal entities: User ─ User's bank ─ Stripe, Inc. (+ its bank partners) ─ Dime Time (Mercury fintech
layer → partner bank Choice/Column/Patriot holds the actual deposit) ─ Creditor's bank.
```

**Two code-level facts sharpen the legal analysis:** (i) the same dollars received from users are later transmitted to creditors out of one commingled, interest-bearing, company-titled pool — the least defensible posture identified in this report; and (ii) the app ledger is the *only* record tying dollars to users, with no bank-level per-beneficiary records and no automated reconciliation — the exact failure mode of the Synapse collapse [23][24][25].

## Revised Conclusion (Rev 2, separated by issue)

**A. Mercury contractual risk.** The traced flow — pooled end-user funds arriving via Stripe payouts and leaving as payments to users' creditors — is third-party fund handling under Mercury's Terms §1.4 and its published account-closure grounds [1][3]. Risk: closure of the company's primary account, potentially mid-cycle with customer funds inside. This risk exists **today** (round-up collections already settle there) regardless of whether the disbursement engine is ever enabled.

**B. Federal FinCEN/MSB analysis (corrected).** Dime Time is category 3 in the ruling taxonomy: a consumer-side payment agent with no creditor contracts and no substantive non-payment service. Under FIN-2009-R004's non-contract branch it "qualif[ies] as [a] money transmitter"; Ruling 2004-4's ancillary exemption is unavailable because Dime Time does not negotiate debt plans or creditor concessions [11][42]. Conservative posture: assume MSB status attaches when the disbursement leg operates → FinCEN registration, AML program, and related obligations — or restructure into category 1/2 before operating the leg.

**C. State money-transmitter analysis.** Unchanged from Rev 1: 49 states regulate the activity; the agent-of-payee exemption fails on the payer side; the interest-earning hold strengthens the "holding as principal" characterization; multistate enforcement is active [12][13][14][26][27][28]. A creditor-agency restructuring (or a licensed rail such as Method/Spinwheel carrying the payment leg) is the cure on the state side as well.

**D. ACH authorization and NACHA issues.** The collection leg's ACH authorization runs to Stripe's mandate framework with Dime Time as merchant; the authorization covers debiting the consumer for the round-up service. Open items for counsel: whether the authorization language adequately discloses that funds will be held (indefinitely for skipped users) and forwarded to third parties; whether the disbursement leg's Mercury-originated credits to creditors correctly identify the *user* as the party on whose behalf payment is made (creditor posting/attribution risk); and WEB-debit-rule compliance on the collection side. These are contract/rule-compliance questions, not licensing questions, but they belong in the same attorney review.

**E. Ownership and treatment of earned interest.** Unchanged and now code-confirmed: interest accrues on a commingled, company-titled savings pool that includes customer funds. Under "interest follows principal" and state statutory-trust regimes, the yield presumptively belongs to users; retaining it without licensing, segregation, permissible-investment compliance, and explicit consent is the least defensible element of the current design [15][16][19][20][21]. Additionally, commingling with subscription revenue makes even *identifying* the customer-funds portion of the interest impossible without ledger work.

**F. Required architecture changes (priority order).**
1. **Do not enable the disbursement leg in production** until counsel reviews categories B/C — the collection leg alone (money in, held) already raises the custody issues; the transmission leg completes the money-transmitter fact pattern.
2. **Segregate customer funds from revenue now:** separate Stripe payout destinations (or a manual split) so round-ups and subscription revenue stop landing in one pool; stop holding customer funds in the interest-bearing savings account (or stop treating its interest as revenue).
3. **Put the payment leg on a rail with creditor relationships** (e.g., Method Financial / Spinwheel — bill-pay networks with biller connectivity) to move the model toward category 2 federally and agent-of-payee treatment at the state level, and to eliminate hand-entered creditor ACH details.
4. **Adopt custodial-grade fund handling** if Dime Time continues to hold balances: FBO account at a sponsor bank with per-user bank-level records (pass-through FDIC), daily reconciliation of app ledger vs. bank balance, and a cap on how long skipped users' funds may roll over.
5. **Fix disclosures** to match actual practice (holding periods, who earns interest, insolvency risk) before any marketing claims.

## Analysis

The three research threads triangulate to one conclusion. Mercury's contract, the money-transmission regime, and the interest-ownership doctrine each independently block the "keep the 3.25%" design, and they reinforce each other: the reason Mercury bans third-party funds is that hosting them would drag its partner banks into custodial obligations; the reason states license transmitters is precisely to impose the trust, investment, and disclosure rules that make float retention conditionally tolerable; and the reason PayPal can print the "we own the interest" sentence is that it built the licensed, segregated structure the rules demand. There is no documented shortcut where an unlicensed app keeps yield on commingled customer money in its own savings account — and the closest structural comparable (Qoins) walled customer funds off in bank-titled custodial accounts even without a float ambition.

The strategically important nuance is that the *economic goal* — revenue from customer balances — survives, but the *mechanism* must change: from "Dime Time earns interest on customers' money" to "Dime Time's sponsor bank earns interest on FBO deposits and shares revenue with Dime Time by contract." That reframing (Option C) is how modern consumer fintech monetizes deposits post-Synapse, it scales with user growth, and it gives users FDIC pass-through instead of taking something from them. At current scale, the bridge is Option A (no-float pass-through) — which the newly built weekly engine can already do, since nothing in it depends on the funds earning interest.

## Limitations

This is research, not legal advice; a fintech attorney must make the final calls. Specific unresolved items: the live state-by-state agent-of-payee map (the CSBS map page is dated 2019; MMTMA adoption has shifted it) [14][29]; Mercury's full prohibited-industries list (login-gated support article); the final status of the FDIC custodial-recordkeeping rule after its 2024 comment period [25]; BaaS revenue-share economics at solo-founder scale (requires term sheets); and whether any state would view the *current* operating history as requiring remediation. Several authoritative sources (FinCEN 2004/2014 rulings, Phillips 1998) are old but remain controlling law rather than stale market data.

## Recommendations

1. **Stop treating the savings-account interest as company revenue now.** Leave the weekly engine's flow intact but treat any interest accruing on pooled customer funds as not-Dime-Time's until counsel says otherwise. Do not market or state the float model anywhere.
2. **Shorten the float toward pass-through (Option A) as the default posture** — the Friday cadence can stay, but the conservative position is that the pool is a conduit, not an asset.
3. **Engage a fintech attorney with a specific brief:** (a) money-transmission exposure of the current accept-hold-forward flow, state by state for actual user locations; (b) whether an agent-of-payee restructuring is achievable with target creditors; (c) review of Mercury Terms §1.4 exposure and whether to proactively discuss with Mercury or migrate.
4. **Get term sheets from 2–3 BaaS providers** (Unit, Treasury Prime, Synctera; also Stripe Treasury given the existing Stripe relationship) for an FBO account with per-user ledgering and a deposit revenue share — this is the legitimate version of the float business and the natural home for the weekly sweep at scale.
5. **Do not represent FDIC coverage to users** under the current structure, in-app or in marketing [7].
6. **Keep the per-user transfers ledger audit-grade** — regardless of path, per-beneficiary recordkeeping is now the regulatory center of gravity post-Synapse [25].

---

## Sources

1. Mercury Terms of Use — https://mercury.com/legal/terms — updated Jun 25, 2026 — Tier 1
2. Mercury blog, "Demand deposit accounts (DDAs) vs. for-benefit-of (FBO) accounts" — https://mercury.com/blog/demand-depost-accounts-vs-for-benefit-of-accounts — Aug 1, 2025 — Tier 2
3. Mercury Support, "Understanding account closures and access restrictions" — https://support.mercury.com/hc/en-us/articles/43095394066452 — current — Tier 1
4. Mercury blog, "How Mercury works with its partner banks" — https://mercury.com/blog/how-mercury-works-with-partner-banks — Mar 11, 2025 — Tier 2
5. Mercury Support, "Understanding Mercury Treasury" — https://support.mercury.com/hc/en-us/articles/41674211743380 — current — Tier 1
6. FDIC, "Pass-through Deposit Insurance Coverage" (12 CFR §§330.5, 330.7) — https://www.fdic.gov/financial-institution-employees-guide-deposit-insurance/pass-through-deposit-insurance-coverage — current — Tier 1
7. Montague Law, "Pass-Through, Not a Promise — FDIC insurance on FBO accounts" (12 CFR Parts 328/330) — https://montague.law/blog/fdic-pass-through-fbo-fintech-disclosure/ — ~2024–2025 — Tier 2
8. Venable LLP, "FBO Accounts: Maximizing Benefits While Minimizing Risks in Fintech Partnerships" — https://www.venable.com/insights/publications/2024/10/fbo-accounts-max-benefits-while-min-risks — Oct 2024 — Tier 2
9. 31 CFR §1010.100 (money transmitter definition) — https://www.law.cornell.edu/cfr/text/31/1010.100 — current CFR — Tier 1
10. FinCEN Ruling FIN-2014-R009 (payment-processor exemption, 4 conditions) — https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/application-money-services-business — Aug 27, 2014 (controlling interpretation) — Tier 1
11. FinCEN Ruling 2004-4 (Debt Management Company held NOT an MSB — transmission ancillary to debt-plan negotiation service) — https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/definition-money-services-business-debt — 2004 (controlling; full text verified 2026-08-05) — Tier 1
12. CA DFPI, Agent-of-Payee opinion letters — https://dfpi.ca.gov/rules-enforcement/laws-and-regulations/opinion-letters-by-law-subject/agent-of-payee-exemption/ — 2018–2022 — Tier 1
13. Cal. Code Regs. Tit. 10 §80.126.10 (Agent of Payee) — https://www.law.cornell.edu/regulations/california/10-CCR-80.126.10 — operative 10/1/2021 — Tier 1
14. Cooley LLP, "US States Adopt Model Money Transmission Act, But Harmonization Remains Elusive" — https://www.cooley.com/news/insight/2024/2024-08-20-us-states-adopt-model-money-transmission-act-but-harmonization-remains-elusive — Aug 20, 2024 — Tier 2
15. Phillips v. Washington Legal Foundation, 524 U.S. 156 (1998) — https://www.law.cornell.edu/supct/html/96-1578.ZO.html — controlling precedent — Tier 1
16. NC Gen. Stat. §53-208.48 (statutory trust / permissible investments; parallel statutes in FL, HI, WA, VA) — https://law.justia.com/codes/north-carolina/chapter-53/article-16b/section-53-208-48/ — 2025 code — Tier 1
17. CFPB Final Rule, "Larger Participants — General-Use Digital Consumer Payment Applications" — https://www.consumerfinance.gov/rules-policy/final-rules/defining-larger-participants-of-a-market-for-general-use-digital-consumer-payment-applications/ — Nov 21, 2024 — Tier 1
18. Maryland Com. Law §12-1026; Oregon ORS 696.578 (state escrow-interest regimes) — https://law.justia.com/codes/maryland/commercial-law/title-12/subtitle-10/section-12-1026/ ; https://oregon.public.law/statutes/ors_696.578 — current codes — Tier 1
19. PayPal User Agreement (interest/ownership language) — https://www.paypal.com/us/legalhub/useragreement-full — eff. Jun 29, 2026 — Tier 1
20. Venmo User Agreement ("We own the interest or other earnings on these investments") — https://venmo.com/legal/us-user-agreement/ — eff. Aug 24, 2026 — Tier 1
21. CFPB Issue Spotlight, "Deposit Insurance Coverage on Funds Stored Through Payment Apps" — https://www.consumerfinance.gov/data-research/research-reports/issue-spotlight-analysis-of-deposit-insurance-coverage-on-funds-stored-through-payment-apps/full-report/ — Jun 1, 2023 (flagged >18mo; policy framing still current) — Tier 1
22. Wolters Kluwer / BankingExchange, "Aligning bank deposit and disclosure activities" (CFPB UDAAP consent order) — https://www.wolterskluwer.com/en/expert-insights/a-thoughtful-approach-to-aligning-bank-deposit-and-disclosure-activities — Feb 14, 2023 (aging; principle current) — Tier 2
23. Troutman Pepper, "Where the F(BO) Is the Money? Part 1 — Synapse" — https://www.troutmanfinancialservices.com/2024/09/where-the-fbo-is-the-money-part-1-synapses-clarion-call-for-standards/ — Sep 2024 — Tier 2
24. CNBC, "Synapse trustee: $85M of customer savings missing" — https://www.cnbc.com/2024/06/07/synapse-bankruptcy-trustee-85-million-of-customer-savings-is-missing.html — Jun 7, 2024 — Tier 2
25. FDIC press release, proposed "Recordkeeping for Custodial Accounts" rule (12 CFR Part 375) — https://www.fdic.gov/news/press-releases/2024/fdic-proposes-deposit-insurance-recordkeeping-rule-banks-third-party — Sep 17, 2024 — Tier 1
26. Oregon DFR, Payward/Kraken consent order & press release (Case MT-24-0052) — https://dfr.oregon.gov/news/news2024/Pages/20240327-cryptocurrency-settlement.aspx — Mar 27, 2024 — Tier 1
27. Texas DOB press release (Payward/Kraken) — https://www.dob.texas.gov/sites/default/files/files/news/press-releases/2024/10-28-24pr.pdf — Oct 28, 2024 — Tier 1
28. CSBS multistate Block/Cash App consent order; NY DFS $40M order — https://www.csbs.org/sites/default/files/other-files/Block_Settlement_and_Consent_OrderFinal_1.13.2025-order%20only.pdf ; https://www.dfs.ny.gov/system/files/documents/2025/04/ea20250410-block.pdf — Jan 13 / Apr 10, 2025 — Tier 1
29. Stinson LLP, "Massachusetts Adopts the Model Money Transmission Modernization Act, Joining 25 Other States" — https://www.stinson.com/newsroom-publications-massachusetts-adopts-the-model-money-transmission-modernization-act-joining-25-other-states — Jan 2025 — Tier 2
30. PayPal, "Program Banks" (legal hub) — https://www.paypal.com/us/legalhub/paypal/program-banks-tnc — updated May 19, 2026 — Tier 1
31. SouthState Bank, N.A. v. Qoins Technologies, Inc., N.D. Ga. — https://caselaw.findlaw.com/court/us-dis-crt-n-d-geo-atl-div/115896403.html — decided Mar 1, 2024 — Tier 1
32. Acorns Help Center, Round-Ups mechanics — https://support.acorns.com/hc/en-us/articles/How-long-does-it-take-for-Round-Ups-to-be-taken-out — 2024/25 — Tier 3
33. Robinhood, IntraFi Network Deposit Sweep Program Agreement — https://cdn.robinhood.com/assets/robinhood/legal/IntraFi%20Network%20Deposit%20Sweep%20Program%20Agreement.pdf — current — Tier 1
34. Wise Interest (yield passed to customer) — https://wise.com/us/interest/ — current — Tier 3
35. Unit, "How high interest rates can drive revenue in tech" (program deposit revenue share) — https://www.unit.co/guides/how-high-interest-rates-can-drive-revenue-in-tech — current — Tier 3
36. FinCEN, MSB registration enforcement actions — https://www.fincen.gov/enforcement-actions-failure-register-money-services-business — current — Tier 1
37. CSBS, "Agent of the Payee Exemption Map" — https://www.csbs.org/agent-payee-exemption-map — Aug 19, 2019 (flagged stale; verify state-by-state) — Tier 1
38. Choice Financial Group Sweep Program Deposit Placement & Custodial Agreement — https://mercury.com/legal/choice/sweep-program-deposit-placement-and-custodial-agreement — Jan 5, 2024 — Tier 1
39. Klaros Group, "The Synapse Bankruptcy has Echoes of What SVB Taught Us About FBOs" — https://www.klaros.com/post/the-synapse-bankruptcy-has-echoes-of-what-svb-taught-us-about-fbos — 2024 — Tier 2
40. Guidehouse, "Preserving the FBO account model" — https://guidehouse.com/insights/financial-services/2026/fbo-account-model — 2026 — Tier 2
41. Gibson Dunn, "2025 Year-End Developments in Anti-Money Laundering" (DOJ §1960 memo — federal criminal posture only) — https://www.gibsondunn.com/2025-year-end-developments-in-anti-money-laundering/ — 2025 — Tier 2
42. FinCEN FIN-2009-R004 (bill-payment provider: contract billers exempt; non-contract billers = money transmission) — https://www.fincen.gov/sites/default/files/administrative_ruling/fin-2009-r004.pdf — Nov 20, 2009 (full text verified 2026-08-05) — Tier 1
43. FinCEN FIN-2008-R006 (authorized agent for utility payments — payee-agent exemption requires creditor contract) — https://www.fincen.gov/sites/default/files/administrative_ruling/fin-2008-r006.pdf — Jun 11, 2008 (full text verified 2026-08-05) — Tier 1

*Raw per-workstream findings with full source notes are saved in `research/raw/` (6 files).*
