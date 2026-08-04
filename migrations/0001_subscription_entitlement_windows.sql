-- Migration: subscription_entitlement_windows (2026-08-04)
-- Founder-approved additive-only change: four nullable columns on
-- "subscriptions" supporting the corrected entitlement policy.
-- No drops, renames, type changes, defaults, rewrites, or backfills.
-- Applied to production via Replit's Publish schema-diff flow (the
-- platform-managed migration path); this file is the reviewed record.

ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "provisional_access_until" timestamp;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "grace_until" timestamp;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "last_payment_intent_status" text;
ALTER TABLE "subscriptions" ADD COLUMN IF NOT EXISTS "last_stripe_event_at" timestamp;

-- Rollback (ONLY if the migration fails; do not run otherwise):
-- ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "provisional_access_until";
-- ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "grace_until";
-- ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "last_payment_intent_status";
-- ALTER TABLE "subscriptions" DROP COLUMN IF EXISTS "last_stripe_event_at";
