---
name: Maintenance-phase spend directive
description: Standing founder directive (2026-07-29) — maintenance/launch phase; no optional dev work or tasks without explicit authorization
---

# Maintenance-phase spend directive (supersedes the 2026-07-28 freeze)

Founder directive 2026-07-29 after July billing hit ~$1,118 (usage invoices bill as accrued; a $267.69 invoice overdrew his bank account). The earlier "freeze" failed because approved tasks still ran — treat approval as spending.

**The rule:** codebase is in maintenance + launch phase, NOT feature development.

Only surface work in these categories:
- Critical production bugs preventing app use
- Security vulnerabilities / compliance issues
- Apple App Store or Google Play review requirements
- Real-user-reported bugs materially affecting UX
- Data loss, failed money movement, or broken bank connection risks

Everything else (UI polish, cleanup, refactors, perf, enhancements, architecture, feature ideas) goes in a **written backlog summary only** — never as proposed tasks, never as prompts to spend.

**How to apply:**
- Do NOT create or propose project tasks / follow-up tasks unless explicitly asked.
- Do NOT run optional subagent rounds (code review, testing, design) — minimal verification only.
- Default every decision to minimizing paid agent work.
- Founder decides later, based on user traction/revenue, what leaves the backlog.
- His priorities: 1) stability, 2) launch, 3) real users, 4) learn before building.

Cost facts for context: quiet-month floor is ~$10–50/mo (hosting + prod DB); everything above is agent usage. Budget cap + alerts recommended in Account → Usage.
