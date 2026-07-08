import type { Express, Request, Response } from "express";
import { axosService } from "../services/axosService";
import { 
  insertRoundUpCollectionSchema, 
  insertWeeklyDistributionSchema,
  insertDistributionPaymentSchema,
  insertInterestEarningsSchema
} from "@shared/schema";
import { z } from "zod";
import { getUserIdFromRequest } from "../middleware/authHelper";
import { requireAdmin } from "../lib/admin";

export function registerAxosRoutes(app: Express) {
  
  // Get business account status and balance
  app.get("/api/axos/business-account", requireAdmin, async (req: Request, res: Response) => {
    try {
      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "Axos service not configured. Please provide AXOS_API_KEY, AXOS_CLIENT_ID, and AXOS_BUSINESS_ACCOUNT_ID environment variables.",
          configured: false
        });
      }

      const account = await axosService.getBusinessAccount();
      res.json({ 
        account, 
        configured: true,
        message: "Business account details retrieved successfully"
      });
    } catch (error) {
      console.error('Error fetching business account:', error);
      res.status(500).json({ message: "Failed to fetch business account details" });
    }
  });

  // Collect round-up from user account
  app.post("/api/axos/collect-roundup", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { userAccountId, userRoutingNumber, amount, transactionId } = req.body;

      if (!userAccountId || !userRoutingNumber || !amount) {
        return res.status(400).json({ 
          message: "userAccountId, userRoutingNumber, and amount are required" 
        });
      }

      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ message: "Axos service not configured" });
      }

      // Process ACH transfer via Axos
      const achTransfer = await axosService.collectRoundUp(
        userAccountId,
        userRoutingNumber,
        amount,
        `Round-up collection for transaction ${transactionId || 'manual'}`
      );

      // Store collection record in database (would use storage service in real implementation)
      const collectionData = {
        userId,
        transactionId: transactionId || null,
        amount,
        userAccountId,
        userRoutingNumber,
        businessAccountId: axosService.getBusinessAccountId(),
        axosTransferId: achTransfer.id,
        status: achTransfer.status,
        effectiveDate: new Date(achTransfer.effectiveDate),
      };

      res.status(201).json({
        success: true,
        achTransfer,
        collectionData,
        message: `Successfully collected $${amount} round-up from user account`
      });
    } catch (error) {
      console.error('Error collecting round-up:', error);
      res.status(500).json({ message: "Failed to collect round-up" });
    }
  });

  // Process weekly bulk debt payments (Friday distribution)
  app.post("/api/axos/weekly-distribution", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { payments } = req.body;

      if (!payments || !Array.isArray(payments) || payments.length === 0) {
        return res.status(400).json({ 
          message: "Payments array is required and must contain at least one payment" 
        });
      }

      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ message: "Axos service not configured" });
      }

      // Validate payment structure
      const paymentSchema = z.object({
        userId: z.string(),
        debtAccountId: z.string(),
        debtRoutingNumber: z.string(),
        amount: z.string(),
        debtName: z.string()
      });

      try {
        payments.forEach(payment => paymentSchema.parse(payment));
      } catch (validationError) {
        return res.status(400).json({ 
          message: "Invalid payment data structure",
          errors: validationError
        });
      }

      // Process bulk payment through Axos
      const bulkPayment = await axosService.processBulkWeeklyPayments(payments);

      // Calculate total amount and interest
      const totalAmount = payments.reduce((sum, payment) => 
        sum + parseFloat(payment.amount), 0);
      const interestEarned = await axosService.calculateInterestEarned(
        totalAmount.toFixed(2), 
        7 // 7 days for weekly calculation
      );

      res.status(201).json({
        success: true,
        bulkPayment,
        totalAmount: totalAmount.toFixed(2),
        paymentCount: payments.length,
        interestEarned,
        message: `Successfully scheduled ${payments.length} debt payments for Friday distribution`
      });
    } catch (error) {
      console.error('Error processing weekly distribution:', error);
      res.status(500).json({ message: "Failed to process weekly distribution" });
    }
  });

  // Pay individual user debt
  app.post("/api/axos/pay-debt", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { userId, debtAccountId, debtRoutingNumber, amount, debtName } = req.body;

      if (!userId || !debtAccountId || !debtRoutingNumber || !amount || !debtName) {
        return res.status(400).json({ 
          message: "userId, debtAccountId, debtRoutingNumber, amount, and debtName are required" 
        });
      }

      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ message: "Axos service not configured" });
      }

      const achTransfer = await axosService.payUserDebt(
        debtAccountId,
        debtRoutingNumber,
        amount,
        userId,
        debtName
      );

      res.status(201).json({
        success: true,
        achTransfer,
        message: `Successfully initiated payment of $${amount} to ${debtName}`
      });
    } catch (error) {
      console.error('Error paying user debt:', error);
      res.status(500).json({ message: "Failed to pay user debt" });
    }
  });

  // Get transfer status
  app.get("/api/axos/transfer/:transferId", requireAdmin, async (req: Request, res: Response) => {
    try {
      const { transferId } = req.params;

      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ message: "Axos service not configured" });
      }

      const transfer = await axosService.getTransferStatus(transferId);
      res.json(transfer);
    } catch (error) {
      console.error('Error fetching transfer status:', error);
      res.status(500).json({ message: "Failed to fetch transfer status" });
    }
  });

  // Get business account transaction history
  app.get("/api/axos/transactions", requireAdmin, async (req: Request, res: Response) => {
    try {
      const startDate = req.query.start_date as string || 
        new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      const endDate = req.query.end_date as string || 
        new Date().toISOString().split('T')[0];
      const limit = parseInt(req.query.limit as string) || 100;

      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ message: "Axos service not configured" });
      }

      const transactions = await axosService.getAccountTransactions(startDate, endDate, limit);
      res.json({
        transactions,
        startDate,
        endDate,
        count: transactions.length
      });
    } catch (error) {
      console.error('Error fetching account transactions:', error);
      res.status(500).json({ message: "Failed to fetch account transactions" });
    }
  });

  // Calculate interest earned on business account
  app.post("/api/axos/calculate-interest", async (req: Request, res: Response) => {
    try {
      const { principalAmount, days = 7 } = req.body;

      if (!principalAmount) {
        return res.status(400).json({ message: "principalAmount is required" });
      }

      const interestEarned = await axosService.calculateInterestEarned(
        principalAmount, 
        parseInt(days)
      );

      res.json({
        principalAmount,
        days: parseInt(days),
        interestRate: "4.00%",
        interestEarned,
        annualizedReturn: (parseFloat(interestEarned) * (365 / parseInt(days))).toFixed(2)
      });
    } catch (error) {
      console.error('Error calculating interest:', error);
      res.status(500).json({ message: "Failed to calculate interest" });
    }
  });

  // Get next Friday date for weekly distributions
  app.get("/api/axos/next-friday", async (req: Request, res: Response) => {
    try {
      const today = new Date();
      const dayOfWeek = today.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      const nextFriday = new Date(today);
      nextFriday.setDate(today.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
      
      res.json({
        today: today.toISOString().split('T')[0],
        nextFriday: nextFriday.toISOString().split('T')[0],
        daysUntilFriday: daysUntilFriday === 0 ? 7 : daysUntilFriday,
        message: "Next weekly distribution date"
      });
    } catch (error) {
      console.error('Error calculating next Friday:', error);
      res.status(500).json({ message: "Failed to calculate next Friday" });
    }
  });

  // Check Axos service configuration and status
  app.get("/api/axos/status", requireAdmin, async (req: Request, res: Response) => {
    try {
      const configured = axosService.isServiceConfigured();
      const businessAccountId = axosService.getBusinessAccountId();
      
      let account = null;
      if (configured) {
        try {
          account = await axosService.getBusinessAccount();
        } catch (error) {
          console.log('Business account fetch failed during status check:', error);
        }
      }

      res.json({
        configured,
        businessAccountId: configured ? businessAccountId : 'Not configured',
        account: account ? {
          balance: account.balance,
          interestRate: account.interestRate,
          accountType: account.type
        } : null,
        features: {
          roundUpCollection: configured,
          weeklyDistribution: configured,
          interestCalculation: true,
          achTransfers: configured
        },
        nextDistribution: configured ? await calculateNextFriday() : null
      });
    } catch (error) {
      console.error('Error checking Axos status:', error);
      res.status(500).json({ message: "Failed to check Axos service status" });
    }
  });
}

// Helper function for next Friday calculation
async function calculateNextFriday(): Promise<string> {
  const today = new Date();
  const dayOfWeek = today.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
  return nextFriday.toISOString().split('T')[0];
}