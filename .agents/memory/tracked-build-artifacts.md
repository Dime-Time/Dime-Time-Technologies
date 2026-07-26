---
name: Tracked build artifacts lag source
description: server-dist/ is git-tracked build output that silently carries removed code until rebuilt
---

# Tracked build artifacts (server-dist/)

`server-dist/` (esbuild server bundle + copied client assets) is **committed to git** and only updates when `npm run build` runs. It routinely lags source by days.

**Why this matters:** a compliance-sensitive removal (authenticated Coinbase trading client, 2026-07) survived in the stale bundle a week after the source was cleaned — code review caught it. Deploys are safe (Autoscale runs `npm run build` fresh), but local/CI `npm start` executes the stale bundle, and greps of "the codebase" can wrongly confirm removed code still exists (or miss that it's gone).

**How to apply:** after deleting sensitive/dead code, rebuild (`npm run build`) so the tracked bundle matches source, and scope verification greps to `server/ client/ shared/` — treat `server-dist/` and `dist/` as derived output, not source of truth.

**Second trap (fixed 2026-07-25):** the build script used to `cp -r` client assets into `server-dist/public` WITHOUT cleaning it, so orphaned old hashed bundles accumulated there forever (and were git-tracked → shipped to deploys). The script now does `rm -rf server-dist/public` before copying — keep that step if the build script is ever rewritten.
