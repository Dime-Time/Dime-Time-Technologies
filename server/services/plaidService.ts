import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  CountryCode,
  Products,
  TransferAuthorizationCreateRequest,
  TransferCreateRequest,
  TransferType,
  TransferNetwork,
  ACHClass,
} from 'plaid';

function resolvePlaidEnvironment(): string {
  const env = process.env.PLAID_ENV || 'sandbox';
  switch (env.toLowerCase()) {
    case 'production': return PlaidEnvironments.production;
    case 'development': return PlaidEnvironments.development;
    default: return PlaidEnvironments.sandbox;
  }
}

/**
 * Plaid issues DIFFERENT secrets per environment. Sandbox testing uses
 * PLAID_SECRET; production mode requires PLAID_SECRET_PRODUCTION (same
 * pattern as STRIPE_SECRET_KEY / STRIPE_SECRET_KEY_TEST). No fallback:
 * if PLAID_ENV=production and the production secret is missing, the
 * service reports unconfigured rather than silently calling production
 * with a sandbox secret.
 */
function resolvePlaidSecret(): string | undefined {
  const env = (process.env.PLAID_ENV || 'sandbox').toLowerCase();
  if (env === 'production') {
    if (!process.env.PLAID_SECRET_PRODUCTION) {
      console.error(
        '[PlaidService] PLAID_ENV=production but PLAID_SECRET_PRODUCTION is not set. ' +
        'Plaid will be unavailable. Set the production secret from the Plaid dashboard (Team Settings → Keys).'
      );
      return undefined;
    }
    return process.env.PLAID_SECRET_PRODUCTION;
  }
  return process.env.PLAID_SECRET;
}

function maskToken(token: string): string {
  if (!token || token.length < 8) return '[masked]';
  return `${token.slice(0, 8)}...[masked]`;
}

import { setCorrelationTag } from '../lib/sentry';

function log(correlationId: string, event: string, data?: Record<string, unknown>): void {
  setCorrelationTag(correlationId);
  const entry: Record<string, unknown> = {
    ts: new Date().toISOString(),
    service: 'PlaidService',
    correlationId,
    event,
    ...data,
  };
  console.log(JSON.stringify(entry));
}

class PlaidService {
  private client: PlaidApi | null = null;
  private isConfigured: boolean = false;
  private environment: string;

  constructor() {
    this.environment = process.env.PLAID_ENV || 'sandbox';
    try {
      const plaidSecret = resolvePlaidSecret();
      const configuration = new Configuration({
        basePath: resolvePlaidEnvironment(),
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
            'PLAID-SECRET': plaidSecret,
          },
        },
      });
      this.client = new PlaidApi(configuration);
      this.isConfigured = !!(process.env.PLAID_CLIENT_ID && plaidSecret);
      if (this.isConfigured) {
        console.log(`Plaid service initialized in ${this.environment} environment`);
      }
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

  async getAccountAuth(accessToken: string): Promise<{ accountId: string; accountNumber: string; routingNumber: string; name: string }[]> {
    if (!this.isConfigured) {
      throw new Error('Plaid service not configured');
    }
    try {
      const response = await this.getClient().authGet({ access_token: accessToken });
      const numbers = response.data.numbers.ach || [];
      return numbers.map((n: any) => ({
        accountId: n.account_id,
        accountNumber: n.account,
        routingNumber: n.routing,
        name: response.data.accounts.find((a: any) => a.account_id === n.account_id)?.name || 'Bank Account',
      }));
    } catch (error) {
      console.error('Error fetching Plaid Auth:', error);
      throw error;
    }
  }

  /**
   * Validate that funding account configuration is present for production.
   * Fails explicitly if MERCURY_PLAID_FUNDING_ID is missing in production.
   */
  private validateFundingAccountConfig(correlationId: string): string | undefined {
    const fundingId = process.env.MERCURY_PLAID_FUNDING_ID;
    if (!fundingId) {
      if (this.environment === 'production') {
        log(correlationId, 'funding_account_missing', {
          severity: 'ERROR',
          message: 'MERCURY_PLAID_FUNDING_ID is not set. This is required in production to route Plaid Transfer funds to Mercury. Set this env var to the Mercury Plaid funding account ID.',
        });
        throw new Error(
          '[PlaidService] MERCURY_PLAID_FUNDING_ID is required in production for Plaid Transfer to route funds to Mercury. ' +
          'Set this env var to the funding account ID provided by Plaid for your Mercury account.'
        );
      }
      log(correlationId, 'funding_account_not_set', {
        severity: 'WARN',
        message: 'MERCURY_PLAID_FUNDING_ID not set — funds will route to Plaid default funding account. Set this for Mercury in production.',
      });
    }
    return fundingId || undefined;
  }

