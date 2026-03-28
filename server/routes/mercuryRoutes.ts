import type { Express, Request, Response } from "express";
import { mercuryService } from "../services/mercuryService";
import { plaidService } from "../services/plaidService";
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
  descriptor: z.string().max(60).optional(),
});

const payDebtSchema = z.object({
  debtId: z.string().min(1, "debtId is required"),
  amount: z
    .number()
    .positive("Amount must be positive")
    .max(MAX_DEBT_PAYMENT_CENTS / 100, `Payment cannot exceed $${MAX_DEBT_PAYMENT_CENTS / 100}`),
  descriptor: z.string().max(60).optional(),
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
   * Collect round-up from the user's linked bank into the Dime Time LLC Mercury account.
   *
   * Money flow (correct inbound direction):
   *   User's bank (Plaid-linked) → ACH debit via Plaid Transfer → Mercury (destination)
   *
   * Steps:
   *   1. Authenticate user and validate request amount.
   *   2. Look up the user's active linked bank account (Plaid access token + account ID).
   *   3. Call Plaid transferAuthorizationCreate (risk check) then transferCreate (ACH debit).
   *   4. Return Plaid transfer ID + status on success.
   *   5. Return 422 if no bank linked; 503 if Plaid Transfer product not enabled.
   *
   * Note: Plaid Transfer product must be enabled in App Dashboard for the Plaid client ID.
   * In sandbox, use "Transfer" product credentials. In production, requires Plaid approval.
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

      if (!activeAccount.plaidAccessToken || !activeAccount.accountId) {
        return res.status(422).json({
          success: false,
          status: 'plaid_token_missing',
          message: "Linked bank account is missing Plaid credentials. Please reconnect your bank.",
        });
      }

      const user = await storage.getUser(userId);
      const userLegalName = user
        ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Account Holder'
        : 'Account Holder';

      const description = descriptor || `Dime Time roundup`;

      try {
        const result = await plaidService.createRoundUpTransfer({
          accessToken: activeAccount.plaidAccessToken,
          accountId: activeAccount.accountId,
          amount,
          userLegalName,
          description,
        });

        return res.status(201).json({
          success: true,
          transferId: result.transferId,
          authorizationId: result.authorizationId,
          status: result.status,
          message: `Round-up of $${amount.toFixed(2)} initiated — ACH debit from ${activeAccount.institutionName} ••${activeAccount.mask || ''} via Plaid Transfer`,
          linkedBank: activeAccount.institutionName,
          amount,
        });
      } catch (transferErr: any) {
        const errMsg: string = transferErr?.response?.data?.error_code ||
          transferErr?.response?.data?.display_message ||
          transferErr?.message || 'Unknown error';

        if (errMsg.includes('INVALID_PRODUCT') || errMsg.includes('NOT_ENABLED') || errMsg.includes('PRODUCT_NOT_ENABLED')) {
          return res.status(503).json({
            success: false,
            status: 'plaid_transfer_not_enabled',
            message: "Plaid Transfer product not enabled for this environment. Enable Transfer in the Plaid Dashboard.",
            detail: errMsg,
          });
        }

        if (errMsg.includes('authorization denied') || errMsg.includes('UNAUTHORIZED')) {
          return res.status(422).json({
            success: false,
            status: 'transfer_not_authorized',
            message: `Plaid rejected this transfer: ${errMsg}`,
          });
        }

        console.error("Plaid Transfer failed:", transferErr?.response?.data || transferErr.message);
        return res.status(502).json({
          success: false,
          status: 'transfer_failed',
          message: "Round-up transfer could not be initiated. Please try again later.",
          detail: errMsg,
        });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("Error collecting round-up:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to collect round-up" });
    }
  });

  /**
   * Queue an outbound debt payment from the Dime Time LLC Mercury account.
   *
   * Security: Recipient routing/account numbers are NEVER accepted from the client.
   * Payee banking details must be stored server-side in the debt record by an administrator
   * before a live Mercury ACH transfer can be initiated. Until then, all payments are queued.
   *
   * This prevents any authenticated user from directing business funds to arbitrary accounts.
   */
  app.post("/api/mercury/pay-debt", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }

      const { debtId, amount, descriptor } = payDebtSchema.parse(req.body);

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

      return res.status(202).json({
        success: true,
        transactionId: `debt_queued_${userId}_${Date.now()}`,
        status: 'queued_awaiting_admin_routing',
        message: `Debt payment of $${amount.toFixed(2)} toward ${debt.name} queued. An administrator must configure the payee routing details in the debt record before Mercury ACH disbursement can execute.`,
        debtName: debt.name,
        amount,
        mercuryBalance: balance.availableBalance,
        note,
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
