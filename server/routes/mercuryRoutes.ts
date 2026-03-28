import type { Express, Request, Response } from "express";
import { randomUUID } from "crypto";
import { mercuryService } from "../services/mercuryService";
import { plaidService } from "../services/plaidService";
import { storage } from "../storage";
import { getUserIdFromRequest } from "../middleware/authHelper";
import { z } from "zod";

const MAX_ROUNDUP_DOLLARS = 5;
const MAX_DEBT_PAYMENT_DOLLARS = 500;

const collectRoundUpSchema = z.object({
  amount: z.number().positive().max(MAX_ROUNDUP_DOLLARS, `Round-up cannot exceed $${MAX_ROUNDUP_DOLLARS}`),
  descriptor: z.string().max(60).optional(),
});

const payDebtSchema = z.object({
  debtId: z.string().min(1),
  amount: z.number().positive().max(MAX_DEBT_PAYMENT_DOLLARS, `Payment cannot exceed $${MAX_DEBT_PAYMENT_DOLLARS}`),
  descriptor: z.string().max(60).optional(),
});

function transferLog(correlationId: string, event: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    service: 'MercuryRoutes',
    correlationId,
    event,
    ...data,
  }));
}

async function checkIdempotency(
  idempotencyKey: string | undefined,
  userId: string,
  endpoint: string,
  correlationId: string,
  res: Response
): Promise<boolean> {
  if (!idempotencyKey) return false;
  const cached = await storage.getIdempotencyKey(idempotencyKey, userId, endpoint);
  if (cached) {
    transferLog(correlationId, 'idempotency_hit', { endpoint, idempotencyKey });
    const body = JSON.parse(cached.responseBody);
    res.status(cached.responseStatus).json({ ...body, _idempotencyReplay: true });
    return true;
  }
  return false;
}

