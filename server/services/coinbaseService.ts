import axios from 'axios';

interface CoinbaseAccount {
  id: string;
  name: string;
  primary: boolean;
  type: string;
  currency: string;
  balance: {
    amount: string;
    currency: string;
  };
}

interface CoinbaseTransaction {
  id: string;
  type: string;
  status: string;
  amount: {
    amount: string;
    currency: string;
  };
  native_amount: {
    amount: string;
    currency: string;
  };
  description: string;
  created_at: string;
  updated_at: string;
}

/**
 * Crypto Preview service.
 *
 * Dime Time's crypto experience is a labeled Preview: market prices are REAL
 * (Coinbase's public, unauthenticated price API) and every "purchase" is
 * SIMULATED. This service deliberately contains no authenticated Coinbase
 * client and reads no API credentials:
 *
 * - The company's Coinbase Advanced Trade API key must NEVER be used for
 *   customer purchases. Routing customer buys through a single
 *   company-controlled account (pooled custody) was permanently rejected
 *   (founder decision 2026-07-25 — see .agents/memory/coinbase-crypto-preview.md).
 * - Real crypto, when it ships, will go through a licensed partner
 *   (per-user OAuth or embedded brokerage) as a separate, explicitly
 *   approved integration. Do not re-add company-key trading here.
 */
class CoinbaseService {
  // Purchases are always simulated in Preview. Real crypto will be a new,
  // provider-approved integration — not a flip of this flag.
  private demoMode: boolean = true;

  // Live public market prices (no auth required) so Preview mode shows real
  // prices while purchases stay simulated. Cached so round-up processing
  // never waits on repeated price lookups.
  private static readonly FALLBACK_USD_PRICES: Record<string, number> = {
    BTC: 43250, ETH: 3200, ADA: 0.38, SOL: 145, XRP: 0.55, LTC: 140,
  };
  private spotPriceCache = new Map<string, { price: number; fetchedAt: number }>();
  private static readonly SPOT_CACHE_TTL_MS = 60_000;
  private inflightSpotFetches = new Map<string, Promise<number | null>>();

  constructor() {
    console.log('✅ Crypto Preview service initialized — live public prices, simulated purchases, no API credentials used');
    this.warmSpotPriceCache();
  }

  /**
   * Pre-warm the public price cache for the coins offered in the app so the
   * first round-up after boot never waits on a network price lookup.
   */
  private warmSpotPriceCache(): void {
    for (const symbol of ['BTC', 'ETH', 'ADA', 'SOL']) {
      void this.fetchAndCacheSpotPrice(`${symbol}-USD`);
    }
  }

