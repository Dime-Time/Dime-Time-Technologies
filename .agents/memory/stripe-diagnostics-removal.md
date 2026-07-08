---
name: Stripe diagnostics tool removal & verdict preservation
description: The admin Stripe capability diagnostics tab was deliberately removed; verdict logic is preserved as a tested pure function.
---

The temporary "Stripe Diagnostics" admin tab (Verdict UI + `GET /api/admin/stripe/diagnostics` + `retrieveAccountDiagnostics()`) was **deliberately removed** (2026-06-30) after the ACH go/no-go decision was made, to keep the admin surface lean and reduce attack surface.

**Rule:** do NOT re-add the diagnostics tab or server route unless the operator explicitly asks. The decision-critical verdict mapping (4 canonical conclusions: ACH ready / ACH pending review / additional info required / Treasury pending but ACH available; action-required takes precedence; FC-not-active secondary note) is preserved verbatim as a pure function `computeStripeVerdict` in `shared/stripeVerdict.ts` with a full test matrix (`npx tsx --test shared/__tests__/stripeVerdict.test.ts`).

**Why:** a later task asked to "lock the Verdict logic with tests" hours after the component was deleted; re-adding the UI/route would have undone a deliberate attack-surface reduction. Extracting only the pure function satisfied both.

**How to apply:** if the diagnostics surface is ever reinstated, build the UI on top of `computeStripeVerdict` (severity → tone mapping in the component) rather than re-inlining copy.