async function saveIdempotency(
  idempotencyKey: string | undefined,
  userId: string,
  endpoint: string,
  status: number,
  body: object
): Promise<void> {
  if (!idempotencyKey) return;
  await storage.createIdempotencyKey({
    idempotencyKey,
    userId,
    endpoint,
    responseStatus: status,
    responseBody: JSON.stringify(body),
  });
}

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
      console.error("Mercury status error:", error?.response?.data || error.message);
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
      console.error("Mercury balance error:", error?.response?.data || error.message);
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
      console.error("Mercury transactions error:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to fetch Mercury transactions" });
    }
  });

  // ACH pull: user's bank → Mercury via Plaid Transfer (inbound to Mercury)
  app.post("/api/mercury/collect-roundup", async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }

      // Idempotency check
      const replayed = await checkIdempotency(idempotencyKey, userId, '/api/mercury/collect-roundup', correlationId, res);
      if (replayed) return;

      const { amount, descriptor } = collectRoundUpSchema.parse(req.body);

      transferLog(correlationId, 'collect_roundup_start', { userId, amount, idempotencyKey });

      const linkedAccounts = await storage.getBankAccountsByUserId(userId);
      const activeAccount = linkedAccounts.find(a => a.isActive) || null;
      if (!activeAccount) {
        return res.status(422).json({
          success: false,
          status: 'no_linked_bank',
          message: "No active linked bank account. Connect a bank account via Plaid first.",
        });
      }

      // Retrieve decrypted token securely — never logged or returned to client
      const accessToken = await storage.getPlaidAccessToken(activeAccount.id);
      if (!accessToken || !activeAccount.accountId) {
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

      // Create transfer ledger record (status: created)
      const ledgerEntry = await storage.createTransfer({
        userId,
        type: 'roundup_collection',
        amount: amount.toFixed(2),
        status: 'created',
        correlationId,
        idempotencyKey: idempotencyKey || null,
        rawRequest: JSON.stringify({ amount, descriptor, accountId: activeAccount.accountId }),
      });

      transferLog(correlationId, 'transfer_ledger_created', { transferId: ledgerEntry.id });

      try {
        const result = await plaidService.createRoundUpTransfer({
          accessToken,
          accountId: activeAccount.accountId,
          amount,
          userLegalName,
          description: descriptor || 'Dime Time roundup',
          correlationId,
          mercuryFundingAccountId: process.env.MERCURY_PLAID_FUNDING_ID || undefined,
        });

        // Update ledger to pending with Plaid IDs
        await storage.updateTransferStatus(ledgerEntry.id, 'pending', {
          plaidTransferId: result.transferId,
          plaidAuthorizationId: result.authorizationId,
          rawResponse: JSON.stringify(result),
        });

        transferLog(correlationId, 'collect_roundup_success', {
          transferId: ledgerEntry.id,
          plaidTransferId: result.transferId,
          status: result.status,
          amount,
        });

        const responseBody = {
          success: true,
          transferId: result.transferId,
          authorizationId: result.authorizationId,
          internalTransferId: ledgerEntry.id,
          status: result.status,
          correlationId,
          message: `Round-up of $${amount.toFixed(2)} initiated — ACH debit from ${activeAccount.institutionName} ••${activeAccount.mask || ''} to Mercury`,
          linkedBank: activeAccount.institutionName,
          amount,
        };

        await saveIdempotency(idempotencyKey, userId, '/api/mercury/collect-roundup', 201, responseBody);
        return res.status(201).json(responseBody);

      } catch (transferErr: any) {
        const errCode: string = transferErr?.response?.data?.error_code || transferErr?.message || 'UNKNOWN';

        await storage.updateTransferStatus(ledgerEntry.id, 'failed', {
          errorCode: errCode,
          errorMessage: transferErr?.message || 'Plaid Transfer failed',
          rawResponse: JSON.stringify(transferErr?.response?.data || {}),
        });

        transferLog(correlationId, 'collect_roundup_failed', {
          transferId: ledgerEntry.id,
          errCode,
          message: transferErr?.message,
        });

        if (/INVALID_PRODUCT|NOT_ENABLED|PRODUCT_NOT_ENABLED/i.test(errCode)) {
          return res.status(503).json({
            success: false,
            status: 'plaid_transfer_not_enabled',
            correlationId,
            message: "Plaid Transfer product not enabled. Enable it in the Plaid Dashboard.",
            detail: errCode,
          });
        }
        if (/authorization denied|UNAUTHORIZED/i.test(errCode)) {
          return res.status(422).json({
            success: false,
            status: 'transfer_not_authorized',
            correlationId,
            message: `Plaid rejected the transfer: ${errCode}`,
          });
        }
        console.error("Plaid Transfer error:", transferErr?.response?.data || transferErr.message);
        return res.status(502).json({
          success: false,
          status: 'transfer_failed',
          correlationId,
          message: "Round-up transfer could not be initiated. Please try again later.",
          detail: errCode,
        });
      }
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("collect-roundup error:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to collect round-up", correlationId });
    }
  });

  // ACH push: Mercury → creditor. Uses server-stored payee routing from debt record only.
  // Client cannot supply recipient routing/account numbers to prevent fund diversion.
  app.post("/api/mercury/pay-debt", async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }

      // Idempotency check
      const replayed = await checkIdempotency(idempotencyKey, userId, '/api/mercury/pay-debt', correlationId, res);
      if (replayed) return;

      const { debtId, amount, descriptor } = payDebtSchema.parse(req.body);

      transferLog(correlationId, 'pay_debt_start', { userId, debtId, amount, idempotencyKey });

      const debt = await storage.getDebt(debtId);
      if (!debt || debt.userId !== userId) {
        return res.status(403).json({ message: "Debt not found or does not belong to this account" });
      }

      const balance = await mercuryService.getAccountBalance();
      if (balance.availableBalance < amount) {
        return res.status(422).json({
          success: false,
          status: 'insufficient_funds',
          correlationId,
          message: `Insufficient Mercury balance. Available: $${balance.availableBalance.toFixed(2)}, Requested: $${amount.toFixed(2)}`,
        });
      }

      const note = descriptor || `Dime Time debt payment — ${debt.name}`;

      if (debt.payeeAccountNumber && debt.payeeRoutingNumber) {
        if (!/^\d{9}$/.test(debt.payeeRoutingNumber)) {
          return res.status(422).json({
            success: false,
            status: 'invalid_payee_routing',
            correlationId,
            message: "Debt record has an invalid payee routing number. An administrator must correct it.",
          });
        }

        // Create transfer ledger record (status: created)
        const ledgerEntry = await storage.createTransfer({
          userId,
          type: 'debt_payment',
          amount: amount.toFixed(2),
          status: 'created',
          debtId,
          correlationId,
          idempotencyKey: idempotencyKey || null,
          rawRequest: JSON.stringify({ debtId, amount, debtName: debt.name }),
        });

        transferLog(correlationId, 'transfer_ledger_created', { transferId: ledgerEntry.id });

        try {
          const transferResult = await mercuryService.initiateTransfer({
            amount,
            note,
            recipientAccountNumber: debt.payeeAccountNumber,
            recipientRoutingNumber: debt.payeeRoutingNumber,
            recipientName: debt.name,
            paymentMethod: 'ach',
            correlationId,
          });

          await storage.updateTransferStatus(ledgerEntry.id, 'pending', {
            mercuryTransferId: transferResult.id,
            rawResponse: JSON.stringify(transferResult),
          });

          transferLog(correlationId, 'pay_debt_success', {
            transferId: ledgerEntry.id,
            mercuryTransferId: transferResult.id,
            status: transferResult.status,
            amount,
          });

          const responseBody = {
            success: true,
            transactionId: transferResult.id,
            internalTransferId: ledgerEntry.id,
            status: transferResult.status,
            correlationId,
            message: `Debt payment of $${amount.toFixed(2)} to ${debt.name} initiated via Mercury ACH`,
            debtName: debt.name,
            amount,
          };

          await saveIdempotency(idempotencyKey, userId, '/api/mercury/pay-debt', 201, responseBody);
          return res.status(201).json(responseBody);

        } catch (transferErr: any) {
          const errCode = transferErr?.response?.data?.errors || transferErr.message || 'UNKNOWN';

          await storage.updateTransferStatus(ledgerEntry.id, 'failed', {
            errorCode: String(errCode),
            errorMessage: transferErr?.message || 'Mercury ACH failed',
            rawResponse: JSON.stringify(transferErr?.response?.data || {}),
          });

          transferLog(correlationId, 'pay_debt_failed', {
            transferId: ledgerEntry.id,
            errCode,
          });

          console.error("Mercury debt payment error:", transferErr?.response?.data || transferErr.message);
          return res.status(502).json({
            success: false,
            status: 'transfer_failed',
            correlationId,
            message: "Mercury ACH transfer failed. Check Mercury account configuration.",
            error: errCode,
          });
        }
      }

      return res.status(202).json({
        success: true,
        transactionId: `debt_queued_${userId}_${Date.now()}`,
        status: 'queued_awaiting_admin_routing',
        correlationId,
        message: `Debt payment of $${amount.toFixed(2)} toward ${debt.name} queued. An administrator must set payee routing details on the debt record before Mercury ACH can execute.`,
        debtName: debt.name,
        amount,
        mercuryBalance: balance.availableBalance,
      });
    } catch (error: any) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("pay-debt error:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to process debt payment", correlationId });
    }
  });
}
