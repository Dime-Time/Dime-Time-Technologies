import type { Express, Request, Response } from "express";
import { z } from "zod";
import { storage } from "../storage";
import { requireAdmin } from "../lib/admin";

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

function publicUserRealTransferStatus(u: {
  id: string;
  realTransfersEnabled: boolean;
  realTransfersEnabledAt: Date | null;
  realTransfersEnabledBy: string | null;
  realTransfersNotes: string | null;
}) {
  return {
    userId: u.id,
    realTransfersEnabled: u.realTransfersEnabled,
    realTransfersEnabledAt: u.realTransfersEnabledAt,
    realTransfersEnabledBy: u.realTransfersEnabledBy,
    realTransfersNotes: u.realTransfersNotes,
  };
}

export function registerAdminRoutes(app: Express): void {
  app.get("/api/admin/me", requireAdmin, (_req: Request, res: Response) => {
    res.json({ isAdmin: true });
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

  // Real-money allowlist status for a single user (read).
  app.get("/api/admin/users/:id/real-transfers", requireAdmin, async (req: Request, res: Response) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      res.json(publicUserRealTransferStatus(user));
    } catch (error) {
      console.error("[admin] GET /api/admin/users/:id/real-transfers error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Emergency enable/disable a single user's real ACH access (write).
  // The debit gate re-reads `users.realTransfersEnabled` live inside its
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
      console.log(
        JSON.stringify({
          event: "admin_real_transfers_toggled",
          severity: "WARN",
          targetUserId: req.params.id,
          enabled,
          adminUserId,
        }),
      );
      res.json(publicUserRealTransferStatus(updated));
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
