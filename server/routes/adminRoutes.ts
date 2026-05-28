import type { Express, Request, Response } from "express";
import { storage } from "../storage";
import { requireAdmin } from "../lib/admin";

/**
 * Internal read-only operator surface. Gated by `ADMIN_USER_IDS` env (Replit Secret).
 * No write endpoints. Used to inspect transfer state, webhook deliveries, and
 * failure reasons during ACH beta testing.
 *
 * Sensitive at-rest secrets (encrypted Plaid tokens, encrypted Stripe PM ids,
 * raw provider payloads) are NEVER returned — `rawResponse` is intentionally
 * stripped before serialization.
 */
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
}

function stripRaw<T extends { rawRequest?: string | null; rawResponse?: string | null }>(t: T): Omit<T, "rawRequest" | "rawResponse"> {
  const { rawRequest, rawResponse, ...rest } = t;
  return rest;
}
