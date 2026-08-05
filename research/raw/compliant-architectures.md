## Key Facts

- **FBO ("for benefit of") account is the standard small-fintech architecture for holding pooled customer funds without a bank charter.** A single omnibus account is opened at a chartered sponsor bank; the bank is legal custodian, the fintech is account-holder-of-record and keeps a sub-ledger tracking each user's share. Fintechs use it specifically to *minimize* (not eliminate) money-transmission licensing risk. — Venable LLP, Oct 2024, https://www.venable.com/insights/publications/2024/10/fbo-accounts-max-benefits-while-min-risks

- **An FBO does NOT automatically exempt a fintech from money-transmitter licensing.** Whether MTLs are needed depends on activities performed, not the account label: if you receive customer funds, hold them, and transmit to third parties, most states treat that as money transmission regardless of FBO structure. Some fintechs operate under the sponsor bank's license, but that requires explicit bank/regulator approval; FinCEN MSB registration may also apply. — Routefusion, Mar 5 2026, https://routefusion.com/blog/fbo-accounts-for-fintechs

- **The "agent of payee" exemption is the cleanest way to avoid an MTL for a debt/creditor-payment flow — and it fits Dime Time's model well.** Under California's Money Transmission Act (Fin. Code §2010(l)), if the company is contractually the agent of the *payee* (the creditor), receipt of money by the agent is legally equivalent to receipt by the payee, so no "money for transmission" occurs. Critical exclusion: the exemption does NOT apply to an agent of the *payor/sender* (the consumer). This requires a written agreement with each creditor designating Dime Time as its collection agent. — CA DFPI opinion letters, https://dfpi.ca.gov/rules-enforcement/laws-and-regulations/opinion-letters-by-law-subject/agent-of-payee-exemption/ ; regulation text Cal. Code Regs. Tit. 10 §80.126.10 (operative 10/1/2021), https://www.law.cornell.edu/regulations/california/10-CCR-80.126.10

- **Immediate pass-through (no hold/no float) is the lowest-risk baseline.** BaaS/API providers explicitly market instant-settlement rails so platforms don't warehouse customer money (Sila ACHNow, Zero Hash Instant USD, Cybrid Instant Funding, Stripe Instant ACH). Not holding funds materially reduces custody, insolvency, and licensing exposure — but by definition eliminates the interest/float the founder wants to capture. — Sila https://www.silamoney.com/achnow ; Stripe https://stripe.com/resources/more/instant-ach-explained-what-it-is-what-it-is-used-for-and-how-it-works

- **Whoever legally *owns* the funds owns the interest — this is the crux of the "keep the yield" question.** Float income is only cleanly the intermediary's when the holder is entitled to it; in fiduciary/custodial/escrow contexts the interest generally belongs to the beneficial owners absent explicit disclosure/consent. Payroll processors (ADP model) keep float precisely because their terms establish that right. For attorney/escrow analogs, retaining accrued interest requires prior written client consent. — LegalClarity, May 12 2026, https://legalclarity.org/float-income-what-it-is-who-earns-it-and-tax-rules/ ; NYCLA Ethics Op. 665 (1985) https://www.nycla.org/resource/ethics-opinion/ethics-opinion-665-1985... ; Talli, Jul 8 2026 https://www.talli.ai/blog/interest-float-settlement-funds

- **Post-Synapse, FBO reconciliation is now the regulatory pressure point, raising the bar for solo founders.** The 2024 Synapse collapse left customer funds unaccounted for due to sub-ledger reconciliation gaps. FDIC issued an NPRM (RIN 3064-AG07, Sept 2024) that would require banks to hold beneficial-owner records directly for custodial accounts with transactional features. Regulators/banks now expect daily-to-intraday reconciliation and tighter SLAs. — Routefusion (Mar 2026); Guidehouse 2026, https://guidehouse.com/insights/financial-services/2026/fbo-account-model

- **BaaS/FBO provider landscape for a small fintech:** Unit, Treasury Prime, Synctera, Column, Infinant, Increase are the commonly compared providers. Notably, Increase acquired a bank charter to eliminate middleware layers (the Synapse-style failure mode). — ExpandUp https://expandup.com/baas-providers-comparison ; TechTimes Jul 29 2026 https://www.techtimes.com/articles/322138/20260729/... ; Synctera https://www.synctera.com/post/fbo-accounts-in-sponsor-banking

## Notable Claims Requiring Cross-Reference

- **"Program (not user) can keep the FBO yield."** No source cleanly confirms a fintech may keep interest on *pooled customer* balances. The consistent implication is the opposite: with beneficial owners, interest tends to follow ownership unless contract/disclosure assigns it otherwise. The agent-of-payee route may change the ownership analysis (funds constructively belong to the creditor once received) — but that does not make the interest the *fintech's*; it would arguably belong to the creditor. This needs a licensed fintech attorney's opinion for Dime Time's exact facts. Current Mercury-savings setup (funds titled to the company, ~3.25% APY) is the weakest posture: it looks like the company holding/investing customer money as principal.
- **Which specific BaaS providers pay yield on FBO balances and let the *program* keep it.** Providers advertise interest-bearing / high-yield account features, but terms on who captures the yield are deal-specific and were not documented in public pages found. Requires direct provider term sheets.
- **State-by-state MTL exposure.** Agent-of-payee exemption specifics found are California-only; scope/wording varies by state and some states lack a clean equivalent. Multi-state coverage unverified.

