---
name: Mercury float compliance research
description: 2026-08-05 deep-research verdict on keeping interest from pooled round-ups in Mercury savings
---
Full report: `research/mercury-float-interest-compliance-report.md` (raw workstreams in `research/raw/`).

**Verdict (conservative, triangulated, 40+ sources):** the keep-the-3.25%-float model is blocked three independent ways:
1. Mercury ToS §1.4 bans third-party funds use; "facilitating payments for third parties" is an account-closure trigger; Mercury offers no FBO/custodial product.
2. Accept→hold→forward is likely unlicensed money transmission (31 CFR 1010.100(ff)). CORRECTED authority: FIN-2009-R004 non-contract-biller branch = money transmission; Ruling 2004-4 held its company NOT an MSB (transmission ancillary to debt-plan NEGOTIATION — Dime Time doesn't negotiate, so no shelter). All exemptions require CREDITOR-side agreements Dime Time lacks. NEVER cite 2004-4 as classifying anyone AS a transmitter.
Code-traced flow (Rev 2): Stripe ACH debit → Stripe balance (commingled w/ subscription revenue) → auto-payout to company Mercury SAVINGS → Friday Mercury ACH to creditor; app ledger unreconciled to bank; skipped users' funds roll indefinitely.
3. "Interest follows principal" (Phillips v. WLF 1998) — float belongs to users absent licensed-transmitter structure (PayPal model). Company-titled account also defeats users' FDIC pass-through.

**How to apply:** never build features that assume float interest is company revenue; treat the pooled account as a conduit. Legit revenue path = FBO at sponsor bank via BaaS with bank deposit revenue share (Unit/Treasury Prime/Synctera/Stripe Treasury), or agent-of-payee restructuring (fixes licensing, not yield). Everything gated on fintech-attorney review — this research feeds that conversation, it is not legal advice.
