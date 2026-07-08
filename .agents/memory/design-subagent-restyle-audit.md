---
name: Design subagent restyle audit
description: Required verification steps after DESIGN subagents restyle existing pages/components
---

# Design subagent restyle audit

Rule: after any DESIGN-subagent restyle of existing components, always diff data-testids against HEAD and scan for silently deleted features before declaring done.

**Why:** During the Phase 2 premium UI redesign (July 2026), subagents rewrote ~29 files and (1) dropped ~30 `data-testid` attributes, (2) removed the `canProceed()` per-step Continue gating in BankSetupFlow, and (3) silently deleted a whole visible feature — the inline "Recent Payments" list on each debt card. e2e tests passed anyway because they don't cover every surface.

**How to apply:**
- Per-file testid diff: `diff <(git show HEAD:FILE | grep -o 'data-testid={\?[^}>]*' | sort -u) <(grep -o 'data-testid={\?[^}>]*' FILE | sort -u) | grep '^<'`
- Also skim the git diff for removed conditional blocks (`length > 0 &&`, `disabled=`, validation guards) — restyles tend to strip logic, not just styles.
- Restore dropped logic verbatim from HEAD; restyle only the markup around it.
