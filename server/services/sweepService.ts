/**
 * Sweep Account Management Service
 * Handles round-up collection, interest calculation, and weekly debt dispersals
 */

import { storage } from "../storage";
import { createJPMorganService } from "./jpMorganService";
import { isFlagEnabled } from "../lib/flags";
import type { InsertSweepDeposit, InsertWeeklyDispersal } from "@shared/schema";

export class SweepService {
  private jpMorgan = createJPMorganService();

  /**
   * Process round-up amount - deposit to sweep account
   */
  async processRoundUp(userId: string, transactionId: string, roundUpAmount: number): Promise<void> {
    try {
      // Get user's sweep account
      const sweepAccount = await storage.getUserSweepAccount(userId);
      if (!sweepAccount) {
        throw new Error('No sweep account found for user');
      }

      // Deposit to JP Morgan sweep account
      const depositResult = await this.jpMorgan.depositRoundUp(
        sweepAccount.jpMorganAccountId,
        roundUpAmount,
        `round-up-${transactionId}`
      );

      // Record the deposit in our database
      const sweepDeposit: InsertSweepDeposit = {
        userId,
        sweepAccountId: sweepAccount.id,
        transactionId,
        roundUpAmount: roundUpAmount.toString(),
        interestEarned: "0.000000",
        status: "collected"
      };

      await storage.createSweepDeposit(sweepDeposit);

      // Update sweep account balance
      await storage.updateSweepAccountBalance(
        sweepAccount.id,
        (parseFloat(sweepAccount.currentBalance) + roundUpAmount).toString()
      );

      console.log(`[Sweep] Processed $${roundUpAmount} round-up for user ${userId}`);
    } catch (error) {
      console.error('[Sweep] Failed to process round-up:', error);
      throw error;
    }
  }

  /**
   * Calculate and apply daily interest to all sweep accounts
   */
  async calculateDailyInterest(): Promise<void> {
    try {
      const sweepAccounts = await storage.getAllActiveSweepAccounts();
      
      for (const account of sweepAccounts) {
        const principal = parseFloat(account.currentBalance);
        const annualRate = parseFloat(account.interestRate);
        
        // Calculate daily interest
        const dailyInterest = await this.jpMorgan.calculateDailyInterest(
          account.jpMorganAccountId,
          principal,
          annualRate
        );

        // Update account balance with interest
        const newBalance = principal + dailyInterest;
        await storage.updateSweepAccountBalance(account.id, newBalance.toString());

        // Update deposits with accrued interest
        await storage.addInterestToDeposits(account.id, dailyInterest);

        console.log(`[Sweep] Applied $${dailyInterest.toFixed(6)} daily interest to account ${account.id}`);
      }
    } catch (error) {
      console.error('[Sweep] Failed to calculate daily interest:', error);
      throw error;
    }
  }

  /**
   * Process weekly dispersals (every Friday)
   */
  async processWeeklyDispersals(): Promise<void> {
    // MONEY-MOVEMENT GUARD. Automated weekly dispersals move real funds to
    // debts. They are OFF unless ENABLE_AUTO_ROUNDUP_SWEEPS is explicitly on,
    // so the public can never have funds auto-dispersed by default — even if a
    // scheduler or admin trigger fires.
    if (!isFlagEnabled("ENABLE_AUTO_ROUNDUP_SWEEPS")) {
      console.warn(
        "[Sweep] processWeeklyDispersals skipped — ENABLE_AUTO_ROUNDUP_SWEEPS is OFF (no money moved)",
      );
      return;
    }
    try {
      const sweepAccounts = await storage.getAllActiveSweepAccounts();
      
      for (const account of sweepAccounts) {
        const balance = parseFloat(account.currentBalance);
        
        // Only disperse if there's a significant balance
        if (balance < 5.00) {
          continue;
        }

        // Get user's highest priority debt
        const targetDebt = await storage.getUserHighestPriorityDebt(account.userId);
        if (!targetDebt) {
          console.log(`[Sweep] No debts found for user ${account.userId}`);
          continue;
        }

        // Calculate principal vs interest portions
        const deposits = await storage.getUserSweepDeposits(account.id);
        const principalAmount = deposits.reduce((sum, deposit) => 
          sum + parseFloat(deposit.roundUpAmount), 0
        );
        const interestAmount = balance - principalAmount;

        // Initiate dispersal through JP Morgan
        const dispersalResult = await this.jpMorgan.disperseToDebtPayment({
          fromAccount: account.jpMorganAccountId,
          toAccount: targetDebt.accountNumber,
          amount: balance,
          reference: `weekly-dispersal-${new Date().toISOString().split('T')[0]}`,
          description: `Weekly debt payment for ${targetDebt.name}`
        });

        // Record the dispersal
        const dispersal: InsertWeeklyDispersal = {
          userId: account.userId,
          sweepAccountId: account.id,
          dispersalDate: new Date(),
          totalAmount: balance.toString(),
          principalAmount: principalAmount.toString(),
          interestAmount: interestAmount.toString(),
          targetDebtId: targetDebt.id,
          jpMorganTransactionId: dispersalResult.transactionId,
          status: dispersalResult.status
        };

        await storage.createWeeklyDispersal(dispersal);

        // Create payment record
        await storage.createPayment({
          userId: account.userId,
          debtId: targetDebt.id,
          amount: balance.toString(),
          source: 'sweep_dispersal'
        });

        // Update debt balance
        const newDebtBalance = parseFloat(targetDebt.currentBalance) - balance;
        await storage.updateDebtBalance(targetDebt.id, Math.max(0, newDebtBalance).toString());

        // Reset sweep account balance
        await storage.updateSweepAccountBalance(account.id, "0.00");

        // Mark deposits as dispersed
        await storage.markDepositsAsDispersed(account.id);

        console.log(`[Sweep] Dispersed $${balance} to debt ${targetDebt.name} for user ${account.userId}`);
      }
    } catch (error) {
      console.error('[Sweep] Failed to process weekly dispersals:', error);
      throw error;
    }
  }

  /**
   * Get sweep account summary for user
   */
  async getUserSweepSummary(userId: string): Promise<{
    account: any;
    currentBalance: number;
    weeklyProjection: number;
    interestEarned: number;
    nextDispersalDate: Date;
  } | null> {
    try {
      const account = await storage.getUserSweepAccount(userId);
      if (!account) {
        return null;
      }

      const deposits = await storage.getUserSweepDeposits(account.id);
      const interestEarned = deposits.reduce((sum, deposit) => 
        sum + parseFloat(deposit.interestEarned), 0
      );

      // Calculate next Friday
      const now = new Date();
      const daysUntilFriday = (5 - now.getDay() + 7) % 7 || 7;
      const nextDispersalDate = new Date(now);
      nextDispersalDate.setDate(now.getDate() + daysUntilFriday);

      // Estimate weekly projection based on recent activity
      const weeklyProjection = deposits.length > 0 ? 
        deposits.slice(-7).reduce((sum, deposit) => sum + parseFloat(deposit.roundUpAmount), 0) : 0;

      return {
        account,
        currentBalance: parseFloat(account.currentBalance),
        weeklyProjection,
        interestEarned,
        nextDispersalDate
      };
    } catch (error) {
      console.error('[Sweep] Failed to get user summary:', error);
      throw error;
    }
  }
}

export const sweepService = new SweepService();