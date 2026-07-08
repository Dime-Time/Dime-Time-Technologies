---
name: Internal admin surface
description: ADMIN_USER_IDS gating, endpoint list, Real Money tab, and the do-not-re-add Stripe Diagnostics rule
---

Gated by `ADMIN_USER_IDS` (Replit Secret, comma-separated user UUIDs). Empty/unset = no admins (fails closed). Restart required after changes.

**Backend:** `server/lib/admin.ts` (`requireAdmin`), `server/routes/adminRoutes.ts`. Read endpoints are GET-only and strip `rawRequest`/`rawResponse` from transfer rows before serialization:
- `GET /api/admin/me` — `{isAdmin:true}` or 401/403.
- `GET /api/admin/transfers?limit=&provider=&status=` — recent transfers, all users (clamp 1..500).
- `GET /api/admin/transfers/:id` — one transfer, full operational fields, no raw payloads.
- `GET /api/admin/webhooks/stripe?limit=` — recent Stripe webhook events.
- `GET`/`POST /api/admin/users/:id/real-transfers` + `GET /api/admin/real-transfer-audit` — real-money allowlist (see real-money-rollout-gate.md).

`/api/user` piggybacks `_isAdmin: boolean` alongside `_flags` (no extra round trip).

**Frontend:** `/admin` → `client/src/pages/admin.tsx` (Transfers + Stripe Webhooks + Real Money tabs). Non-admins see "not authorized" card; backend stays source of truth. Real Money tab: approve/revoke allowlist with AlertDialog confirmation; "Your account" card enables self-approval; purely a UI over the audited endpoints.

**Do NOT re-add** the "Stripe Diagnostics" tab (removed 2026-06-30 after ACH go/no-go). Verdict mapping preserved as pure fn `computeStripeVerdict` in `shared/stripeVerdict.ts`, locked by `npx tsx --test shared/__tests__/stripeVerdict.test.ts`. Any reinstated UI must consume that function. (See also stripe-diagnostics-removal.md.)
