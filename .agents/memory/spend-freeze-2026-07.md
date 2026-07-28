---
name: Cash-preservation directive (2026-07-28)
description: Founder froze optional dev spend to protect $1,000 rent; only outage/security/data-loss/store-rejection/user-blocking work allowed until lifted.
---

# Cash-preservation directive — effective 2026-07-28

The founder directed an immediate freeze on optional development and nonessential paid usage
(subagents, background tasks, speculative features, redesigns, integrations).

**Allowed work only:** production outage, security vulnerability, data-loss or money-movement
risk, a store rejection blocking launch, or a verified user-blocking defect.

**Release plan under freeze:** wait for Google Play verdict on build 209 → verify public
release → build 210 contains ONLY already-merged changes (no new features) → Codemagic
submission timed so it never threatens rent.

**How to apply:** default to NO new tasks, NO code-review/testing subagent rounds, minimal
verification, until the founder explicitly lifts the freeze. Do not assume incoming revenue
before rent is due.
