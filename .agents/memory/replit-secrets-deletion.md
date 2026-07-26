---
name: Replit Secrets — deletion limits & disaster recovery
description: deleteEnvVars no-ops on Secrets; checkpoints never restore secrets; the running deployment's separate secret store is the recovery copy; PLAID_TOKEN_ENCRYPTION_KEY is not re-issuable
---

# Secrets deletion limits

Rule: the agent cannot delete Replit **Secrets**. `deleteEnvVars` handles only non-secret env vars — called on a secret key it returns a success-shaped echo (`{environment, keys}`) while deleting nothing; a follow-up `viewEnvVars` shows the secret still present.

**Why:** discovered 2026-07-26 while purging dead AWS_* keys — the echo response looks like success and can fool you into reporting a deletion that never happened.

**How to apply:** to remove a secret, ask the user to delete it in the workspace Secrets pane (give exact key names). Always re-check with `viewEnvVars` before claiming a secret is gone.

# Disaster recovery if secrets are lost (docs-confirmed 2026-07-26)

Rule: deleted Secrets have no undelete, and checkpoint rollback does NOT restore secrets (code/chat/DB only). Development and deployment secrets are SEPARATE stores that never auto-sync — deleting workspace secrets leaves the published app running on its own copies until the next republish.

**Why:** the docs confirm the deployment store is untouched by workspace deletions and only updates on republish — so the live app is both uptime and the recovery source in a mass-deletion incident.

**How to apply:** if secrets are mass-deleted: (1) do NOT republish — the running deployment keeps prod alive and holds the recovery copies; (2) inventory what's missing via `viewEnvVars`/printenv presence checks (names only, never values); (3) most keys are re-issuable from provider dashboards (Stripe, Plaid, Cloudflare, GitHub, Resend, Mercury, Neon); (4) `PLAID_TOKEN_ENCRYPTION_KEY` is self-generated and NOT re-issuable — recover the exact value (deployment store or the founder's password-manager backup, recommended to him 2026-07-26) or all stored bank links become undecryptable; `SESSION_SECRET` loss is only a one-time mass logout.
