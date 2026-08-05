---
name: Mercury float compliance research
description: 2026-08-05 deep-research verdict on keeping interest from pooled round-ups in Mercury savings
---
Full report: `research/mercury-float-interest-compliance-report.md` (raw workstreams in `research/raw/`).

**Verdict (conservative, triangulated, 40+ sources):** the keep-the-3.25%-float model is blocked three independent ways:
1. Mercury ToS §1.4 bans third-party funds use; "facilitating payments for third parties" is an account-closure trigger; Mercury offers no FBO/custodial product.
2. Accept→hold→forward is likely unlicensed money transmission (31 CFR 1010.100(ff); FinCEN Ruling 2004-4 debt-management analog). Payment-processor + agent-of-payee exemptions both require CREDITOR-side agreements Dime Time lacks.
3. "Interest follows principal" (Phillips v. WLF 1998) — float belongs to users absent licensed-transmitter structure (PayPal model). Company-titled account also defeats users' FDIC pass-through.

**How to apply:** never build features that assume float interest is company revenue; treat the pooled account as a conduit. Legit revenue path = FBO at sponsor bank via BaaS with bank deposit revenue share (Unit/Treasury Prime/Synctera/Stripe Treasury), or agent-of-payee restructuring (fixes licensing, not yield). Everything gated on fintech-attorney review — this research feeds that conversation, it is not legal advice.
