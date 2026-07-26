---
name: AWS fully removed
description: Dime Time has zero AWS dependency; AWS_* secrets may linger unused — don't reintroduce or "fix" AWS integration
---

# AWS removed (2026-07-25)

All AWS code (S3 document upload/backup, DynamoDB parallel-storage sync, `/api/aws/*` routes, all @aws-sdk packages, multer) was deliberately removed with founder approval. It was early scaffolding no client screen ever called; Postgres (Neon) is the only system of record.

**Why:** dead endpoints wired to live credentials = pointless attack/billing surface; founder is retiring the AWS account entirely.

**How to apply:** if `AWS_*` secrets still appear in the environment, they are leftovers — their presence does NOT mean AWS is used. Never re-add AWS SDKs or "restore" the S3/Dynamo integration; file storage needs (receipts, statements) should use Replit object storage or a founder-approved provider instead.

**Status (2026-07-26):** AWS account fully CLOSED (console banner "The account is closed"). Pre-closure API check: configured bucket returned NoSuchBucket and account-wide bucket list = 0 — zero data ever stored. Leftover AWS_* secrets await founder deletion via the Secrets pane (agent cannot delete Secrets). Do not re-verify the account or treat AWS_* keys as live.
