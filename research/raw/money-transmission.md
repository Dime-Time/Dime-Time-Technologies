## Key Facts

- **Federal MT definition (primary law):** Under 31 CFR § 1010.100(ff)(5)(i), a "money transmitter" is a person providing "money transmission services," defined as "the acceptance of currency, funds, or other value...from one person AND the transmission of...to another location or person by any means." Dime Time's flow (accept consumer funds via ACH → hold → forward to creditor) is textbook acceptance-plus-transmission. "Any means" explicitly includes electronic funds transfer networks (ACH). — https://www.law.cornell.edu/cfr/text/31/1010.100

- **Payment-processor exemption is narrow and likely does NOT cover Dime Time.** 31 CFR § 1010.100(ff)(5)(ii)(B) exempts a person who "acts as a payment processor to facilitate the purchase of, or payment of a bill for, a good or service through a clearance and settlement system **by agreement with the creditor or seller**." The exemption requires a formal agreement with the *payee* (creditor/seller). Dime Time's agreement is with the *consumer/payer*, and it is paying down the consumer's pre-existing debt (moving the consumer's own money), not facilitating a purchase of goods/services under a merchant agreement. — https://www.law.cornell.edu/cfr/text/31/1010.100

- **FinCEN's own 4-condition test (FIN-2014-R009, issued 8/27/2014) reinforces this.** The four conditions: (1) facilitate purchase of goods/services or payment of bills for goods/services (other than money transmission itself); (2) operate through clearance/settlement systems admitting only BSA-regulated FIs (both collection AND disbursement legs — FinCEN expressly flagged the disbursement leg); (3) provide the service under a formal agreement; and (4) "**the entity's agreement must be at a minimum with the seller or creditor that provided the goods or services and receives the funds.**" Condition 4 is the sticking point: Dime Time has no agreement with the creditor. — https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/application-money-services-business

- **Debt-management/round-up pattern is regulator-sensitive.** FinCEN has a dedicated ruling classing a "Debt Management Company" that collects and disburses consumer funds as an MSB/money transmitter (FinCEN Ruling 2004-4). This is directly analogous to collecting round-ups and forwarding to creditors. — https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/definition-money-services-business-debt

- **State "agent of the payee" exemption also likely fails.** The exemption protects an agent appointed **by the payee (creditor)** to collect on the payee's behalf. Dime Time acts on the *payer's* (consumer's) instruction, with no appointment by the creditor. Only ~22 states adopt an agent-of-payee exemption at all, and ~3 apply it case-by-case — it is NOT uniform and does NOT preempt separate state licensing. — https://www.csbs.org/agent-payee-exemption-map ; https://www.moderntreasury.com/learn/what-is-an-agent-of-the-payee-exemption

- **State money transmitter licensing (MTL) is the bigger exposure.** Most states require an MTL to receive money for transmission; state definitions are often broader than FinCEN's and lack a payment-processor safe harbor. Licensing is per-state (via NMLS), with surety bonds, net-worth/permissible-investment requirements, and BSA/AML programs. The CSBS Model Money Transmission Modernization Act (MTMA) is the harmonization framework states are adopting. — https://www.csbs.org/sites/default/files/2023-02/CSBS%20Money%20Transmission%20Modernization%20Act.pdf ; https://www.nmlsonline.org / https://www.dfs.ny.gov/apps_and_licensing/money_transmitters

- **CFPB now supervises large payment apps (added exposure, separate from MTL).** CFPB's final rule (issued Nov 21, 2024; effective per Fed. Reg. 12/10/2024) subjects nonbank "general-use digital consumer payment applications" to CFPB supervision if they facilitate ≥50 million covered consumer payment transactions/year. Dime Time is far below that threshold today, but CFPB's UDAAP enforcement authority under the CFPA applies regardless of the supervisory threshold. — https://www.consumerfinance.gov/rules-policy/final-rules/defining-larger-participants-of-a-market-for-general-use-digital-consumer-payment-applications/

- **Keeping interest on pooled customer float is a distinct, elevated risk.** Holding commingled consumer funds in a company savings account and retaining the ~3.25% APY implicates: (a) state "permissible investment" / safeguarding rules that generally require licensees to hold customer funds in permissible investments and often bar or restrict use of customer float; (b) UDAAP/disclosure exposure if consumers aren't told the company earns yield on their money; and (c) FBO/commingling structural risk highlighted post-Synapse. Conservative reading: earning and retaining interest strengthens the argument that Dime Time is holding customer funds as principal (money transmission), not as a mere conduit. — https://www.venable.com/-/media/files/publications/2024/10/bigartfbo-accounts-maximizing-benefits-while-minim.pdf ; https://www.cgap.org/sites/default/files/publications/2021_05_Technical_Note_Interest_Float_Accounts_updated.pdf

## Notable Claims Requiring Cross-Reference
- Exact count of agent-of-payee states ("22 + 3 case-by-case") comes from a Modern Treasury explainer citing the CSBS map; the CSBS map page itself is dated Aug 19, 2019 and may be stale — the count and each state's statute should be re-verified state-by-state before relying on it.
- Whether ANY state treats a payer-authorized bill-pay/round-up model as exempt is uncertain; most exemptions are payee-side. Requires a 50-state survey (a UC Berkeley/Paul Hastings 50-state MTL survey exists but its snippet date is unconfirmed).
- CFPB's future posture is politically volatile (2025 leadership/rulemaking changes); the larger-participant rule's status/enforcement priority should be re-checked before relying on the 50M threshold as a safe harbor.
- No FinCEN ruling squarely addresses a "spare-change round-up to pay consumer's own creditor" fact pattern; the debt-management analogy (2004-4) is the closest but is 20+ years old.

## Source Quality Assessment
- **Tier 1 (government/regulator/primary law):**
  - 31 CFR § 1010.100 via Cornell LII — current CFR text (evergreen).
  - FinCEN Administrative Ruling FIN-2014-R009 — dated 8/27/2014 (>18 months; FLAGGED as old, but it is the authoritative interpretation still cited).
  - FinCEN Ruling 2004-4 (Debt Management Company) — 2004 (FLAGGED old, still authoritative).
  - CFPB final rule page — Nov 21, 2024 (current).
  - CSBS Model MTMA — Feb 2023 (current-ish).
  - NY DFS / CA DFPI licensing pages — evergreen regulator pages.
- **Tier 2 (major law-firm / infrastructure-provider analysis):**
  - Venable FBO accounts article — Oct 2024 (current).
  - Modern Treasury agent-of-payee explainer — Apr 4, 2023 (borderline >18 months; FLAGGED).
  - Orrick InfoBytes on FIN-2014-R009 — Sept 5, 2014 (FLAGGED old).
  - CGAP interest-on-float note — May 2021 (FLAGGED old; also non-US-centric).
- **Tier 3 (blog/promotional):**
  - ComplyOne, Faison Law Group, Cornerstone/Ridgeway licensing marketing pages — undated/promotional; use only for orientation, not authority.

## Gaps & Unanswered Questions
- No authoritative, current 50-state determination of whether Dime Time's payer-side model needs an MTL in each state (needs a paid 50-state survey or state-by-state counsel opinions).
- Whether structuring an FBO/for-benefit-of trust account (with pass-through deposit insurance and customer-owned funds) plus a bank partner could avoid MTL — not analyzed here; likely the recommended conservative architecture.
- Whether retaining float interest is contractually/legally permissible if funds are held FBO for customers (likely requires either explicit customer consent/disclosure or the interest belonging to customers) — needs express legal opinion.
- No direct enforcement action found against a round-up/debt-payoff app specifically; closest analogues are money-transmitter licensing enforcement (e.g., NYDFS multistate action, Apr 2025) and general FBO/commingling failures (Synapse).
- Money Transmission Modernization Act adoption status per state (which states have enacted it and how it treats payer-directed transfers) not enumerated.

## Sources
1. 31 CFR § 1010.100 — General definitions (money transmitter / money transmission services; exemptions) — https://www.law.cornell.edu/cfr/text/31/1010.100 — current CFR — Tier 1
2. FinCEN Administrative Ruling FIN-2014-R009, "Application of MSB Regulations to a Company Acting as an ISO and Payment Processor" (4-condition payment-processor exemption) — https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/application-money-services-business — Aug 27, 2014 [OLD >18mo] — Tier 1
3. FinCEN Ruling 2004-4, "Definition of Money Services Business (Debt Management Company)" — https://www.fincen.gov/resources/statutes-regulations/administrative-rulings/definition-money-services-business-debt — 2004 [OLD] — Tier 1
4. CFPB Final Rule, "Defining Larger Participants of a Market for General-Use Digital Consumer Payment Applications" (50M-transaction supervisory threshold) — https://www.consumerfinance.gov/rules-policy/final-rules/defining-larger-participants-of-a-market-for-general-use-digital-consumer-payment-applications/ — Nov 21, 2024 — Tier 1
5. CSBS Model Money Transmission Modernization Act (MTMA) — https://www.csbs.org/sites/default/files/2023-02/CSBS%20Money%20Transmission%20Modernization%20Act.pdf — Feb 2023 — Tier 1
6. CSBS "Agent of the Payee Exemption Map" — https://www.csbs.org/agent-payee-exemption-map — Aug 19, 2019 [OLD] — Tier 1 (data possibly stale)
7. Modern Treasury, "What is an Agent of the Payee Exemption?" — https://www.moderntreasury.com/learn/what-is-an-agent-of-the-payee-exemption — Apr 4, 2023 [borderline] — Tier 2
8. Venable LLP, "FBO Accounts: Maximizing Benefits While Minimizing Risks in Fintech Partnerships" — https://www.venable.com/-/media/files/publications/2024/10/bigartfbo-accounts-maximizing-benefits-while-minim.pdf — Oct 2024 — Tier 2
9. NY DFS Money Transmitter Licensing — https://www.dfs.ny.gov/apps_and_licensing/money_transmitters — evergreen — Tier 1
10. Orrick InfoBytes summary of FIN-2014-R009 — http://infobytes.orrick.com/2014-09-05/fincen-rules-regulations-money-services-businesses-do-not-apply-isos-and-exempt-payment-processors/ — Sept 5, 2014 [OLD] — Tier 2

**Bottom-line (conservative):** Under the "nothing allowed unless documented" standard, Dime Time's current architecture (contracting with the consumer, accepting funds, holding up to 7 days, forwarding to a creditor) most likely constitutes federal money transmission and triggers state MTL requirements. Neither the federal payment-processor exemption nor the state agent-of-payee exemption cleanly applies, because both require an agreement with the payee/creditor/seller, which Dime Time does not have. Retaining interest on pooled customer float compounds the risk (safeguarding/permissible-investment rules + UDAAP). Recommended next step for the founder: obtain formal counsel on an FBO/bank-partner structure and a 50-state MTL analysis before retaining float interest or scaling.