## Source Quality Assessment

**Tier 1 (government/regulator/official):**
- CA DFPI Agent-of-Payee opinion letters (2018, 2021, 2022) — current/authoritative
- Cal. Code Regs. Tit. 10 §80.126.10 via Cornell LII (operative 10/1/2021) — current
- FDIC NPRM RIN 3064-AG07 (Sept 2024) — current, referenced secondhand; verify at fdic.gov
- OCC Preemption Determination, State Interest-on-Escrow Laws (Docket OCC-2025-0735) — current

**Tier 2 (major law-firm / advisory analysis):**
- Venable LLP, "FBO Accounts: Maximizing Benefits While Minimizing Risks," Oct 2024 — recent, authoritative
- Guidehouse, "Preserving the FBO account model," 2026 — recent
- LegalClarity, "Float Income: Who Earns It," May 2026 — recent, well-cited (UCC 4A, Reg CC)
- Routefusion blog, Mar 2026 — vendor but substantive, cites FDIC/Reuters/FinCEN

**Tier 3 (vendor/promotional/blog):**
- Stripe, Sila, Synctera, ExpandUp, Talli, TechTimes — useful for landscape/options; commercially motivated
- Modern Treasury FBO explainer (June 29 2021) — **>18 months old; flag as dated**, pre-Synapse; do not rely on its risk framing

## Gaps & Unanswered Questions

1. Can Dime Time legally keep interest on pooled customer balances under ANY structure? Not resolved by public sources — needs counsel. Default conservative answer: no, without explicit disclosure/consent, and even then likely contested for consumer funds.
2. Does agent-of-payee reclassify the funds such that interest belongs to the creditor (not Dime Time)? Unverified.
3. Which BaaS provider offers program-retained yield on FBO balances, at solo-founder scale/cost? Requires term sheets (Unit, Treasury Prime, Synctera, Column, Increase).
4. Concrete cost/effort for a solo founder: sponsor-bank minimums, BaaS platform fees, reconciliation tooling, and whether daily-reconciliation SLAs are feasible without a compliance hire — not quantified in sources.
5. Multi-state MTL map beyond California's agent-of-payee exemption.
6. Whether the current Mercury business/savings setup (company-owned, interest-earning) already constitutes unlicensed money transmission / improper commingling — the highest-risk item to escalate.

**Conservative bottom line for the founder:** (a) Immediate pass-through with no float is the safest baseline and eliminates the yield entirely. (b) Agent-of-payee (written agreements with creditors) is the strongest MTL-avoidance path for a debt-payoff flow, but likely does NOT let Dime Time keep the interest. (c) FBO-at-partner-bank via a BaaS provider is viable but now carries heavy post-Synapse reconciliation burden and does not, on the record found, authorize the *program* to pocket interest on customer money. (d) The current Mercury-savings-earning-3.25%-for-the-company arrangement is the least defensible and should be treated as not-allowed until a fintech attorney documents otherwise.

## Sources
1. Venable LLP — "FBO Accounts: Maximizing Benefits While Minimizing Risks in Fintech Partnerships" — https://www.venable.com/insights/publications/2024/10/fbo-accounts-max-benefits-while-min-risks — Oct 2024 — Tier 2
2. Routefusion — "FBO Accounts for Fintechs: Post-Synapse Risk" — https://routefusion.com/blog/fbo-accounts-for-fintechs — Mar 5 2026 — Tier 3 (substantive)
3. CA DFPI — "Agent of Payee Exemption" opinion letters — https://dfpi.ca.gov/rules-enforcement/laws-and-regulations/opinion-letters-by-law-subject/agent-of-payee-exemption/ — 2021 — Tier 1
4. Cornell LII — "Cal. Code Regs. Tit. 10 §80.126.10 – Agent of Payee" — https://www.law.cornell.edu/regulations/california/10-CCR-80.126.10 — operative 10/1/2021 — Tier 1
5. LegalClarity — "Float Income: What It Is, Who Earns It, and Tax Rules" — https://legalclarity.org/float-income-what-it-is-who-earns-it-and-tax-rules/ — May 12 2026 — Tier 2
6. Guidehouse — "Preserving the FBO account model with better governance" — https://guidehouse.com/insights/financial-services/2026/fbo-account-model — 2026 — Tier 2
7. ExpandUp — "BaaS Providers Compared: Unit, Treasury Prime, Synctera, Column, Infinant" — https://expandup.com/baas-providers-comparison — 2026 — Tier 3
8. Sila — "ACHNow" instant-settlement API — https://www.silamoney.com/achnow — Tier 3
9. Talli — "Interest Float on Settlement Funds: A Fiduciary Question" — https://www.talli.ai/blog/interest-float-settlement-funds — Jul 8 2026 — Tier 3
10. TechTimes — "Increase Acquires Bank Charter, Eliminating BaaS Middleware" — https://www.techtimes.com/articles/322138/20260729/... — Jul 29 2026 — Tier 3
11. Stripe — "What Is an FBO Account?" — https://stripe.com/resources/more/what-is-an-fbo-account-a-guide-to-this-type-of-bank-account — Tier 3
12. Modern Treasury — "When and How to Set Up an FBO Account" — https://www.moderntreasury.com/journal/when-and-how-to-get-an-fbo-account — June 29 2021 — Tier 3 — **FLAG: >18 months old, pre-Synapse**