import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { isAuthenticated } from "./replitAuth";
import { dimeTokenService } from "./services/dimeTokenService";
import { createHash } from "crypto";

import { insertTransactionSchema, insertPaymentSchema, insertDebtSchema, insertCryptoPurchaseSchema, insertRoundUpSettingsSchema, insertContactSubmissionSchema } from "@shared/schema";
import { z } from "zod";
import { plaidService } from "./services/plaidService";
import { coinbaseService } from "./services/coinbaseService";
import { s3Service } from "./services/s3Service";
import { dynamoService } from "./services/dynamoService";
import { axosService } from "./services/axosService";
import { registerAxosRoutes } from "./routes/axosRoutes";
import { registerSilaRoutes } from "./routes/silaRoutes";
import { notificationRoutes } from "./routes/notificationRoutes";
import { notificationService } from "./services/notificationService";
import { notificationTriggers } from "./services/notificationTriggers";
import { roundUpSplitService } from "./services/roundUpSplitService";
import { calculateRoundUp } from "../client/src/lib/calculations";
import multer from "multer";

// Helper function to get authenticated user ID
function getAuthenticatedUserId(req: Request): string | null {
  const authUser = req.user as any;
  return authUser?.claims?.sub || null;
}

// Simple password hashing (use bcrypt in production)
function hashPassword(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

function verifyPassword(password: string, hash: string): boolean {
  return hashPassword(password) === hash;
}

export async function registerRoutes(app: Express): Promise<Server> {

  // Signup endpoint
  app.post("/api/signup", async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = hashPassword(password);
      const user = await storage.createUser({
        email,
        password: hashedPassword,
        firstName: firstName || email.split("@")[0],
        lastName: lastName || "",
      });

      // Initialize user data (debts, roundup settings, etc.)
      await storage.createOrUpdateRoundUpSettings({
        userId: user.id,
        isEnabled: true,
        multiplier: "1.00",
      });

      // Store user session - THIS IS CRITICAL so they're authenticated after signup
      req.session.userId = user.id;
      
      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.status(201).json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
      });
    } catch (error) {
      console.error("Signup error:", error);
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Login endpoint
  app.post("/api/login", async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password || !verifyPassword(password, user.password)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      // Store user session
      req.session.userId = user.id;
      
      // Explicitly save session before responding
      req.session.save((err) => {
        if (err) {
          console.error("Session save error:", err);
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.json({ success: true, user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName } });
      });
    } catch (error) {
      console.error("Login error:", error);
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Get current user 
  app.get("/api/user", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.json(user);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint
  app.get("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true, message: "Logged out successfully" });
    });
  });

  // Contact form submission (public endpoint)
  app.post("/api/contact", async (req: Request, res: Response) => {
    try {
      const validatedData = insertContactSubmissionSchema.parse(req.body);
      const submission = await storage.createContactSubmission(validatedData);
      res.json({ success: true, submission });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid form data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's debts
  app.get("/api/debts", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const debts = await storage.getDebtsByUserId(userId);
      res.json(debts);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's transactions
  app.get("/api/transactions", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const transactions = await storage.getTransactionsByUserId(userId, limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new transaction
  app.post("/api/transactions", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      // Get user's round-up settings to calculate proper round-up with multiplier
      const roundUpSettings = await storage.getRoundUpSettings(userId);
      
      // Calculate round-up with multiplier
      const amount = parseFloat(req.body.amount);
      const multiplier = roundUpSettings ? parseFloat(roundUpSettings.multiplier) : 1.0;
      const totalRoundUp = calculateRoundUp(amount, multiplier);
      
      // Create transaction with calculated round-up
      const validatedData = insertTransactionSchema.parse({
        ...req.body,
        userId,
        roundUpAmount: totalRoundUp.toFixed(2)
      });
      
      const transaction = await storage.createTransaction(validatedData);
      
      // Process round-up split (crypto immediate + debt accumulation) if round-up > 0
      if (totalRoundUp > 0 && roundUpSettings?.isEnabled) {
        try {
          console.log(`🔄 Processing split round-up: $${totalRoundUp.toFixed(2)}`);
          
          const splitResult = await roundUpSplitService.processRoundUpSplit(
            userId,
            transaction.id,
            totalRoundUp,
            roundUpSettings
          );
          
          console.log(`✅ Split processing complete:`, splitResult);
          
          // Trigger round-up notification with split details
          await notificationTriggers.onRoundUpCollected(
            userId, 
            transaction.id, 
            totalRoundUp, 
            transaction.merchant
          );
          
        } catch (splitError) {
          console.error('Error processing round-up split:', splitError);
          // Transaction still succeeds even if split processing fails
        }
      }
      
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's payments
  app.get("/api/payments", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const payments = await storage.getPaymentsByUserId(userId);
      res.json(payments);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new payment
  app.post("/api/payments", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const validatedData = insertPaymentSchema.parse({
        ...req.body,
        userId,
      });
      
      const payment = await storage.createPayment(validatedData);
      
      // Update debt balance
      const debt = await storage.getDebt(validatedData.debtId);
      if (debt) {
        const newBalance = (parseFloat(debt.currentBalance) - parseFloat(validatedData.amount)).toFixed(2);
        await storage.updateDebt(validatedData.debtId, {
          currentBalance: newBalance,
        });

        // Trigger debt payment notification
        await notificationTriggers.onDebtPaymentProcessed(
          userId,
          validatedData.debtId,
          parseFloat(validatedData.amount)
        );
      }
      
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payment data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // One-tap accelerated payment
  app.post("/api/accelerated-payment", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { debtId, amount } = req.body;
      
      if (!debtId || !amount) {
        return res.status(400).json({ message: "debtId and amount are required" });
      }

      const result = await storage.makeAcceleratedPayment(userId, debtId, amount);
      
      res.json({
        success: true,
        payment: result.payment,
        updatedDebt: result.updatedDebt,
        message: `Successfully paid $${amount} toward ${result.updatedDebt.name}`
      });
    } catch (error) {
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get round-up settings
  app.get("/api/round-up-settings", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const settings = await storage.getRoundUpSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update round-up settings
  app.put("/api/round-up-settings", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const settings = await storage.createOrUpdateRoundUpSettings({
        ...req.body,
        userId,
      });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Apply round-ups to debt
  app.post("/api/apply-round-ups", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const { debtId, amount } = req.body;
      
      if (!debtId || !amount) {
        return res.status(400).json({ message: "debtId and amount are required" });
      }

      // Create payment record
      const payment = await storage.createPayment({
        userId,
        debtId,
        amount,
        source: "round_up",
      });

      // Update debt balance
      const debt = await storage.getDebt(debtId);
      if (debt) {
        const newBalance = (parseFloat(debt.currentBalance) - parseFloat(amount)).toFixed(2);
        await storage.updateDebt(debtId, {
          currentBalance: newBalance,
        });
      }

      res.json({ success: true, payment });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get dashboard summary
  app.get("/api/dashboard-summary", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const [debts, transactions, payments] = await Promise.all([
        storage.getDebtsByUserId(userId),
        storage.getTransactionsByUserId(userId),
        storage.getPaymentsByUserId(userId),
      ]);

      const totalDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
      const totalRoundUps = transactions.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount), 0);
      
      // Calculate this month's round-ups
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      
      const thisMonthRoundUps = transactions
        .filter(trans => trans.date >= thisMonth)
        .reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount), 0);

      // Calculate this month's debt payments
      const thisMonthPayments = payments
        .filter(payment => payment.date >= thisMonth)
        .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

      // Calculate progress (simplified)
      const totalOriginalDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.originalBalance), 0);
      const progressPercentage = totalOriginalDebt > 0 
        ? Math.round(((totalOriginalDebt - totalDebt) / totalOriginalDebt) * 100)
        : 0;

      // Estimate debt-free date (simplified calculation)
      const averageMonthlyPayment = thisMonthPayments || 500; // fallback
      const monthsToPayOff = Math.ceil(totalDebt / averageMonthlyPayment);
      const debtFreeDate = new Date();
      debtFreeDate.setMonth(debtFreeDate.getMonth() + monthsToPayOff);

      const summary = {
        totalDebt: totalDebt.toFixed(2),
        totalRoundUps: totalRoundUps.toFixed(2),
        thisMonthRoundUps: thisMonthRoundUps.toFixed(2),
        thisMonthPayments: thisMonthPayments.toFixed(2),
        progressPercentage,
        debtFreeDate: debtFreeDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        debtsCount: debts.length,
      };

      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's crypto purchases
  app.get("/api/crypto-purchases", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const purchases = await storage.getCryptoPurchasesByUserId(userId);
      res.json(purchases);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new crypto purchase with real Coinbase integration
  app.post("/api/crypto-purchases", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { amount, cryptoSymbol = "BTC" } = req.body;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      let purchase;
      
      if (coinbaseService.isServiceConfigured()) {
        try {
          // Get Coinbase accounts to find the primary account
          const accounts = await coinbaseService.getAccounts();
          const primaryAccount = (accounts as any).find((acc: any) => acc.primary) || (accounts as any)[0];
          
          if (primaryAccount) {
            // Execute real crypto purchase through Coinbase
            const coinbaseTransaction = await coinbaseService.buyCrypto(primaryAccount.id, amount, 'USD');
            
            // Store the real purchase in database
            purchase = await storage.createCryptoPurchase({
              userId,
              cryptoSymbol,
              amountUsd: amount,
              cryptoAmount: (coinbaseTransaction as any).amount?.amount || '0',
              purchasePrice: amount,
              coinbaseOrderId: (coinbaseTransaction as any).id || '',
            });

            res.status(201).json({
              ...purchase,
              coinbaseTransaction,
              message: "Real crypto purchase completed via Coinbase"
            });
          } else {
            throw new Error("No Coinbase account found");
          }
        } catch (coinbaseError) {
          console.error("Coinbase purchase failed:", coinbaseError);
          
          // Store failed attempt for tracking
          purchase = await storage.createCryptoPurchase({
            userId,
            cryptoSymbol,
            amountUsd: amount,
            cryptoAmount: '0',
            purchasePrice: amount,
          });

          res.status(503).json({
            ...purchase,
            error: coinbaseError,
            message: "Coinbase purchase failed - check API credentials"
          });
        }
      } else {
        // Demo mode when Coinbase not configured
        const cryptoAmount = (parseFloat(amount) / 50000).toFixed(8);
        purchase = await storage.createCryptoPurchase({
          userId,
          cryptoSymbol,
          amountUsd: amount,
          cryptoAmount,
          purchasePrice: amount,
        });

        res.status(201).json({
          ...purchase,
          message: "Demo purchase - Add Coinbase credentials for real trading"
        });
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid crypto purchase data", errors: error.errors });
      }
      console.error("Error creating crypto purchase:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get crypto portfolio summary
  app.get("/api/crypto-summary", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const purchases = await storage.getCryptoPurchasesByUserId(userId);
      const completedPurchases = purchases.filter(p => p.status === 'completed');
      
      // Group by crypto symbol
      const portfolio = completedPurchases.reduce((acc, purchase) => {
        const symbol = purchase.cryptoSymbol;
        if (!acc[symbol]) {
          acc[symbol] = {
            symbol,
            totalInvested: 0,
            totalCrypto: 0,
            averagePrice: 0,
            purchaseCount: 0
          };
        }
        
        acc[symbol].totalInvested += parseFloat(purchase.amountUsd);
        acc[symbol].totalCrypto += parseFloat(purchase.cryptoAmount);
        acc[symbol].purchaseCount += 1;
        
        return acc;
      }, {} as Record<string, any>);

      // Calculate average prices
      Object.values(portfolio).forEach((coin: any) => {
        coin.averagePrice = coin.totalInvested / coin.totalCrypto;
      });

      const totalInvested = completedPurchases.reduce((sum, p) => sum + parseFloat(p.amountUsd), 0);
      
      res.json({
        portfolio: Object.values(portfolio),
        totalInvested: totalInvested.toFixed(2),
        totalPurchases: completedPurchases.length,
        lastPurchase: completedPurchases[0]?.createdAt || null
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Plaid banking integration routes
  app.post("/api/plaid/create-link-token", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "Plaid service not configured. Please provide PLAID_CLIENT_ID and PLAID_SECRET environment variables.",
          configured: false
        });
      }

      const linkToken = await plaidService.createLinkToken(userId);
      res.json({ linkToken, configured: true });
    } catch (error) {
      console.error('Error creating Plaid link token:', error);
      res.status(500).json({ message: "Failed to create link token" });
    }
  });

  app.post("/api/plaid/exchange-token", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { publicToken } = req.body;

      if (!publicToken) {
        return res.status(400).json({ message: "Public token is required" });
      }

      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }

      const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);
      
      // Get account information
      const accounts = await plaidService.getAccounts(accessToken);
      
      // Store bank account information in storage
      for (const account of accounts) {
        await storage.createBankAccount({
          userId,
          plaidItemId: itemId,
          plaidAccessToken: accessToken,
          accountId: account.account_id,
          accountName: account.name,
          accountType: account.type,
          institutionName: account.name, // You might want to fetch institution details
          mask: account.mask || '',
        });
      }

      res.json({ 
        success: true, 
        accounts: accounts.map(acc => ({
          id: acc.account_id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask
        }))
      });
    } catch (error) {
      console.error('Error exchanging Plaid token:', error);
      res.status(500).json({ message: "Failed to exchange token" });
    }
  });

  app.get("/api/plaid/accounts", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts = await storage.getBankAccountsByUserId(userId);
      res.json(bankAccounts);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      res.status(500).json({ message: "Failed to fetch bank accounts" });
    }
  });

  app.get("/api/plaid/transactions", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts = await storage.getBankAccountsByUserId(userId);
      
      if (bankAccounts.length === 0) {
        return res.json([]);
      }

      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }

      // Get transactions from the last 30 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const allTransactions = [];
      for (const account of bankAccounts) {
        try {
          const transactions = await plaidService.getTransactions(account.plaidAccessToken, startDate, endDate);
          allTransactions.push(...transactions);
        } catch (error) {
          console.error(`Error fetching transactions for account ${account.accountId}:`, error);
        }
      }

      res.json(allTransactions);
    } catch (error) {
      console.error('Error fetching Plaid transactions:', error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/plaid/balances", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts = await storage.getBankAccountsByUserId(userId);
      
      if (bankAccounts.length === 0) {
        return res.json([]);
      }

      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }

      const allBalances = [];
      for (const account of bankAccounts) {
        try {
          const balances = await plaidService.getBalance(account.plaidAccessToken);
          allBalances.push(...balances);
        } catch (error) {
          console.error(`Error fetching balance for account ${account.accountId}:`, error);
        }
      }

      res.json(allBalances);
    } catch (error) {
      console.error('Error fetching account balances:', error);
      res.status(500).json({ message: "Failed to fetch balances" });
    }
  });

  // Coinbase cryptocurrency integration routes
  app.get("/api/coinbase/accounts", async (req: Request, res: Response) => {
    try {
      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "Coinbase service not configured. Please provide COINBASE_API_KEY and COINBASE_API_SECRET environment variables.",
          configured: false
        });
      }

      const accounts = await coinbaseService.getAccounts();
      res.json({ accounts, configured: true });
    } catch (error) {
      console.error('Error fetching Coinbase accounts:', error);
      res.status(500).json({ message: "Failed to fetch Coinbase accounts" });
    }
  });

  app.get("/api/coinbase/prices/:currency?", async (req: Request, res: Response) => {
    try {
      const currency = req.params.currency || 'BTC';
      
      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "Coinbase service not configured",
          configured: false
        });
      }

      const [spotPrice, exchangeRates] = await Promise.all([
        coinbaseService.getSpotPrice(`${currency}-USD`),
        coinbaseService.getExchangeRates(currency)
      ]);

      res.json({ spotPrice, exchangeRates, configured: true });
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      res.status(500).json({ message: "Failed to fetch crypto prices" });
    }
  });

  app.post("/api/coinbase/buy", async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { accountId, amount, currency = 'USD' } = req.body;

      if (!accountId || !amount) {
        return res.status(400).json({ message: "Account ID and amount are required" });
      }

      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({ message: "Coinbase service not configured" });
      }

      const transaction = await coinbaseService.buyCrypto(accountId, amount, currency);
      
      // Store crypto purchase in our database
      await storage.createCryptoPurchase({
        userId,
        cryptoSymbol: 'BTC', // You might want to make this dynamic
        amountUsd: amount,
        cryptoAmount: '0', // Will be updated when transaction completes
        purchasePrice: amount,
        coinbaseOrderId: (transaction as any).id || ''
      });

      res.json({ success: true, transaction });
    } catch (error) {
      console.error('Error buying crypto:', error);
      res.status(500).json({ message: "Failed to purchase cryptocurrency" });
    }
  });

  app.get("/api/coinbase/transactions/:accountId", async (req: Request, res: Response) => {
    try {
      const { accountId } = req.params;

      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({ message: "Coinbase service not configured" });
      }

      const transactions = await coinbaseService.getTransactions(accountId);
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching Coinbase transactions:', error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/service-status", async (req: Request, res: Response) => {
    try {
      const status = {
        plaid: {
          configured: plaidService.isServiceConfigured(),
          status: plaidService.isServiceConfigured() ? 'ready' : 'missing_credentials'
        },
        coinbase: {
          configured: coinbaseService.isServiceConfigured(),
          status: coinbaseService.isServiceConfigured() ? 'ready' : 'missing_credentials'
        }
      };
      res.json(status);
    } catch (error) {
      console.error('Error checking service status:', error);
      res.status(500).json({ message: "Failed to check service status" });
    }
  });

  // Dime Time Token (DTT) API Routes
  app.get('/api/dime-token/info', async (req: Request, res: Response) => {
    try {
      const tokenInfo = await storage.getDttTokenInfo();
      if (!tokenInfo) {
        return res.status(404).json({ message: 'Token information not found' });
      }
      res.json(tokenInfo);
    } catch (error) {
      console.error('Error fetching token info:', error);
      res.status(500).json({ message: 'Failed to fetch token information' });
    }
  });

  app.get('/api/dime-token/balance', async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const holdings = await storage.getDttHoldings(userId);
      
      if (!holdings) {
        // Return default empty balance if user has no holdings yet
        return res.json({
          balance: '0.00000000',
          stakedAmount: '0.00000000',
          totalEarned: '0.00000000'
        });
      }
      
      res.json({
        balance: holdings.balance,
        stakedAmount: holdings.stakedAmount,
        totalEarned: holdings.totalEarned
      });
    } catch (error) {
      console.error('Error fetching token balance:', error);
      res.status(500).json({ message: 'Failed to fetch token balance' });
    }
  });

  app.get('/api/dime-token/rewards', async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const rewards = await storage.getDttRewardsByUserId(userId);
      
      // Transform to match frontend interface
      const formattedRewards = rewards.map(reward => ({
        id: reward.id,
        action: reward.action,
        amount: reward.amount,
        transactionHash: reward.transactionHash || '',
        createdAt: reward.createdAt.toISOString()
      }));
      
      res.json(formattedRewards);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      res.status(500).json({ message: 'Failed to fetch token rewards' });
    }
  });

  app.post('/api/dime-token/stake', async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { amount, duration } = req.body;

      if (!amount || !duration || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: 'Valid amount and duration required' });
      }

      // Check if user has sufficient balance
      const holdings = await storage.getDttHoldings(userId);
      if (!holdings || parseFloat(holdings.balance) < parseFloat(amount)) {
        return res.status(400).json({ message: 'Insufficient DTT balance for staking' });
      }

      // Calculate APY based on duration
      let apy = "5.00000000"; // Base 5% APY
      if (parseInt(duration) >= 90) apy = "15.50000000"; // 90+ days = 15.5% APY
      else if (parseInt(duration) >= 30) apy = "10.00000000"; // 30+ days = 10% APY

      // Create staking record
      const endDate = new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1000);
      const staking = await storage.createDttStaking({
        userId,
        amount: amount,
        duration: parseInt(duration),
        apy: apy,
        endDate: endDate,
        rewardsEarned: "0.00000000",
        status: "active",
      });

      res.json({
        ...staking,
        message: `Successfully staked ${amount} DTT for ${duration} days at ${parseFloat(apy).toFixed(1)}% APY`
      });
    } catch (error) {
      console.error('Error staking tokens:', error);
      res.status(500).json({ message: 'Failed to stake tokens' });
    }
  });

  app.get('/api/dime-token/trading-pairs', async (req: Request, res: Response) => {
    try {
      const tradingPairs = dimeTokenService.getTradingPairs();
      res.json(tradingPairs);
    } catch (error) {
      console.error('Error fetching trading pairs:', error);
      res.status(500).json({ message: 'Failed to fetch trading pairs' });
    }
  });

  // Award DTT tokens for user actions (called internally)
  app.post('/api/dime-token/award', async (req: Request, res: Response) => {
    try {
      const { userId, action, amount } = req.body;
      
      const reward = await dimeTokenService.awardTokens(userId || "demo-user-1", action, amount);
      res.json(reward);
    } catch (error) {
      console.error('Error awarding tokens:', error);
      res.status(500).json({ message: 'Failed to award tokens' });
    }
  });

  // Configure multer for file uploads (in-memory storage)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // AWS S3 File Upload Routes
  app.post("/api/aws/upload", upload.single('file'), async (req: Request, res: Response) => {
    try {
      const userId = (req.session as any)?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const documentType = req.body.documentType || 'other';
      
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      if (!s3Service.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "S3 service not configured. Please provide AWS credentials.",
          configured: false
        });
      }

      const fileUrl = await s3Service.uploadUserDocument(
        userId, 
        req.file.originalname, 
        req.file.buffer, 
        documentType as 'receipt' | 'statement' | 'profile' | 'other'
      );

      res.json({
        success: true,
        fileUrl,
        fileName: req.file.originalname,
        documentType,
        message: "File uploaded successfully to S3"
      });
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.get("/api/aws/files/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const documentType = req.query.type as string;

      if (!s3Service.isServiceConfigured()) {
        return res.status(503).json({ message: "S3 service not configured" });
      }

      const files = await s3Service.listUserFiles(userId, documentType);
      res.json({ files });
    } catch (error) {
      console.error('Error listing user files:', error);
      res.status(500).json({ message: "Failed to list files" });
    }
  });

  app.post("/api/aws/backup-user-data", async (req: Request, res: Response) => {
    try {
      const userId = "demo-user-1";
      
      if (!s3Service.isServiceConfigured()) {
        return res.status(503).json({ message: "S3 service not configured" });
      }

      // Gather all user data
      const [debts, transactions, payments, cryptoPurchases] = await Promise.all([
        storage.getDebtsByUserId(userId),
        storage.getTransactionsByUserId(userId),
        storage.getPaymentsByUserId(userId),
        storage.getCryptoPurchasesByUserId(userId),
      ]);

      const userData = {
        userId,
        backupDate: new Date().toISOString(),
        data: {
          debts,
          transactions,
          payments,
          cryptoPurchases,
        }
      };

      const backupUrl = await s3Service.backupUserData(userId, userData);
      
      res.json({
        success: true,
        backupUrl,
        message: "User data backed up successfully to S3"
      });
    } catch (error) {
      console.error('Error backing up user data:', error);
      res.status(500).json({ message: "Failed to backup user data" });
    }
  });

  // AWS DynamoDB Routes (for migration or parallel storage)
  app.post("/api/aws/sync-to-dynamo", async (req: Request, res: Response) => {
    try {
      const userId = "demo-user-1";

      if (!dynamoService.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "DynamoDB service not configured. Please provide AWS credentials.",
          configured: false
        });
      }

      // Sync transactions to DynamoDB
      const transactions = await storage.getTransactionsByUserId(userId);
      const syncResults = await Promise.all(
        transactions.map(transaction => 
          dynamoService.createTransaction(transaction)
        )
      );

      res.json({
        success: true,
        syncedCount: syncResults.length,
        message: "Financial data synced to DynamoDB successfully"
      });
    } catch (error) {
      console.error('Error syncing to DynamoDB:', error);
      res.status(500).json({ message: "Failed to sync data to DynamoDB" });
    }
  });

  app.get("/api/aws/service-status", async (req: Request, res: Response) => {
    try {
      const status = {
        s3: {
          configured: s3Service.isServiceConfigured(),
          status: s3Service.isServiceConfigured() ? 'ready' : 'missing_credentials'
        },
        dynamodb: {
          configured: dynamoService.isServiceConfigured(),
          status: dynamoService.isServiceConfigured() ? 'ready' : 'missing_credentials'
        },
        plaid: {
          configured: plaidService.isServiceConfigured(),
          status: plaidService.isServiceConfigured() ? 'ready' : 'missing_credentials'
        },
        coinbase: {
          configured: coinbaseService.isServiceConfigured(),
          status: coinbaseService.isServiceConfigured() ? 'ready' : 'missing_credentials'
        }
      };
      res.json(status);
    } catch (error) {
      console.error('Error checking AWS service status:', error);
      res.status(500).json({ message: "Failed to check AWS service status" });
    }
  });

  // Register Axos Bank integration routes
  registerAxosRoutes(app);

  // Register Sila Money integration routes  
  registerSilaRoutes(app);

  // Register notification routes
  app.use(notificationRoutes);

  const httpServer = createServer(app);
  return httpServer;
}

// ... ADD THESE ENDPOINTS BEFORE THE FINAL RETURN ...

// NO WAIT - I need to properly insert these. Let me use a different approach.
