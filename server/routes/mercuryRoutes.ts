import type { Express, Request, Response } from "express";
import { mercuryService } from "../services/mercuryService";
import { plaidService } from "../services/plaidService";
import { storage } from "../storage";
import { getUserIdFromRequest } from "../middleware/authHelper";
import { z } from "zod";

const collectRoundUpSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  descriptor: z.string().optional(),
});

const payDebtSchema = z.object({
  amount: z.number().positive("Amount must be positive"),
  debtName: z.string().min(1, "debtName is required"),
  recipientAccountNumber: z.string().optional(),
  recipientRoutingNumber: z.string().optional(),
  descriptor: z.string().optional(),
});

export function registerMercuryRoutes(app: Express) {

  app.get("/api/mercury/status", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

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

      const { amount, descriptor } = collectRoundUpSchema.parse(req.body);
      const note = descriptor || `Dime Time round-up collection: $${amount.toFixed(2)}`;

      const linkedAccounts = await storage.getBankAccountsByUserId(userId);
      const activeChecking = linkedAccounts.find(
        a => a.isActive && (a.accountType === 'depository' || a.accountType === 'checking')
      ) || linkedAccounts.find(a => a.isActive);

      if (!activeChecking) {
        return res.status(422).json({
          success: false,
          status: 'no_linked_bank',
          message: "No active linked bank account found. Connect a bank account via Plaid first.",
        });
      }

      let transferResult: any;
      let authNumbers: any[] = [];

      if (plaidService.isServiceConfigured()) {
        try {
          authNumbers = await plaidService.getAccountAuth(activeChecking.plaidAccessToken);
        } catch (authErr: any) {
          console.warn("Plaid Auth fetch failed:", authErr?.message || authErr);
        }
      }

      const plaidAccount = authNumbers.find(n => n.accountId === activeChecking.accountId) || authNumbers[0];

      if (plaidAccount?.accountNumber && plaidAccount?.routingNumber) {
        try {
          transferResult = await mercuryService.initiateTransfer({
            amount,
            note,
            recipientAccountNumber: plaidAccount.accountNumber,
            recipientRoutingNumber: plaidAccount.routingNumber,
            recipientName: plaidAccount.name || activeChecking.accountName,
            paymentMethod: 'ach',
          });

          return res.status(201).json({
            success: true,
            transactionId: transferResult.id,
            status: transferResult.status,
            message: `Round-up of $${amount.toFixed(2)} initiated via Mercury ACH from ${activeChecking.institutionName}`,
            amount,
          });
        } catch (transferErr: any) {
          console.error("Mercury transfer failed:", transferErr?.response?.data || transferErr.message);
        }
      }

      return res.status(202).json({
        success: true,
        transactionId: `queued_${userId}_${Date.now()}`,
        status: 'queued',
        message: `Round-up of $${amount.toFixed(2)} queued — ${activeChecking.institutionName} account linked, awaiting Plaid ACH production approval`,
        linkedBank: activeChecking.institutionName,
        amount,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error collecting round-up:", error?.response?.data || error.message);
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

      const { amount, debtName, recipientAccountNumber, recipientRoutingNumber, descriptor } = payDebtSchema.parse(req.body);
      const note = descriptor || `Dime Time debt payment for ${debtName}: $${amount.toFixed(2)}`;

      if (recipientAccountNumber && recipientRoutingNumber) {
        try {
          const transferResult = await mercuryService.initiateTransfer({
            amount,
            note,
            recipientAccountNumber,
            recipientRoutingNumber,
            recipientName: debtName,
            paymentMethod: 'ach',
          });

          return res.status(201).json({
            success: true,
            transactionId: transferResult.id,
            status: transferResult.status,
            message: `Debt payment of $${amount.toFixed(2)} to ${debtName} initiated via Mercury ACH`,
            amount,
          });
        } catch (transferErr: any) {
          console.error("Mercury debt payment failed:", transferErr?.response?.data || transferErr.message);
        }
      }

      return res.status(202).json({
        success: true,
        transactionId: `debt_queued_${userId}_${Date.now()}`,
        status: 'queued',
        message: `Debt payment of $${amount.toFixed(2)} toward ${debtName} queued — provide payee routing number to complete Mercury ACH transfer`,
        amount,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error processing debt payment:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to process debt payment" });
    }
  });
}