  /**
   * Fetch + cache a live public spot price. Never throws; returns null on
   * failure. Concurrent calls for the same pair share one request.
   */
  private fetchAndCacheSpotPrice(pair: string): Promise<number | null> {
    const existing = this.inflightSpotFetches.get(pair);
    if (existing) {
      return existing;
    }
    const fetchPromise = (async () => {
      try {
        const resp = await axios.get(`https://api.coinbase.com/v2/prices/${pair}/spot`, { timeout: 4000 });
        const price = parseFloat(resp.data?.data?.amount);
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error('Invalid price payload from Coinbase public API');
        }
        this.spotPriceCache.set(pair, { price, fetchedAt: Date.now() });
        return price;
      } catch (error) {
        console.warn(`Coinbase public price fetch failed for ${pair}:`, error instanceof Error ? error.message : error);
        return null;
      } finally {
        this.inflightSpotFetches.delete(pair);
      }
    })();
    this.inflightSpotFetches.set(pair, fetchPromise);
    return fetchPromise;
  }

  /**
   * Live spot price from Coinbase's public (unauthenticated) price API,
   * used in Preview mode so users see real market prices even though
   * purchases are simulated. Designed to never block the round-up hot path:
   * a fresh or stale cached price is returned immediately (stale triggers a
   * background refresh); only the very first lookup for a pair awaits the
   * network, and it degrades to a static fallback on failure.
   */
  private async getPublicSpotPrice(currencyPair: string): Promise<{ amount: string; currency: string }> {
    const pair = currencyPair.toUpperCase();
    const base = pair.split('-')[0] || 'BTC';
    const formatUsd = (p: number) => (p >= 1 ? p.toFixed(2) : p.toFixed(6));
    const cached = this.spotPriceCache.get(pair);

    if (cached) {
      if (Date.now() - cached.fetchedAt >= CoinbaseService.SPOT_CACHE_TTL_MS) {
        // Stale: serve immediately, refresh in the background
        void this.fetchAndCacheSpotPrice(pair);
      }
      return { amount: formatUsd(cached.price), currency: 'USD' };
    }

    // Cold path (first lookup for this pair since boot): await one fetch
    const price = await this.fetchAndCacheSpotPrice(pair);
    if (price !== null) {
      return { amount: formatUsd(price), currency: 'USD' };
    }
    const fallback = CoinbaseService.FALLBACK_USD_PRICES[base] ?? CoinbaseService.FALLBACK_USD_PRICES.BTC;
    return { amount: formatUsd(fallback), currency: 'USD' };
  }

  /**
   * Generate a simulated Bitcoin purchase for Preview mode
   */
  private generateDemoPurchase(amount: string, currency: string = 'USD'): CoinbaseTransaction {
    const btcPrice = 43250.00; // Simulated BTC price
    const usdAmount = parseFloat(amount);
    const btcAmount = usdAmount / btcPrice;

    return {
      id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: 'buy',
      status: 'completed',
      amount: {
        amount: btcAmount.toFixed(8),
        currency: 'BTC',
      },
      native_amount: {
        amount: amount,
        currency: currency,
      },
      description: `Demo purchase of ${btcAmount.toFixed(8)} BTC`,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
  }

  async getAccounts(): Promise<CoinbaseAccount[]> {
    // Preview: simulated wallet accounts only
    return [
      {
        id: 'demo_btc_account',
        name: 'Bitcoin Wallet',
        primary: true,
        type: 'wallet',
        currency: 'BTC',
        balance: { amount: '0.00125000', currency: 'BTC' }
      },
      {
        id: 'demo_usd_account',
        name: 'USD Wallet',
        primary: false,
        type: 'fiat',
        currency: 'USD',
        balance: { amount: '50.00', currency: 'USD' }
      }
    ];
  }

  async getAccount(accountId: string): Promise<CoinbaseAccount> {
    // Preview: simulated wallet account only
    return {
      id: accountId,
      name: 'Demo Bitcoin Wallet',
      primary: true,
      type: 'wallet',
      currency: 'BTC',
      balance: { amount: '0.00125000', currency: 'BTC' }
    };
  }

  async buyCrypto(_accountId: string, amount: string, currency: string = 'USD') {
    // Always simulated — no authenticated client exists in this service.
    console.log(`[PREVIEW] Simulating BTC purchase of ${amount} ${currency} — no real money moves`);
    return this.generateDemoPurchase(amount, currency);
  }

  async getExchangeRates(currency: string = 'BTC') {
    // Preview mode: derive the USD rate from the live public spot price
    // instead of advertising stale hardcoded numbers.
    const spot = await this.getPublicSpotPrice(`${currency}-USD`);
    return {
      currency: currency,
      rates: {
        USD: spot.amount
      }
    };
  }

  async getSpotPrice(currencyPair: string = 'BTC-USD') {
    // Preview mode: real market price, simulated trading
    return this.getPublicSpotPrice(currencyPair);
  }

  async getTransactions(_accountId: string): Promise<CoinbaseTransaction[]> {
    // Preview: simulated purchase history only
    return [
      {
        id: 'demo_tx_1',
        type: 'buy',
        status: 'completed',
        amount: { amount: '0.00023100', currency: 'BTC' },
        native_amount: { amount: '10.00', currency: 'USD' },
        description: 'Demo round-up purchase',
        created_at: new Date(Date.now() - 86400000).toISOString(),
        updated_at: new Date(Date.now() - 86400000).toISOString()
      },
      {
        id: 'demo_tx_2',
        type: 'buy',
        status: 'completed',
        amount: { amount: '0.00011550', currency: 'BTC' },
        native_amount: { amount: '5.00', currency: 'USD' },
        description: 'Demo round-up purchase',
        created_at: new Date(Date.now() - 172800000).toISOString(),
        updated_at: new Date(Date.now() - 172800000).toISOString()
      }
    ];
  }

  /**
   * Preview mode needs no credentials, so the service is always "configured".
   * Kept for call-site compatibility (routes and round-up split gate on it).
   */
  isServiceConfigured(): boolean {
    return true;
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }
}

export const coinbaseService = new CoinbaseService();