  /**
   * Initiate an ACH debit from the user's linked bank account via Plaid Transfer.
   * Structured reconciliation logging included throughout.
   * Flow: transferAuthorizationCreate → transferCreate → return ids
   */
  async createRoundUpTransfer(params: {
    accessToken: string;
    accountId: string;
    amount: number;
    userLegalName: string;
    description: string;
    correlationId: string;
    mercuryFundingAccountId?: string;
  }): Promise<{ transferId: string; authorizationId: string; status: string }> {
    if (!this.isConfigured) {
      throw new Error('Plaid service not configured');
    }
    const { correlationId } = params;
    const client = this.getClient();

    const fundingAccountId = params.mercuryFundingAccountId ?? this.validateFundingAccountConfig(correlationId);

    log(correlationId, 'transfer_auth_request', {
      accountId: params.accountId,
      amount: params.amount,
      amountStr: params.amount.toFixed(2),
      userLegalName: params.userLegalName,
      accessToken: maskToken(params.accessToken),
      fundingAccountId: fundingAccountId || 'not_set',
    });

    const authRequest: TransferAuthorizationCreateRequest = {
      access_token: params.accessToken,
      account_id: params.accountId,
      type: TransferType.Debit,
      network: TransferNetwork.Ach,
      amount: params.amount.toFixed(2),
      ach_class: ACHClass.Ppd,
      user: { legal_name: params.userLegalName },
      ...(fundingAccountId ? { funding_account_id: fundingAccountId } : {}),
    };

    const authResponse = await client.transferAuthorizationCreate(authRequest);
    const authorization = authResponse.data.authorization;

    log(correlationId, 'transfer_auth_response', {
      authorizationId: authorization.id,
      decision: authorization.decision,
      decisionRationaleCode: authorization.decision_rationale?.code,
      decisionRationaleDescription: authorization.decision_rationale?.description,
    });

    if (authorization.decision !== 'approved') {
      throw new Error(
        `Plaid Transfer authorization denied: ${authorization.decision_rationale?.code || 'UNKNOWN'} — ${authorization.decision_rationale?.description || ''}`
      );
    }

    const createRequest: TransferCreateRequest = {
      access_token: params.accessToken,
      account_id: params.accountId,
      authorization_id: authorization.id,
      description: params.description.slice(0, 15),
    };

    log(correlationId, 'transfer_create_request', {
      authorizationId: authorization.id,
      description: createRequest.description,
    });

    const transferResponse = await client.transferCreate(createRequest);
    const transfer = transferResponse.data.transfer;

    log(correlationId, 'transfer_create_response', {
      transferId: transfer.id,
      status: transfer.status,
      amount: transfer.amount,
      network: transfer.network,
    });

    return {
      transferId: transfer.id,
      authorizationId: authorization.id,
      status: transfer.status,
    };
  }

  /**
   * Create a Link token scoped to the Liabilities product ONLY.
   * This deliberately creates a SEPARATE Plaid item from the bank-connect flow
   * (which uses Transactions + Auth) so importing debts never forces the user to
   * re-consent their linked funding bank. Used by the automatic debt-import flow.
   */
  async createLiabilitiesLinkToken(userId: string): Promise<string> {
    if (!this.isConfigured) {
      throw new Error('Plaid service not configured. Please provide PLAID_CLIENT_ID and PLAID_SECRET environment variables.');
    }
    try {
      const linkTokenRequest: any = {
        user: { client_user_id: userId },
        client_name: 'Dime Time',
        products: [Products.Liabilities],
        country_codes: [CountryCode.Us],
        language: 'en',
      };

      const redirectUri = process.env.PLAID_REDIRECT_URI;
      if (redirectUri && !redirectUri.includes('your-domain') && redirectUri.startsWith('https://')) {
        linkTokenRequest.redirect_uri = redirectUri;
      }

      const response = await this.getClient().linkTokenCreate(linkTokenRequest);
      return response.data.link_token;
    } catch (error) {
      console.error('Error creating liabilities link token:', this.redactPlaidError(error));
      throw error;
    }
  }

  /**
   * Fetch the raw Liabilities payload for a Plaid item (credit cards, student
   * loans, mortgages) alongside the accounts they belong to. Callers normalize
   * this into NormalizedLiability[] — the raw shape never leaks into the app.
   */
  async getLiabilities(accessToken: string) {
    if (!this.isConfigured) {
      throw new Error('Plaid service not configured');
    }
    try {
      const response = await this.getClient().liabilitiesGet({ access_token: accessToken });
      return {
        accounts: response.data.accounts,
        liabilities: response.data.liabilities,
        item: response.data.item,
      };
    } catch (error) {
      console.error('Error fetching liabilities:', this.redactPlaidError(error));
      throw error;
    }
  }

  /**
   * Remove a Plaid item (best-effort teardown when a user disconnects debt import).
   */
  async removeItem(accessToken: string): Promise<void> {
    if (!this.isConfigured) {
      throw new Error('Plaid service not configured');
    }
    await this.getClient().itemRemove({ access_token: accessToken });
  }

  /**
   * Extract ONLY non-sensitive fields from a Plaid/axios error for logging.
   * Plaid errors are axios errors whose `config` contains the request body
   * (public_token / access_token) and the PLAID-SECRET header — never log those.
   */
  private redactPlaidError(error: any): Record<string, unknown> {
    const data = error?.response?.data;
    if (data && typeof data === 'object') {
      return {
        error_code: data.error_code,
        error_type: data.error_type,
        request_id: data.request_id,
      };
    }
    return { message: error instanceof Error ? error.message : String(error) };
  }

  isServiceConfigured(): boolean {
    return this.isConfigured;
  }
}

export const plaidService = new PlaidService();
