---
name: Auto-sweep feature removed
description: The dormant auto round-up sweep engine was deliberately deleted as dead code (2026-07-26); flag is vestigial — don't resurrect without knowing this history.
---

# Auto-sweep feature removed (2026-07-26)

The auto-sweep engine (sweep page, sweep routes, sweepService — ~680 lines) was **deliberately deleted** during the typecheck-gate task, not lost. It was verified dead: server routes never mounted in routes.ts, client page never routed in App.tsx, zero dangling imports (tsc clean after removal).

**Why:** It carried unfixable-without-effort type errors and was unreachable behind `ENABLE_AUTO_ROUNDUP_SWEEPS` (resolves false everywhere, unset in prod). Deleting beat maintaining dead code.

**How to apply:**
- `ENABLE_AUTO_ROUNDUP_SWEEPS` in shared/flags.ts and sweep-related schema tables are **vestigial** — the flag gates nothing now. Don't "wire it back up" thinking something is missing.
- The LIVE round-up feature (round_up_settings, weekly dispersals, /api/round-up* routes) is a separate system and was untouched — do not confuse the two.
- If auto-sweeps are ever wanted again, build fresh from the live round-up system; git history (typecheck-gate merge commit) has the old code for reference.
