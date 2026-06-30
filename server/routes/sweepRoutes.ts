import type { Express } from "express";
import { storage } from "../storage";
import { sweepService } from "../services/sweepService";
import { getUserIdFromRequest } from "../middleware/authHelper";
import { requireAdmin } from "../lib/admin";

export function registerSweepRoutes(app: Express) {
  // Get user's sweep account summary
  app.get("/api/sweep/summary", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const summary = await sweepService.getUserSweepSummary(userId);

      if (!summary) {
        return res.status(404).json({ message: "No sweep account found" });
      }

      res.json(summary);
    } catch (error) {
      console.error("Error fetching sweep summary:", error);
      res.status(500).json({ message: "Failed to fetch sweep summary" });
    }
  });

  // Create new sweep account for user
  app.post("/api/sweep/account", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });

      // Create JP Morgan sweep account
      const jpMorganService = await import("../services/jpMorganService").then(m => m.createJPMorganService());
      const accountDetails = await jpMorganService.createSweepAccount(userId, {
        accountType: "sweep",
        initialDeposit: 0,
      });

      // Store in our database
      const sweepAccount = await storage.createSweepAccount({
        userId,
        jpMorganAccountId: accountDetails.accountId,
        accountNumber: accountDetails.accountNumber,
        routingNumber: accountDetails.routingNumber,
        accountType: "sweep",
        currentBalance: "0.00",
        interestRate: "0.0225", // 2.25%
        status: "active",
      });

      res.json(sweepAccount);
    } catch (error) {
      console.error("Error creating sweep account:", error);
      res.status(500).json({ message: "Failed to create sweep account" });
    }
  });

  // Get sweep deposits history
  app.get("/api/sweep/deposits", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const sweepAccount = await storage.getUserSweepAccount(userId);

      if (!sweepAccount) {
        return res.status(404).json({ message: "No sweep account found" });
      }

      const deposits = await storage.getUserSweepDeposits(sweepAccount.id);
      res.json(deposits);
    } catch (error) {
      console.error("Error fetching deposits:", error);
      res.status(500).json({ message: "Failed to fetch deposits" });
    }
  });

  // Get weekly dispersals history
  app.get("/api/sweep/dispersals", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const dispersals = await storage.getWeeklyDispersalsByUser(userId);
      res.json(dispersals);
    } catch (error) {
      console.error("Error fetching dispersals:", error);
      res.status(500).json({ message: "Failed to fetch dispersals" });
    }
  });

  // Manual trigger for weekly dispersal (admin only). Real money movement is
  // additionally gated behind ENABLE_AUTO_ROUNDUP_SWEEPS inside the service, so
  // this is a no-op unless that flag is explicitly enabled.
  app.post("/api/sweep/disperse", requireAdmin, async (req, res) => {
    try {
      await sweepService.processWeeklyDispersals();
      res.json({ message: "Weekly dispersals processed successfully" });
    } catch (error) {
      console.error("Error processing dispersals:", error);
      res.status(500).json({ message: "Failed to process dispersals" });
    }
  });

  // Manual trigger for daily interest calculation (admin only)
  app.post("/api/sweep/calculate-interest", requireAdmin, async (req, res) => {
    try {
      await sweepService.calculateDailyInterest();
      res.json({ message: "Daily interest calculated successfully" });
    } catch (error) {
      console.error("Error calculating interest:", error);
      res.status(500).json({ message: "Failed to calculate interest" });
    }
  });
}
