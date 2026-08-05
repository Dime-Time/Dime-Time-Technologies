import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../lib/admin";
import { previewDisbursement, runWeeklyDisbursement } from "../services/weeklyDisbursementService";
import { isFlagEnabled } from "../lib/flags";

/**
 * Internal operator surface. Gated by `ADMIN_USER_IDS` env (Replit Secret).
 *
 * Mostly read-only (transfer state, webhook deliveries, failure reasons during
 * ACH beta testing). The ONLY write endpoint is the real-money allowlist toggle
 * (`POST /api/admin/users/:id/real-transfers`) — the emergency enable/disable
 * switch for an individual user's real ACH access. Every flip is audited in
 * `real_transfer_audit_logs` inside the same transaction.
 *
 * Sensitive at-rest secrets (encrypted Plaid tokens, encrypted Stripe PM ids,
 * raw provider payloads) are NEVER returned — `rawResponse` is intentionally
 * stripped before serialization.
 */

const realTransfersToggleSchema = z.object({
  enabled: z.boolean(),
  notes: z.string().max(500).optional(),
});

const dailyCapOverrideSchema = z.object({
  // null clears the override (automatic tiers apply again).
  dailyCap: z.number().min(0).max(10000).nullable(),
  notes: z.string().max(500).optional(),
});

function publicUserRealTransferStatus(u: {
  id: string;
  realTransfersBlocked: boolean;
  realTransfersBlockedAt: Date | null;
  realTransfersBlockedBy: string | null;
  realTransfersNotes: string | null;
}) {
  return {
    userId: u.id,
    // Enabled by default for everyone; false only when an admin has blocked.
    realTransfersEnabled: u.realTransfersBlocked !== true,
    realTransfersBlockedAt: u.realTransfersBlockedAt,
    realTransfersBlockedBy: u.realTransfersBlockedBy,
    realTransfersNotes: u.realTransfersNotes,
  };
}

