---
name: npm lockfile CI portability
description: Replit package installs can write package-firewall.replit.local URLs into package-lock.json, breaking external CI (Codemagic)
---

# npm lockfile portability to external CI

Package installs performed inside Replit (agent package tools or npm) can write
`resolved` URLs pointing to `http://package-firewall.replit.local/npm/...` into
`package-lock.json`. That host only exists inside Replit, so any external CI
that runs `npm install`/`npm ci` from the pushed repo (Codemagic iOS builds)
fails with `getaddrinfo ENOTFOUND package-firewall.replit.local`.

**Why:** Broke Codemagic build 207 on launch night (2026-07-20) — playwright-core
(local screenshot tooling) and canvas-confetti (merged task) both landed
firewall URLs in the lockfile.

**How to apply:**
- Before the founder pushes to GitHub / triggers Codemagic, run:
  `grep -c "package-firewall.replit.local" package-lock.json` — must be 0.
- Fix is a safe sed rewrite (integrity hashes stay valid, same tarballs):
  `sed -i 's|http://package-firewall.replit.local/npm/|https://registry.npmjs.org/|g' package-lock.json`
- Dev-only tooling (e.g. playwright-core for screenshot capture) should be
  uninstalled before release pushes, not left in package.json.
- Merged task-agent work can reintroduce firewall URLs — re-check after merges.
