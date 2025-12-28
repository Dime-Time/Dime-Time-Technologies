import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from 'plaid';

class PlaidService {
  private client: PlaidApi | null = null;
  private isConfigured: boolean = false;

  constructor() {
    try {
      const configuration = new Configuration({
        basePath: PlaidEnvironments.sandbox, // Use sandbox for development
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': process.env.PLAID_SECRET,
          },
        },
      });
      this.client = new PlaidApi(configuration);
      this.isConfigured = !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
    } catch (error) {
      console.error('Failed to initialize Plaid service:', error);
      this.isConfigured = false;
    }
  }

  private getClient(): PlaidApi {
    if (!this.client) {
      throw new Error('Plaid client not initialized');
    }
    return this.client;
  }

  async createLinkToken(userId: string) {
    if (!this.isConfigured) {
      throw new Error('Plaid service not configured. Please provide PLAID_CLIENT_ID and PLAID_SECRET environment variables.');
    }

    try {
      const linkTokenRequest: any = {
        user: { client_user_id: userId },
        client_name: 'Dime Time',
        products: [Products.Transactions, Products.Auth],
        country_codes: [CountryCode.Us],
        language: 'en',
      };
      
      // Only include redirect_uri if properly configured (not a placeholder)
      const redirectUri = process.env.PLAID_REDIRECT_URI;
      if (redirectUri && !redirectUri.includes('your-domain') && redirectUri.startsWith('https://')) {
        linkTokenRequest.redirect_uri = redirectUri;
      }
      
      const response = await this.getClient().linkTokenCreate(linkTokenRequest);
      return response.data.link_token;
    } catch (error) {
      console.error('Error creating link token:', error);
      throw error;
    }
  }

  async exchangePublicToken(publicToken: string) {
    if (!this.isConfigured) {
      throw new Error('Plaid service not configured');
    }

    try {
      const response = await this.getClient().itemPublicTokenExchange({
        public_token: publicToken,
      });
      return {
        accessToken: response.data.access_token,
        itemId: response.data.item_id,
      };
    } catch (error) {
      console.error('Error exchanging public token:', error);
      throw error;
    }
  }

  async getAccounts(accessToken: string) {
    if (!this.isConfigured) {
      throw new Error('Plaid service not configured');
    }

    try {
      const response = await this.getClient().accountsGet({
        access_token: accessToken,
      });
      return response.data.accounts;
    } catch (error) {
      console.error('Error fetching accounts:', error);
      throw error;
    }
  }

  async getTransactions(accessToken: string, startDate: string, endDate: string) {
    if (!this.isConfigured) {
      throw new Error('Plaid service not configured');
    }

    try {
      const response = await this.getClient().transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate,
      });
      return response.data.transactions;
    } catch (error) {
      console.error('Error fetching transactions:', error);
      throw error;
    }
  }

  async getBalance(accessToken: string) {
    if (!this.isConfigured) {
      throw new Error('Plaid service not configured');
    }

    try {
      const response = await this.getClient().accountsBalanceGet({
        access_token: accessToken,
      });
      return response.data.accounts;
    } catch (error) {
      console.error('Error fetching balance:', error);
      throw error;
    }
  }

  isServiceConfigured(): boolean {
    return this.isConfigured;
  }
}

export const plaidService = new PlaidService();