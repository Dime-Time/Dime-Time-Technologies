import axios, { AxiosInstance, AxiosRequestConfig } from 'axios';
import crypto from 'crypto';
import { z } from 'zod';

// Input validation schemas
const accountIdSchema = z.string().min(1);
const amountSchema = z.string().regex(/^\d+(\.\d+)?$/);
const currencySchema = z.string().min(1).max(10);

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

class CoinbaseApiClient {
  private axiosClient: AxiosInstance;
  private apiKey: string;
  private apiSecret: string;
  private passphrase: string;
  private baseURL = 'https://api.coinbase.com';
  private apiVersion = '2021-06-14';

  constructor(apiKey: string, apiSecret: string, passphrase: string = '') {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.passphrase = passphrase;
    
    this.axiosClient = axios.create({
      baseURL: this.baseURL,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        'CB-VERSION': this.apiVersion,
      },
    });

    // Add request interceptor for authentication
    this.axiosClient.interceptors.request.use((config) => {
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const method = (config.method || 'GET').toUpperCase();
      const requestPath = config.url || '';
      const body = config.data ? JSON.stringify(config.data) : '';

      const signature = this.generateSignature(timestamp, method, requestPath, body);

      Object.assign(config.headers || {}, {
        'CB-ACCESS-KEY': this.apiKey,
        'CB-ACCESS-SIGN': signature,
        'CB-ACCESS-TIMESTAMP': timestamp,
        'CB-ACCESS-PASSPHRASE': this.passphrase,
      });

      return config;
    });
  }

  /**
   * Generate HMAC signature for Coinbase API authentication
   */
  private generateSignature(timestamp: string, method: string, requestPath: string, body: string): string {
    try {
      // Create the prehash string
      const message = timestamp + method + requestPath + body;
      
      // Decode the base64 secret
      const key = Buffer.from(this.apiSecret, 'base64');
      
      // Create HMAC SHA-256 signature
      const hmac = crypto.createHmac('sha256', key);
      const signature = hmac.update(message, 'utf8').digest('base64');
      
      return signature;
    } catch (error) {
      console.error('Error generating HMAC signature:', error);
      throw new Error('Failed to generate API signature');
    }
  }

  /**
   * Make authenticated API request
   */
  private async makeRequest<T>(method: string, endpoint: string, data?: any): Promise<T> {
    try {
      const config: AxiosRequestConfig = {
        method: method.toLowerCase() as any,
        url: endpoint,
      };

      if (data) {
        config.data = data;
      }

      const response = await this.axiosClient.request<{ data: T }>(config);
      return response.data.data;
    } catch (error: any) {
      if (error.response) {
        const errorData = error.response.data;
        console.error('Coinbase API Error:', {
          status: error.response.status,
          statusText: error.response.statusText,
          data: errorData,
        });
        throw new Error(
          `Coinbase API Error: ${error.response.status} - ${errorData?.message || error.response.statusText}`
        );
      } else if (error.request) {
        console.error('Network Error:', error.message);
        throw new Error('Network error - Unable to connect to Coinbase API');
      } else {
        console.error('Request Error:', error.message);
        throw new Error(`Request error: ${error.message}`);
      }
    }
  }

  /**
   * Get all user accounts
   */
  async getAccounts(): Promise<CoinbaseAccount[]> {
    return this.makeRequest<CoinbaseAccount[]>('GET', '/v2/accounts');
  }

  /**
   * Get specific account by ID
   */
  async getAccount(accountId: string): Promise<CoinbaseAccount> {
    const validatedId = accountIdSchema.parse(accountId);
    return this.makeRequest<CoinbaseAccount>('GET', `/v2/accounts/${validatedId}`);
  }

  /**
   * Buy cryptocurrency
   */
  async buyCrypto(accountId: string, amount: string, currency: string = 'USD'): Promise<CoinbaseTransaction> {
    const validatedId = accountIdSchema.parse(accountId);
    const validatedAmount = amountSchema.parse(amount);
    const validatedCurrency = currencySchema.parse(currency);

    const buyData = {
      amount: validatedAmount,
      currency: validatedCurrency,
      commit: true,
    };

    return this.makeRequest<CoinbaseTransaction>('POST', `/v2/accounts/${validatedId}/buys`, buyData);
  }

  /**
   * Get exchange rates
   */
  async getExchangeRates(currency: string = 'BTC'): Promise<any> {
    const validatedCurrency = currencySchema.parse(currency);
    return this.makeRequest<any>('GET', `/v2/exchange-rates?currency=${validatedCurrency}`);
  }

  /**
   * Get spot price for currency pair
   */
  async getSpotPrice(currencyPair: string = 'BTC-USD'): Promise<any> {
    const validatedPair = z.string().min(1).parse(currencyPair);
    return this.makeRequest<any>('GET', `/v2/prices/${validatedPair}/spot`);
  }

  /**
   * Get account transactions
   */
  async getTransactions(accountId: string): Promise<CoinbaseTransaction[]> {
    const validatedId = accountIdSchema.parse(accountId);
    return this.makeRequest<CoinbaseTransaction[]>('GET', `/v2/accounts/${validatedId}/transactions`);
  }
}

