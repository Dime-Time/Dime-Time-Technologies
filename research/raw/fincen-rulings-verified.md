Fetched primary sources directly from fincen.gov (both retrieved successfully; no mirrors needed). Key finding for the fact pattern: the round-up app is a **consumer-side payment agent with NO creditor contract**, which maps to the losing side of FIN-2009-R004 and 2008-R006 → **money transmitter / MSB**, NOT the exempt 2004-4 debt-management posture.

## Ruling 2004-4 actual holding (with exact quotes)
Holding: **WAS NOT** an MSB. FinCEN determined "that [the business] is not an MSB as defined in 31 C.F.R. § 103.11(uu)."

Operative conclusion (integral/ancillary reasoning):
> "Based on the information contained in your letters, we conclude that [the business]'s debt management service does not constitute money transmission. As set forth in 103.11(uu)(5)(ii), FinCEN will generally not treat as a money transmitter a person engaged in the acceptance and transmission of funds 'as an integral part of the execution and settlement of a transaction other than the funds transmission itself.…' The general service that [the business] provides is to help debtors create a plan for payment and/or adjustment of their debts, and to obtain the agreement of creditors to accept payment under that plan. FinCEN views the money transmission that [the business] conducts as ancillary to the debt management service that [the business] provides, and incidental to a debtor's primary purpose in using the services of [the business]. To the extent that the money transmission conducted by [the business] is limited to submitting payments to creditors on behalf of debtors in conjunction with a debt management plan, FinCEN would not deem [the business] a money transmitter for purposes of 31 CFR 103.11(uu)(5)."

Critical distinguisher: the exemption turned on the existence of a **separate substantive service** (debt-plan creation + negotiating creditor concessions like rate reductions/late-fee waivers). Payment was ancillary to THAT service.

## FIN-2009-R004 holding (quotes)
Split holding based on creditor-side contract:

Billers WITH contract (Contract Clients, ~86%) — **NOT a money transmitter**:
> "FinCEN has concluded that a merchant payment processor, processing payments from consumers as an agent of the merchant to whom the consumers owe money – rather than on behalf of the consumers themselves – is not a money transmitter… FinCEN does not deem the Companies money transmitters… for services rendered to their Contract Clients."

Billers WITHOUT contract (~14%) — **IS a money transmitter**:
> "FinCEN does not, however, reach the same conclusion with respect to the services rendered by the Companies to bill payers… when the Companies transmit any given payment from a bill payer to a Biller, there is no transaction 'other than a money transmission itself' … Moreover, because the Companies do not have an ongoing contractual relationship with the Billers comparable to that between a merchant payment processor and the merchant for which it works, that exception does not apply… To the extent that they transmit such payments, therefore, the Companies qualify as money transmitters under FinCEN regulations."

(Note: separate Funds Transfer/Travel Rule relief was moot because all transfers were ACH, which is excepted from "transmittal of funds" under then-31 CFR 103.11(jj).)

## Other relevant rulings
- **FIN-2008-R006** (Authorized Agent for Receipt of Utility Payments, June 11, 2008): agent WITH utility contracts is NOT a transmitter — "As long as [ ] limits itself to accepting payments only on behalf of the utilities with whom it has contracted as an agent… [it] would not deem [ ] a money transmitter." This is the merchant-payment-processor line 2009-R004 relied on.
- **FinCEN Ruling 2003-8** (Merchant Payment Processor): the foundational holding — a processor acting as **agent of the payee/merchant** (not the consumer) is exempt.
- **FIN-2008-R004**: NOT a bill-pay ruling — it concerns a foreign-exchange consultant, but applies the same (ff)(5)(ii)(F) integral-part exemption ("transmitting funds solely as an integral part of… foreign exchange… is not a money transmitter").
- Recurring principle: the payee-agent exemption requires a **contractual agency relationship with the creditor/merchant**; the (ff)(5)(ii)(F) "integral part" exemption requires a **genuine separate underlying transaction** the transmission is incident to.

## Application to the round-up fact pattern
Facts: app contracts with the CONSUMER, ACH-debits the consumer (Stripe), holds up to 7 days, pays the consumer's creditor — **no agreement with the creditor**.

- (a) Debt-management co [2004-4]: **Does NOT fit.** 2004-4's exemption rests on a real ancillary service — building a debt plan and negotiating creditor concessions. A round-up sweep that merely forwards money is not a debt-management/plan-negotiation service; payment is the primary purpose, not ancillary. No safe harbor here.
- (b) Bill-pay WITH biller contracts: **Does NOT fit.** The app has no contractual/agency relationship with creditors, so it cannot claim the payee-agent (merchant-payment-processor) exemption of 2009-R004 / 2008-R006 / 2003-8.
- (c) Bill-pay WITHOUT biller contracts: **This is the match.** Acting on behalf of the consumer to push funds to a creditor with whom it has no contract is exactly the ~14% "Biller" activity FinCEN held to BE money transmission — "there is no transaction 'other than a money transmission itself'" and the payee-agent exception "does not apply."

Conservative conclusion: Under 2009-R004 and 2008-R006, the round-up app is acting **on behalf of the consumer/payer, not as agent of the payee**, and provides **no separate non-transmission service** that payment is integral to. It therefore **qualifies as a money transmitter → an MSB** under (ff)(5) (formerly 31 CFR 103.11(uu)(5)); the (ff)(5)(ii)(F) integral-part exemption is unavailable. Accepting from the consumer and transmitting to the creditor is the whole service. (The 7-day hold reinforces this — receiving, holding, and transmitting consumer funds is textbook transmission.) Note the ACH Funds-Transfer/Travel-Rule exception in 2009-R004 addresses only recordkeeping scope, NOT MSB status — it does not save the app from money-transmitter classification/registration/AML-program obligations.

## Sources (URL, date, tier)
- FinCEN Ruling 2004-4, "Definition of Money Services Business (Debt Management Company)" — https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/definition-money-services-business-debt — fetched 2026-08-05 — **Tier 1 (primary, fincen.gov official HTML)**.
- FIN-2009-R004 (Nov 20, 2009) — https://www.fincen.gov/sites/default/files/administrative_ruling/fin-2009-r004.pdf — fetched 2026-08-05 — **Tier 1 (primary, fincen.gov official PDF)**.
- FIN-2008-R006 (June 11, 2008) — https://www.fincen.gov/sites/default/files/administrative_ruling/fin-2008-r006.pdf — fetched 2026-08-05 — **Tier 1 (primary, fincen.gov official PDF)**.
- FIN-2008-R004 (foreign-exchange consultant; not bill-pay) — https://www.fincen.gov/sites/default/files/administrative_ruling/fin-2008-r004.pdf — fetched 2026-08-05 — **Tier 1 (primary, fincen.gov official PDF)**.
- FinCEN Ruling 2003-8 (Merchant Payment Processor, Nov 19, 2003) — cited within 2009-R004/2008-R006; not separately fetched — **Tier 2 (cited secondary reference within Tier-1 sources)**.

Regulatory note: rulings cite the pre-2011 citation 31 CFR 103.11(uu)(5); the current recodification is 31 CFR 1010.100(ff)(5), with the integral/ancillary exemption at 1010.100(ff)(5)(ii)(F).