export function registerAdminRoutes(app: Express): void {
  app.get("/api/admin/me", requireAdmin, (_req: Request, res: Response) => {
    res.json({ isAdmin: true });
  });

  // Weekly round-up disbursement — preview what WOULD be paid out.
  // Read-only: computes balances and eligibility, moves nothing.
  app.get("/api/admin/weekly-disbursement/preview", requireAdmin, async (_req: Request, res: Response) => {
    try {
      const lines = await previewDisbursement();
      const eligible = lines.filter((l) => l.status === "would_disburse");
      res.json({
        flags: {
          weeklyDisbursementEnabled: isFlagEnabled("ENABLE_WEEKLY_DISBURSEMENT"),
          realTransfersEnabled: isFlagEnabled("ENABLE_REAL_TRANSFERS"),
        },
        eligibleCount: eligible.length,
        eligibleTotal: Number(eligible.reduce((s, l) => s + l.amount, 0).toFixed(2)),
        lines,
      });
    } catch (error: any) {
      console.error("weekly-disbursement preview error:", error?.message || error);
      res.status(500).json({ message: "Failed to compute disbursement preview" });
    }
  });

  // Manual run. Body: { dryRun: boolean } — dryRun defaults to TRUE; a real
  // run must be explicitly requested and still passes every flag gate inside
  // the service (ENABLE_WEEKLY_DISBURSEMENT + ENABLE_REAL_TRANSFERS + Mercury
  // configured), so this endpoint can never move money while flags are off.
  app.post("/api/admin/weekly-disbursement/run", requireAdmin, async (req: Request, res: Response) => {
    try {
      const parsed = z.object({ dryRun: z.boolean().optional() }).parse(req.body ?? {});
      const dryRun = parsed.dryRun !== false; // default true
      const result = await runWeeklyDisbursement({
        dryRun,
        triggeredBy: (req as any).adminUserId || "admin",
      });
      res.json(result);
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("weekly-disbursement run error:", error?.message || error);
      res.status(422).json({ message: error?.message || "Disbursement run failed" });
    }
  });

  app.get("/api/admin/transfers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit ?? "100"), 10) || 100));
      const provider = typeof req.query.provider === "string" && req.query.provider.length > 0 ? String(req.query.provider) : undefined;
      const status = typeof req.query.status === "string" && req.query.status.length > 0 ? String(req.query.status) : undefined;
      const rows = await storage.getRecentTransfers({ limit, provider, status });
      res.json({
        count: rows.length,
        transfers: rows.map(stripRaw),
      });
    } catch (error) {
      console.error("[admin] /api/admin/transfers error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/transfers/:id", requireAdmin, async (req: Request, res: Response) => {
    try {
      const row = await storage.getTransfer(req.params.id);
      if (!row) return res.status(404).json({ message: "Transfer not found" });
      res.json(stripRaw(row));
    } catch (error) {
      console.error("[admin] /api/admin/transfers/:id error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  app.get("/api/admin/webhooks/stripe", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit ?? "100"), 10) || 100));
      const rows = await storage.getRecentStripeWebhookEvents(limit);
      res.json({ count: rows.length, events: rows });
    } catch (error) {
      console.error("[admin] /api/admin/webhooks/stripe error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Real-money status for a single user (read) — block state + progressive
  // trust tier / effective limits.
  app.get("/api/admin/users/:id/real-transfers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const trust = await storage.getUserRealTransferTrust(req.params.id);
      res.json({
        ...publicUserRealTransferStatus(user),
        trust: trust ? {
          tier: trust.tier,
          flagged: trust.flagged,
          dailyTotalMaxDollars: trust.dailyTotalMaxDollars,
          dailyCountMax: trust.dailyCountMax,
          firstTransferMaxDollars: trust.firstTransferMaxDollars,
          overrideApplied: trust.overrideApplied,
          firstSettledAt: trust.firstSettledAt,
        } : null,
        dailyCapOverride: user.realTransfersDailyCapOverride,
      });
    } catch (error) {
      console.error("[admin] GET /api/admin/users/:id/real-transfers error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Set or clear an admin daily-cap override for a single user (write).
  // Used to raise, lower, or (after manual review of a risk-flagged user)
  // release a user's daily real-transfer limit. Audited transactionally.
  app.post("/api/admin/users/:id/real-transfer-limit", requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminUserId = (req as any).adminUserId as string;
      const parsed = dailyCapOverrideSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const { dailyCap, notes } = parsed.data;
      const updated = await storage.setUserRealTransfersDailyCapOverride(req.params.id, dailyCap, adminUserId, notes);
      if (!updated) return res.status(404).json({ message: "User not found" });
      console.log(JSON.stringify({
        event: "admin_real_transfer_cap_override",
        severity: "WARN",
        targetUserId: req.params.id,
        dailyCap,
        adminUserId,
      }));
      const trust = await storage.getUserRealTransferTrust(req.params.id);
      res.json({
        ...publicUserRealTransferStatus(updated),
        trust: trust ? {
          tier: trust.tier,
          flagged: trust.flagged,
          dailyTotalMaxDollars: trust.dailyTotalMaxDollars,
          dailyCountMax: trust.dailyCountMax,
          firstTransferMaxDollars: trust.firstTransferMaxDollars,
          overrideApplied: trust.overrideApplied,
          firstSettledAt: trust.firstSettledAt,
        } : null,
        dailyCapOverride: updated.realTransfersDailyCapOverride,
      });
    } catch (error) {
      console.error("[admin] POST /api/admin/users/:id/real-transfer-limit error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Emergency enable/disable a single user's real ACH access (write).
  // The debit gate re-reads `users.realTransfersBlocked` live inside its
  // transaction, so disabling here revokes access on the very next attempt —
  // no cache, no restart required. Every flip is audited transactionally.
  app.post("/api/admin/users/:id/real-transfers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const adminUserId = (req as any).adminUserId as string;
      const parsed = realTransfersToggleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const { enabled, notes } = parsed.data;
      const updated = await storage.setUserRealTransfersEnabled(req.params.id, enabled, adminUserId, notes);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const trust = await storage.getUserRealTransferTrust(req.params.id);
      console.log(
        JSON.stringify({
          event: "admin_real_transfers_toggled",
          severity: "WARN",
          targetUserId: req.params.id,
          enabled,
          adminUserId,
        }),
      );
      res.json({
        ...publicUserRealTransferStatus(updated),
        trust: trust ? {
          tier: trust.tier,
          flagged: trust.flagged,
          dailyTotalMaxDollars: trust.dailyTotalMaxDollars,
          dailyCountMax: trust.dailyCountMax,
          firstTransferMaxDollars: trust.firstTransferMaxDollars,
          overrideApplied: trust.overrideApplied,
          firstSettledAt: trust.firstSettledAt,
        } : null,
        dailyCapOverride: updated.realTransfersDailyCapOverride,
      });
    } catch (error) {
      console.error("[admin] POST /api/admin/users/:id/real-transfers error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Money-decision audit trail (allowlist flips + per-debit gate decisions).
  app.get("/api/admin/real-transfer-audit", requireAdmin, async (req: Request, res: Response) => {
    try {
      const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit ?? "100"), 10) || 100));
      const userId = typeof req.query.userId === "string" && req.query.userId.length > 0 ? String(req.query.userId) : undefined;
      const rows = await storage.getRecentRealTransferAuditLogs({ limit, userId });
      res.json({ count: rows.length, logs: rows });
    } catch (error) {
      console.error("[admin] /api/admin/real-transfer-audit error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}

function stripRaw<T extends { rawRequest?: string | null; rawResponse?: string | null }>(t: T): Omit<T, "rawRequest" | "rawResponse"> {
  const { rawRequest, rawResponse, ...rest } = t;
  return rest;
}
