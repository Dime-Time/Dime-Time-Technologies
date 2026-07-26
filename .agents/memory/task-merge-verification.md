---
name: Task-agent merge verification ritual
description: How task-agent merges behave on this project and the post-Apply verification ritual that catches problems fast
---

# Task-agent merge verification

**Follow-up chains (learned 2026-07):** each finishing task agent may drop a follow-up DRAFT proposal. Drafts are inert until accepted — but the founder speed-clicks Apply/start, so chains keep running past intended stop points. The only off-switch is not clicking; there is no agent-side cancel. Get the definitive remaining-work count from the task board query, not from streamed updates.

**Ritual test steps are now canonical commands** (replaces hand-built file globs): `npm test` (auto-discovers all non-DB safety tests), `npm run test:db` (DB lane incl. storage-parity suites, dev DB only), `npm run check` (tsc gate — must exit 0; it is a registered pre-ship validation).

Rule: task-agent repls snapshot **current main at start**, so a task whose feature already exists on main merges as a harmless no-op (branch ref equals HEAD, zero diff). Never assume an Apply means new code landed — check. The founder speed-clicks "Apply changes" the moment cards turn Ready, sometimes stacking several merges before any check; that is workable *because* of this ritual, not despite it.

**Why:** 2026-07-26 queue day — a feared "duplicate feature" merge turned out to be a zero-diff no-op, while five real merges each needed the same checks; one destructive-feature merge shipped with no automated tests, caught only by the ritual's live probe.

**How to apply:** after every task merge: (1) `git show --stat <merge-sha>` to see what actually changed; (2) grep sentinel markers of existing features (route regs, storage method defs, key testids) for accidental duplication/removal; (3) run the full test suite; (4) restart the workflow — tsx dev server does NOT hot-reload server files; (5) live-probe the changed behavior via curl on the throwaway dev user. For destructive features, also verify guard rails live (auth 401 / ownership 404 / state-guard 400) and confirm related records survive. If a merge ships untested critical paths, queue or write tests once the task queue drains.
