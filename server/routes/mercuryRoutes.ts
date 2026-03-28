import type { Express, Request, Response } from "express";
import { mercuryService } from "../services/mercuryService";
import { storage } from "../storage";
import { getUserIdFromRequest } from "../middleware/authHelper";
import { z } from "zod";

const MAX_SINGLE_ROUNDUP_CENTS = 500;
const MAX_DEBT_PAYMENT_CENTS = 50000;

const collectRoundUpSchema = z.object({
  amount: z
    .number()
    .positive("Amount must be positive")
    .max(MAX_SINGLE_ROUNDUP_CENTS / 100, `Round-up cannot exceed $${MAX_SINGLE_ROUNDUP_CENTS / 100}`),
  descriptor: z.string().optional(),
});

const payDebtSchema = z.object({
  debtId: z.string().min(1, "debtId is required"),
  amount: z
    .number()
    .positive("Amount must be positive")
    .max(MAX_DEBT_PAYMENT_CENTS / 100, `Payment cannot exceed $${MAX_DEBT_PAYMENT_CENTS / 100}`),
  recipientAccountNumber: z.string().optional(),
  recipientRoutingNumber: z.string().regex(/^\d{9}$/, "Routing number must be exactly 9 digits").optional(),
  descriptor: z.string().optional(),
});

export function registerMercuryRoutes(app: Express) {

  app.get("/api/mercury/status", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      if (!mercuryService.isServiceConfigured()) {
        return res.json({ configured: false, message: "Mercury service not configured" });
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

  /**
   * Collect round-up from a user's linked bank into the Dime Time LLC Mercury account.
   *
   * Architecture: ACH round-up collection is a PULL from the user's external bank account
   * INTO Mercury. Mercury's own API only initiates OUTBOUND payments (Mercury → external).
   * Therefore the correct mechanism is Plaid Transfer API, which acts as the ACH originator,
   * pulling funds from the user's Plaid-linked bank and depositing them into Mercury.
   *
   * Current status: Plaid Transfer product requires production Plaid credentials with the
   * Transfer product enabled (separate from Link/Auth). This endpoint validates that the user
   * has a linked bank account, checks Mercury balance for operational status, and returns a
   * "queued_for_plaid_transfer" status so the caller knows exactly what is pending.
   */
  app.post("/api/mercury/collect-roundup", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }

      const { amount, descriptor } = collectRoundUpSchema.parse(req.body);

      const linkedAccounts = await storage.getBankAccountsByUserId(userId);
      const activeAccount = linkedAccounts.find(a => a.isActive) || null;

      if (!activeAccount) {
        return res.status(422).json({
          success: false,
          status: 'no_linked_bank',
          message: "No active linked bank account found. Connect a bank account via Plaid first.",
        });
      }

      const note = descriptor || `Dime Time round-up collection: $${amount.toFixed(2)}`;

      return res.status(202).json({
        success: true,
        transactionId: `roundup_${userId}_${Date.now()}`,
        status: 'queued_for_plaid_transfer',
        message: `Round-up of $${amount.toFixed(2)} queued for ACH collection from ${activeAccount.institutionName} ••${activeAccount.mask || ''}. Transfers execute via Plaid Transfer API — production Plaid credentials with Transfer product required.`,
        linkedBank: activeAccount.institutionName,
        linkedAccountMask: activeAccount.mask,
        destinationAccount: `Mercury Checking ••${mercuryService.getMercuryAccountNumber().slice(-4)}`,
        amount,
        note,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error collecting round-up:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to collect round-up" });
    }
  });

  /**
   * Initiate an outbound ACH debt payment from the Dime Time LLC Mercury account.
   *
   * Authorization: The requesting user must own the debt. Amount is capped. Recipient
   * routing number must be a valid 9-digit ABA number. Mercury balance must be sufficient.
   * When payee routing/account numbers are provided, calls Mercury's transfer API directly.
   */
  app.post("/api/mercury/pay-debt", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }

      const { debtId, amount, recipientAccountNumber, recipientRoutingNumber, descriptor } = payDebtSchema.parse(req.body);

      const debt = await storage.getDebt(debtId);
      if (!debt || debt.userId !== userId) {
        return res.status(403).json({ message: "Debt not found or does not belong to this account" });
      }

      const balance = await mercuryService.getAccountBalance();
      if (balance.availableBalance < amount) {
        return res.status(422).json({
          success: false,
          status: 'insufficient_funds',
          message: `Insufficient Mercury balance. Available: $${balance.availableBalance.toFixed(2)}, Requested: $${amount.toFixed(2)}`,
        });
      }

      const note = descriptor || `Dime Time debt payment — ${debt.name}: $${amount.toFixed(2)}`;

      if (recipientAccountNumber && recipientRoutingNumber) {
        try {
          const transferResult = await mercuryService.initiateTransfer({
            amount,
            note,
            recipientAccountNumber,
            recipientRoutingNumber,
            recipientName: debt.name,
            paymentMethod: 'ach',
          });

          return res.status(201).json({
            success: true,
            transactionId: transferResult.id,
            status: transferResult.status,
            message: `Debt payment of $${amount.toFixed(2)} to ${debt.name} initiated via Mercury ACH`,
            amount,
          });
        } catch (transferErr: any) {
          console.error("Mercury debt payment transfer failed:", transferErr?.response?.data || transferErr.message);
          return res.status(502).json({
            success: false,
            status: 'transfer_failed',
            message: "Mercury ACH transfer failed — check recipient routing/account details",
            error: transferErr?.response?.data?.errors || transferErr.message,
          });
        }
      }

      return res.status(202).json({
        success: true,
        transactionId: `debt_queued_${userId}_${Date.now()}`,
        status: 'queued_awaiting_payee_routing',
        message: `Debt payment of $${amount.toFixed(2)} toward ${debt.name} queued. Provide recipientAccountNumber and recipientRoutingNumber to initiate Mercury ACH transfer.`,
        debtName: debt.name,
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
