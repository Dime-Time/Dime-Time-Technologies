import { 
  type User, 
  type InsertUser, 
  type Debt, 
  type InsertDebt, 
  type Transaction, 
  type InsertTransaction, 
  type Payment, 
  type InsertPayment, 
  type RoundUpSettings, 
  type InsertRoundUpSettings, 
  type CryptoPurchase, 
  type InsertCryptoPurchase, 
  type BankAccount, 
  type InsertBankAccount, 
  type UserSession, 
  type InsertUserSession,
  type Notification,
  type InsertNotification,
  type NotificationSettings,
  type InsertNotificationSettings,
  type DttHoldings,
  type InsertDttHoldings,
  type DttRewards,
  type InsertDttRewards,
  type DttStaking,
  type InsertDttStaking,
  type DttTokenInfo,
  type InsertDttTokenInfo,
  type ContactSubmission,
  type InsertContactSubmission,
  type Transfer,
  type InsertTransfer,
  type PasswordResetToken,
  type InsertPasswordResetToken,
  passwordResetTokens,
  type EmailVerificationToken,
  type InsertEmailVerificationToken,
  emailVerificationTokens,
  users, 
  debts, 
  transactions, 
  payments, 
  roundUpSettings, 
  cryptoPurchases, 
  bankAccounts, 
  userSessions,
  notifications,
  notificationSettings,
  dttHoldings,
  dttRewards,
  dttStaking,
  dttTokenInfo,
  contactSubmissions,
  roundUpCollections,
  distributionPayments,
  sweepAccounts,
  sweepDeposits,
  weeklyDispersals,
  idempotencyKeys,
  transfers
} from "@shared/schema";
import { encryptToken, decryptToken } from "./services/encryptionService";
import { randomUUID } from "crypto";
import { db } from "./db";
import { eq, desc, and, sql } from "drizzle-orm";

