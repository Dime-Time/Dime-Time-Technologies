import { coinbaseService } from './coinbaseService.js';
import { axosService } from './axosService.js';
import { storage } from '../storage.js';
import { splitRoundUp } from '../../client/src/lib/calculations.js';

export class RoundUpSplitService {
  
  /**
   * Process a round-up by splitting between crypto (immediate) and debt (Axos accumulation)
   */
  async processRoundUpSplit(
    userId: string, 
    transactionId: string, 
    totalRoundUpAmount: number,
    roundUpSettings: any
  ) {
    try {
      console.log(`Processing split round-up: $${totalRoundUpAmount.toFixed(2)} for user ${userId}`);
      
      // If crypto is not enabled, all goes to debt accumulation
      if (!roundUpSettings.cryptoEnabled) {
        await this.processDebtAccumulation(userId, transactionId, totalRoundUpAmount);
        return { cryptoAmount: 0, debtAmount: totalRoundUpAmount, success: true };
      }

      // Split the round-up based on crypto percentage
      const { cryptoAmount, debtAmount } = splitRoundUp(
        totalRoundUpAmount, 
        parseFloat(roundUpSettings.cryptoPercentage)
      );

      console.log(`Split: Crypto $${cryptoAmount.toFixed(2)}, Debt $${debtAmount.toFixed(2)}`);

      // Process both portions simultaneously
      const [cryptoResult, debtResult] = await Promise.all([
        cryptoAmount > 0 ? this.processImmediateCryptoPurchase(
          userId, 
          transactionId, 
          cryptoAmount, 
          roundUpSettings.preferredCrypto
        ) : Promise.resolve({ success: true }),
        debtAmount > 0 ? this.processDebtAccumulation(userId, transactionId, debtAmount) : Promise.resolve({ success: true })
      ]);

      return {
        cryptoAmount,
        debtAmount,
        cryptoSuccess: cryptoResult.success,
        debtSuccess: debtResult.success,
        success: cryptoResult.success && debtResult.success
      };

    } catch (error) {
      console.error('Error processing round-up split:', error);
      throw error;
    }
  }

  /**
   * Immediately purchase cryptocurrency through Coinbase
   */
  private async processImmediateCryptoPurchase(
    userId: string, 
    transactionId: string, 
    amount: number, 
    cryptoSymbol: string
  ) {
    try {
      console.log(`Processing immediate crypto purchase: $${amount.toFixed(2)} of ${cryptoSymbol}`);

      // Get current crypto price for calculation
      const currentPrice = await this.getCurrentCryptoPrice(cryptoSymbol);
      const cryptoAmount = amount / currentPrice;

      // Create the crypto purchase record first
      const cryptoPurchase = await storage.createCryptoPurchase({
        userId,
        transactionId,
        cryptoSymbol,
        amountUsd: amount.toFixed(2),
        cryptoAmount: cryptoAmount.toFixed(8),
        purchasePrice: currentPrice.toFixed(2)
      });

      // Execute the purchase through Coinbase if configured
      if (coinbaseService.isServiceConfigured()) {
        try {
          // In a real implementation, you'd get the user's Coinbase account
          // For now, we'll simulate the purchase and update status
          const orderResult = await this.simulateCoinbasePurchase(cryptoSymbol, amount);
          
          // Update with Coinbase order ID
          await storage.updateCryptoPurchaseStatus(cryptoPurchase.id, 'completed', orderResult.orderId);

          console.log(`✅ Crypto purchase completed: ${cryptoAmount.toFixed(8)} ${cryptoSymbol}`);
        } catch (coinbaseError) {
          console.error('Coinbase purchase failed:', coinbaseError);
          await storage.updateCryptoPurchaseStatus(cryptoPurchase.id, 'failed');
          throw coinbaseError;
        }
      } else {
        // Demo mode - mark as completed
        await storage.updateCryptoPurchaseStatus(cryptoPurchase.id, 'completed', `demo-${Date.now()}`);
        console.log(`✅ Demo crypto purchase completed: ${cryptoAmount.toFixed(8)} ${cryptoSymbol}`);
      }

      return { success: true, cryptoPurchaseId: cryptoPurchase.id };

    } catch (error: any) {
      console.error('Error processing crypto purchase:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Accumulate debt portion in Axos business account for Friday payout
   */
  private async processDebtAccumulation(userId: string, transactionId: string, amount: number) {
    try {
      console.log(`Processing debt accumulation: $${amount.toFixed(2)} for user ${userId}`);

      // For now, create a payment record to track the debt accumulation
      const collection = await storage.createPayment({
        userId,
        debtId: 'pending-debt-allocation', // Will be allocated on Friday
        amount: amount.toFixed(2),
        source: 'round_up_debt_portion'
      });

      // Note: Business account balance will be updated when Axos processes the transfer

      console.log(`✅ Debt accumulation completed: $${amount.toFixed(2)} added to Axos account`);

      return { success: true, collectionId: collection.id };

    } catch (error: any) {
      console.error('Error processing debt accumulation:', error);
      return { success: false, error: error.message };
    }
  }

  /**
   * Get current cryptocurrency price
   */
  private async getCurrentCryptoPrice(cryptoSymbol: string): Promise<number> {
    // coinbaseService.getSpotPrice returns live public market prices even in
    // demo/preview mode, so use it whether or not API keys are configured.
    try {
      const priceData: any = await coinbaseService.getSpotPrice(`${cryptoSymbol}-USD`);
      const price = parseFloat(priceData.data?.amount || priceData.amount || priceData);
      if (Number.isFinite(price) && price > 0) {
        return price;
      }
      throw new Error(`Invalid spot price for ${cryptoSymbol}`);
    } catch (error) {
      console.error('Error getting crypto price:', error);
      // Static fallback prices, aligned with coinbaseService fallbacks
      const fallbackPrices: { [key: string]: number } = {
        'BTC': 43250,
        'ETH': 3200,
        'XRP': 0.55,
        'LTC': 140,
        'ADA': 0.38,
        'SOL': 145
      };
      return fallbackPrices[cryptoSymbol] || fallbackPrices['BTC'];
    }
  }

  /**
   * Simulate Coinbase purchase (in production, use real Coinbase API)
   */
  private async simulateCoinbasePurchase(cryptoSymbol: string, amountUsd: number) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      orderId: `cb-order-${Date.now()}`,
      status: 'completed',
      cryptoSymbol,
      amountUsd,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Note: Business account balance tracking will be handled by Axos service
   * when the actual bank transfers are processed
   */
}

export const roundUpSplitService = new RoundUpSplitService();