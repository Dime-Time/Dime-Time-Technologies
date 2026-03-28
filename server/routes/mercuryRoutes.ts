import type { Express, Request, Response } from "express";
import { mercuryService } from "../services/mercuryService";
import { getUserIdFromRequest } from "../middleware/authHelper";
import { z } from "zod";

const collectRoundUpSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  descriptor: z.string().optional(),
});

const payDebtSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  debtName: z.string().min(1, "debtName is required"),
  descriptor: z.string().optional(),
});

export function registerMercuryRoutes(app: Express) {

  app.get("/api/mercury/status", async (_req: Request, res: Response) => {
    try {
      if (!mercuryService.isServiceConfigured()) {
        return res.json({
          configured: false,
          message: "Mercury service not configured — missing secrets",
        });
      }

      const balance = await mercuryService.getAccountBalance();
      res.json({
        configured: true,
        message: "Mercury banking service connected",
        accountNumber: `••${balance.accountNumber.slice(-4)}`,
        routingNumber: balance.routingNumber,
        currentBalance: balance.balance,
        availableBalance: balance.availableBalance,
        currency: balance.currency,
        formattedBalance: `$${balance.availableBalance.toFixed(2)}`,
      });
    } catch (error: any) {
      console.error("Error checking Mercury status:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to check Mercury service status" });
    }
  });

  app.get("/api/mercury/balance", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }
      const balance = await mercuryService.getAccountBalance();
      res.json({
        currentBalance: balance.balance,
        availableBalance: balance.availableBalance,
        currency: balance.currency,
        formattedBalance: `$${balance.availableBalance.toFixed(2)}`,
      });
    } catch (error: any) {
      console.error("Error fetching Mercury balance:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to fetch Mercury account balance" });
    }
  });

  app.get("/api/mercury/transactions", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 50;
      const transactions = await mercuryService.getTransactions(limit);
      res.json({ transactions });
    } catch (error: any) {
      console.error("Error fetching Mercury transactions:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to fetch Mercury transactions" });
    }
  });

  app.post("/api/mercury/collect-roundup", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }
      const data = collectRoundUpSchema.parse(req.body);
      const result = await mercuryService.collectRoundUp({ ...data, userId });
      res.status(201).json({
        success: result.success,
        transactionId: result.transactionId,
        status: result.status,
        message: result.message,
        amount: result.amount,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error collecting round-up via Mercury:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to collect round-up" });
    }
  });

  app.post("/api/mercury/pay-debt", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }
      const data = payDebtSchema.parse(req.body);
      const result = await mercuryService.payDebt({ ...data, userId });
      res.status(201).json({
        success: result.success,
        transactionId: result.transactionId,
        status: result.status,
        message: result.message,
        amount: result.amount,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error processing debt payment via Mercury:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to process debt payment" });
    }
  });
}
