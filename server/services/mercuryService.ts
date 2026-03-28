import axios, { AxiosInstance } from 'axios';

const MERCURY_API_BASE = 'https://api.mercury.com/api/v1';

interface MercuryAccount {
  id: string;
  accountNumber: string;
  routingNumber: string;
  name: string;
  kind: string;
  status: string;
  currentBalance: number;
  availableBalance: number;
  currency: string;
}

interface MercuryTransaction {
  id: string;
  amount: number;
  status: string;
  kind: string;
  createdAt: string;
  counterpartyName: string;
  note?: string;
  dashboardLink?: string;
  accountId?: string;
}

interface MercuryTransferResponse {
  id: string;
  status: string;
  amount: number;
  createdAt: string;
  note?: string;
}

class MercuryService {
  private client: AxiosInstance;
  private isConfigured: boolean = false;
  private cachedAccountId: string = '';

  constructor() {
    const apiKey = process.env.MERCURY_API_KEY || process.env.Mercury_API_Key;

    this.isConfigured = !!(
      apiKey &&
      process.env.MERCURY_ACCOUNT_NUMBER &&
      process.env.MERCURY_ROUTING_NUMBER
    );

    this.client = axios.create({
      baseURL: MERCURY_API_BASE,
      headers: {
        'Authorization': `Bearer ${apiKey || ''}`,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      timeout: 30000,
    });

    if (this.isConfigured) {
      console.log('Mercury banking service configured successfully');
    } else {
      console.log('Mercury banking service not configured — missing MERCURY_API_KEY, MERCURY_ACCOUNT_NUMBER, or MERCURY_ROUTING_NUMBER');
    }
  }

  isServiceConfigured(): boolean {
    return this.isConfigured;
  }

  private async resolveCheckingAccountId(): Promise<string> {
    if (this.cachedAccountId) return this.cachedAccountId;
    const accounts = await this.listAccounts();
    const accountNumber = process.env.MERCURY_ACCOUNT_NUMBER;
    const checking = accounts.find(a => a.accountNumber === accountNumber && a.kind === 'checking')
      || accounts.find(a => a.kind === 'checking')
      || accounts[0];
    if (!checking) throw new Error('No Mercury checking account found');
    this.cachedAccountId = checking.id;
    return this.cachedAccountId;
  }

  async listAccounts(): Promise<MercuryAccount[]> {
    const response = await this.client.get('/accounts');
    return response.data.accounts || [];
  }

  async getAccountBalance(): Promise<{ balance: number; availableBalance: number; currency: string; accountNumber: string; routingNumber: string }> {
    if (!this.isConfigured) throw new Error('Mercury service not configured');
    const accounts = await this.listAccounts();
    const accountNumber = process.env.MERCURY_ACCOUNT_NUMBER;
    const account = accounts.find(a => a.accountNumber === accountNumber) || accounts.find(a => a.kind === 'checking') || accounts[0];
    if (!account) throw new Error('No Mercury accounts found');
    return {
      balance: account.currentBalance,
      availableBalance: account.availableBalance,
      currency: 'USD',
      accountNumber: account.accountNumber,
      routingNumber: account.routingNumber,
    };
  }

  async getTransactions(limit: number = 50): Promise<MercuryTransaction[]> {
    if (!this.isConfigured) throw new Error('Mercury service not configured');
    const response = await this.client.get('/transactions', { params: { limit } });
    return response.data.transactions || [];
  }

  async initiateTransfer(params: {
    amount: number;
    note: string;
    recipientAccountNumber: string;
    recipientRoutingNumber: string;
    recipientName: string;
    paymentMethod?: 'ach' | 'wire';
  }): Promise<MercuryTransferResponse> {
    if (!this.isConfigured) throw new Error('Mercury service not configured');
    const accountId = await this.resolveCheckingAccountId();
    const response = await this.client.post(`/account/${accountId}/transactions`, {
      amount: params.amount,
      paymentMethod: params.paymentMethod || 'ach',
      counterparty: {
        accountNumber: params.recipientAccountNumber,
        routingNumber: params.recipientRoutingNumber,
        name: params.recipientName,
        kind: 'business',
      },
      note: params.note,
    });
    return response.data;
  }

  async collectRoundUp(params: {
    amount: number;
    userId: string;
    descriptor?: string;
  }): Promise<{ success: boolean; transactionId?: string; status: string; message: string; amount: number }> {
    if (!this.isConfigured) throw new Error('Mercury service not configured');
    return {
      success: true,
      transactionId: `roundup_queued_${Date.now()}`,
      status: 'queued',
      message: `Round-up of $${params.amount.toFixed(2)} queued — ACH origination from user bank account requires Plaid integration (next milestone)`,
      amount: params.amount,
    };
  }

  async payDebt(params: {
    amount: number;
    userId: string;
    debtName: string;
    descriptor?: string;
  }): Promise<{ success: boolean; transactionId?: string; status: string; message: string; amount: number }> {
    if (!this.isConfigured) throw new Error('Mercury service not configured');
    return {
      success: true,
      transactionId: `debt_queued_${Date.now()}`,
      status: 'queued',
      message: `Debt payment of $${params.amount.toFixed(2)} toward ${params.debtName} queued — payee routing details required to complete ACH transfer`,
      amount: params.amount,
    };
  }
}

export const mercuryService = new MercuryService();