class CoinbaseService {
  private client: CoinbaseApiClient | null = null;
  private isConfigured: boolean = false;
  private demoMode: boolean = true; // Always use demo mode for user safety

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
    try {
      if (process.env.COINBASE_API_KEY && process.env.COINBASE_API_SECRET) {
        this.client = new CoinbaseApiClient(
          process.env.COINBASE_API_KEY,
          process.env.COINBASE_API_SECRET,
          process.env.COINBASE_PASSPHRASE || ''
        );
        this.isConfigured = true;
        console.log('✅ Coinbase service initialized with secure API client (DEMO MODE - no real trades)');
        this.warmSpotPriceCache();
      } else {
        this.isConfigured = false;
        console.log('⚠️  Coinbase service not configured - missing API credentials');
      }
    } catch (error) {
      console.error('Failed to initialize Coinbase service:', error);
      this.isConfigured = false;
    }
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
   * used in demo/preview mode so users see real market prices even though
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
   * Generate a simulated Bitcoin purchase for demo mode
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
    if (this.demoMode) {
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

    if (!this.isConfigured || !this.client) {
      throw new Error('Coinbase service not configured. Please provide COINBASE_API_KEY and COINBASE_API_SECRET environment variables.');
    }

    try {
      const accounts = await this.client.getAccounts();
      return accounts;
    } catch (error) {
      console.error('Error fetching Coinbase accounts:', error);
      throw error;
    }
  }

  async getAccount(accountId: string): Promise<CoinbaseAccount> {
    if (this.demoMode) {
      return {
        id: accountId,
        name: 'Demo Bitcoin Wallet',
        primary: true,
        type: 'wallet',
        currency: 'BTC',
        balance: { amount: '0.00125000', currency: 'BTC' }
      };
    }

    if (!this.isConfigured || !this.client) {
      throw new Error('Coinbase service not configured');
    }

    try {
      const account = await this.client.getAccount(accountId);
      return account;
    } catch (error) {
      console.error('Error fetching Coinbase account:', error);
      throw error;
    }
  }

  async buyCrypto(accountId: string, amount: string, currency: string = 'USD') {
    // Always use demo mode for user safety - no real trades
    if (this.demoMode) {
      console.log(`[DEMO MODE] Simulating BTC purchase of ${amount} ${currency}`);
      return this.generateDemoPurchase(amount, currency);
    }

    if (!this.isConfigured || !this.client) {
      throw new Error('Coinbase service not configured');
    }

    try {
      const transaction = await this.client.buyCrypto(accountId, amount, currency);
      return transaction;
    } catch (error) {
      console.error('Error buying crypto:', error);
      throw error;
    }
  }

  async getExchangeRates(currency: string = 'BTC') {
    if (this.demoMode) {
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

    if (!this.isConfigured || !this.client) {
      throw new Error('Coinbase service not configured');
    }

    try {
      const rates = await this.client.getExchangeRates(currency);
      return rates;
    } catch (error) {
      console.error('Error fetching exchange rates:', error);
      throw error;
    }
  }

  async getSpotPrice(currencyPair: string = 'BTC-USD') {
    if (this.demoMode) {
      // Preview mode: real market price, simulated trading
      return this.getPublicSpotPrice(currencyPair);
    }

    if (!this.isConfigured || !this.client) {
      throw new Error('Coinbase service not configured');
    }

    try {
      const price = await this.client.getSpotPrice(currencyPair);
      return price;
    } catch (error) {
      console.error('Error fetching spot price:', error);
      throw error;
    }
  }

  async getTransactions(accountId: string): Promise<CoinbaseTransaction[]> {
    if (this.demoMode) {
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

    if (!this.isConfigured || !this.client) {
      throw new Error('Coinbase service not configured');
    }

    try {
      const transactions = await this.client.getTransactions(accountId);
      return transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  isDemoMode(): boolean {
    return this.demoMode;
  }
}

export const coinbaseService = new CoinbaseService();