export interface IStorage {
  // User methods
  getUser(id: string): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  upsertUser(user: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User>;

  // Debt methods
  getDebtsByUserId(userId: string): Promise<Debt[]>;
  getDebt(id: string): Promise<Debt | undefined>;
  createDebt(debt: InsertDebt): Promise<Debt>;
  updateDebt(id: string, updates: Partial<Debt>): Promise<Debt | undefined>;

  // Transaction methods
  getTransactionsByUserId(userId: string, limit?: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;

  // Payment methods
  getPaymentsByUserId(userId: string): Promise<Payment[]>;
  getPaymentsByDebtId(debtId: string): Promise<Payment[]>;
  createPayment(payment: InsertPayment): Promise<Payment>;
  makeAcceleratedPayment(userId: string, debtId: string, amount: string): Promise<{ payment: Payment; updatedDebt: Debt }>;

  // Round-up settings methods
  getRoundUpSettings(userId: string): Promise<RoundUpSettings | undefined>;
  createOrUpdateRoundUpSettings(settings: InsertRoundUpSettings): Promise<RoundUpSettings>;

  // Crypto purchase methods
  getCryptoPurchasesByUserId(userId: string): Promise<CryptoPurchase[]>;
  createCryptoPurchase(purchase: InsertCryptoPurchase): Promise<CryptoPurchase>;
  updateCryptoPurchaseStatus(id: string, status: string, coinbaseOrderId?: string): Promise<CryptoPurchase | undefined>;

  // Bank account methods
  getBankAccountsByUserId(userId: string): Promise<BankAccount[]>;
  createBankAccount(account: InsertBankAccount): Promise<BankAccount>;
  getBankAccountByPlaidItemId(itemId: string): Promise<BankAccount | undefined>;
  updateBankAccountStatus(id: string, isActive: boolean): Promise<BankAccount | undefined>;

  // User session methods
  createUserSession(session: InsertUserSession): Promise<UserSession>;

  // DTT Token methods
  getDttHoldings(userId: string): Promise<DttHoldings | undefined>;
  createOrUpdateDttHoldings(holdings: InsertDttHoldings): Promise<DttHoldings>;
  updateDttBalance(userId: string, balance: string, stakedAmount?: string, totalEarned?: string): Promise<DttHoldings | undefined>;
  
  getDttRewardsByUserId(userId: string): Promise<DttRewards[]>;
  createDttReward(reward: InsertDttRewards): Promise<DttRewards>;
  
  getDttStakingByUserId(userId: string): Promise<DttStaking[]>;
  createDttStaking(staking: InsertDttStaking): Promise<DttStaking>;
  updateDttStakingStatus(id: string, status: string): Promise<DttStaking | undefined>;
  
  getDttTokenInfo(): Promise<DttTokenInfo | undefined>;
  updateDttTokenInfo(info: InsertDttTokenInfo): Promise<DttTokenInfo>;
  getUserSessionByToken(token: string): Promise<UserSession | undefined>;
  updateSessionActivity(id: string): Promise<UserSession | undefined>;
  deactivateUserSessions(userId: string, deviceType?: string): Promise<void>;

  // Notification methods
  createNotification(notification: InsertNotification): Promise<Notification>;
  getNotificationsByUserId(userId: string, limit?: number): Promise<Notification[]>;
  updateNotificationStatus(id: string, status: string, sentAt?: Date, deliveredAt?: Date): Promise<Notification | undefined>;
  
  // Notification settings methods
  getNotificationSettings(userId: string): Promise<NotificationSettings | undefined>;
  createOrUpdateNotificationSettings(settings: InsertNotificationSettings): Promise<NotificationSettings>;

  // Contact submission methods
  createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission>;
  getContactSubmissions(): Promise<ContactSubmission[]>;

  // Security methods
  updateUserPassword(userId: string, passwordHash: string, algo: string): Promise<void>;
  deleteUserAccount(userId: string): Promise<void>;

  // Idempotency methods
  getIdempotencyKey(key: string, userId: string, endpoint: string): Promise<{ responseStatus: number; responseBody: string } | undefined>;
  createIdempotencyKey(data: { idempotencyKey: string; userId: string; endpoint: string; responseStatus: number; responseBody: string }): Promise<void>;

  // Transfer ledger methods
  createTransfer(data: InsertTransfer): Promise<Transfer>;
  getTransfer(id: string): Promise<Transfer | undefined>;
  getTransferByCorrelationId(correlationId: string): Promise<Transfer | undefined>;
  getTransferByPlaidTransferId(plaidTransferId: string): Promise<Transfer | undefined>;
  updateTransferStatus(id: string, status: string, updates?: Partial<Pick<Transfer, 'plaidTransferId' | 'plaidAuthorizationId' | 'mercuryTransferId' | 'errorCode' | 'errorMessage' | 'rawResponse'>>): Promise<Transfer | undefined>;
  getTransfersByUserId(userId: string): Promise<Transfer[]>;

  // Encrypted bank account token methods
  getPlaidAccessToken(bankAccountId: string): Promise<string | undefined>;

  // Password reset token methods
  createPasswordResetToken(data: InsertPasswordResetToken): Promise<PasswordResetToken>;
  consumePasswordResetToken(tokenHash: string): Promise<PasswordResetToken | undefined>;
  invalidatePasswordResetTokensForUser(userId: string): Promise<void>;
  invalidateAllUserSessions(userId: string): Promise<void>;

  // Email verification token methods
  createEmailVerificationToken(data: InsertEmailVerificationToken): Promise<EmailVerificationToken>;
  consumeEmailVerificationToken(tokenHash: string): Promise<EmailVerificationToken | undefined>;
  invalidateEmailVerificationTokensForUser(userId: string): Promise<void>;
  markUserEmailVerified(userId: string, when?: Date): Promise<void>;
}

export class MemStorage implements IStorage {
  private users: Map<string, User>;
  private debts: Map<string, Debt>;
  private transactions: Map<string, Transaction>;
  private payments: Map<string, Payment>;
  private roundUpSettings: Map<string, RoundUpSettings>;
  private cryptoPurchases: Map<string, CryptoPurchase>;
  private bankAccounts: Map<string, BankAccount>;
  private userSessions: Map<string, UserSession>;
  private notifications: Map<string, Notification>;
  private notificationSettingsMap: Map<string, NotificationSettings>;
  private dttHoldingsMap: Map<string, DttHoldings>;
  private dttRewardsMap: Map<string, DttRewards>;
  private dttStakingMap: Map<string, DttStaking>;
  private dttTokenInfoData: DttTokenInfo | undefined;

  constructor() {
    this.users = new Map();
    this.debts = new Map();
    this.transactions = new Map();
    this.payments = new Map();
    this.roundUpSettings = new Map();
    this.cryptoPurchases = new Map();
    this.bankAccounts = new Map();
    this.userSessions = new Map();
    this.notifications = new Map();
    this.notificationSettingsMap = new Map();
    this.dttHoldingsMap = new Map();
    this.dttRewardsMap = new Map();
    this.dttStakingMap = new Map();
    
    // Initialize DTT token info
    this.dttTokenInfoData = {
      id: "dtt-info",
      currentPrice: "0.284700",
      priceChange24h: "12.45",
      marketCap: "28470000.00",
      volume24h: "2847000.00",
      totalSupply: "100000000",
      circulatingSupply: "75000000",
      lastUpdated: new Date(),
    };
    
    // Initialize with demo data
    this.initializeDemoData();
  }

  private initializeDemoData() {
    // Create demo user
    const demoUser: User = {
      id: "demo-user-1",
      email: "demo@dimetime.app",
      password: null,
      passwordAlgo: null,
      firstName: "Neo",
      lastName: "User",
      profileImageUrl: null,
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-01"),
    };
    this.users.set(demoUser.id, demoUser);

    // Create demo debts
    const demoDebts: Debt[] = [
      {
        id: "debt-1",
        userId: demoUser.id,
        name: "Chase Freedom Card",
        accountNumber: "••••4892",
        originalBalance: "15000.00",
        currentBalance: "6847.12",
        interestRate: "18.99",
        minimumPayment: "165.00",
        dueDate: 15,
        isActive: true,
        payeeAccountNumber: null,
        payeeRoutingNumber: null,
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "debt-2",
        userId: demoUser.id,
        name: "Capital One Venture",
        accountNumber: "••••2847",
        originalBalance: "20000.00",
        currentBalance: "10200.00",
        interestRate: "21.99",
        minimumPayment: "248.00",
        dueDate: 22,
        isActive: true,
        payeeAccountNumber: null,
        payeeRoutingNumber: null,
        createdAt: new Date("2024-01-01"),
      },
      {
        id: "debt-3",
        userId: demoUser.id,
        name: "Student Loan",
        accountNumber: "Federal Direct",
        originalBalance: "8000.00",
        currentBalance: "1850.00",
        interestRate: "4.50",
        minimumPayment: "89.00",
        dueDate: 1,
        isActive: true,
        payeeAccountNumber: null,
        payeeRoutingNumber: null,
        createdAt: new Date("2024-01-01"),
      },
    ];
    demoDebts.forEach(debt => this.debts.set(debt.id, debt));

    // Create demo transactions with higher round-ups
    const demoTransactions: Transaction[] = [
      {
        id: "trans-1",
        userId: demoUser.id,
        merchant: "Starbucks Coffee",
        category: "Food & Drink",
        amount: "4.17",
        roundUpAmount: "0.83",
        date: new Date(),
        description: "Morning coffee",
      },
      {
        id: "trans-2",
        userId: demoUser.id,
        merchant: "Shell Gas Station",
        category: "Transportation",
        amount: "37.28",
        roundUpAmount: "0.72",
        date: new Date(Date.now() - 86400000), // Yesterday
        description: "Gas fill-up",
      },
      {
        id: "trans-3",
        userId: demoUser.id,
        merchant: "Amazon Purchase",
        category: "Shopping",
        amount: "24.15",
        roundUpAmount: "0.85",
        date: new Date(Date.now() - 86400000),
        description: "Online purchase",
      },
      {
        id: "trans-4",
        userId: demoUser.id,
        merchant: "Whole Foods Market",
        category: "Groceries",
        amount: "67.22",
        roundUpAmount: "0.78",
        date: new Date(Date.now() - 172800000), // 2 days ago
        description: "Weekly groceries",
      },
      {
        id: "trans-5",
        userId: demoUser.id,
        merchant: "Target",
        category: "Shopping",
        amount: "86.11",
        roundUpAmount: "0.89",
        date: new Date(Date.now() - 259200000), // 3 days ago
        description: "Home supplies",
      },
      {
        id: "trans-6",
        userId: demoUser.id,
        merchant: "McDonald's",
        category: "Food & Drink",
        amount: "12.08",
        roundUpAmount: "0.92",
        date: new Date(Date.now() - 345600000), // 4 days ago
        description: "Lunch",
      },
      {
        id: "trans-7",
        userId: demoUser.id,
        merchant: "CVS Pharmacy",
        category: "Health",
        amount: "28.13",
        roundUpAmount: "0.87",
        date: new Date(Date.now() - 432000000), // 5 days ago
        description: "Prescriptions",
      },
      {
        id: "trans-8",
        userId: demoUser.id,
        merchant: "Uber",
        category: "Transportation",
        amount: "19.07",
        roundUpAmount: "0.93",
        date: new Date(Date.now() - 518400000), // 6 days ago
        description: "Ride to airport",
      },
      {
        id: "trans-9",
        userId: demoUser.id,
        merchant: "Best Buy",
        category: "Electronics",
        amount: "145.12",
        roundUpAmount: "0.88",
        date: new Date(Date.now() - 604800000), // 1 week ago
        description: "Phone charger",
      },
      {
        id: "trans-10",
        userId: demoUser.id,
        merchant: "Chipotle",
        category: "Food & Drink",
        amount: "13.09",
        roundUpAmount: "0.91",
        date: new Date(Date.now() - 691200000), // 8 days ago
        description: "Dinner",
      },
      {
        id: "trans-11",
        userId: demoUser.id,
        merchant: "Home Depot",
        category: "Home Improvement",
        amount: "92.06",
        roundUpAmount: "0.94",
        date: new Date(Date.now() - 777600000), // 9 days ago
        description: "Garden supplies",
      },
      {
        id: "trans-12",
        userId: demoUser.id,
        merchant: "Netflix",
        category: "Entertainment",
        amount: "15.03",
        roundUpAmount: "0.97",
        date: new Date(Date.now() - 864000000), // 10 days ago
        description: "Monthly subscription",
      },
      {
        id: "trans-13",
        userId: demoUser.id,
        merchant: "Costco",
        category: "Groceries",
        amount: "124.08",
        roundUpAmount: "0.92",
        date: new Date(Date.now() - 950400000), // 11 days ago
        description: "Bulk shopping",
      },
      {
        id: "trans-14",
        userId: demoUser.id,
        merchant: "Spotify",
        category: "Entertainment",
        amount: "9.99",
        roundUpAmount: "0.01",
        date: new Date(Date.now() - 1036800000), // 12 days ago
        description: "Music streaming",
      },
      {
        id: "trans-15",
        userId: demoUser.id,
        merchant: "Panera Bread",
        category: "Food & Drink",
        amount: "8.23",
        roundUpAmount: "0.77",
        date: new Date(Date.now() - 1123200000), // 13 days ago
        description: "Lunch meeting",
      },
      {
        id: "trans-16",
        userId: demoUser.id,
        merchant: "Gas Station",
        category: "Transportation",
        amount: "42.16",
        roundUpAmount: "0.84",
        date: new Date(Date.now() - 1209600000), // 14 days ago
        description: "Fuel up",
      },
      {
        id: "trans-17",
        userId: demoUser.id,
        merchant: "Walgreens",
        category: "Health",
        amount: "17.34",
        roundUpAmount: "0.66",
        date: new Date(Date.now() - 1296000000), // 15 days ago
        description: "Vitamins",
      },
      {
        id: "trans-18",
        userId: demoUser.id,
        merchant: "Pizza Hut",
        category: "Food & Drink",
        amount: "23.12",
        roundUpAmount: "0.88",
        date: new Date(Date.now() - 1382400000), // 16 days ago
        description: "Friday dinner",
      },
      {
        id: "trans-19",
        userId: demoUser.id,
        merchant: "Barnes & Noble",
        category: "Books",
        amount: "34.07",
        roundUpAmount: "0.93",
        date: new Date(Date.now() - 1468800000), // 17 days ago
        description: "Book purchase",
      },
      {
        id: "trans-20",
        userId: demoUser.id,
        merchant: "Trader Joe's",
        category: "Groceries",
        amount: "56.14",
        roundUpAmount: "0.86",
        date: new Date(Date.now() - 1555200000), // 18 days ago
        description: "Weekly groceries",
      },
    ];
    demoTransactions.forEach(trans => this.transactions.set(trans.id, trans));

    // Create demo round-up settings with crypto enabled
    const demoRoundUpSettings: RoundUpSettings = {
      id: "settings-1",
      userId: demoUser.id,
      isEnabled: true,
      sourceAccountId: null, // User needs to select their bank account
      targetDebtId: null, // User needs to select their target debt
      multiplier: "1.00",
      autoApplyThreshold: "25.00",
      cryptoEnabled: true,
      cryptoPercentage: "25.00", // 25% of round-ups go to crypto
      preferredCrypto: "BTC",
    };
    this.roundUpSettings.set(demoUser.id, demoRoundUpSettings);

    // Create demo crypto purchases totaling $12,800.88
    const demoCryptoPurchases: CryptoPurchase[] = [
      {
        id: "crypto-1",
        userId: demoUser.id,
        transactionId: "trans-1",
        cryptoSymbol: "BTC",
        amountUsd: "856.05",
        cryptoAmount: "0.00920592",
        purchasePrice: "93000.00",
        coinbaseOrderId: "order-btc-001",
        status: "completed",
        createdAt: new Date(),
      },
      {
        id: "crypto-2",
        userId: demoUser.id,
        transactionId: "trans-2",
        cryptoSymbol: "BTC",
        amountUsd: "926.17",
        cryptoAmount: "0.00993718",
        purchasePrice: "93200.00",
        coinbaseOrderId: "order-btc-002",
        status: "completed",
        createdAt: new Date(Date.now() - 86400000),
      },
      {
        id: "crypto-3",
        userId: demoUser.id,
        transactionId: "trans-3",
        cryptoSymbol: "BTC",
        amountUsd: "1158.10",
        cryptoAmount: "0.01241289",
        purchasePrice: "93300.00",
        coinbaseOrderId: "order-btc-003",
        status: "completed",
        createdAt: new Date(Date.now() - 172800000),
      },
      {
        id: "crypto-4",
        userId: demoUser.id,
        transactionId: "trans-4",
        cryptoSymbol: "BTC",
        amountUsd: "785.46",
        purchasePrice: "93500.00",
        cryptoAmount: "0.00840171",
        coinbaseOrderId: "order-btc-004",
        status: "completed",
        createdAt: new Date(Date.now() - 259200000),
      },
      {
        id: "crypto-5",
        userId: demoUser.id,
        transactionId: "trans-5",
        cryptoSymbol: "BTC",
        amountUsd: "1108.09",
        cryptoAmount: "0.01184078",
        purchasePrice: "93600.00",
        coinbaseOrderId: "order-btc-005",
        status: "completed",
        createdAt: new Date(Date.now() - 345600000),
      },
      {
        id: "crypto-6",
        userId: demoUser.id,
        transactionId: "trans-6",
        cryptoSymbol: "BTC",
        amountUsd: "957.06",
        cryptoAmount: "0.01021929",
        purchasePrice: "93700.00",
        coinbaseOrderId: "order-btc-006",
        status: "completed",
        createdAt: new Date(Date.now() - 432000000),
      },
      {
        id: "crypto-7",
        userId: demoUser.id,
        transactionId: "trans-7",
        cryptoSymbol: "BTC",
        amountUsd: "1259.11",
        cryptoAmount: "0.01339267",
        purchasePrice: "94000.00",
        coinbaseOrderId: "order-btc-007",
        status: "completed",
        createdAt: new Date(Date.now() - 518400000),
      },
      {
        id: "crypto-8",
        userId: demoUser.id,
        transactionId: "trans-8",
        cryptoSymbol: "ETH",
        amountUsd: "725.26",
        cryptoAmount: "0.27062687",
        purchasePrice: "2680.00",
        coinbaseOrderId: "order-eth-001",
        status: "completed",
        createdAt: new Date(Date.now() - 604800000),
      },
      {
        id: "crypto-9",
        userId: demoUser.id,
        transactionId: "trans-9",
        cryptoSymbol: "ETH",
        amountUsd: "896.72",
        cryptoAmount: "0.33212593",
        purchasePrice: "2700.00",
        coinbaseOrderId: "order-eth-002",
        status: "completed",
        createdAt: new Date(Date.now() - 691200000),
      },
      {
        id: "crypto-10",
        userId: demoUser.id,
        transactionId: "trans-10",
        cryptoSymbol: "ETH",
        amountUsd: "655.05",
        cryptoAmount: "0.24078676",
        purchasePrice: "2720.00",
        coinbaseOrderId: "order-eth-003",
        status: "completed",
        createdAt: new Date(Date.now() - 777600000),
      },
      {
        id: "crypto-11",
        userId: demoUser.id,
        transactionId: "trans-11",
        cryptoSymbol: "ETH",
        amountUsd: "987.29",
        cryptoAmount: "0.36037664",
        purchasePrice: "2740.00",
        coinbaseOrderId: "order-eth-004",
        status: "completed",
        createdAt: new Date(Date.now() - 864000000),
      },
      {
        id: "crypto-12",
        userId: demoUser.id,
        transactionId: "trans-12",
        cryptoSymbol: "ETH",
        amountUsd: "765.67",
        cryptoAmount: "0.27741667",
        purchasePrice: "2760.00",
        coinbaseOrderId: "order-eth-005",
        status: "completed",
        createdAt: new Date(Date.now() - 950400000),
      },
      {
        id: "crypto-13",
        userId: demoUser.id,
        transactionId: "trans-13",
        cryptoSymbol: "XRP",
        amountUsd: "352.61",
        cryptoAmount: "141.04400000",
        purchasePrice: "2.50",
        coinbaseOrderId: "order-xrp-001",
        status: "completed",
        createdAt: new Date(Date.now() - 1036800000),
      },
      {
        id: "crypto-14",
        userId: demoUser.id,
        transactionId: "trans-14",
        cryptoSymbol: "XRP",
        amountUsd: "483.46",
        cryptoAmount: "189.59607843",
        purchasePrice: "2.55",
        coinbaseOrderId: "order-xrp-002",
        status: "completed",
        createdAt: new Date(Date.now() - 1123200000),
      },
      {
        id: "crypto-15",
        userId: demoUser.id,
        transactionId: "trans-15",
        cryptoSymbol: "XRP",
        amountUsd: "423.01",
        cryptoAmount: "162.69615385",
        purchasePrice: "2.60",
        coinbaseOrderId: "order-xrp-003",
        status: "completed",
        createdAt: new Date(Date.now() - 1209600000),
      },
      {
        id: "crypto-16",
        userId: demoUser.id,
        transactionId: "trans-16",
        cryptoSymbol: "XRP",
        amountUsd: "251.82",
        cryptoAmount: "95.02641509",
        purchasePrice: "2.65",
        coinbaseOrderId: "order-xrp-004",
        status: "completed",
        createdAt: new Date(Date.now() - 1296000000),
      }
    ];
    demoCryptoPurchases.forEach(purchase => this.cryptoPurchases.set(purchase.id, purchase));

    // Create demo payment history to show significant debt paydown
    const demoPayments: Payment[] = [
      {
        id: "payment-1",
        userId: demoUser.id,
        debtId: "debt-1",
        amount: "2500.00",
        source: "manual",
        date: new Date(Date.now() - 2592000000), // 30 days ago
        status: "completed",
      },
      {
        id: "payment-2",
        userId: demoUser.id,
        debtId: "debt-2",
        amount: "3200.00",
        source: "manual",
        date: new Date(Date.now() - 2160000000), // 25 days ago
        status: "completed",
      },
      {
        id: "payment-3",
        userId: demoUser.id,
        debtId: "debt-3",
        amount: "1800.00",
        source: "manual",
        date: new Date(Date.now() - 1728000000), // 20 days ago
        status: "completed",
      },
      {
        id: "payment-4",
        userId: demoUser.id,
        debtId: "debt-1",
        amount: "3405.88",
        source: "round_up",
        date: new Date(Date.now() - 1296000000), // 15 days ago
        status: "completed",
      },
      {
        id: "payment-5",
        userId: demoUser.id,
        debtId: "debt-2",
        amount: "6597.00",
        source: "round_up",
        date: new Date(Date.now() - 864000000), // 10 days ago
        status: "completed",
      },
      {
        id: "payment-6",
        userId: demoUser.id,
        debtId: "debt-3",
        amount: "4350.00",
        source: "round_up",
        date: new Date(Date.now() - 432000000), // 5 days ago
        status: "completed",
      },
    ];
    demoPayments.forEach(payment => this.payments.set(payment.id, payment));

    // Create demo DTT holdings
    const demoDttHoldings: DttHoldings = {
      id: randomUUID(),
      userId: demoUser.id,
      balance: "247.85620000",
      stakedAmount: "125.00000000",
      totalEarned: "372.85620000",
      createdAt: new Date("2024-01-01"),
      lastActivity: new Date(),
    };
    this.dttHoldingsMap.set(demoUser.id, demoDttHoldings);

    // Create demo DTT rewards history
    const demoDttRewards: DttRewards[] = [
      {
        id: "dtt-reward-1",
        userId: demoUser.id,
        action: "round_up",
        amount: "0.10000000",
        transactionId: null,
        paymentId: null,
        transactionHash: null,
        status: "completed",
        metadata: JSON.stringify({ description: "Round-up reward from Starbucks purchase" }),
        createdAt: new Date(Date.now() - 86400000), // 1 day ago
      },
      {
        id: "dtt-reward-2", 
        userId: demoUser.id,
        action: "debt_payment",
        amount: "12.50000000",
        transactionId: null,
        paymentId: null,
        transactionHash: null,
        status: "completed",
        metadata: JSON.stringify({ description: "Debt payment reward: $250 payment to Chase Freedom" }),
        createdAt: new Date(Date.now() - 172800000), // 2 days ago
      },
      {
        id: "dtt-reward-3",
        userId: demoUser.id,
        action: "milestone",
        amount: "50.00000000",
        transactionId: null,
        paymentId: null,
        transactionHash: null,
        status: "completed",
        metadata: JSON.stringify({ description: "Milestone reward: 25% debt reduction achieved" }),
        createdAt: new Date(Date.now() - 432000000), // 5 days ago
      },
      {
        id: "dtt-reward-4",
        userId: demoUser.id,
        action: "round_up",
        amount: "0.15000000",
        transactionId: null,
        paymentId: null,
        transactionHash: null,
        status: "completed",
        metadata: JSON.stringify({ description: "Round-up reward from Shell Gas purchase" }),
        createdAt: new Date(Date.now() - 518400000), // 6 days ago
      },
      {
        id: "dtt-reward-5",
        userId: demoUser.id,
        action: "daily_login",
        amount: "1.00000000",
        transactionId: null,
        paymentId: null,
        transactionHash: null,
        status: "completed",
        metadata: JSON.stringify({ description: "Daily login bonus" }),
        createdAt: new Date(Date.now() - 604800000), // 7 days ago
      },
    ];
    demoDttRewards.forEach(reward => this.dttRewardsMap.set(reward.id, reward));

    // Create demo DTT staking
    const demoDttStaking: DttStaking[] = [
      {
        id: "dtt-stake-1",
        userId: demoUser.id,
        amount: "125.00000000",
        duration: 90,
        apy: "15.50000000",
        rewardsEarned: "4.25680000",
        status: "active",
        startDate: new Date(Date.now() - 2592000000), // 30 days ago
        endDate: new Date(Date.now() + 5184000000), // 60 days from now
        lastRewardCalculation: new Date(),
        createdAt: new Date(Date.now() - 2592000000),
      },
    ];
    demoDttStaking.forEach(stake => this.dttStakingMap.set(stake.id, stake));
  }

  async getUser(id: string): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.email === email);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = randomUUID();
    const user: User = { 
      id,
      email: insertUser.email ?? null,
      password: insertUser.password ?? null,
      passwordAlgo: insertUser.passwordAlgo ?? null,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      profileImageUrl: insertUser.profileImageUrl ?? null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    this.users.set(id, user);
    return user;
  }

  async upsertUser(userData: { id: string; email?: string | null; password?: string | null; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User> {
    const existingUser = this.users.get(userData.id);
    
    if (existingUser) {
      const updatedUser: User = {
        ...existingUser,
        email: userData.email ?? existingUser.email,
        password: userData.password ?? existingUser.password,
        firstName: userData.firstName ?? existingUser.firstName,
        lastName: userData.lastName ?? existingUser.lastName,
        profileImageUrl: userData.profileImageUrl ?? existingUser.profileImageUrl,
        updatedAt: new Date(),
      };
      this.users.set(userData.id, updatedUser);
      return updatedUser;
    } else {
      const newUser: User = {
        id: userData.id,
        email: userData.email ?? null,
        password: userData.password ?? null,
        passwordAlgo: null,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.users.set(userData.id, newUser);
      return newUser;
    }
  }

  async getDebtsByUserId(userId: string): Promise<Debt[]> {
    return Array.from(this.debts.values()).filter(debt => debt.userId === userId && debt.isActive);
  }

  async getDebt(id: string): Promise<Debt | undefined> {
    return this.debts.get(id);
  }

  async createDebt(insertDebt: InsertDebt): Promise<Debt> {
    const id = randomUUID();
    const debt: Debt = { 
      ...insertDebt, 
      id,
      isActive: insertDebt.isActive ?? true,
      payeeAccountNumber: insertDebt.payeeAccountNumber ?? null,
      payeeRoutingNumber: insertDebt.payeeRoutingNumber ?? null,
      createdAt: new Date(),
    };
    this.debts.set(id, debt);
    return debt;
  }

  async updateDebt(id: string, updates: Partial<Debt>): Promise<Debt | undefined> {
    const debt = this.debts.get(id);
    if (!debt) return undefined;
    
    const updatedDebt = { ...debt, ...updates };
    this.debts.set(id, updatedDebt);
    return updatedDebt;
  }

  async getTransactionsByUserId(userId: string, limit?: number): Promise<Transaction[]> {
    const userTransactions = Array.from(this.transactions.values())
      .filter(trans => trans.userId === userId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return limit ? userTransactions.slice(0, limit) : userTransactions;
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const transaction: Transaction = { 
      ...insertTransaction, 
      id,
      description: insertTransaction.description ?? null,
      date: new Date(),
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async getPaymentsByUserId(userId: string): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter(payment => payment.userId === userId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async getPaymentsByDebtId(debtId: string): Promise<Payment[]> {
    return Array.from(this.payments.values())
      .filter(payment => payment.debtId === debtId)
      .sort((a, b) => b.date.getTime() - a.date.getTime());
  }

  async createPayment(insertPayment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const payment: Payment = { 
      ...insertPayment, 
      id,
      date: new Date(),
      status: 'completed',
    };
    this.payments.set(id, payment);
    return payment;
  }

  async makeAcceleratedPayment(userId: string, debtId: string, amount: string): Promise<{ payment: Payment; updatedDebt: Debt }> {
    const debt = this.debts.get(debtId);
    if (!debt || debt.userId !== userId) {
      throw new Error('Debt not found or unauthorized');
    }

    // Create the payment record
    const payment = await this.createPayment({
      userId,
      debtId,
      amount,
      source: 'manual',
    });

    // Update the debt balance
    const currentBalance = parseFloat(debt.currentBalance);
    const paymentAmount = parseFloat(amount);
    const newBalance = Math.max(0, currentBalance - paymentAmount);

    const updatedDebt = await this.updateDebt(debtId, {
      currentBalance: newBalance.toFixed(2),
    });

    if (!updatedDebt) {
      throw new Error('Failed to update debt balance');
    }

    return { payment, updatedDebt };
  }

  async getRoundUpSettings(userId: string): Promise<RoundUpSettings | undefined> {
    return this.roundUpSettings.get(userId);
  }

  async createOrUpdateRoundUpSettings(settings: InsertRoundUpSettings): Promise<RoundUpSettings> {
    const existing = this.roundUpSettings.get(settings.userId);
    
    if (existing) {
      const updated = { ...existing, ...settings };
      this.roundUpSettings.set(settings.userId, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newSettings: RoundUpSettings = { 
        ...settings, 
        id,
        isEnabled: settings.isEnabled ?? true,
        sourceAccountId: settings.sourceAccountId ?? null,
        targetDebtId: settings.targetDebtId ?? null,
        multiplier: settings.multiplier ?? "1.00",
        autoApplyThreshold: settings.autoApplyThreshold ?? "25.00",
        cryptoEnabled: settings.cryptoEnabled ?? false,
        cryptoPercentage: settings.cryptoPercentage ?? "0.00",
        preferredCrypto: settings.preferredCrypto ?? "BTC",
      };
      this.roundUpSettings.set(settings.userId, newSettings);
      return newSettings;
    }
  }

  async getCryptoPurchasesByUserId(userId: string): Promise<CryptoPurchase[]> {
    return Array.from(this.cryptoPurchases.values())
      .filter(purchase => purchase.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createCryptoPurchase(insertPurchase: InsertCryptoPurchase): Promise<CryptoPurchase> {
    const id = randomUUID();
    const purchase: CryptoPurchase = {
      ...insertPurchase,
      id,
      transactionId: insertPurchase.transactionId ?? null,
      coinbaseOrderId: insertPurchase.coinbaseOrderId ?? null,
      status: 'pending',
      createdAt: new Date(),
    };
    this.cryptoPurchases.set(id, purchase);
    return purchase;
  }

  async updateCryptoPurchaseStatus(id: string, status: string, coinbaseOrderId?: string): Promise<CryptoPurchase | undefined> {
    const purchase = this.cryptoPurchases.get(id);
    if (!purchase) return undefined;
    
    const updated: CryptoPurchase = {
      ...purchase,
      status,
      coinbaseOrderId: coinbaseOrderId || purchase.coinbaseOrderId,
    };
    this.cryptoPurchases.set(id, updated);
    return updated;
  }

  async getBankAccountsByUserId(userId: string): Promise<BankAccount[]> {
    return Array.from(this.bankAccounts.values())
      .filter(account => account.userId === userId && account.isActive)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createBankAccount(account: InsertBankAccount): Promise<BankAccount> {
    const id = randomUUID();
    const bankAccount: BankAccount = {
      ...account,
      id,
      mask: account.mask ?? null,
      isActive: account.isActive ?? true,
      createdAt: new Date(),
    };
    this.bankAccounts.set(id, bankAccount);
    return bankAccount;
  }

  async getBankAccountByPlaidItemId(itemId: string): Promise<BankAccount | undefined> {
    return Array.from(this.bankAccounts.values()).find(account => account.plaidItemId === itemId);
  }

  async updateBankAccountStatus(id: string, isActive: boolean): Promise<BankAccount | undefined> {
    const account = this.bankAccounts.get(id);
    if (!account) return undefined;
    
    const updated = { ...account, isActive };
    this.bankAccounts.set(id, updated);
    return updated;
  }

  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    const id = randomUUID();
    const userSession: UserSession = {
      ...session,
      id,
      deviceId: session.deviceId ?? null,
      isActive: session.isActive ?? true,
      lastActivity: new Date(),
      createdAt: new Date(),
    };
    this.userSessions.set(id, userSession);
    return userSession;
  }

  async getUserSessionByToken(token: string): Promise<UserSession | undefined> {
    return Array.from(this.userSessions.values()).find(session => session.sessionToken === token);
  }

  async updateSessionActivity(id: string): Promise<UserSession | undefined> {
    const session = this.userSessions.get(id);
    if (!session) return undefined;
    
    const updated = { ...session, lastActivity: new Date() };
    this.userSessions.set(id, updated);
    return updated;
  }

  async deactivateUserSessions(userId: string, deviceType?: string): Promise<void> {
    Array.from(this.userSessions.entries()).forEach(([id, session]) => {
      if (session.userId === userId && (!deviceType || session.deviceType === deviceType)) {
        const updated = { ...session, isActive: false };
        this.userSessions.set(id, updated);
      }
    });
  }

  // Notification methods
  async createNotification(insertNotification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const notification: Notification = {
      ...insertNotification,
      id,
      status: insertNotification.status ?? 'pending',
      priority: insertNotification.priority ?? 'medium',
      sentAt: null,
      deliveredAt: null,
      metadata: insertNotification.metadata ?? null,
      createdAt: new Date(),
    };
    this.notifications.set(id, notification);
    return notification;
  }

  async getNotificationsByUserId(userId: string, limit?: number): Promise<Notification[]> {
    const userNotifications = Array.from(this.notifications.values())
      .filter(notification => notification.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    
    return limit ? userNotifications.slice(0, limit) : userNotifications;
  }

  async getUserNotifications(userId: string, limit?: number): Promise<Notification[]> {
    return this.getNotificationsByUserId(userId, limit);
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async getUserTransactions(userId: string, limit?: number): Promise<Transaction[]> {
    return this.getTransactionsByUserId(userId, limit);
  }

  async getUserDebts(userId: string): Promise<Debt[]> {
    return this.getDebtsByUserId(userId);
  }

  async getUserCryptoPurchases(userId: string): Promise<CryptoPurchase[]> {
    return this.getCryptoPurchasesByUserId(userId);
  }

  async getDashboardSummary(userId: string): Promise<any> {
    // Calculate summary data
    const debts = await this.getUserDebts(userId);
    const transactions = await this.getUserTransactions(userId);
    const cryptoPurchases = await this.getUserCryptoPurchases(userId);

    const totalDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
    const totalRoundUps = transactions.reduce((sum, trans) => sum + (parseFloat(trans.roundUpAmount || '0')), 0);
    const totalCrypto = cryptoPurchases.reduce((sum, purchase) => sum + parseFloat(purchase.amountUsd), 0);

    return {
      totalDebt: totalDebt.toFixed(2),
      totalRoundUps: totalRoundUps.toFixed(2), 
      totalCrypto: totalCrypto.toFixed(2),
      debtCount: debts.length,
      transactionCount: transactions.length
    };
  }

  async updateNotificationStatus(id: string, status: string, sentAt?: Date, deliveredAt?: Date): Promise<Notification | undefined> {
    const notification = this.notifications.get(id);
    if (!notification) return undefined;
    
    const updated: Notification = {
      ...notification,
      status,
      sentAt: sentAt || notification.sentAt,
      deliveredAt: deliveredAt || notification.deliveredAt,
    };
    this.notifications.set(id, updated);
    return updated;
  }

  async getNotificationSettings(userId: string): Promise<NotificationSettings | undefined> {
    return Array.from(this.notificationSettingsMap.values())
      .find(settings => settings.userId === userId);
  }

  async createOrUpdateNotificationSettings(insertSettings: InsertNotificationSettings): Promise<NotificationSettings> {
    const existingSettings = await this.getNotificationSettings(insertSettings.userId);
    
    if (existingSettings) {
      const updated: NotificationSettings = {
        ...existingSettings,
        ...insertSettings,
        updatedAt: new Date(),
      };
      this.notificationSettingsMap.set(existingSettings.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const settings: NotificationSettings = {
        ...insertSettings,
        id,
        smsEnabled: insertSettings.smsEnabled ?? true,
        emailEnabled: insertSettings.emailEnabled ?? true,
        pushEnabled: insertSettings.pushEnabled ?? true,
        phoneNumber: insertSettings.phoneNumber ?? null,
        paymentReminders: insertSettings.paymentReminders ?? true,
        roundupMilestones: insertSettings.roundupMilestones ?? true,
        cryptoUpdates: insertSettings.cryptoUpdates ?? true,
        weeklyReports: insertSettings.weeklyReports ?? true,
        marketingMessages: insertSettings.marketingMessages ?? false,
        updatedAt: new Date(),
      };
      this.notificationSettingsMap.set(id, settings);
      return settings;
    }
  }

  // DTT Token methods
  async getDttHoldings(userId: string): Promise<DttHoldings | undefined> {
    return this.dttHoldingsMap.get(userId);
  }

  async createOrUpdateDttHoldings(holdings: InsertDttHoldings): Promise<DttHoldings> {
    const existing = this.dttHoldingsMap.get(holdings.userId);
    
    if (existing) {
      const updated: DttHoldings = {
        ...existing,
        ...holdings,
        lastActivity: new Date(),
      };
      this.dttHoldingsMap.set(holdings.userId, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newHoldings: DttHoldings = {
        ...holdings,
        id,
        balance: holdings.balance || "0.00000000",
        stakedAmount: holdings.stakedAmount || "0.00000000",
        totalEarned: holdings.totalEarned || "0.00000000",
        lastActivity: new Date(),
        createdAt: new Date(),
      };
      this.dttHoldingsMap.set(holdings.userId, newHoldings);
      return newHoldings;
    }
  }

  async updateDttBalance(userId: string, balance: string, stakedAmount?: string, totalEarned?: string): Promise<DttHoldings | undefined> {
    const existing = this.dttHoldingsMap.get(userId);
    if (!existing) return undefined;
    
    const updated: DttHoldings = {
      ...existing,
      balance,
      stakedAmount: stakedAmount || existing.stakedAmount,
      totalEarned: totalEarned || existing.totalEarned,
      lastActivity: new Date(),
    };
    this.dttHoldingsMap.set(userId, updated);
    return updated;
  }

  async getDttRewardsByUserId(userId: string): Promise<DttRewards[]> {
    return Array.from(this.dttRewardsMap.values())
      .filter(reward => reward.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createDttReward(reward: InsertDttRewards): Promise<DttRewards> {
    const id = randomUUID();
    const newReward: DttRewards = {
      ...reward,
      id,
      status: "completed",
      transactionId: reward.transactionId || null,
      paymentId: reward.paymentId || null,
      transactionHash: reward.transactionHash || null,
      metadata: reward.metadata || null,
      createdAt: new Date(),
    };
    this.dttRewardsMap.set(id, newReward);
    return newReward;
  }

  async getDttStakingByUserId(userId: string): Promise<DttStaking[]> {
    return Array.from(this.dttStakingMap.values())
      .filter(stake => stake.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  async createDttStaking(staking: InsertDttStaking): Promise<DttStaking> {
    const id = randomUUID();
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (staking.duration * 24 * 60 * 60 * 1000));
    
    const newStaking: DttStaking = {
      ...staking,
      id,
      startDate,
      endDate,
      status: staking.status || "active",
      rewardsEarned: staking.rewardsEarned || "0.00000000",
      lastRewardCalculation: new Date(),
      createdAt: new Date(),
    };
    this.dttStakingMap.set(id, newStaking);
    return newStaking;
  }

  async updateDttStakingStatus(id: string, status: string): Promise<DttStaking | undefined> {
    const staking = this.dttStakingMap.get(id);
    if (!staking) return undefined;
    
    const updated: DttStaking = {
      ...staking,
      status,
    };
    this.dttStakingMap.set(id, updated);
    return updated;
  }

  async getDttTokenInfo(): Promise<DttTokenInfo | undefined> {
    return this.dttTokenInfoData;
  }

  async updateDttTokenInfo(info: InsertDttTokenInfo): Promise<DttTokenInfo> {
    const updated: DttTokenInfo = {
      id: "dtt-info",
      currentPrice: info.currentPrice || "0.250000",
      marketCap: info.marketCap || "2500000.00",
      volume24h: info.volume24h || "125000.00",
      priceChange24h: info.priceChange24h || "5.25",
      totalSupply: info.totalSupply || "10000000",
      circulatingSupply: info.circulatingSupply || "2500000",
      lastUpdated: new Date(),
    };
    this.dttTokenInfoData = updated;
    return updated;
  }

  // Contact submission methods
  async createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission> {
    const [result] = await db.insert(contactSubmissions).values(submission).returning();
    return result;
  }

  async getContactSubmissions(): Promise<ContactSubmission[]> {
    return await db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt));
  }

  async updateUserPassword(userId: string, passwordHash: string, algo: string): Promise<void> {
    const user = this.users.get(userId);
    if (user) {
      (user as any).password = passwordHash;
      (user as any).passwordAlgo = algo;
    }
  }

  async deleteUserAccount(userId: string): Promise<void> {
    this.users.delete(userId);
  }

  async getIdempotencyKey(_key: string, _userId: string, _endpoint: string): Promise<{ responseStatus: number; responseBody: string } | undefined> {
    return undefined;
  }

  async createIdempotencyKey(_data: { idempotencyKey: string; userId: string; endpoint: string; responseStatus: number; responseBody: string }): Promise<void> {}

  async createTransfer(_data: InsertTransfer): Promise<Transfer> {
    throw new Error('MemStorage does not support transfer ledger');
  }
  async getTransfer(_id: string): Promise<Transfer | undefined> { return undefined; }
  async getTransferByCorrelationId(_correlationId: string): Promise<Transfer | undefined> { return undefined; }
  async getTransferByPlaidTransferId(_plaidTransferId: string): Promise<Transfer | undefined> { return undefined; }
  async updateTransferStatus(_id: string, _status: string, _updates?: any): Promise<Transfer | undefined> { return undefined; }
  async getTransfersByUserId(_userId: string): Promise<Transfer[]> { return []; }
  async getPlaidAccessToken(_bankAccountId: string): Promise<string | undefined> { return undefined; }

  async createPasswordResetToken(_data: InsertPasswordResetToken): Promise<PasswordResetToken> {
    throw new Error('MemStorage does not support password reset tokens');
  }
  async consumePasswordResetToken(_tokenHash: string): Promise<PasswordResetToken | undefined> { return undefined; }
  async invalidatePasswordResetTokensForUser(_userId: string): Promise<void> {}
  async invalidateAllUserSessions(_userId: string): Promise<void> {}

  async createEmailVerificationToken(_data: InsertEmailVerificationToken): Promise<EmailVerificationToken> {
    throw new Error('MemStorage does not support email verification tokens');
  }
  async consumeEmailVerificationToken(_tokenHash: string): Promise<EmailVerificationToken | undefined> { return undefined; }
  async invalidateEmailVerificationTokensForUser(_userId: string): Promise<void> {}
  async markUserEmailVerified(_userId: string, _when?: Date): Promise<void> {}
}

// DatabaseStorage class for persistent storage using PostgreSQL
export class DatabaseStorage implements IStorage {
  // User methods
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async createUser(user: InsertUser): Promise<User> {
    const id = randomUUID();
    const [result] = await db.insert(users).values({ ...user, id }).returning();
    return result;
  }

  async upsertUser(user: { id: string; email?: string | null; firstName?: string | null; lastName?: string | null; profileImageUrl?: string | null }): Promise<User> {
    const existing = await this.getUser(user.id);
    if (existing) {
      const [updated] = await db.update(users)
        .set({ ...user, updatedAt: new Date() })
        .where(eq(users.id, user.id))
        .returning();
      return updated;
    }
    const [result] = await db.insert(users).values({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl,
    }).returning();
    return result;
  }

  // Debt methods
  async getDebtsByUserId(userId: string): Promise<Debt[]> {
    return await db.select().from(debts).where(eq(debts.userId, userId));
  }

  async getDebt(id: string): Promise<Debt | undefined> {
    const [debt] = await db.select().from(debts).where(eq(debts.id, id));
    return debt;
  }

  async createDebt(debt: InsertDebt): Promise<Debt> {
    const id = randomUUID();
    const [result] = await db.insert(debts).values({ ...debt, id }).returning();
    return result;
  }

  async updateDebt(id: string, updates: Partial<Debt>): Promise<Debt | undefined> {
    const [result] = await db.update(debts).set(updates).where(eq(debts.id, id)).returning();
    return result;
  }

  // Transaction methods
  async getTransactionsByUserId(userId: string, limit?: number): Promise<Transaction[]> {
    const query = db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.date));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async createTransaction(transaction: InsertTransaction): Promise<Transaction> {
    const id = randomUUID();
    const [result] = await db.insert(transactions).values({ ...transaction, id }).returning();
    return result;
  }

  // Payment methods
  async getPaymentsByUserId(userId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.date));
  }

  async getPaymentsByDebtId(debtId: string): Promise<Payment[]> {
    return await db.select().from(payments).where(eq(payments.debtId, debtId));
  }

  async createPayment(payment: InsertPayment): Promise<Payment> {
    const id = randomUUID();
    const [result] = await db.insert(payments).values({ ...payment, id }).returning();
    return result;
  }

  async makeAcceleratedPayment(userId: string, debtId: string, amount: string): Promise<{ payment: Payment; updatedDebt: Debt }> {
    const debt = await this.getDebt(debtId);
    if (!debt) throw new Error("Debt not found");
    
    const newBalance = (parseFloat(debt.currentBalance) - parseFloat(amount)).toFixed(2);
    const payment = await this.createPayment({
      userId,
      debtId,
      amount,
      source: "accelerated",
    });
    
    const updatedDebt = await this.updateDebt(debtId, { currentBalance: newBalance });
    if (!updatedDebt) throw new Error("Failed to update debt");
    
    return { payment, updatedDebt };
  }

  // Round-up settings methods
  async getRoundUpSettings(userId: string): Promise<RoundUpSettings | undefined> {
    const [settings] = await db.select().from(roundUpSettings).where(eq(roundUpSettings.userId, userId));
    return settings;
  }

  async createOrUpdateRoundUpSettings(settings: InsertRoundUpSettings): Promise<RoundUpSettings> {
    const existing = await this.getRoundUpSettings(settings.userId);
    if (existing) {
      const [updated] = await db.update(roundUpSettings).set(settings).where(eq(roundUpSettings.userId, settings.userId)).returning();
      return updated;
    }
    const id = randomUUID();
    const [result] = await db.insert(roundUpSettings).values({ ...settings, id }).returning();
    return result;
  }

  // Crypto purchase methods
  async getCryptoPurchasesByUserId(userId: string): Promise<CryptoPurchase[]> {
    return await db.select().from(cryptoPurchases).where(eq(cryptoPurchases.userId, userId)).orderBy(desc(cryptoPurchases.createdAt));
  }

  async createCryptoPurchase(purchase: InsertCryptoPurchase): Promise<CryptoPurchase> {
    const id = randomUUID();
    const [result] = await db.insert(cryptoPurchases).values({ ...purchase, id }).returning();
    return result;
  }

  async updateCryptoPurchaseStatus(id: string, status: string, coinbaseOrderId?: string): Promise<CryptoPurchase | undefined> {
    const [result] = await db.update(cryptoPurchases).set({ status, coinbaseOrderId }).where(eq(cryptoPurchases.id, id)).returning();
    return result;
  }

  // Bank account methods — access tokens are encrypted at rest
  async getBankAccountsByUserId(userId: string): Promise<BankAccount[]> {
    const rows = await db.select().from(bankAccounts).where(eq(bankAccounts.userId, userId));
    // Return accounts with tokens masked — callers must use getPlaidAccessToken() for the live token
    return rows.map(a => ({ ...a, plaidAccessToken: '[encrypted]' }));
  }

  async createBankAccount(account: InsertBankAccount): Promise<BankAccount> {
    const id = randomUUID();
    const encrypted = encryptToken(account.plaidAccessToken);
    const [result] = await db.insert(bankAccounts).values({ ...account, id, plaidAccessToken: encrypted }).returning();
    return { ...result, plaidAccessToken: '[encrypted]' };
  }

  async getBankAccountByPlaidItemId(itemId: string): Promise<BankAccount | undefined> {
    const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.plaidItemId, itemId));
    if (!account) return undefined;
    return { ...account, plaidAccessToken: '[encrypted]' };
  }

  async updateBankAccountStatus(id: string, isActive: boolean): Promise<BankAccount | undefined> {
    const [result] = await db.update(bankAccounts).set({ isActive }).where(eq(bankAccounts.id, id)).returning();
    if (!result) return undefined;
    return { ...result, plaidAccessToken: '[encrypted]' };
  }

  async getPlaidAccessToken(bankAccountId: string): Promise<string | undefined> {
    const [account] = await db.select({ token: bankAccounts.plaidAccessToken }).from(bankAccounts).where(eq(bankAccounts.id, bankAccountId));
    if (!account) return undefined;
    return decryptToken(account.token);
  }

  // User session methods
  async createUserSession(session: InsertUserSession): Promise<UserSession> {
    const id = randomUUID();
    const [result] = await db.insert(userSessions).values({ ...session, id }).returning();
    return result;
  }

  async getUserSessionByToken(token: string): Promise<UserSession | undefined> {
    const [session] = await db.select().from(userSessions).where(eq(userSessions.sessionToken, token));
    return session;
  }

  async updateSessionActivity(id: string): Promise<UserSession | undefined> {
    const [result] = await db.update(userSessions).set({ lastActivity: new Date() }).where(eq(userSessions.id, id)).returning();
    return result;
  }

  async deactivateUserSessions(userId: string, deviceType?: string): Promise<void> {
    if (deviceType) {
      await db.update(userSessions).set({ isActive: false }).where(and(eq(userSessions.userId, userId), eq(userSessions.deviceType, deviceType)));
    } else {
      await db.update(userSessions).set({ isActive: false }).where(eq(userSessions.userId, userId));
    }
  }

  // DTT Token methods
  async getDttHoldings(userId: string): Promise<DttHoldings | undefined> {
    const [holdings] = await db.select().from(dttHoldings).where(eq(dttHoldings.userId, userId));
    return holdings;
  }

  async createOrUpdateDttHoldings(holdings: InsertDttHoldings): Promise<DttHoldings> {
    const existing = await this.getDttHoldings(holdings.userId);
    if (existing) {
      const [updated] = await db.update(dttHoldings).set(holdings).where(eq(dttHoldings.userId, holdings.userId)).returning();
      return updated;
    }
    const id = randomUUID();
    const [result] = await db.insert(dttHoldings).values({ ...holdings, id }).returning();
    return result;
  }

  async updateDttBalance(userId: string, balance: string, stakedAmount?: string, totalEarned?: string): Promise<DttHoldings | undefined> {
    const updates: Partial<DttHoldings> = { balance };
    if (stakedAmount !== undefined) updates.stakedAmount = stakedAmount;
    if (totalEarned !== undefined) updates.totalEarned = totalEarned;
    const [result] = await db.update(dttHoldings).set(updates).where(eq(dttHoldings.userId, userId)).returning();
    return result;
  }

  async getDttRewardsByUserId(userId: string): Promise<DttRewards[]> {
    return await db.select().from(dttRewards).where(eq(dttRewards.userId, userId)).orderBy(desc(dttRewards.createdAt));
  }

  async createDttReward(reward: InsertDttRewards): Promise<DttRewards> {
    const id = randomUUID();
    const [result] = await db.insert(dttRewards).values({ ...reward, id }).returning();
    return result;
  }

  async getDttStakingByUserId(userId: string): Promise<DttStaking[]> {
    return await db.select().from(dttStaking).where(eq(dttStaking.userId, userId)).orderBy(desc(dttStaking.createdAt));
  }

  async createDttStaking(staking: InsertDttStaking): Promise<DttStaking> {
    const id = randomUUID();
    const startDate = new Date();
    const endDate = new Date(startDate.getTime() + (staking.duration * 24 * 60 * 60 * 1000));
    const [result] = await db.insert(dttStaking).values({
      ...staking,
      id,
      startDate,
      endDate,
      status: staking.status || "active",
      rewardsEarned: staking.rewardsEarned || "0.00000000",
    }).returning();
    return result;
  }

  async updateDttStakingStatus(id: string, status: string): Promise<DttStaking | undefined> {
    const [result] = await db.update(dttStaking).set({ status }).where(eq(dttStaking.id, id)).returning();
    return result;
  }

  async getDttTokenInfo(): Promise<DttTokenInfo | undefined> {
    const [info] = await db.select().from(dttTokenInfo);
    return info;
  }

  async updateDttTokenInfo(info: InsertDttTokenInfo): Promise<DttTokenInfo> {
    const existing = await this.getDttTokenInfo();
    if (existing) {
      const [updated] = await db.update(dttTokenInfo).set({ ...info, lastUpdated: new Date() }).where(eq(dttTokenInfo.id, existing.id)).returning();
      return updated;
    }
    const id = randomUUID();
    const [result] = await db.insert(dttTokenInfo).values({ ...info, id }).returning();
    return result;
  }

  // Notification methods
  async createNotification(notification: InsertNotification): Promise<Notification> {
    const id = randomUUID();
    const [result] = await db.insert(notifications).values({ ...notification, id }).returning();
    return result;
  }

  async getNotificationsByUserId(userId: string, limit?: number): Promise<Notification[]> {
    const query = db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }

  async updateNotificationStatus(id: string, status: string, sentAt?: Date, deliveredAt?: Date): Promise<Notification | undefined> {
    const updates: Partial<Notification> = { status };
    if (sentAt) updates.sentAt = sentAt;
    if (deliveredAt) updates.deliveredAt = deliveredAt;
    const [result] = await db.update(notifications).set(updates).where(eq(notifications.id, id)).returning();
    return result;
  }

  // Notification settings methods
  async getNotificationSettings(userId: string): Promise<NotificationSettings | undefined> {
    const [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId));
    return settings;
  }

  async createOrUpdateNotificationSettings(settings: InsertNotificationSettings): Promise<NotificationSettings> {
    const existing = await this.getNotificationSettings(settings.userId);
    if (existing) {
      const [updated] = await db.update(notificationSettings).set(settings).where(eq(notificationSettings.userId, settings.userId)).returning();
      return updated;
    }
    const id = randomUUID();
    const [result] = await db.insert(notificationSettings).values({ ...settings, id }).returning();
    return result;
  }

  // Alias for interface compatibility
  async getUserNotifications(userId: string, limit?: number): Promise<Notification[]> {
    return this.getNotificationsByUserId(userId, limit);
  }

  // Contact submission methods
  async createContactSubmission(submission: InsertContactSubmission): Promise<ContactSubmission> {
    const [result] = await db.insert(contactSubmissions).values(submission).returning();
    return result;
  }

  async getContactSubmissions(): Promise<ContactSubmission[]> {
    return await db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt));
  }

  async updateUserPassword(userId: string, passwordHash: string, algo: string): Promise<void> {
    await db.update(users).set({ password: passwordHash, passwordAlgo: algo }).where(eq(users.id, userId));
  }

  async deleteUserAccount(userId: string): Promise<void> {
    await db.delete(weeklyDispersals).where(eq(weeklyDispersals.userId, userId));
    await db.delete(sweepDeposits).where(eq(sweepDeposits.userId, userId));
    await db.delete(sweepAccounts).where(eq(sweepAccounts.userId, userId));
    await db.delete(distributionPayments).where(eq(distributionPayments.userId, userId));
    await db.delete(roundUpCollections).where(eq(roundUpCollections.userId, userId));
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
    await db.delete(notifications).where(eq(notifications.userId, userId));
    await db.delete(notificationSettings).where(eq(notificationSettings.userId, userId));
    await db.delete(cryptoPurchases).where(eq(cryptoPurchases.userId, userId));
    await db.delete(dttHoldings).where(eq(dttHoldings.userId, userId));
    await db.delete(dttRewards).where(eq(dttRewards.userId, userId));
    await db.delete(dttStaking).where(eq(dttStaking.userId, userId));
    await db.delete(roundUpSettings).where(eq(roundUpSettings.userId, userId));
    await db.delete(payments).where(eq(payments.userId, userId));
    await db.delete(transactions).where(eq(transactions.userId, userId));
    await db.delete(bankAccounts).where(eq(bankAccounts.userId, userId));
    await db.delete(debts).where(eq(debts.userId, userId));
    await db.delete(idempotencyKeys).where(eq(idempotencyKeys.userId, userId));
    await db.delete(transfers).where(eq(transfers.userId, userId));
    await db.delete(users).where(eq(users.id, userId));
  }

  async getIdempotencyKey(key: string, userId: string, endpoint: string): Promise<{ responseStatus: number; responseBody: string } | undefined> {
    const result = await db.execute(
      sql`SELECT response_status, response_body FROM idempotency_keys WHERE idempotency_key = ${key} AND user_id = ${userId} AND endpoint = ${endpoint} AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1`
    );
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0] as any;
      return { responseStatus: row.response_status, responseBody: row.response_body };
    }
    return undefined;
  }

  async createIdempotencyKey(data: { idempotencyKey: string; userId: string; endpoint: string; responseStatus: number; responseBody: string }): Promise<void> {
    await db.execute(
      sql`INSERT INTO idempotency_keys (id, idempotency_key, user_id, endpoint, response_status, response_body) VALUES (gen_random_uuid(), ${data.idempotencyKey}, ${data.userId}, ${data.endpoint}, ${data.responseStatus}, ${data.responseBody})`
    );
  }

  // Transfer ledger methods
  async createTransfer(data: InsertTransfer): Promise<Transfer> {
    const id = randomUUID();
    const now = new Date();
    const [result] = await db.insert(transfers).values({ ...data, id, createdAt: now, updatedAt: now }).returning();
    return result;
  }

  async getTransfer(id: string): Promise<Transfer | undefined> {
    const [result] = await db.select().from(transfers).where(eq(transfers.id, id));
    return result;
  }

  async getTransferByCorrelationId(correlationId: string): Promise<Transfer | undefined> {
    const [result] = await db.select().from(transfers).where(eq(transfers.correlationId, correlationId));
    return result;
  }

  async getTransferByPlaidTransferId(plaidTransferId: string): Promise<Transfer | undefined> {
    const [result] = await db.select().from(transfers).where(eq(transfers.plaidTransferId, plaidTransferId));
    return result;
  }

  async updateTransferStatus(
    id: string,
    status: string,
    updates?: Partial<Pick<Transfer, 'plaidTransferId' | 'plaidAuthorizationId' | 'mercuryTransferId' | 'errorCode' | 'errorMessage' | 'rawResponse'>>
  ): Promise<Transfer | undefined> {
    const [result] = await db
      .update(transfers)
      .set({ status, updatedAt: new Date(), ...updates })
      .where(eq(transfers.id, id))
      .returning();
    return result;
  }

  async getTransfersByUserId(userId: string): Promise<Transfer[]> {
    return await db.select().from(transfers).where(eq(transfers.userId, userId)).orderBy(desc(transfers.createdAt));
  }

  // Password reset token methods
  async createPasswordResetToken(data: InsertPasswordResetToken): Promise<PasswordResetToken> {
    const [result] = await db.insert(passwordResetTokens).values(data).returning();
    return result;
  }

  /**
   * Atomically consume a password reset token. Returns the row only if it
   * was unused AND not expired AT THE MOMENT of the update — eliminates the
   * SELECT-then-UPDATE race where two callers could both pass the
   * "not used yet" check. The conditional UPDATE ... RETURNING is the
   * single source of truth.
   */
  async consumePasswordResetToken(tokenHash: string): Promise<PasswordResetToken | undefined> {
    const now = new Date();
    const [result] = await db.update(passwordResetTokens)
      .set({ usedAt: now })
      .where(and(
        eq(passwordResetTokens.tokenHash, tokenHash),
        sql`${passwordResetTokens.usedAt} IS NULL`,
        sql`${passwordResetTokens.expiresAt} > ${now}`,
      ))
      .returning();
    return result;
  }

  async invalidatePasswordResetTokensForUser(userId: string): Promise<void> {
    // Mark all unused tokens for this user as used (defensive: prevents
    // re-use of any outstanding token after a successful password change).
    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(and(eq(passwordResetTokens.userId, userId), sql`${passwordResetTokens.usedAt} IS NULL`));
  }

  /**
   * Wipe every active session for a user after a sensitive event
   * (password reset). Covers both:
   *   - express-session rows in `sessions` (sid PK, sess jsonb)
   *   - app-level user_sessions rows (used by native auth tokens)
   */
  async invalidateAllUserSessions(userId: string): Promise<void> {
    await db.execute(sql`DELETE FROM sessions WHERE sess->>'userId' = ${userId}`);
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
  }

  // Email verification token methods
  async createEmailVerificationToken(data: InsertEmailVerificationToken): Promise<EmailVerificationToken> {
    const [result] = await db.insert(emailVerificationTokens).values(data).returning();
    return result;
  }

  /**
   * Atomically consume an email verification token. Same single-update
   * pattern as password reset: returns the row only if it was unused AND
   * not expired AT THE MOMENT of the update.
   */
  async consumeEmailVerificationToken(tokenHash: string): Promise<EmailVerificationToken | undefined> {
    const now = new Date();
    const [result] = await db.update(emailVerificationTokens)
      .set({ usedAt: now })
      .where(and(
        eq(emailVerificationTokens.tokenHash, tokenHash),
        sql`${emailVerificationTokens.usedAt} IS NULL`,
        sql`${emailVerificationTokens.expiresAt} > ${now}`,
      ))
      .returning();
    return result;
  }

  async invalidateEmailVerificationTokensForUser(userId: string): Promise<void> {
    await db.update(emailVerificationTokens)
      .set({ usedAt: new Date() })
      .where(and(
        eq(emailVerificationTokens.userId, userId),
        sql`${emailVerificationTokens.usedAt} IS NULL`,
      ));
  }

  async markUserEmailVerified(userId: string, when: Date = new Date()): Promise<void> {
    await db.update(users).set({ emailVerifiedAt: when }).where(eq(users.id, userId));
  }
}

// Use DatabaseStorage for persistent data (production)
export const storage = new DatabaseStorage();
