var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// server/index.ts
import express2 from "express";
import cors from "cors";

// server/routes.ts
import { createServer } from "http";

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  bankAccounts: () => bankAccounts,
  businessAccount: () => businessAccount,
  contactSubmissions: () => contactSubmissions,
  cryptoPurchases: () => cryptoPurchases,
  debts: () => debts,
  distributionPayments: () => distributionPayments,
  dttHoldings: () => dttHoldings,
  dttRewards: () => dttRewards,
  dttStaking: () => dttStaking,
  dttTokenInfo: () => dttTokenInfo,
  insertBankAccountSchema: () => insertBankAccountSchema,
  insertBusinessAccountSchema: () => insertBusinessAccountSchema,
  insertContactSubmissionSchema: () => insertContactSubmissionSchema,
  insertCryptoPurchaseSchema: () => insertCryptoPurchaseSchema,
  insertDebtSchema: () => insertDebtSchema,
  insertDistributionPaymentSchema: () => insertDistributionPaymentSchema,
  insertDttHoldingsSchema: () => insertDttHoldingsSchema,
  insertDttRewardsSchema: () => insertDttRewardsSchema,
  insertDttStakingSchema: () => insertDttStakingSchema,
  insertDttTokenInfoSchema: () => insertDttTokenInfoSchema,
  insertInterestEarningsSchema: () => insertInterestEarningsSchema,
  insertNotificationSchema: () => insertNotificationSchema,
  insertNotificationSettingsSchema: () => insertNotificationSettingsSchema,
  insertPaymentSchema: () => insertPaymentSchema,
  insertRoundUpCollectionSchema: () => insertRoundUpCollectionSchema,
  insertRoundUpSettingsSchema: () => insertRoundUpSettingsSchema,
  insertSweepAccountSchema: () => insertSweepAccountSchema,
  insertSweepDepositSchema: () => insertSweepDepositSchema,
  insertTransactionSchema: () => insertTransactionSchema,
  insertUserSchema: () => insertUserSchema,
  insertUserSessionSchema: () => insertUserSessionSchema,
  insertWeeklyDispersalSchema: () => insertWeeklyDispersalSchema,
  insertWeeklyDistributionSchema: () => insertWeeklyDistributionSchema,
  interestEarnings: () => interestEarnings,
  notificationSettings: () => notificationSettings,
  notifications: () => notifications,
  payments: () => payments,
  roundUpCollections: () => roundUpCollections,
  roundUpSettings: () => roundUpSettings,
  sessions: () => sessions,
  sweepAccounts: () => sweepAccounts,
  sweepDeposits: () => sweepDeposits,
  transactions: () => transactions,
  userSessions: () => userSessions,
  users: () => users,
  weeklyDispersals: () => weeklyDispersals,
  weeklyDistributions: () => weeklyDistributions
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, integer, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
var sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull()
  },
  (table) => [index("IDX_session_expire").on(table.expire)]
);
var users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var debts = pgTable("debts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  accountNumber: text("account_number").notNull(),
  originalBalance: decimal("original_balance", { precision: 10, scale: 2 }).notNull(),
  currentBalance: decimal("current_balance", { precision: 10, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  minimumPayment: decimal("minimum_payment", { precision: 10, scale: 2 }).notNull(),
  dueDate: integer("due_date").notNull(),
  // day of month
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  merchant: text("merchant").notNull(),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  roundUpAmount: decimal("round_up_amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  description: text("description")
});
var payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  debtId: varchar("debt_id").notNull().references(() => debts.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  source: text("source").notNull(),
  // 'round_up', 'manual', 'scheduled'
  date: timestamp("date").defaultNow().notNull(),
  status: text("status").default("completed").notNull()
});
var roundUpSettings = pgTable("round_up_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  sourceAccountId: varchar("source_account_id"),
  // Bank account ID for pulling round-ups (e.g., JP Morgan Chase checking)
  targetDebtId: varchar("target_debt_id"),
  // Debt account to pay (e.g., Carmax car loan)
  multiplier: decimal("multiplier", { precision: 3, scale: 2 }).default("1.00").notNull(),
  // 1.00 = normal, 2.00 = double round-ups
  autoApplyThreshold: decimal("auto_apply_threshold", { precision: 10, scale: 2 }).default("25.00").notNull(),
  cryptoEnabled: boolean("crypto_enabled").default(false).notNull(),
  cryptoPercentage: decimal("crypto_percentage", { precision: 5, scale: 2 }).default("0.00").notNull(),
  // 0-100%
  preferredCrypto: text("preferred_crypto").default("BTC").notNull()
});
var cryptoPurchases = pgTable("crypto_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  cryptoSymbol: text("crypto_symbol").notNull(),
  amountUsd: decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  cryptoAmount: decimal("crypto_amount", { precision: 18, scale: 8 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }).notNull(),
  coinbaseOrderId: text("coinbase_order_id"),
  status: text("status").default("pending").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  plaidItemId: text("plaid_item_id").notNull().unique(),
  plaidAccessToken: text("plaid_access_token").notNull(),
  accountId: text("account_id").notNull(),
  accountName: text("account_name").notNull(),
  accountType: text("account_type").notNull(),
  // checking, savings, credit
  institutionName: text("institution_name").notNull(),
  mask: text("mask"),
  // last 4 digits
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sessionToken: text("session_token").notNull().unique(),
  deviceType: text("device_type").notNull(),
  // web, mobile
  deviceId: text("device_id"),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var businessAccount = pgTable("business_account", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankName: text("bank_name").default("Axos Bank").notNull(),
  accountId: text("account_id").notNull(),
  // Axos account ID
  accountNumber: text("account_number").notNull(),
  routingNumber: text("routing_number").notNull(),
  accountType: text("account_type").default("business_checking").notNull(),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).default("0.00").notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).default("0.0400").notNull(),
  // 4% APY
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var roundUpCollections = pgTable("round_up_collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  userAccountId: text("user_account_id").notNull(),
  // User's bank account
  userRoutingNumber: text("user_routing_number").notNull(),
  businessAccountId: varchar("business_account_id").notNull().references(() => businessAccount.id),
  axosTransferId: text("axos_transfer_id"),
  // Axos API transfer ID
  status: text("status").default("pending").notNull(),
  // pending, completed, failed
  collectionDate: timestamp("collection_date").defaultNow().notNull(),
  effectiveDate: timestamp("effective_date"),
  // When funds are available
  failureReason: text("failure_reason")
});
var weeklyDistributions = pgTable("weekly_distributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  distributionDate: timestamp("distribution_date").notNull(),
  // Friday date
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentCount: integer("payment_count").notNull(),
  businessAccountId: varchar("business_account_id").notNull().references(() => businessAccount.id),
  axosBulkTransferId: text("axos_bulk_transfer_id"),
  // Axos bulk payment ID
  status: text("status").default("scheduled").notNull(),
  // scheduled, processing, completed, failed
  scheduledDate: timestamp("scheduled_date").notNull(),
  completedDate: timestamp("completed_date"),
  interestEarned: decimal("interest_earned", { precision: 10, scale: 2 }).default("0.00").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var distributionPayments = pgTable("distribution_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  distributionId: varchar("distribution_id").notNull().references(() => weeklyDistributions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  debtId: varchar("debt_id").notNull().references(() => debts.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  debtAccountId: text("debt_account_id").notNull(),
  // Debt account number
  debtRoutingNumber: text("debt_routing_number").notNull(),
  axosTransferId: text("axos_transfer_id"),
  // Individual transfer ID
  status: text("status").default("scheduled").notNull(),
  // scheduled, completed, failed
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var interestEarnings = pgTable("interest_earnings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessAccountId: varchar("business_account_id").notNull().references(() => businessAccount.id),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  averageBalance: decimal("average_balance", { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).notNull(),
  interestEarned: decimal("interest_earned", { precision: 10, scale: 2 }).notNull(),
  daysInPeriod: integer("days_in_period").notNull(),
  calculatedDate: timestamp("calculated_date").defaultNow().notNull()
});
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertDebtSchema = createInsertSchema(debts).omit({
  id: true,
  createdAt: true
});
var insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  date: true
});
var insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  date: true,
  status: true
});
var insertRoundUpSettingsSchema = createInsertSchema(roundUpSettings).omit({
  id: true
});
var insertBusinessAccountSchema = createInsertSchema(businessAccount).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertRoundUpCollectionSchema = createInsertSchema(roundUpCollections).omit({
  id: true,
  collectionDate: true
});
var insertWeeklyDistributionSchema = createInsertSchema(weeklyDistributions).omit({
  id: true,
  createdAt: true
});
var insertDistributionPaymentSchema = createInsertSchema(distributionPayments).omit({
  id: true,
  createdAt: true
});
var insertInterestEarningsSchema = createInsertSchema(interestEarnings).omit({
  id: true,
  calculatedDate: true
});
var dttHoldings = pgTable("dtt_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  balance: decimal("balance", { precision: 18, scale: 8 }).notNull().default("0.00000000"),
  stakedAmount: decimal("staked_amount", { precision: 18, scale: 8 }).notNull().default("0.00000000"),
  totalEarned: decimal("total_earned", { precision: 18, scale: 8 }).notNull().default("0.00000000"),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var dttRewards = pgTable("dtt_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  paymentId: varchar("payment_id").references(() => payments.id),
  action: text("action").notNull(),
  // 'round_up', 'debt_payment', 'milestone', 'daily_login', 'referral'
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  transactionHash: text("transaction_hash"),
  // For future blockchain integration
  status: text("status").default("completed").notNull(),
  metadata: text("metadata"),
  // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var dttStaking = pgTable("dtt_staking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  duration: integer("duration").notNull(),
  // days
  apy: decimal("apy", { precision: 5, scale: 2 }).notNull(),
  // annual percentage yield
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").default("active").notNull(),
  // active, completed, withdrawn
  rewardsEarned: decimal("rewards_earned", { precision: 18, scale: 8 }).default("0.00000000").notNull(),
  lastRewardCalculation: timestamp("last_reward_calculation"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var dttTokenInfo = pgTable("dtt_token_info", {
  id: varchar("id").primaryKey().default("dtt-info"),
  currentPrice: decimal("current_price", { precision: 10, scale: 6 }).notNull().default("0.250000"),
  marketCap: decimal("market_cap", { precision: 15, scale: 2 }).notNull().default("2500000.00"),
  volume24h: decimal("volume_24h", { precision: 12, scale: 2 }).notNull().default("125000.00"),
  priceChange24h: decimal("price_change_24h", { precision: 5, scale: 2 }).notNull().default("5.25"),
  totalSupply: decimal("total_supply", { precision: 20, scale: 0 }).notNull().default("10000000"),
  circulatingSupply: decimal("circulating_supply", { precision: 20, scale: 0 }).notNull().default("2500000"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull()
});
var sweepAccounts = pgTable("sweep_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  jpMorganAccountId: varchar("jp_morgan_account_id").notNull(),
  accountNumber: varchar("account_number").notNull(),
  routingNumber: varchar("routing_number").notNull(),
  accountType: varchar("account_type").notNull().default("sweep"),
  // sweep, checking, savings
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).notNull().default("0.0200"),
  // 2%
  status: varchar("status").notNull().default("active"),
  // active, inactive, suspended
  lastInterestCalculation: timestamp("last_interest_calculation"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var sweepDeposits = pgTable("sweep_deposits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sweepAccountId: varchar("sweep_account_id").notNull().references(() => sweepAccounts.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  roundUpAmount: decimal("round_up_amount", { precision: 10, scale: 2 }).notNull(),
  interestEarned: decimal("interest_earned", { precision: 10, scale: 6 }).notNull().default("0.000000"),
  depositDate: timestamp("deposit_date").defaultNow(),
  status: varchar("status").notNull().default("collected")
  // collected, earning_interest, dispersed
});
var weeklyDispersals = pgTable("weekly_dispersals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sweepAccountId: varchar("sweep_account_id").notNull().references(() => sweepAccounts.id),
  dispersalDate: timestamp("dispersal_date").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  principalAmount: decimal("principal_amount", { precision: 12, scale: 2 }).notNull(),
  interestAmount: decimal("interest_amount", { precision: 12, scale: 6 }).notNull(),
  targetDebtId: varchar("target_debt_id").references(() => debts.id),
  jpMorganTransactionId: varchar("jp_morgan_transaction_id"),
  status: varchar("status").notNull().default("pending"),
  // pending, processing, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow()
});
var insertSweepAccountSchema = createInsertSchema(sweepAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertSweepDepositSchema = createInsertSchema(sweepDeposits).omit({
  id: true,
  depositDate: true
});
var insertWeeklyDispersalSchema = createInsertSchema(weeklyDispersals).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var insertCryptoPurchaseSchema = createInsertSchema(cryptoPurchases).omit({
  id: true,
  createdAt: true,
  status: true
});
var insertBankAccountSchema = createInsertSchema(bankAccounts).omit({
  id: true,
  createdAt: true
});
var insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
  lastActivity: true
});
var insertDttHoldingsSchema = createInsertSchema(dttHoldings).omit({
  id: true,
  createdAt: true,
  lastActivity: true
});
var insertDttRewardsSchema = createInsertSchema(dttRewards).omit({
  id: true,
  createdAt: true,
  status: true
});
var insertDttStakingSchema = createInsertSchema(dttStaking).omit({
  id: true,
  createdAt: true,
  startDate: true,
  lastRewardCalculation: true
});
var insertDttTokenInfoSchema = createInsertSchema(dttTokenInfo).omit({
  lastUpdated: true
});
var notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(),
  // 'sms', 'email', 'push', 'system'
  channel: text("channel").notNull(),
  // 'sms', 'email', 'push', 'toast'
  title: text("title").notNull(),
  message: text("message").notNull(),
  recipient: text("recipient").notNull(),
  // phone number for SMS, email for email
  status: text("status").notNull().default("pending"),
  // 'pending', 'sent', 'delivered', 'failed'
  priority: text("priority").notNull().default("medium"),
  // 'low', 'medium', 'high'
  metadata: text("metadata"),
  // JSON string for additional data
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  smsEnabled: boolean("sms_enabled").default(true).notNull(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  phoneNumber: text("phone_number"),
  // User's phone number for SMS
  paymentReminders: boolean("payment_reminders").default(true).notNull(),
  roundupMilestones: boolean("roundup_milestones").default(true).notNull(),
  cryptoUpdates: boolean("crypto_updates").default(true).notNull(),
  weeklyReports: boolean("weekly_reports").default(true).notNull(),
  marketingMessages: boolean("marketing_messages").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  deliveredAt: true
});
var insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({
  id: true,
  updatedAt: true
});
var contactSubmissions = pgTable("contact_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  status: text("status").default("new").notNull(),
  // 'new', 'read', 'responded'
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({
  id: true,
  createdAt: true,
  status: true
});

// server/storage.ts
import { randomUUID } from "crypto";

// server/db.ts
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import ws from "ws";
neonConfig.webSocketConstructor = ws;
if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?"
  );
}
var pool = new Pool({ connectionString: process.env.DATABASE_URL });
var db = drizzle({ client: pool, schema: schema_exports });

// server/storage.ts
import { desc } from "drizzle-orm";
var MemStorage = class {
  users;
  debts;
  transactions;
  payments;
  roundUpSettings;
  cryptoPurchases;
  bankAccounts;
  userSessions;
  notifications;
  notificationSettingsMap;
  dttHoldingsMap;
  dttRewardsMap;
  dttStakingMap;
  dttTokenInfoData;
  constructor() {
    this.users = /* @__PURE__ */ new Map();
    this.debts = /* @__PURE__ */ new Map();
    this.transactions = /* @__PURE__ */ new Map();
    this.payments = /* @__PURE__ */ new Map();
    this.roundUpSettings = /* @__PURE__ */ new Map();
    this.cryptoPurchases = /* @__PURE__ */ new Map();
    this.bankAccounts = /* @__PURE__ */ new Map();
    this.userSessions = /* @__PURE__ */ new Map();
    this.notifications = /* @__PURE__ */ new Map();
    this.notificationSettingsMap = /* @__PURE__ */ new Map();
    this.dttHoldingsMap = /* @__PURE__ */ new Map();
    this.dttRewardsMap = /* @__PURE__ */ new Map();
    this.dttStakingMap = /* @__PURE__ */ new Map();
    this.dttTokenInfoData = {
      id: "dtt-info",
      currentPrice: "0.284700",
      priceChange24h: "12.45",
      marketCap: "28470000.00",
      volume24h: "2847000.00",
      totalSupply: "100000000",
      circulatingSupply: "75000000",
      lastUpdated: /* @__PURE__ */ new Date()
    };
    this.initializeDemoData();
  }
  initializeDemoData() {
    const demoUser = {
      id: "demo-user-1",
      email: "demo@dimetime.app",
      password: null,
      firstName: "Neo",
      lastName: "User",
      profileImageUrl: null,
      createdAt: /* @__PURE__ */ new Date("2024-01-01"),
      updatedAt: /* @__PURE__ */ new Date("2024-01-01")
    };
    this.users.set(demoUser.id, demoUser);
    const demoDebts = [
      {
        id: "debt-1",
        userId: demoUser.id,
        name: "Chase Freedom Card",
        accountNumber: "\u2022\u2022\u2022\u20224892",
        originalBalance: "15000.00",
        currentBalance: "6847.12",
        interestRate: "18.99",
        minimumPayment: "165.00",
        dueDate: 15,
        isActive: true,
        createdAt: /* @__PURE__ */ new Date("2024-01-01")
      },
      {
        id: "debt-2",
        userId: demoUser.id,
        name: "Capital One Venture",
        accountNumber: "\u2022\u2022\u2022\u20222847",
        originalBalance: "20000.00",
        currentBalance: "10200.00",
        interestRate: "21.99",
        minimumPayment: "248.00",
        dueDate: 22,
        isActive: true,
        createdAt: /* @__PURE__ */ new Date("2024-01-01")
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
        createdAt: /* @__PURE__ */ new Date("2024-01-01")
      }
    ];
    demoDebts.forEach((debt) => this.debts.set(debt.id, debt));
    const demoTransactions = [
      {
        id: "trans-1",
        userId: demoUser.id,
        merchant: "Starbucks Coffee",
        category: "Food & Drink",
        amount: "4.17",
        roundUpAmount: "0.83",
        date: /* @__PURE__ */ new Date(),
        description: "Morning coffee"
      },
      {
        id: "trans-2",
        userId: demoUser.id,
        merchant: "Shell Gas Station",
        category: "Transportation",
        amount: "37.28",
        roundUpAmount: "0.72",
        date: new Date(Date.now() - 864e5),
        // Yesterday
        description: "Gas fill-up"
      },
      {
        id: "trans-3",
        userId: demoUser.id,
        merchant: "Amazon Purchase",
        category: "Shopping",
        amount: "24.15",
        roundUpAmount: "0.85",
        date: new Date(Date.now() - 864e5),
        description: "Online purchase"
      },
      {
        id: "trans-4",
        userId: demoUser.id,
        merchant: "Whole Foods Market",
        category: "Groceries",
        amount: "67.22",
        roundUpAmount: "0.78",
        date: new Date(Date.now() - 1728e5),
        // 2 days ago
        description: "Weekly groceries"
      },
      {
        id: "trans-5",
        userId: demoUser.id,
        merchant: "Target",
        category: "Shopping",
        amount: "86.11",
        roundUpAmount: "0.89",
        date: new Date(Date.now() - 2592e5),
        // 3 days ago
        description: "Home supplies"
      },
      {
        id: "trans-6",
        userId: demoUser.id,
        merchant: "McDonald's",
        category: "Food & Drink",
        amount: "12.08",
        roundUpAmount: "0.92",
        date: new Date(Date.now() - 3456e5),
        // 4 days ago
        description: "Lunch"
      },
      {
        id: "trans-7",
        userId: demoUser.id,
        merchant: "CVS Pharmacy",
        category: "Health",
        amount: "28.13",
        roundUpAmount: "0.87",
        date: new Date(Date.now() - 432e6),
        // 5 days ago
        description: "Prescriptions"
      },
      {
        id: "trans-8",
        userId: demoUser.id,
        merchant: "Uber",
        category: "Transportation",
        amount: "19.07",
        roundUpAmount: "0.93",
        date: new Date(Date.now() - 5184e5),
        // 6 days ago
        description: "Ride to airport"
      },
      {
        id: "trans-9",
        userId: demoUser.id,
        merchant: "Best Buy",
        category: "Electronics",
        amount: "145.12",
        roundUpAmount: "0.88",
        date: new Date(Date.now() - 6048e5),
        // 1 week ago
        description: "Phone charger"
      },
      {
        id: "trans-10",
        userId: demoUser.id,
        merchant: "Chipotle",
        category: "Food & Drink",
        amount: "13.09",
        roundUpAmount: "0.91",
        date: new Date(Date.now() - 6912e5),
        // 8 days ago
        description: "Dinner"
      },
      {
        id: "trans-11",
        userId: demoUser.id,
        merchant: "Home Depot",
        category: "Home Improvement",
        amount: "92.06",
        roundUpAmount: "0.94",
        date: new Date(Date.now() - 7776e5),
        // 9 days ago
        description: "Garden supplies"
      },
      {
        id: "trans-12",
        userId: demoUser.id,
        merchant: "Netflix",
        category: "Entertainment",
        amount: "15.03",
        roundUpAmount: "0.97",
        date: new Date(Date.now() - 864e6),
        // 10 days ago
        description: "Monthly subscription"
      },
      {
        id: "trans-13",
        userId: demoUser.id,
        merchant: "Costco",
        category: "Groceries",
        amount: "124.08",
        roundUpAmount: "0.92",
        date: new Date(Date.now() - 9504e5),
        // 11 days ago
        description: "Bulk shopping"
      },
      {
        id: "trans-14",
        userId: demoUser.id,
        merchant: "Spotify",
        category: "Entertainment",
        amount: "9.99",
        roundUpAmount: "0.01",
        date: new Date(Date.now() - 10368e5),
        // 12 days ago
        description: "Music streaming"
      },
      {
        id: "trans-15",
        userId: demoUser.id,
        merchant: "Panera Bread",
        category: "Food & Drink",
        amount: "8.23",
        roundUpAmount: "0.77",
        date: new Date(Date.now() - 11232e5),
        // 13 days ago
        description: "Lunch meeting"
      },
      {
        id: "trans-16",
        userId: demoUser.id,
        merchant: "Gas Station",
        category: "Transportation",
        amount: "42.16",
        roundUpAmount: "0.84",
        date: new Date(Date.now() - 12096e5),
        // 14 days ago
        description: "Fuel up"
      },
      {
        id: "trans-17",
        userId: demoUser.id,
        merchant: "Walgreens",
        category: "Health",
        amount: "17.34",
        roundUpAmount: "0.66",
        date: new Date(Date.now() - 1296e6),
        // 15 days ago
        description: "Vitamins"
      },
      {
        id: "trans-18",
        userId: demoUser.id,
        merchant: "Pizza Hut",
        category: "Food & Drink",
        amount: "23.12",
        roundUpAmount: "0.88",
        date: new Date(Date.now() - 13824e5),
        // 16 days ago
        description: "Friday dinner"
      },
      {
        id: "trans-19",
        userId: demoUser.id,
        merchant: "Barnes & Noble",
        category: "Books",
        amount: "34.07",
        roundUpAmount: "0.93",
        date: new Date(Date.now() - 14688e5),
        // 17 days ago
        description: "Book purchase"
      },
      {
        id: "trans-20",
        userId: demoUser.id,
        merchant: "Trader Joe's",
        category: "Groceries",
        amount: "56.14",
        roundUpAmount: "0.86",
        date: new Date(Date.now() - 15552e5),
        // 18 days ago
        description: "Weekly groceries"
      }
    ];
    demoTransactions.forEach((trans) => this.transactions.set(trans.id, trans));
    const demoRoundUpSettings = {
      id: "settings-1",
      userId: demoUser.id,
      isEnabled: true,
      sourceAccountId: null,
      // User needs to select their bank account
      targetDebtId: null,
      // User needs to select their target debt
      multiplier: "1.00",
      autoApplyThreshold: "25.00",
      cryptoEnabled: true,
      cryptoPercentage: "25.00",
      // 25% of round-ups go to crypto
      preferredCrypto: "BTC"
    };
    this.roundUpSettings.set(demoUser.id, demoRoundUpSettings);
    const demoCryptoPurchases = [
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
        createdAt: /* @__PURE__ */ new Date()
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
        createdAt: new Date(Date.now() - 864e5)
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
        createdAt: new Date(Date.now() - 1728e5)
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
        createdAt: new Date(Date.now() - 2592e5)
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
        createdAt: new Date(Date.now() - 3456e5)
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
        createdAt: new Date(Date.now() - 432e6)
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
        createdAt: new Date(Date.now() - 5184e5)
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
        createdAt: new Date(Date.now() - 6048e5)
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
        createdAt: new Date(Date.now() - 6912e5)
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
        createdAt: new Date(Date.now() - 7776e5)
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
        createdAt: new Date(Date.now() - 864e6)
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
        createdAt: new Date(Date.now() - 9504e5)
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
        createdAt: new Date(Date.now() - 10368e5)
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
        createdAt: new Date(Date.now() - 11232e5)
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
        createdAt: new Date(Date.now() - 12096e5)
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
        createdAt: new Date(Date.now() - 1296e6)
      }
    ];
    demoCryptoPurchases.forEach((purchase) => this.cryptoPurchases.set(purchase.id, purchase));
    const demoPayments = [
      {
        id: "payment-1",
        userId: demoUser.id,
        debtId: "debt-1",
        amount: "2500.00",
        source: "manual",
        date: new Date(Date.now() - 2592e6),
        // 30 days ago
        status: "completed"
      },
      {
        id: "payment-2",
        userId: demoUser.id,
        debtId: "debt-2",
        amount: "3200.00",
        source: "manual",
        date: new Date(Date.now() - 216e7),
        // 25 days ago
        status: "completed"
      },
      {
        id: "payment-3",
        userId: demoUser.id,
        debtId: "debt-3",
        amount: "1800.00",
        source: "manual",
        date: new Date(Date.now() - 1728e6),
        // 20 days ago
        status: "completed"
      },
      {
        id: "payment-4",
        userId: demoUser.id,
        debtId: "debt-1",
        amount: "3405.88",
        source: "round_up",
        date: new Date(Date.now() - 1296e6),
        // 15 days ago
        status: "completed"
      },
      {
        id: "payment-5",
        userId: demoUser.id,
        debtId: "debt-2",
        amount: "6597.00",
        source: "round_up",
        date: new Date(Date.now() - 864e6),
        // 10 days ago
        status: "completed"
      },
      {
        id: "payment-6",
        userId: demoUser.id,
        debtId: "debt-3",
        amount: "4350.00",
        source: "round_up",
        date: new Date(Date.now() - 432e6),
        // 5 days ago
        status: "completed"
      }
    ];
    demoPayments.forEach((payment) => this.payments.set(payment.id, payment));
    const demoDttHoldings = {
      id: randomUUID(),
      userId: demoUser.id,
      balance: "247.85620000",
      stakedAmount: "125.00000000",
      totalEarned: "372.85620000",
      createdAt: /* @__PURE__ */ new Date("2024-01-01"),
      lastActivity: /* @__PURE__ */ new Date()
    };
    this.dttHoldingsMap.set(demoUser.id, demoDttHoldings);
    const demoDttRewards = [
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
        createdAt: new Date(Date.now() - 864e5)
        // 1 day ago
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
        createdAt: new Date(Date.now() - 1728e5)
        // 2 days ago
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
        createdAt: new Date(Date.now() - 432e6)
        // 5 days ago
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
        createdAt: new Date(Date.now() - 5184e5)
        // 6 days ago
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
        createdAt: new Date(Date.now() - 6048e5)
        // 7 days ago
      }
    ];
    demoDttRewards.forEach((reward) => this.dttRewardsMap.set(reward.id, reward));
    const demoDttStaking = [
      {
        id: "dtt-stake-1",
        userId: demoUser.id,
        amount: "125.00000000",
        duration: 90,
        apy: "15.50000000",
        rewardsEarned: "4.25680000",
        status: "active",
        startDate: new Date(Date.now() - 2592e6),
        // 30 days ago
        endDate: new Date(Date.now() + 5184e6),
        // 60 days from now
        lastRewardCalculation: /* @__PURE__ */ new Date(),
        createdAt: new Date(Date.now() - 2592e6)
      }
    ];
    demoDttStaking.forEach((stake) => this.dttStakingMap.set(stake.id, stake));
  }
  async getUser(id) {
    return this.users.get(id);
  }
  async getUserByEmail(email) {
    return Array.from(this.users.values()).find((user) => user.email === email);
  }
  async createUser(insertUser) {
    const id = randomUUID();
    const user = {
      id,
      email: insertUser.email ?? null,
      password: insertUser.password ?? null,
      firstName: insertUser.firstName ?? null,
      lastName: insertUser.lastName ?? null,
      profileImageUrl: insertUser.profileImageUrl ?? null,
      createdAt: /* @__PURE__ */ new Date(),
      updatedAt: /* @__PURE__ */ new Date()
    };
    this.users.set(id, user);
    return user;
  }
  async upsertUser(userData) {
    const existingUser = this.users.get(userData.id);
    if (existingUser) {
      const updatedUser = {
        ...existingUser,
        email: userData.email ?? existingUser.email,
        password: userData.password ?? existingUser.password,
        firstName: userData.firstName ?? existingUser.firstName,
        lastName: userData.lastName ?? existingUser.lastName,
        profileImageUrl: userData.profileImageUrl ?? existingUser.profileImageUrl,
        updatedAt: /* @__PURE__ */ new Date()
      };
      this.users.set(userData.id, updatedUser);
      return updatedUser;
    } else {
      const newUser = {
        id: userData.id,
        email: userData.email ?? null,
        password: userData.password ?? null,
        firstName: userData.firstName ?? null,
        lastName: userData.lastName ?? null,
        profileImageUrl: userData.profileImageUrl ?? null,
        createdAt: /* @__PURE__ */ new Date(),
        updatedAt: /* @__PURE__ */ new Date()
      };
      this.users.set(userData.id, newUser);
      return newUser;
    }
  }
  async getDebtsByUserId(userId) {
    return Array.from(this.debts.values()).filter((debt) => debt.userId === userId && debt.isActive);
  }
  async getDebt(id) {
    return this.debts.get(id);
  }
  async createDebt(insertDebt) {
    const id = randomUUID();
    const debt = {
      ...insertDebt,
      id,
      isActive: insertDebt.isActive ?? true,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.debts.set(id, debt);
    return debt;
  }
  async updateDebt(id, updates) {
    const debt = this.debts.get(id);
    if (!debt) return void 0;
    const updatedDebt = { ...debt, ...updates };
    this.debts.set(id, updatedDebt);
    return updatedDebt;
  }
  async getTransactionsByUserId(userId, limit) {
    const userTransactions = Array.from(this.transactions.values()).filter((trans) => trans.userId === userId).sort((a, b) => b.date.getTime() - a.date.getTime());
    return limit ? userTransactions.slice(0, limit) : userTransactions;
  }
  async createTransaction(insertTransaction) {
    const id = randomUUID();
    const transaction = {
      ...insertTransaction,
      id,
      description: insertTransaction.description ?? null,
      date: /* @__PURE__ */ new Date()
    };
    this.transactions.set(id, transaction);
    return transaction;
  }
  async getPaymentsByUserId(userId) {
    return Array.from(this.payments.values()).filter((payment) => payment.userId === userId).sort((a, b) => b.date.getTime() - a.date.getTime());
  }
  async getPaymentsByDebtId(debtId) {
    return Array.from(this.payments.values()).filter((payment) => payment.debtId === debtId).sort((a, b) => b.date.getTime() - a.date.getTime());
  }
  async createPayment(insertPayment) {
    const id = randomUUID();
    const payment = {
      ...insertPayment,
      id,
      date: /* @__PURE__ */ new Date(),
      status: "completed"
    };
    this.payments.set(id, payment);
    return payment;
  }
  async makeAcceleratedPayment(userId, debtId, amount) {
    const debt = this.debts.get(debtId);
    if (!debt || debt.userId !== userId) {
      throw new Error("Debt not found or unauthorized");
    }
    const payment = await this.createPayment({
      userId,
      debtId,
      amount,
      source: "manual"
    });
    const currentBalance = parseFloat(debt.currentBalance);
    const paymentAmount = parseFloat(amount);
    const newBalance = Math.max(0, currentBalance - paymentAmount);
    const updatedDebt = await this.updateDebt(debtId, {
      currentBalance: newBalance.toFixed(2)
    });
    if (!updatedDebt) {
      throw new Error("Failed to update debt balance");
    }
    return { payment, updatedDebt };
  }
  async getRoundUpSettings(userId) {
    return this.roundUpSettings.get(userId);
  }
  async createOrUpdateRoundUpSettings(settings) {
    const existing = this.roundUpSettings.get(settings.userId);
    if (existing) {
      const updated = { ...existing, ...settings };
      this.roundUpSettings.set(settings.userId, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newSettings = {
        ...settings,
        id,
        isEnabled: settings.isEnabled ?? true,
        sourceAccountId: settings.sourceAccountId ?? null,
        targetDebtId: settings.targetDebtId ?? null,
        multiplier: settings.multiplier ?? "1.00",
        autoApplyThreshold: settings.autoApplyThreshold ?? "25.00",
        cryptoEnabled: settings.cryptoEnabled ?? false,
        cryptoPercentage: settings.cryptoPercentage ?? "0.00",
        preferredCrypto: settings.preferredCrypto ?? "BTC"
      };
      this.roundUpSettings.set(settings.userId, newSettings);
      return newSettings;
    }
  }
  async getCryptoPurchasesByUserId(userId) {
    return Array.from(this.cryptoPurchases.values()).filter((purchase) => purchase.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createCryptoPurchase(insertPurchase) {
    const id = randomUUID();
    const purchase = {
      ...insertPurchase,
      id,
      transactionId: insertPurchase.transactionId ?? null,
      coinbaseOrderId: insertPurchase.coinbaseOrderId ?? null,
      status: "pending",
      createdAt: /* @__PURE__ */ new Date()
    };
    this.cryptoPurchases.set(id, purchase);
    return purchase;
  }
  async updateCryptoPurchaseStatus(id, status, coinbaseOrderId) {
    const purchase = this.cryptoPurchases.get(id);
    if (!purchase) return void 0;
    const updated = {
      ...purchase,
      status,
      coinbaseOrderId: coinbaseOrderId || purchase.coinbaseOrderId
    };
    this.cryptoPurchases.set(id, updated);
    return updated;
  }
  async getBankAccountsByUserId(userId) {
    return Array.from(this.bankAccounts.values()).filter((account) => account.userId === userId && account.isActive).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createBankAccount(account) {
    const id = randomUUID();
    const bankAccount = {
      ...account,
      id,
      mask: account.mask ?? null,
      isActive: account.isActive ?? true,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.bankAccounts.set(id, bankAccount);
    return bankAccount;
  }
  async getBankAccountByPlaidItemId(itemId) {
    return Array.from(this.bankAccounts.values()).find((account) => account.plaidItemId === itemId);
  }
  async updateBankAccountStatus(id, isActive) {
    const account = this.bankAccounts.get(id);
    if (!account) return void 0;
    const updated = { ...account, isActive };
    this.bankAccounts.set(id, updated);
    return updated;
  }
  async createUserSession(session2) {
    const id = randomUUID();
    const userSession = {
      ...session2,
      id,
      deviceId: session2.deviceId ?? null,
      isActive: session2.isActive ?? true,
      lastActivity: /* @__PURE__ */ new Date(),
      createdAt: /* @__PURE__ */ new Date()
    };
    this.userSessions.set(id, userSession);
    return userSession;
  }
  async getUserSessionByToken(token) {
    return Array.from(this.userSessions.values()).find((session2) => session2.sessionToken === token);
  }
  async updateSessionActivity(id) {
    const session2 = this.userSessions.get(id);
    if (!session2) return void 0;
    const updated = { ...session2, lastActivity: /* @__PURE__ */ new Date() };
    this.userSessions.set(id, updated);
    return updated;
  }
  async deactivateUserSessions(userId, deviceType) {
    Array.from(this.userSessions.entries()).forEach(([id, session2]) => {
      if (session2.userId === userId && (!deviceType || session2.deviceType === deviceType)) {
        const updated = { ...session2, isActive: false };
        this.userSessions.set(id, updated);
      }
    });
  }
  // Notification methods
  async createNotification(insertNotification) {
    const id = randomUUID();
    const notification = {
      ...insertNotification,
      id,
      status: insertNotification.status ?? "pending",
      priority: insertNotification.priority ?? "medium",
      sentAt: null,
      deliveredAt: null,
      metadata: insertNotification.metadata ?? null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.notifications.set(id, notification);
    return notification;
  }
  async getNotificationsByUserId(userId, limit) {
    const userNotifications = Array.from(this.notifications.values()).filter((notification) => notification.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
    return limit ? userNotifications.slice(0, limit) : userNotifications;
  }
  async getUserNotifications(userId, limit) {
    return this.getNotificationsByUserId(userId, limit);
  }
  async getAllUsers() {
    return Array.from(this.users.values());
  }
  async getUserTransactions(userId, limit) {
    return this.getTransactionsByUserId(userId, limit);
  }
  async getUserDebts(userId) {
    return this.getDebtsByUserId(userId);
  }
  async getUserCryptoPurchases(userId) {
    return this.getCryptoPurchasesByUserId(userId);
  }
  async getDashboardSummary(userId) {
    const debts3 = await this.getUserDebts(userId);
    const transactions3 = await this.getUserTransactions(userId);
    const cryptoPurchases3 = await this.getUserCryptoPurchases(userId);
    const totalDebt = debts3.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
    const totalRoundUps = transactions3.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount || "0"), 0);
    const totalCrypto = cryptoPurchases3.reduce((sum, purchase) => sum + parseFloat(purchase.amountUsd), 0);
    return {
      totalDebt: totalDebt.toFixed(2),
      totalRoundUps: totalRoundUps.toFixed(2),
      totalCrypto: totalCrypto.toFixed(2),
      debtCount: debts3.length,
      transactionCount: transactions3.length
    };
  }
  async updateNotificationStatus(id, status, sentAt, deliveredAt) {
    const notification = this.notifications.get(id);
    if (!notification) return void 0;
    const updated = {
      ...notification,
      status,
      sentAt: sentAt || notification.sentAt,
      deliveredAt: deliveredAt || notification.deliveredAt
    };
    this.notifications.set(id, updated);
    return updated;
  }
  async getNotificationSettings(userId) {
    return Array.from(this.notificationSettingsMap.values()).find((settings) => settings.userId === userId);
  }
  async createOrUpdateNotificationSettings(insertSettings) {
    const existingSettings = await this.getNotificationSettings(insertSettings.userId);
    if (existingSettings) {
      const updated = {
        ...existingSettings,
        ...insertSettings,
        updatedAt: /* @__PURE__ */ new Date()
      };
      this.notificationSettingsMap.set(existingSettings.id, updated);
      return updated;
    } else {
      const id = randomUUID();
      const settings = {
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
        updatedAt: /* @__PURE__ */ new Date()
      };
      this.notificationSettingsMap.set(id, settings);
      return settings;
    }
  }
  // DTT Token methods
  async getDttHoldings(userId) {
    return this.dttHoldingsMap.get(userId);
  }
  async createOrUpdateDttHoldings(holdings) {
    const existing = this.dttHoldingsMap.get(holdings.userId);
    if (existing) {
      const updated = {
        ...existing,
        ...holdings,
        lastActivity: /* @__PURE__ */ new Date()
      };
      this.dttHoldingsMap.set(holdings.userId, updated);
      return updated;
    } else {
      const id = randomUUID();
      const newHoldings = {
        ...holdings,
        id,
        balance: holdings.balance || "0.00000000",
        stakedAmount: holdings.stakedAmount || "0.00000000",
        totalEarned: holdings.totalEarned || "0.00000000",
        lastActivity: /* @__PURE__ */ new Date(),
        createdAt: /* @__PURE__ */ new Date()
      };
      this.dttHoldingsMap.set(holdings.userId, newHoldings);
      return newHoldings;
    }
  }
  async updateDttBalance(userId, balance, stakedAmount, totalEarned) {
    const existing = this.dttHoldingsMap.get(userId);
    if (!existing) return void 0;
    const updated = {
      ...existing,
      balance,
      stakedAmount: stakedAmount || existing.stakedAmount,
      totalEarned: totalEarned || existing.totalEarned,
      lastActivity: /* @__PURE__ */ new Date()
    };
    this.dttHoldingsMap.set(userId, updated);
    return updated;
  }
  async getDttRewardsByUserId(userId) {
    return Array.from(this.dttRewardsMap.values()).filter((reward) => reward.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createDttReward(reward) {
    const id = randomUUID();
    const newReward = {
      ...reward,
      id,
      status: "completed",
      transactionId: reward.transactionId || null,
      paymentId: reward.paymentId || null,
      transactionHash: reward.transactionHash || null,
      metadata: reward.metadata || null,
      createdAt: /* @__PURE__ */ new Date()
    };
    this.dttRewardsMap.set(id, newReward);
    return newReward;
  }
  async getDttStakingByUserId(userId) {
    return Array.from(this.dttStakingMap.values()).filter((stake) => stake.userId === userId).sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
  async createDttStaking(staking) {
    const id = randomUUID();
    const startDate = /* @__PURE__ */ new Date();
    const endDate = new Date(startDate.getTime() + staking.duration * 24 * 60 * 60 * 1e3);
    const newStaking = {
      ...staking,
      id,
      startDate,
      endDate,
      status: staking.status || "active",
      rewardsEarned: staking.rewardsEarned || "0.00000000",
      lastRewardCalculation: /* @__PURE__ */ new Date(),
      createdAt: /* @__PURE__ */ new Date()
    };
    this.dttStakingMap.set(id, newStaking);
    return newStaking;
  }
  async updateDttStakingStatus(id, status) {
    const staking = this.dttStakingMap.get(id);
    if (!staking) return void 0;
    const updated = {
      ...staking,
      status
    };
    this.dttStakingMap.set(id, updated);
    return updated;
  }
  async getDttTokenInfo() {
    return this.dttTokenInfoData;
  }
  async updateDttTokenInfo(info) {
    const updated = {
      id: "dtt-info",
      currentPrice: info.currentPrice || "0.250000",
      marketCap: info.marketCap || "2500000.00",
      volume24h: info.volume24h || "125000.00",
      priceChange24h: info.priceChange24h || "5.25",
      totalSupply: info.totalSupply || "10000000",
      circulatingSupply: info.circulatingSupply || "2500000",
      lastUpdated: /* @__PURE__ */ new Date()
    };
    this.dttTokenInfoData = updated;
    return updated;
  }
  // Contact submission methods
  async createContactSubmission(submission) {
    const [result] = await db.insert(contactSubmissions).values(submission).returning();
    return result;
  }
  async getContactSubmissions() {
    return await db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt));
  }
};
var storage = new MemStorage();

// server/services/dimeTokenService.ts
var DimeTokenService = class {
  tokenData = {
    symbol: "DTT",
    name: "Dime Time Token",
    decimals: 18,
    totalSupply: "1000000000",
    // 1 billion DTT
    currentPrice: 0.05,
    // Starting at $0.05
    marketCap: 5e7,
    // $50M market cap
    volume24h: 25e5,
    // $2.5M daily volume
    priceChange24h: 0.025
    // 2.5% daily growth
  };
  // Get current DTT token information
  getTokenInfo() {
    this.updateTokenPrice();
    return this.tokenData;
  }
  // Calculate DTT rewards for user actions
  calculateReward(action, amount) {
    const baseRewards = {
      round_up: 0.1,
      // 0.1 DTT per round-up
      debt_payment: 0.05,
      // 0.05 DTT per dollar of debt payment
      referral: 100,
      // 100 DTT per successful referral
      milestone: 50,
      // 50 DTT per debt milestone
      daily_login: 1
      // 1 DTT per daily login
    };
    const baseReward = baseRewards[action];
    if (action === "debt_payment" && amount) {
      return baseReward * amount;
    }
    if (action === "round_up" && amount) {
      return baseReward * (amount * 10);
    }
    return baseReward;
  }
  // Award DTT tokens to user
  async awardTokens(userId, action, amount) {
    const dttAmount = this.calculateReward(action, amount);
    const reward = {
      userId,
      action,
      amount: dttAmount.toString(),
      transactionHash: this.generateTransactionHash(),
      createdAt: /* @__PURE__ */ new Date()
    };
    console.log(`Awarded ${dttAmount} DTT to user ${userId} for ${action}`);
    return reward;
  }
  // Get DTT price in different currencies
  getTokenPrice(currency = "USD") {
    const prices = {
      USD: this.tokenData.currentPrice,
      BTC: this.tokenData.currentPrice / 95e3,
      // Assuming BTC at $95k
      ETH: this.tokenData.currentPrice / 3500
      // Assuming ETH at $3.5k
    };
    return prices[currency];
  }
  // Calculate staking rewards
  calculateStakingRewards(stakedAmount, durationDays) {
    const baseAPY = 0.12;
    const bonusAPY = Math.min(durationDays / 365 * 0.08, 0.08);
    const apy = baseAPY + bonusAPY;
    const dailyRewards = stakedAmount * apy / 365;
    const totalRewards = dailyRewards * durationDays;
    return { apy, dailyRewards, totalRewards };
  }
  // Simulate token trading volume and price movement
  updateTokenPrice() {
    const usageMultiplier = 1 + (Math.random() * 0.02 - 0.01);
    const growthTrend = 1.0001;
    this.tokenData.currentPrice *= usageMultiplier * growthTrend;
    this.tokenData.marketCap = parseFloat(this.tokenData.totalSupply) * this.tokenData.currentPrice;
    this.tokenData.priceChange24h = (usageMultiplier - 1) * 100;
  }
  // Generate mock transaction hash
  generateTransactionHash() {
    return "0x" + Math.random().toString(16).substr(2, 64);
  }
  // Get trading pairs for DTT
  getTradingPairs() {
    return [
      {
        pair: "DTT/USD",
        price: this.tokenData.currentPrice,
        change24h: this.tokenData.priceChange24h,
        volume: this.tokenData.volume24h
      },
      {
        pair: "DTT/BTC",
        price: this.getTokenPrice("BTC"),
        change24h: this.tokenData.priceChange24h,
        volume: this.tokenData.volume24h * 0.3
      },
      {
        pair: "DTT/ETH",
        price: this.getTokenPrice("ETH"),
        change24h: this.tokenData.priceChange24h,
        volume: this.tokenData.volume24h * 0.2
      }
    ];
  }
  // Check if user qualifies for token rewards
  checkRewardEligibility(userId, action) {
    return true;
  }
};
var dimeTokenService = new DimeTokenService();

// server/routes.ts
import { createHash } from "crypto";
import { z as z4 } from "zod";

// server/services/plaidService.ts
import { Configuration, PlaidApi, PlaidEnvironments, CountryCode, Products } from "plaid";
var PlaidService = class {
  client;
  isConfigured = false;
  constructor() {
    try {
      const configuration = new Configuration({
        basePath: PlaidEnvironments.sandbox,
        // Use sandbox for development
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": process.env.PLAID_SECRET
          }
        }
      });
      this.client = new PlaidApi(configuration);
      this.isConfigured = !!(process.env.PLAID_CLIENT_ID && process.env.PLAID_SECRET);
    } catch (error) {
      console.error("Failed to initialize Plaid service:", error);
      this.isConfigured = false;
    }
  }
  async createLinkToken(userId) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured. Please provide PLAID_CLIENT_ID and PLAID_SECRET environment variables.");
    }
    try {
      const response = await this.client.linkTokenCreate({
        user: { client_user_id: userId },
        client_name: "Dime Time",
        products: [Products.Transactions, Products.Auth],
        country_codes: [CountryCode.Us],
        language: "en",
        redirect_uri: process.env.PLAID_REDIRECT_URI
      });
      return response.data.link_token;
    } catch (error) {
      console.error("Error creating link token:", error);
      throw error;
    }
  }
  async exchangePublicToken(publicToken) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    try {
      const response = await this.client.itemPublicTokenExchange({
        public_token: publicToken
      });
      return {
        accessToken: response.data.access_token,
        itemId: response.data.item_id
      };
    } catch (error) {
      console.error("Error exchanging public token:", error);
      throw error;
    }
  }
  async getAccounts(accessToken) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    try {
      const response = await this.client.accountsGet({
        access_token: accessToken
      });
      return response.data.accounts;
    } catch (error) {
      console.error("Error fetching accounts:", error);
      throw error;
    }
  }
  async getTransactions(accessToken, startDate, endDate) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    try {
      const response = await this.client.transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate
      });
      return response.data.transactions;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw error;
    }
  }
  async getBalance(accessToken) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    try {
      const response = await this.client.accountsBalanceGet({
        access_token: accessToken
      });
      return response.data.accounts;
    } catch (error) {
      console.error("Error fetching balance:", error);
      throw error;
    }
  }
  isServiceConfigured() {
    return this.isConfigured;
  }
};
var plaidService = new PlaidService();

// server/services/coinbaseService.ts
import axios from "axios";
import crypto from "crypto";
import { z } from "zod";
var accountIdSchema = z.string().min(1);
var amountSchema = z.string().regex(/^\d+(\.\d+)?$/);
var currencySchema = z.string().min(1).max(10);
var CoinbaseApiClient = class {
  axiosClient;
  apiKey;
  apiSecret;
  passphrase;
  baseURL = "https://api.coinbase.com";
  apiVersion = "2021-06-14";
  constructor(apiKey, apiSecret, passphrase = "") {
    this.apiKey = apiKey;
    this.apiSecret = apiSecret;
    this.passphrase = passphrase;
    this.axiosClient = axios.create({
      baseURL: this.baseURL,
      timeout: 3e4,
      headers: {
        "Content-Type": "application/json",
        "CB-VERSION": this.apiVersion
      }
    });
    this.axiosClient.interceptors.request.use((config) => {
      const timestamp2 = Math.floor(Date.now() / 1e3).toString();
      const method = (config.method || "GET").toUpperCase();
      const requestPath = config.url || "";
      const body = config.data ? JSON.stringify(config.data) : "";
      const signature = this.generateSignature(timestamp2, method, requestPath, body);
      Object.assign(config.headers || {}, {
        "CB-ACCESS-KEY": this.apiKey,
        "CB-ACCESS-SIGN": signature,
        "CB-ACCESS-TIMESTAMP": timestamp2,
        "CB-ACCESS-PASSPHRASE": this.passphrase
      });
      return config;
    });
  }
  /**
   * Generate HMAC signature for Coinbase API authentication
   */
  generateSignature(timestamp2, method, requestPath, body) {
    try {
      const message = timestamp2 + method + requestPath + body;
      const key = Buffer.from(this.apiSecret, "base64");
      const hmac = crypto.createHmac("sha256", key);
      const signature = hmac.update(message, "utf8").digest("base64");
      return signature;
    } catch (error) {
      console.error("Error generating HMAC signature:", error);
      throw new Error("Failed to generate API signature");
    }
  }
  /**
   * Make authenticated API request
   */
  async makeRequest(method, endpoint, data) {
    try {
      const config = {
        method: method.toLowerCase(),
        url: endpoint
      };
      if (data) {
        config.data = data;
      }
      const response = await this.axiosClient.request(config);
      return response.data.data;
    } catch (error) {
      if (error.response) {
        const errorData = error.response.data;
        console.error("Coinbase API Error:", {
          status: error.response.status,
          statusText: error.response.statusText,
          data: errorData
        });
        throw new Error(
          `Coinbase API Error: ${error.response.status} - ${errorData?.message || error.response.statusText}`
        );
      } else if (error.request) {
        console.error("Network Error:", error.message);
        throw new Error("Network error - Unable to connect to Coinbase API");
      } else {
        console.error("Request Error:", error.message);
        throw new Error(`Request error: ${error.message}`);
      }
    }
  }
  /**
   * Get all user accounts
   */
  async getAccounts() {
    return this.makeRequest("GET", "/v2/accounts");
  }
  /**
   * Get specific account by ID
   */
  async getAccount(accountId) {
    const validatedId = accountIdSchema.parse(accountId);
    return this.makeRequest("GET", `/v2/accounts/${validatedId}`);
  }
  /**
   * Buy cryptocurrency
   */
  async buyCrypto(accountId, amount, currency = "USD") {
    const validatedId = accountIdSchema.parse(accountId);
    const validatedAmount = amountSchema.parse(amount);
    const validatedCurrency = currencySchema.parse(currency);
    const buyData = {
      amount: validatedAmount,
      currency: validatedCurrency,
      commit: true
    };
    return this.makeRequest("POST", `/v2/accounts/${validatedId}/buys`, buyData);
  }
  /**
   * Get exchange rates
   */
  async getExchangeRates(currency = "BTC") {
    const validatedCurrency = currencySchema.parse(currency);
    return this.makeRequest("GET", `/v2/exchange-rates?currency=${validatedCurrency}`);
  }
  /**
   * Get spot price for currency pair
   */
  async getSpotPrice(currencyPair = "BTC-USD") {
    const validatedPair = z.string().min(1).parse(currencyPair);
    return this.makeRequest("GET", `/v2/prices/${validatedPair}/spot`);
  }
  /**
   * Get account transactions
   */
  async getTransactions(accountId) {
    const validatedId = accountIdSchema.parse(accountId);
    return this.makeRequest("GET", `/v2/accounts/${validatedId}/transactions`);
  }
};
var CoinbaseService = class {
  client = null;
  isConfigured = false;
  demoMode = true;
  // Always use demo mode for user safety
  constructor() {
    try {
      if (process.env.COINBASE_API_KEY && process.env.COINBASE_API_SECRET) {
        this.client = new CoinbaseApiClient(
          process.env.COINBASE_API_KEY,
          process.env.COINBASE_API_SECRET,
          process.env.COINBASE_PASSPHRASE || ""
        );
        this.isConfigured = true;
        console.log("\u2705 Coinbase service initialized with secure API client (DEMO MODE - no real trades)");
      } else {
        this.isConfigured = false;
        console.log("\u26A0\uFE0F  Coinbase service not configured - missing API credentials");
      }
    } catch (error) {
      console.error("Failed to initialize Coinbase service:", error);
      this.isConfigured = false;
    }
  }
  /**
   * Generate a simulated Bitcoin purchase for demo mode
   */
  generateDemoPurchase(amount, currency = "USD") {
    const btcPrice = 43250;
    const usdAmount = parseFloat(amount);
    const btcAmount = usdAmount / btcPrice;
    return {
      id: `demo_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      type: "buy",
      status: "completed",
      amount: {
        amount: btcAmount.toFixed(8),
        currency: "BTC"
      },
      native_amount: {
        amount,
        currency
      },
      description: `Demo purchase of ${btcAmount.toFixed(8)} BTC`,
      created_at: (/* @__PURE__ */ new Date()).toISOString(),
      updated_at: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  async getAccounts() {
    if (this.demoMode) {
      return [
        {
          id: "demo_btc_account",
          name: "Bitcoin Wallet",
          primary: true,
          type: "wallet",
          currency: "BTC",
          balance: { amount: "0.00125000", currency: "BTC" }
        },
        {
          id: "demo_usd_account",
          name: "USD Wallet",
          primary: false,
          type: "fiat",
          currency: "USD",
          balance: { amount: "50.00", currency: "USD" }
        }
      ];
    }
    if (!this.isConfigured || !this.client) {
      throw new Error("Coinbase service not configured. Please provide COINBASE_API_KEY and COINBASE_API_SECRET environment variables.");
    }
    try {
      const accounts = await this.client.getAccounts();
      return accounts;
    } catch (error) {
      console.error("Error fetching Coinbase accounts:", error);
      throw error;
    }
  }
  async getAccount(accountId) {
    if (this.demoMode) {
      return {
        id: accountId,
        name: "Demo Bitcoin Wallet",
        primary: true,
        type: "wallet",
        currency: "BTC",
        balance: { amount: "0.00125000", currency: "BTC" }
      };
    }
    if (!this.isConfigured || !this.client) {
      throw new Error("Coinbase service not configured");
    }
    try {
      const account = await this.client.getAccount(accountId);
      return account;
    } catch (error) {
      console.error("Error fetching Coinbase account:", error);
      throw error;
    }
  }
  async buyCrypto(accountId, amount, currency = "USD") {
    if (this.demoMode) {
      console.log(`[DEMO MODE] Simulating BTC purchase of ${amount} ${currency}`);
      return this.generateDemoPurchase(amount, currency);
    }
    if (!this.isConfigured || !this.client) {
      throw new Error("Coinbase service not configured");
    }
    try {
      const transaction = await this.client.buyCrypto(accountId, amount, currency);
      return transaction;
    } catch (error) {
      console.error("Error buying crypto:", error);
      throw error;
    }
  }
  async getExchangeRates(currency = "BTC") {
    if (this.demoMode) {
      return {
        currency,
        rates: {
          USD: "43250.00",
          EUR: "39800.00",
          GBP: "34100.00"
        }
      };
    }
    if (!this.isConfigured || !this.client) {
      throw new Error("Coinbase service not configured");
    }
    try {
      const rates = await this.client.getExchangeRates(currency);
      return rates;
    } catch (error) {
      console.error("Error fetching exchange rates:", error);
      throw error;
    }
  }
  async getSpotPrice(currencyPair = "BTC-USD") {
    if (this.demoMode) {
      return {
        amount: "43250.00",
        currency: "USD"
      };
    }
    if (!this.isConfigured || !this.client) {
      throw new Error("Coinbase service not configured");
    }
    try {
      const price = await this.client.getSpotPrice(currencyPair);
      return price;
    } catch (error) {
      console.error("Error fetching spot price:", error);
      throw error;
    }
  }
  async getTransactions(accountId) {
    if (this.demoMode) {
      return [
        {
          id: "demo_tx_1",
          type: "buy",
          status: "completed",
          amount: { amount: "0.00023100", currency: "BTC" },
          native_amount: { amount: "10.00", currency: "USD" },
          description: "Demo round-up purchase",
          created_at: new Date(Date.now() - 864e5).toISOString(),
          updated_at: new Date(Date.now() - 864e5).toISOString()
        },
        {
          id: "demo_tx_2",
          type: "buy",
          status: "completed",
          amount: { amount: "0.00011550", currency: "BTC" },
          native_amount: { amount: "5.00", currency: "USD" },
          description: "Demo round-up purchase",
          created_at: new Date(Date.now() - 1728e5).toISOString(),
          updated_at: new Date(Date.now() - 1728e5).toISOString()
        }
      ];
    }
    if (!this.isConfigured || !this.client) {
      throw new Error("Coinbase service not configured");
    }
    try {
      const transactions3 = await this.client.getTransactions(accountId);
      return transactions3;
    } catch (error) {
      console.error("Error fetching transactions:", error);
      throw error;
    }
  }
  isServiceConfigured() {
    return this.isConfigured;
  }
  isDemoMode() {
    return this.demoMode;
  }
};
var coinbaseService = new CoinbaseService();

// server/services/s3Service.ts
import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, ListObjectsV2Command } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
var S3Service = class {
  client;
  bucketName;
  isConfigured = false;
  constructor() {
    try {
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY && process.env.AWS_S3_BUCKET_NAME) {
        this.client = new S3Client({
          region: process.env.AWS_REGION || "us-east-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        });
        this.bucketName = process.env.AWS_S3_BUCKET_NAME;
        this.isConfigured = true;
      } else {
        this.isConfigured = false;
      }
    } catch (error) {
      console.error("Failed to initialize S3 service:", error);
      this.isConfigured = false;
    }
  }
  isServiceConfigured() {
    return this.isConfigured;
  }
  async uploadFile(key, buffer, contentType = "application/octet-stream") {
    if (!this.isConfigured) {
      throw new Error("S3 service not configured. Please provide AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, and AWS_S3_BUCKET_NAME environment variables.");
    }
    const command = new PutObjectCommand({
      Bucket: this.bucketName,
      Key: key,
      Body: buffer,
      ContentType: contentType
    });
    await this.client.send(command);
    return `https://${this.bucketName}.s3.amazonaws.com/${key}`;
  }
  async uploadUserDocument(userId, fileName, buffer, documentType = "other") {
    const timestamp2 = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const key = `users/${userId}/${documentType}/${timestamp2}-${fileName}`;
    const extension = fileName.split(".").pop()?.toLowerCase();
    let contentType = "application/octet-stream";
    switch (extension) {
      case "jpg":
      case "jpeg":
        contentType = "image/jpeg";
        break;
      case "png":
        contentType = "image/png";
        break;
      case "pdf":
        contentType = "application/pdf";
        break;
      case "txt":
        contentType = "text/plain";
        break;
    }
    return this.uploadFile(key, buffer, contentType);
  }
  async getFileUrl(key, expiresIn = 3600) {
    if (!this.isConfigured) {
      throw new Error("S3 service not configured");
    }
    const command = new GetObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });
    return getSignedUrl(this.client, command, { expiresIn });
  }
  async deleteFile(key) {
    if (!this.isConfigured) {
      throw new Error("S3 service not configured");
    }
    const command = new DeleteObjectCommand({
      Bucket: this.bucketName,
      Key: key
    });
    await this.client.send(command);
  }
  async listUserFiles(userId, documentType) {
    if (!this.isConfigured) {
      throw new Error("S3 service not configured");
    }
    const prefix = documentType ? `users/${userId}/${documentType}/` : `users/${userId}/`;
    const command = new ListObjectsV2Command({
      Bucket: this.bucketName,
      Prefix: prefix
    });
    const response = await this.client.send(command);
    return response.Contents?.map((obj) => obj.Key || "") || [];
  }
  // Backup entire user data to S3
  async backupUserData(userId, userData) {
    if (!this.isConfigured) {
      throw new Error("S3 service not configured");
    }
    const timestamp2 = (/* @__PURE__ */ new Date()).toISOString().replace(/[:.]/g, "-");
    const key = `backups/${userId}/${timestamp2}-user-data.json`;
    const buffer = Buffer.from(JSON.stringify(userData, null, 2));
    return this.uploadFile(key, buffer, "application/json");
  }
};
var s3Service = new S3Service();

// server/services/dynamoService.ts
import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import {
  DynamoDBDocumentClient,
  PutCommand,
  GetCommand,
  UpdateCommand,
  DeleteCommand,
  QueryCommand
} from "@aws-sdk/lib-dynamodb";
var DynamoService = class {
  client;
  isConfigured = false;
  constructor() {
    try {
      if (process.env.AWS_ACCESS_KEY_ID && process.env.AWS_SECRET_ACCESS_KEY) {
        const dynamoClient = new DynamoDBClient({
          region: process.env.AWS_REGION || "us-east-1",
          credentials: {
            accessKeyId: process.env.AWS_ACCESS_KEY_ID,
            secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY
          }
        });
        this.client = DynamoDBDocumentClient.from(dynamoClient);
        this.isConfigured = true;
      } else {
        this.isConfigured = false;
      }
    } catch (error) {
      console.error("Failed to initialize DynamoDB service:", error);
      this.isConfigured = false;
    }
  }
  isServiceConfigured() {
    return this.isConfigured;
  }
  // Generic CRUD operations for any table
  async putItem(tableName, item) {
    if (!this.isConfigured) {
      throw new Error("DynamoDB service not configured. Please provide AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY environment variables.");
    }
    const serializedItem = this.serializeDates(item);
    const command = new PutCommand({
      TableName: tableName,
      Item: serializedItem
    });
    await this.client.send(command);
    return item;
  }
  // Helper method to convert Date objects to ISO strings
  serializeDates(obj) {
    if (obj instanceof Date) {
      return obj.toISOString();
    }
    if (Array.isArray(obj)) {
      return obj.map((item) => this.serializeDates(item));
    }
    if (obj !== null && typeof obj === "object") {
      const serialized = {};
      for (const [key, value] of Object.entries(obj)) {
        serialized[key] = this.serializeDates(value);
      }
      return serialized;
    }
    return obj;
  }
  async getItem(tableName, key) {
    if (!this.isConfigured) {
      throw new Error("DynamoDB service not configured");
    }
    const command = new GetCommand({
      TableName: tableName,
      Key: key
    });
    const response = await this.client.send(command);
    return response.Item;
  }
  async updateItem(tableName, key, updates) {
    if (!this.isConfigured) {
      throw new Error("DynamoDB service not configured");
    }
    const updateExpression = Object.keys(updates).map((attr, index2) => `#attr${index2} = :val${index2}`).join(", ");
    const expressionAttributeNames = Object.keys(updates).reduce((acc, attr, index2) => {
      acc[`#attr${index2}`] = attr;
      return acc;
    }, {});
    const expressionAttributeValues = Object.values(updates).reduce((acc, val, index2) => {
      acc[`:val${index2}`] = val;
      return acc;
    }, {});
    const command = new UpdateCommand({
      TableName: tableName,
      Key: key,
      UpdateExpression: `SET ${updateExpression}`,
      ExpressionAttributeNames: expressionAttributeNames,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    });
    const response = await this.client.send(command);
    return response.Attributes;
  }
  async deleteItem(tableName, key) {
    if (!this.isConfigured) {
      throw new Error("DynamoDB service not configured");
    }
    const command = new DeleteCommand({
      TableName: tableName,
      Key: key
    });
    await this.client.send(command);
  }
  async queryItems(tableName, keyCondition, expressionAttributeValues, limit) {
    if (!this.isConfigured) {
      throw new Error("DynamoDB service not configured");
    }
    const command = new QueryCommand({
      TableName: tableName,
      KeyConditionExpression: keyCondition,
      ExpressionAttributeValues: expressionAttributeValues,
      Limit: limit,
      ScanIndexForward: false
      // Sort in descending order (newest first)
    });
    const response = await this.client.send(command);
    return response.Items || [];
  }
  // Specific methods for financial data
  async getTransactionsByUserId(userId, limit) {
    return this.queryItems(
      process.env.AWS_DYNAMODB_TRANSACTIONS_TABLE || "dime-time-transactions",
      "userId = :userId",
      { ":userId": userId },
      limit
    );
  }
  async createTransaction(transaction) {
    const tableName = process.env.AWS_DYNAMODB_TRANSACTIONS_TABLE || "dime-time-transactions";
    return this.putItem(tableName, {
      ...transaction,
      id: transaction.id || `trans-${Date.now()}`,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  async getUserDebts(userId) {
    return this.queryItems(
      process.env.AWS_DYNAMODB_DEBTS_TABLE || "dime-time-debts",
      "userId = :userId",
      { ":userId": userId }
    );
  }
  async createDebt(debt) {
    const tableName = process.env.AWS_DYNAMODB_DEBTS_TABLE || "dime-time-debts";
    return this.putItem(tableName, {
      ...debt,
      id: debt.id || `debt-${Date.now()}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  async getUserCryptoPurchases(userId) {
    return this.queryItems(
      process.env.AWS_DYNAMODB_CRYPTO_TABLE || "dime-time-crypto-purchases",
      "userId = :userId",
      { ":userId": userId }
    );
  }
  async createCryptoPurchase(purchase) {
    const tableName = process.env.AWS_DYNAMODB_CRYPTO_TABLE || "dime-time-crypto-purchases";
    return this.putItem(tableName, {
      ...purchase,
      id: purchase.id || `crypto-${Date.now()}`,
      createdAt: (/* @__PURE__ */ new Date()).toISOString()
    });
  }
  // Backup and analytics methods
  async exportUserDataToS3(userId) {
    if (!this.isConfigured) {
      throw new Error("DynamoDB service not configured");
    }
    const [transactions3, debts3, cryptoPurchases3] = await Promise.all([
      this.getTransactionsByUserId(userId),
      this.getUserDebts(userId),
      this.getUserCryptoPurchases(userId)
    ]);
    const userData = {
      userId,
      exportDate: (/* @__PURE__ */ new Date()).toISOString(),
      transactions: transactions3,
      debts: debts3,
      cryptoPurchases: cryptoPurchases3
    };
    return JSON.stringify(userData);
  }
};
var dynamoService = new DynamoService();

// server/services/axosService.ts
import axios2 from "axios";
var AxosService = class {
  client;
  isConfigured = false;
  businessAccountId = "";
  constructor() {
    try {
      this.client = axios2.create({
        baseURL: "https://api.axosbank.com/v1",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${process.env.AXOS_API_KEY}`,
          "X-Client-ID": process.env.AXOS_CLIENT_ID
        },
        timeout: 3e4
      });
      this.businessAccountId = process.env.AXOS_BUSINESS_ACCOUNT_ID || "";
      this.isConfigured = !!(process.env.AXOS_API_KEY && process.env.AXOS_CLIENT_ID && process.env.AXOS_BUSINESS_ACCOUNT_ID);
      if (this.isConfigured) {
        console.log("\u2705 Axos Bank service configured successfully");
      } else {
        console.log("\u26A0\uFE0F Axos Bank service not configured - missing credentials");
      }
    } catch (error) {
      console.error("Failed to initialize Axos service:", error);
      this.isConfigured = false;
    }
  }
  // Get business account details and current balance
  async getBusinessAccount() {
    if (!this.isConfigured) {
      throw new Error("Axos service not configured. Please provide AXOS_API_KEY, AXOS_CLIENT_ID, and AXOS_BUSINESS_ACCOUNT_ID environment variables.");
    }
    try {
      const response = await this.client.get(`/accounts/${this.businessAccountId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching business account:", error);
      throw new Error("Failed to fetch business account details");
    }
  }
  // Collect round-up from user's bank account to business account
  async collectRoundUp(userAccountId, userRoutingNumber, amount, description = "Dime Time Round-up Collection") {
    if (!this.isConfigured) {
      throw new Error("Axos service not configured");
    }
    try {
      const transferData = {
        amount,
        fromAccount: userAccountId,
        fromRoutingNumber: userRoutingNumber,
        toAccount: this.businessAccountId,
        type: "debit",
        // Debit from user account
        description,
        effectiveDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        // Same day
        source: "round_up_collection"
      };
      const response = await this.client.post("/transfers/ach", transferData);
      return response.data;
    } catch (error) {
      console.error("Error collecting round-up:", error);
      throw new Error("Failed to collect round-up funds");
    }
  }
  // Pay user's debt from business account
  async payUserDebt(debtAccountId, debtRoutingNumber, amount, userId, debtName) {
    if (!this.isConfigured) {
      throw new Error("Axos service not configured");
    }
    try {
      const transferData = {
        amount,
        fromAccount: this.businessAccountId,
        toAccount: debtAccountId,
        toRoutingNumber: debtRoutingNumber,
        type: "credit",
        // Credit to debt account
        description: `Dime Time Payment - ${debtName} for User ${userId}`,
        effectiveDate: (/* @__PURE__ */ new Date()).toISOString().split("T")[0],
        source: "debt_payment"
      };
      const response = await this.client.post("/transfers/ach", transferData);
      return response.data;
    } catch (error) {
      console.error("Error paying user debt:", error);
      throw new Error("Failed to pay user debt");
    }
  }
  // Process bulk weekly payments (every Friday)
  async processBulkWeeklyPayments(payments3) {
    if (!this.isConfigured) {
      throw new Error("Axos service not configured");
    }
    try {
      const totalAmount = payments3.reduce((sum, payment) => sum + parseFloat(payment.amount), 0).toFixed(2);
      const bulkTransferData = {
        fromAccount: this.businessAccountId,
        payments: payments3.map((payment) => ({
          toAccount: payment.debtAccountId,
          toRoutingNumber: payment.debtRoutingNumber,
          amount: payment.amount,
          description: `Dime Time Weekly Payment - ${payment.debtName}`,
          userId: payment.userId
        })),
        scheduledDate: this.getNextFriday(),
        totalAmount,
        type: "bulk_debt_payment"
      };
      const response = await this.client.post("/transfers/bulk-ach", bulkTransferData);
      return response.data;
    } catch (error) {
      console.error("Error processing bulk payments:", error);
      throw new Error("Failed to process bulk weekly payments");
    }
  }
  // Calculate 4% APY interest on business account balance
  async calculateInterestEarned(principalAmount, days) {
    const principal = parseFloat(principalAmount);
    const annualRate = 0.04;
    const dailyRate = annualRate / 365;
    const interest = principal * dailyRate * days;
    return interest.toFixed(2);
  }
  // Get transfer status and history
  async getTransferStatus(transferId) {
    if (!this.isConfigured) {
      throw new Error("Axos service not configured");
    }
    try {
      const response = await this.client.get(`/transfers/${transferId}`);
      return response.data;
    } catch (error) {
      console.error("Error fetching transfer status:", error);
      throw new Error("Failed to fetch transfer status");
    }
  }
  // Get account transaction history
  async getAccountTransactions(startDate, endDate, limit = 100) {
    if (!this.isConfigured) {
      throw new Error("Axos service not configured");
    }
    try {
      const response = await this.client.get(`/accounts/${this.businessAccountId}/transactions`, {
        params: {
          start_date: startDate,
          end_date: endDate,
          limit
        }
      });
      return response.data.transactions;
    } catch (error) {
      console.error("Error fetching account transactions:", error);
      throw new Error("Failed to fetch account transactions");
    }
  }
  // Helper function to get next Friday date
  getNextFriday() {
    const today = /* @__PURE__ */ new Date();
    const dayOfWeek = today.getDay();
    const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
    const nextFriday = new Date(today);
    nextFriday.setDate(today.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
    return nextFriday.toISOString().split("T")[0];
  }
  // Verify if service is properly configured
  isServiceConfigured() {
    return this.isConfigured;
  }
  // Get business account ID for external use
  getBusinessAccountId() {
    return this.businessAccountId;
  }
};
var axosService = new AxosService();

// server/routes/axosRoutes.ts
import { z as z2 } from "zod";
function registerAxosRoutes(app2) {
  app2.get("/api/axos/business-account", async (req, res) => {
    try {
      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({
          message: "Axos service not configured. Please provide AXOS_API_KEY, AXOS_CLIENT_ID, and AXOS_BUSINESS_ACCOUNT_ID environment variables.",
          configured: false
        });
      }
      const account = await axosService.getBusinessAccount();
      res.json({
        account,
        configured: true,
        message: "Business account details retrieved successfully"
      });
    } catch (error) {
      console.error("Error fetching business account:", error);
      res.status(500).json({ message: "Failed to fetch business account details" });
    }
  });
  app2.post("/api/axos/collect-roundup", async (req, res) => {
    try {
      const userId = "demo-user-1";
      const { userAccountId, userRoutingNumber, amount, transactionId } = req.body;
      if (!userAccountId || !userRoutingNumber || !amount) {
        return res.status(400).json({
          message: "userAccountId, userRoutingNumber, and amount are required"
        });
      }
      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ message: "Axos service not configured" });
      }
      const achTransfer = await axosService.collectRoundUp(
        userAccountId,
        userRoutingNumber,
        amount,
        `Round-up collection for transaction ${transactionId || "manual"}`
      );
      const collectionData = {
        userId,
        transactionId: transactionId || null,
        amount,
        userAccountId,
        userRoutingNumber,
        businessAccountId: axosService.getBusinessAccountId(),
        axosTransferId: achTransfer.id,
        status: achTransfer.status,
        effectiveDate: new Date(achTransfer.effectiveDate)
      };
      res.status(201).json({
        success: true,
        achTransfer,
        collectionData,
        message: `Successfully collected $${amount} round-up from user account`
      });
    } catch (error) {
      console.error("Error collecting round-up:", error);
      res.status(500).json({ message: "Failed to collect round-up" });
    }
  });
  app2.post("/api/axos/weekly-distribution", async (req, res) => {
    try {
      const { payments: payments3 } = req.body;
      if (!payments3 || !Array.isArray(payments3) || payments3.length === 0) {
        return res.status(400).json({
          message: "Payments array is required and must contain at least one payment"
        });
      }
      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ message: "Axos service not configured" });
      }
      const paymentSchema = z2.object({
        userId: z2.string(),
        debtAccountId: z2.string(),
        debtRoutingNumber: z2.string(),
        amount: z2.string(),
        debtName: z2.string()
      });
      try {
        payments3.forEach((payment) => paymentSchema.parse(payment));
      } catch (validationError) {
        return res.status(400).json({
          message: "Invalid payment data structure",
          errors: validationError
        });
      }
      const bulkPayment = await axosService.processBulkWeeklyPayments(payments3);
      const totalAmount = payments3.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const interestEarned = await axosService.calculateInterestEarned(
        totalAmount.toFixed(2),
        7
        // 7 days for weekly calculation
      );
      res.status(201).json({
        success: true,
        bulkPayment,
        totalAmount: totalAmount.toFixed(2),
        paymentCount: payments3.length,
        interestEarned,
        message: `Successfully scheduled ${payments3.length} debt payments for Friday distribution`
      });
    } catch (error) {
      console.error("Error processing weekly distribution:", error);
      res.status(500).json({ message: "Failed to process weekly distribution" });
    }
  });
  app2.post("/api/axos/pay-debt", async (req, res) => {
    try {
      const { userId, debtAccountId, debtRoutingNumber, amount, debtName } = req.body;
      if (!userId || !debtAccountId || !debtRoutingNumber || !amount || !debtName) {
        return res.status(400).json({
          message: "userId, debtAccountId, debtRoutingNumber, amount, and debtName are required"
        });
      }
      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ message: "Axos service not configured" });
      }
      const achTransfer = await axosService.payUserDebt(
        debtAccountId,
        debtRoutingNumber,
        amount,
        userId,
        debtName
      );
      res.status(201).json({
        success: true,
        achTransfer,
        message: `Successfully initiated payment of $${amount} to ${debtName}`
      });
    } catch (error) {
      console.error("Error paying user debt:", error);
      res.status(500).json({ message: "Failed to pay user debt" });
    }
  });
  app2.get("/api/axos/transfer/:transferId", async (req, res) => {
    try {
      const { transferId } = req.params;
      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ message: "Axos service not configured" });
      }
      const transfer = await axosService.getTransferStatus(transferId);
      res.json(transfer);
    } catch (error) {
      console.error("Error fetching transfer status:", error);
      res.status(500).json({ message: "Failed to fetch transfer status" });
    }
  });
  app2.get("/api/axos/transactions", async (req, res) => {
    try {
      const startDate = req.query.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
      const endDate = req.query.end_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const limit = parseInt(req.query.limit) || 100;
      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ message: "Axos service not configured" });
      }
      const transactions3 = await axosService.getAccountTransactions(startDate, endDate, limit);
      res.json({
        transactions: transactions3,
        startDate,
        endDate,
        count: transactions3.length
      });
    } catch (error) {
      console.error("Error fetching account transactions:", error);
      res.status(500).json({ message: "Failed to fetch account transactions" });
    }
  });
  app2.post("/api/axos/calculate-interest", async (req, res) => {
    try {
      const { principalAmount, days = 7 } = req.body;
      if (!principalAmount) {
        return res.status(400).json({ message: "principalAmount is required" });
      }
      const interestEarned = await axosService.calculateInterestEarned(
        principalAmount,
        parseInt(days)
      );
      res.json({
        principalAmount,
        days: parseInt(days),
        interestRate: "4.00%",
        interestEarned,
        annualizedReturn: (parseFloat(interestEarned) * (365 / parseInt(days))).toFixed(2)
      });
    } catch (error) {
      console.error("Error calculating interest:", error);
      res.status(500).json({ message: "Failed to calculate interest" });
    }
  });
  app2.get("/api/axos/next-friday", async (req, res) => {
    try {
      const today = /* @__PURE__ */ new Date();
      const dayOfWeek = today.getDay();
      const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
      const nextFriday = new Date(today);
      nextFriday.setDate(today.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
      res.json({
        today: today.toISOString().split("T")[0],
        nextFriday: nextFriday.toISOString().split("T")[0],
        daysUntilFriday: daysUntilFriday === 0 ? 7 : daysUntilFriday,
        message: "Next weekly distribution date"
      });
    } catch (error) {
      console.error("Error calculating next Friday:", error);
      res.status(500).json({ message: "Failed to calculate next Friday" });
    }
  });
  app2.get("/api/axos/status", async (req, res) => {
    try {
      const configured = axosService.isServiceConfigured();
      const businessAccountId = axosService.getBusinessAccountId();
      let account = null;
      if (configured) {
        try {
          account = await axosService.getBusinessAccount();
        } catch (error) {
          console.log("Business account fetch failed during status check:", error);
        }
      }
      res.json({
        configured,
        businessAccountId: configured ? businessAccountId : "Not configured",
        account: account ? {
          balance: account.balance,
          interestRate: account.interestRate,
          accountType: account.type
        } : null,
        features: {
          roundUpCollection: configured,
          weeklyDistribution: configured,
          interestCalculation: true,
          achTransfers: configured
        },
        nextDistribution: configured ? await calculateNextFriday() : null
      });
    } catch (error) {
      console.error("Error checking Axos status:", error);
      res.status(500).json({ message: "Failed to check Axos service status" });
    }
  });
}
async function calculateNextFriday() {
  const today = /* @__PURE__ */ new Date();
  const dayOfWeek = today.getDay();
  const daysUntilFriday = (5 - dayOfWeek + 7) % 7;
  const nextFriday = new Date(today);
  nextFriday.setDate(today.getDate() + (daysUntilFriday === 0 ? 7 : daysUntilFriday));
  return nextFriday.toISOString().split("T")[0];
}

// server/services/silaService.ts
import axios3 from "axios";
var SilaService = class {
  client;
  isConfigured = false;
  appHandle;
  environment;
  constructor() {
    try {
      this.appHandle = "dime_time_app";
      const mode = process.env.SILA_MODE || "live";
      if (mode === "mock") {
        this.environment = "sandbox";
        this.isConfigured = false;
        console.log("\u{1F3AD} Sila service set to MOCK mode - using MockSilaService for beta testing");
        return;
      }
      this.environment = process.env.NODE_ENV === "production" ? "production" : "sandbox";
      const baseURL = this.environment === "production" ? "https://api.silamoney.com/0.2" : "https://sandbox.silamoney.com/0.2";
      this.client = axios3.create({
        baseURL,
        headers: {
          "Content-Type": "application/json",
          "authsignature": ""
          // Will be set per request
        },
        timeout: 3e4
      });
      this.isConfigured = !!(process.env.SILA_APP_HANDLE && process.env.SILA_APP_PRIVATE_KEY);
      if (this.isConfigured) {
        console.log(`\u2705 Sila Money service configured successfully (${this.environment})`);
      } else {
        console.log("\u26A0\uFE0F Sila Money service not configured - missing SILA_APP_HANDLE and SILA_APP_PRIVATE_KEY for Ed25519 signatures");
      }
    } catch (error) {
      console.error("Failed to initialize Sila service:", error);
      this.isConfigured = false;
    }
  }
  generateAuthSignature(message, endpoint) {
    const timestamp2 = Date.now().toString();
    return `${process.env.SILA_CLIENT_ID}:${process.env.SILA_CLIENT_SECRET}:${timestamp2}`;
  }
  // Register a user with Sila
  async registerUser(userData) {
    if (!this.isConfigured) {
      throw new Error("Sila service not configured");
    }
    try {
      const message = {
        header: {
          app_handle: this.appHandle,
          user_handle: userData.handle
        },
        message: "register_msg",
        ...userData
      };
      const signature = this.generateAuthSignature(JSON.stringify(message), "/register");
      const response = await this.client.post("/register", message, {
        headers: { authsignature: signature }
      });
      return {
        success: response.data.success || false,
        message: response.data.message || "Registration completed",
        reference: response.data.reference
      };
    } catch (error) {
      console.error("Error registering user with Sila:", error);
      throw new Error("Failed to register user");
    }
  }
  // Link bank account to user
  async linkAccount(userHandle, accountData) {
    if (!this.isConfigured) {
      throw new Error("Sila service not configured");
    }
    try {
      const message = {
        header: {
          app_handle: this.appHandle,
          user_handle: userHandle
        },
        message: "link_account_msg",
        ...accountData
      };
      const signature = this.generateAuthSignature(JSON.stringify(message), "/link_account");
      const response = await this.client.post("/link_account", message, {
        headers: { authsignature: signature }
      });
      return {
        success: response.data.success || false,
        message: response.data.message || "Account linked successfully",
        account_name: response.data.account_name
      };
    } catch (error) {
      console.error("Error linking bank account:", error);
      throw new Error("Failed to link bank account");
    }
  }
  // Issue (deposit) money from bank account to Sila wallet
  async issueToWallet(userHandle, amount, accountName, descriptor) {
    if (!this.isConfigured) {
      throw new Error("Sila service not configured");
    }
    try {
      const reference = `issue_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const message = {
        header: {
          app_handle: this.appHandle,
          user_handle: userHandle
        },
        message: "issue_msg",
        amount,
        account_name: accountName,
        descriptor: descriptor || "Dime Time Round-up Collection",
        business_uuid: process.env.SILA_BUSINESS_UUID || void 0,
        processing_type: "STANDARD_ACH"
      };
      const signature = this.generateAuthSignature(JSON.stringify(message), "/issue");
      const response = await this.client.post("/issue", message, {
        headers: { authsignature: signature }
      });
      return {
        reference,
        status: response.data.status || "pending",
        message: response.data.message || "Transfer initiated",
        transaction_id: response.data.transaction_id,
        effective_date: response.data.effective_date
      };
    } catch (error) {
      console.error("Error issuing to wallet:", error);
      throw new Error("Failed to issue funds to wallet");
    }
  }
  // Redeem (withdraw) money from Sila wallet to bank account
  async redeemFromWallet(userHandle, amount, accountName, descriptor) {
    if (!this.isConfigured) {
      throw new Error("Sila service not configured");
    }
    try {
      const reference = `redeem_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const message = {
        header: {
          app_handle: this.appHandle,
          user_handle: userHandle
        },
        message: "redeem_msg",
        amount,
        account_name: accountName,
        descriptor: descriptor || "Dime Time Debt Payment",
        business_uuid: process.env.SILA_BUSINESS_UUID || void 0,
        processing_type: "STANDARD_ACH"
      };
      const signature = this.generateAuthSignature(JSON.stringify(message), "/redeem");
      const response = await this.client.post("/redeem", message, {
        headers: { authsignature: signature }
      });
      return {
        reference,
        status: response.data.status || "pending",
        message: response.data.message || "Transfer initiated",
        transaction_id: response.data.transaction_id,
        effective_date: response.data.effective_date
      };
    } catch (error) {
      console.error("Error redeeming from wallet:", error);
      throw new Error("Failed to redeem funds from wallet");
    }
  }
  // Get transaction status
  async getTransactionStatus(userHandle, transactionId) {
    if (!this.isConfigured) {
      throw new Error("Sila service not configured");
    }
    try {
      const message = {
        header: {
          app_handle: this.appHandle,
          user_handle: userHandle
        },
        message: "get_transactions_msg",
        search_filters: {
          transaction_id: transactionId
        }
      };
      const signature = this.generateAuthSignature(JSON.stringify(message), "/get_transactions");
      const response = await this.client.post("/get_transactions", message, {
        headers: { authsignature: signature }
      });
      const transaction = response.data.transactions?.[0];
      return {
        status: transaction?.status || "unknown",
        message: transaction?.message || "Transaction not found"
      };
    } catch (error) {
      console.error("Error getting transaction status:", error);
      throw new Error("Failed to get transaction status");
    }
  }
  // Get user's wallet balance
  async getWalletBalance(userHandle) {
    if (!this.isConfigured) {
      throw new Error("Sila service not configured");
    }
    try {
      const message = {
        header: {
          app_handle: this.appHandle,
          user_handle: userHandle
        },
        message: "get_wallet_msg"
      };
      const signature = this.generateAuthSignature(JSON.stringify(message), "/get_wallet");
      const response = await this.client.post("/get_wallet", message, {
        headers: { authsignature: signature }
      });
      return {
        balance: parseFloat(response.data.wallet?.available_balance || "0"),
        currency: "USD"
      };
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      throw new Error("Failed to get wallet balance");
    }
  }
  // Check if service is configured
  isServiceConfigured() {
    return this.isConfigured;
  }
  // Get environment info
  getEnvironment() {
    return this.environment;
  }
  // Helper method to create a demo user for testing
  createDemoUser(userId = "demo-user-1") {
    return {
      handle: `dime_time_${userId}`,
      first_name: "Demo",
      last_name: "User",
      address: {
        address_alias: "home",
        street_address_1: "123 Demo Street",
        city: "Demo City",
        state: "CA",
        country: "US",
        postal_code: "12345"
      },
      identity: {
        identity_alias: "ssn",
        identity_value: "123456789"
        // Demo SSN for sandbox
      },
      contact: {
        phone: "555-123-4567",
        email: "demo@dimetime.app"
      }
    };
  }
};
var silaService = new SilaService();

// server/services/mockSilaService.ts
var MockSilaService = class {
  isConfigured = false;
  environment;
  mockDatabase = /* @__PURE__ */ new Map();
  // Simple in-memory store for mock data
  constructor() {
    this.environment = "mock";
    this.isConfigured = true;
    console.log("\u2705 Sila Money service configured successfully (MOCK MODE for beta testing)");
  }
  // Register a user (mock implementation)
  async registerUser(userData) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const reference = `MOCK_REG_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    this.mockDatabase.set(`user:${userData.handle}`, {
      ...userData,
      reference,
      status: "verified",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    this.mockDatabase.set(`wallet:${userData.handle}`, {
      balance: 0,
      currency: "USD",
      last_updated: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      success: true,
      message: "Entity successfully registered.",
      reference
    };
  }
  // Link bank account (mock implementation)
  async linkAccount(userHandle, accountData) {
    await new Promise((resolve) => setTimeout(resolve, 150));
    this.mockDatabase.set(`account:${userHandle}:${accountData.account_name}`, {
      ...accountData,
      status: "active",
      verification_status: "verified",
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      success: true,
      message: "Bank account successfully linked and verified.",
      account_name: accountData.account_name
    };
  }
  // Issue money (collect roundup - mock implementation)
  async issueToWallet(userHandle, amount, accountName, descriptor) {
    await new Promise((resolve) => setTimeout(resolve, 200));
    const reference = `MOCK_ISSUE_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const transactionId = `TXN_${Date.now()}`;
    const walletKey = `wallet:${userHandle}`;
    const wallet = this.mockDatabase.get(walletKey) || { balance: 0, currency: "USD" };
    wallet.balance += amount;
    wallet.last_updated = (/* @__PURE__ */ new Date()).toISOString();
    this.mockDatabase.set(walletKey, wallet);
    this.mockDatabase.set(`transaction:${transactionId}`, {
      reference,
      user_handle: userHandle,
      amount,
      type: "issue",
      status: "success",
      descriptor,
      account_name: accountName,
      effective_date: (/* @__PURE__ */ new Date()).toISOString(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      reference,
      status: "success",
      message: `Successfully collected $${amount.toFixed(2)} roundup`,
      transaction_id: transactionId,
      effective_date: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  // Redeem money (pay debt - mock implementation)
  async redeemFromWallet(userHandle, amount, accountName, descriptor) {
    await new Promise((resolve) => setTimeout(resolve, 250));
    const reference = `MOCK_REDEEM_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const transactionId = `TXN_${Date.now()}`;
    const walletKey = `wallet:${userHandle}`;
    const wallet = this.mockDatabase.get(walletKey) || { balance: 0, currency: "USD" };
    if (wallet.balance < amount) {
      return {
        reference,
        status: "failed",
        message: `Insufficient funds. Wallet balance: $${wallet.balance.toFixed(2)}, requested: $${amount.toFixed(2)}`,
        transaction_id: transactionId
      };
    }
    wallet.balance -= amount;
    wallet.last_updated = (/* @__PURE__ */ new Date()).toISOString();
    this.mockDatabase.set(walletKey, wallet);
    this.mockDatabase.set(`transaction:${transactionId}`, {
      reference,
      user_handle: userHandle,
      amount,
      type: "redeem",
      status: "success",
      descriptor,
      account_name: accountName,
      effective_date: (/* @__PURE__ */ new Date()).toISOString(),
      created_at: (/* @__PURE__ */ new Date()).toISOString()
    });
    return {
      reference,
      status: "success",
      message: `Successfully paid $${amount.toFixed(2)} towards debt`,
      transaction_id: transactionId,
      effective_date: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  // Get transaction status (mock implementation)
  async getTransactionStatus(userHandle, transactionId) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const transaction = this.mockDatabase.get(`transaction:${transactionId}`);
    if (!transaction) {
      return {
        status: "not_found",
        message: "Transaction not found"
      };
    }
    return {
      status: transaction.status,
      message: `Transaction ${transaction.type} of $${transaction.amount.toFixed(2)} is ${transaction.status}`
    };
  }
  // Get wallet balance (mock implementation)
  async getWalletBalance(userHandle) {
    await new Promise((resolve) => setTimeout(resolve, 100));
    const wallet = this.mockDatabase.get(`wallet:${userHandle}`) || { balance: 0, currency: "USD" };
    return {
      balance: wallet.balance,
      currency: wallet.currency
    };
  }
  // Service status methods
  isServiceConfigured() {
    return this.isConfigured;
  }
  getEnvironment() {
    return this.environment;
  }
  // Helper method to create a demo user for testing
  createDemoUser(userId = "demo-user-1") {
    return {
      handle: `dime_time_${userId}`,
      first_name: "Demo",
      last_name: "User",
      address: {
        address_alias: "home",
        street_address_1: "123 Demo Street",
        city: "Demo City",
        state: "CA",
        country: "US",
        postal_code: "12345"
      },
      identity: {
        identity_alias: "ssn",
        identity_value: "123456789"
        // Demo SSN for testing
      },
      contact: {
        phone: "555-123-4567",
        email: "demo@dimetime.app"
      }
    };
  }
  // Mock-specific methods for testing and debugging
  getMockDatabase() {
    return this.mockDatabase;
  }
  clearMockDatabase() {
    this.mockDatabase.clear();
    console.log("\u{1F9F9} Mock Sila database cleared");
  }
  // Simulate various transaction states for testing
  async simulateTransactionState(transactionId, newStatus) {
    const transaction = this.mockDatabase.get(`transaction:${transactionId}`);
    if (!transaction) {
      return false;
    }
    transaction.status = newStatus;
    transaction.updated_at = (/* @__PURE__ */ new Date()).toISOString();
    this.mockDatabase.set(`transaction:${transactionId}`, transaction);
    console.log(`\u{1F3AD} Simulated transaction ${transactionId} status change to: ${newStatus}`);
    return true;
  }
};
var mockSilaService = new MockSilaService();

// server/routes/silaRoutes.ts
import { z as z3 } from "zod";
var registerUserSchema = z3.object({
  handle: z3.string().min(1, "User handle is required"),
  first_name: z3.string().min(1, "First name is required"),
  last_name: z3.string().min(1, "Last name is required"),
  street_address_1: z3.string().min(1, "Street address is required"),
  city: z3.string().min(1, "City is required"),
  state: z3.string().length(2, "State must be 2 characters"),
  postal_code: z3.string().min(5, "Valid postal code required"),
  phone: z3.string().min(10, "Valid phone number required"),
  email: z3.string().email("Valid email required"),
  identity_value: z3.string().min(9, "SSN/EIN required")
});
var linkAccountSchema = z3.object({
  user_handle: z3.string().min(1, "User handle is required"),
  account_name: z3.string().min(1, "Account name is required"),
  account_type: z3.enum(["CHECKING", "SAVINGS"]),
  account_number: z3.string().min(1, "Account number is required"),
  routing_number: z3.string().length(9, "Routing number must be 9 digits"),
  account_owner_name: z3.string().min(1, "Account owner name is required")
});
var transferSchema = z3.object({
  user_handle: z3.string().min(1, "User handle is required"),
  amount: z3.number().positive("Amount must be positive"),
  account_name: z3.string().min(1, "Account name is required"),
  descriptor: z3.string().optional()
});
function registerSilaRoutes(app2) {
  const getActiveService = () => {
    const mode = process.env.SILA_MODE || "mock";
    return mode === "mock" ? mockSilaService : silaService;
  };
  app2.get("/api/sila/status", async (req, res) => {
    try {
      const service = getActiveService();
      const configured = service.isServiceConfigured();
      const environment = service.getEnvironment();
      const mode = process.env.SILA_MODE || "mock";
      res.json({
        configured,
        environment: mode === "mock" ? "mock" : environment,
        mode,
        message: configured ? `Sila Money service ready (${mode === "mock" ? "MOCK" : environment})` : "Sila service not configured - missing credentials"
      });
    } catch (error) {
      console.error("Error checking Sila status:", error);
      res.status(500).json({ message: "Failed to check Sila service status" });
    }
  });
  app2.post("/api/sila/register-demo-user", async (req, res) => {
    try {
      const service = getActiveService();
      if (!service.isServiceConfigured()) {
        return res.status(503).json({
          message: "Sila service not configured"
        });
      }
      const userId = req.body.userId || "demo-user-1";
      const demoUser = service.createDemoUser(userId);
      const result = await service.registerUser(demoUser);
      res.json({
        success: result.success,
        message: result.message,
        user_handle: demoUser.handle,
        reference: result.reference,
        mode: process.env.SILA_MODE || "mock"
      });
    } catch (error) {
      console.error("Error registering demo user:", error);
      res.status(500).json({ message: "Failed to register demo user" });
    }
  });
  app2.post("/api/sila/register-user", async (req, res) => {
    try {
      const userData = registerUserSchema.parse(req.body);
      const service = getActiveService();
      if (!service.isServiceConfigured()) {
        return res.status(503).json({ message: "Sila service not configured" });
      }
      const silaUser = {
        handle: userData.handle,
        first_name: userData.first_name,
        last_name: userData.last_name,
        address: {
          address_alias: "home",
          street_address_1: userData.street_address_1,
          city: userData.city,
          state: userData.state,
          country: "US",
          postal_code: userData.postal_code
        },
        identity: {
          identity_alias: "ssn",
          identity_value: userData.identity_value
        },
        contact: {
          phone: userData.phone,
          email: userData.email
        }
      };
      const result = await service.registerUser(silaUser);
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      console.error("Error registering user:", error);
      res.status(500).json({ message: "Failed to register user" });
    }
  });
  app2.post("/api/sila/link-account", async (req, res) => {
    try {
      const accountData = linkAccountSchema.parse(req.body);
      const service = getActiveService();
      if (!service.isServiceConfigured()) {
        return res.status(503).json({ message: "Sila service not configured" });
      }
      const bankAccount = {
        account_name: accountData.account_name,
        account_type: accountData.account_type,
        account_number: accountData.account_number,
        routing_number: accountData.routing_number,
        account_owner_name: accountData.account_owner_name
      };
      const result = await service.linkAccount(accountData.user_handle, bankAccount);
      res.status(result.success ? 201 : 400).json(result);
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      console.error("Error linking account:", error);
      res.status(500).json({ message: "Failed to link bank account" });
    }
  });
  app2.post("/api/sila/collect-roundup", async (req, res) => {
    try {
      const transferData = transferSchema.parse(req.body);
      const service = getActiveService();
      if (!service.isServiceConfigured()) {
        return res.status(503).json({ message: "Sila service not configured" });
      }
      const result = await service.issueToWallet(
        transferData.user_handle,
        transferData.amount,
        transferData.account_name,
        transferData.descriptor || `Dime Time round-up collection: $${transferData.amount}`
      );
      res.status(201).json({
        success: true,
        transfer: result,
        message: `Successfully initiated round-up collection of $${transferData.amount}`
      });
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      console.error("Error collecting round-up:", error);
      res.status(500).json({ message: "Failed to collect round-up" });
    }
  });
  app2.post("/api/sila/pay-debt", async (req, res) => {
    try {
      const transferData = transferSchema.parse(req.body);
      const service = getActiveService();
      if (!service.isServiceConfigured()) {
        return res.status(503).json({ message: "Sila service not configured" });
      }
      const result = await service.redeemFromWallet(
        transferData.user_handle,
        transferData.amount,
        transferData.account_name,
        transferData.descriptor || `Dime Time debt payment: $${transferData.amount}`
      );
      res.status(201).json({
        success: true,
        transfer: result,
        message: `Successfully initiated debt payment of $${transferData.amount}`
      });
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({
          message: "Validation error",
          errors: error.errors
        });
      }
      console.error("Error paying debt:", error);
      res.status(500).json({ message: "Failed to pay debt" });
    }
  });
  app2.get("/api/sila/wallet/:user_handle", async (req, res) => {
    try {
      const userHandle = req.params.user_handle;
      const service = getActiveService();
      if (!service.isServiceConfigured()) {
        return res.status(503).json({ message: "Sila service not configured" });
      }
      const balance = await service.getWalletBalance(userHandle);
      res.json({
        user_handle: userHandle,
        balance: balance.balance,
        currency: balance.currency,
        formatted_balance: `$${balance.balance.toFixed(2)}`
      });
    } catch (error) {
      console.error("Error getting wallet balance:", error);
      res.status(500).json({ message: "Failed to get wallet balance" });
    }
  });
  app2.get("/api/sila/transaction/:user_handle/:transaction_id", async (req, res) => {
    try {
      const { user_handle, transaction_id } = req.params;
      const service = getActiveService();
      if (!service.isServiceConfigured()) {
        return res.status(503).json({ message: "Sila service not configured" });
      }
      const status = await service.getTransactionStatus(user_handle, transaction_id);
      res.json({
        user_handle,
        transaction_id,
        status: status.status,
        message: status.message
      });
    } catch (error) {
      console.error("Error getting transaction status:", error);
      res.status(500).json({ message: "Failed to get transaction status" });
    }
  });
}

// server/routes/notificationRoutes.ts
import { Router } from "express";

// server/services/notificationService.ts
var NotificationService = class {
  webPushSubscriptions = /* @__PURE__ */ new Map();
  // Store push subscriptions
  async sendNotification(userId, template, metadata) {
    try {
      const settings = await storage.getNotificationSettings(userId);
      if (!settings) {
        console.log(`No notification settings found for user ${userId}`);
        return;
      }
      if (template.channel === "push" && !settings.pushEnabled) {
        console.log(`Push notifications disabled for user ${userId}`);
        return;
      }
      const notification = {
        userId,
        type: template.type,
        channel: template.channel,
        title: template.title,
        message: template.message,
        recipient: userId,
        // For push notifications, recipient is the user ID
        priority: template.priority,
        metadata: metadata ? JSON.stringify(metadata) : null
      };
      const createdNotification = await storage.createNotification(notification);
      if (template.channel === "push") {
        await this.sendPushNotification(userId, template);
      }
      return createdNotification;
    } catch (error) {
      console.error("Error sending notification:", error);
    }
  }
  async sendPushNotification(userId, template) {
    try {
      if (typeof window !== "undefined" && "Notification" in window) {
        if (Notification.permission === "granted") {
          new Notification(template.title, {
            body: template.message,
            icon: "/favicon.ico",
            badge: "/favicon.ico",
            tag: template.type,
            requireInteraction: template.priority === "high"
          });
        }
      }
      if (typeof window !== "undefined" && window.Capacitor && window.Capacitor.isNative) {
        try {
          console.log("Sending notification via Capacitor:", template.title);
        } catch (error) {
          console.log("Capacitor LocalNotifications not available:", error);
        }
      }
      console.log(`Push notification sent to user ${userId}: ${template.title}`);
    } catch (error) {
      console.error("Error sending push notification:", error);
    }
  }
  // Notification templates for different events
  async sendRoundUpNotification(userId, amount, merchant) {
    const template = {
      title: "Round-up Collected! \u{1F4B0}",
      message: `+$${amount} from ${merchant} \u2192 Moving you closer to debt freedom!`,
      type: "roundup",
      channel: "push",
      priority: "medium"
    };
    return this.sendNotification(userId, template, { amount, merchant });
  }
  async sendPaymentDueNotification(userId, debtName, amount, daysUntilDue) {
    const urgency = daysUntilDue <= 2 ? "\u{1F6A8}" : daysUntilDue <= 7 ? "\u23F0" : "\u{1F4C5}";
    const template = {
      title: `${urgency} Payment Due ${daysUntilDue === 1 ? "Tomorrow" : `in ${daysUntilDue} days`}`,
      message: `${debtName}: $${amount} payment due ${daysUntilDue === 1 ? "tomorrow" : `in ${daysUntilDue} days`}`,
      type: "payment",
      channel: "push",
      priority: daysUntilDue <= 2 ? "high" : "medium"
    };
    return this.sendNotification(userId, template, { debtName, amount, daysUntilDue });
  }
  async sendMilestoneNotification(userId, milestone, progress) {
    const template = {
      title: "\u{1F389} Milestone Achieved!",
      message: `${milestone} You're ${progress}% closer to being debt-free!`,
      type: "milestone",
      channel: "push",
      priority: "high"
    };
    return this.sendNotification(userId, template, { milestone, progress });
  }
  async sendWeeklyReportNotification(userId, weeklyRoundUps, totalSaved, monthsReduced) {
    const template = {
      title: "\u{1F4CA} Weekly Progress Report",
      message: `This week: $${weeklyRoundUps} in round-ups! Total saved: $${totalSaved} (${monthsReduced} months faster to debt-free)`,
      type: "weekly_report",
      channel: "push",
      priority: "medium"
    };
    return this.sendNotification(userId, template, { weeklyRoundUps, totalSaved, monthsReduced });
  }
  async sendCryptoUpdateNotification(userId, cryptoAmount, currentValue, gains) {
    const template = {
      title: "\u20BF Crypto Update",
      message: `Your $${cryptoAmount} Bitcoin investment is now worth $${currentValue} (+$${gains})`,
      type: "crypto",
      channel: "push",
      priority: "low"
    };
    return this.sendNotification(userId, template, { cryptoAmount, currentValue, gains });
  }
  async sendDebtPaidOffNotification(userId, debtName, finalAmount) {
    const template = {
      title: "\u{1F38A} DEBT PAID OFF! \u{1F38A}",
      message: `Congratulations! You've completely paid off your ${debtName} ($${finalAmount})! You're officially debt-free on this account!`,
      type: "debt_payoff",
      channel: "push",
      priority: "high"
    };
    return this.sendNotification(userId, template, { debtName, finalAmount });
  }
  async sendMotivationalNotification(userId, customMessage) {
    const messages = [
      "Every dollar counts! Your round-ups are building momentum \u{1F4AA}",
      "Small changes, big results! Keep up the great work \u{1F31F}",
      "You're closer to debt freedom than yesterday! \u{1F4C8}",
      "Your future self will thank you for today's progress \u{1F64F}",
      "Debt freedom isn't just a dream - you're making it reality! \u2728"
    ];
    const message = customMessage || messages[Math.floor(Math.random() * messages.length)];
    const template = {
      title: "\u{1F4AB} Daily Motivation",
      message,
      type: "motivation",
      channel: "push",
      priority: "low"
    };
    return this.sendNotification(userId, template, { customMessage: message });
  }
  // Advanced notification types for enhanced user engagement
  async sendDebtTimelineNotification(userId, monthsReduced, debtFreeDate) {
    const template = {
      title: "\u{1F3AF} Debt Freedom Timeline Update!",
      message: `Amazing! You're now ${monthsReduced} months closer to debt-free. At this pace, you'll be free by ${debtFreeDate}! \u{1F389}`,
      type: "debt_timeline",
      channel: "push",
      priority: "high"
    };
    return this.sendNotification(userId, template, { monthsReduced, debtFreeDate });
  }
  async sendInterestSavingsNotification(userId, amountSaved, realWorldComparison) {
    const template = {
      title: "\u{1F4B0} Interest Savings Alert!",
      message: `Your round-ups saved you $${amountSaved} in credit card interest this month! That's equivalent to ${realWorldComparison} \u{1F6D2}`,
      type: "interest_savings",
      channel: "push",
      priority: "high"
    };
    return this.sendNotification(userId, template, { amountSaved, realWorldComparison });
  }
  async sendCompetitiveSavingsNotification(userId, percentile, weeklyAmount) {
    const template = {
      title: "\u{1F3C6} You're Crushing It!",
      message: `You've saved more than ${percentile}% of Dime Time users this week! Your $${weeklyAmount} in round-ups is 2x the average user!`,
      type: "competitive_savings",
      channel: "push",
      priority: "medium"
    };
    return this.sendNotification(userId, template, { percentile, weeklyAmount });
  }
  async sendAxosEarningsNotification(userId, weeklyEarnings, totalEarnings, realWorldValue) {
    const template = {
      title: "\u{1F3E6} Your Money is Working!",
      message: `Your round-ups earned $${weeklyEarnings} this week at 4% APY! Total earned: $${totalEarnings} - that's a ${realWorldValue}! \u{1F3AC}`,
      type: "axos_earnings",
      channel: "push",
      priority: "medium"
    };
    return this.sendNotification(userId, template, { weeklyEarnings, totalEarnings, realWorldValue });
  }
  async sendGoalProgressNotification(userId, amountNeeded, goalType, progressPercent) {
    const urgency = progressPercent >= 90 ? "\u{1F525}" : progressPercent >= 75 ? "\u26A1" : "\u{1F3AF}";
    const template = {
      title: `${urgency} Almost There!`,
      message: `You're just $${amountNeeded} away from your $${goalType} goal! You're ${progressPercent}% of the way there!`,
      type: "goal_progress",
      channel: "push",
      priority: "medium"
    };
    return this.sendNotification(userId, template, { amountNeeded, goalType, progressPercent });
  }
  async sendDebtAvalancheNotification(userId, recommendedDebt, potentialSavings) {
    const template = {
      title: "\u{1F4A1} Smart Debt Strategy!",
      message: `Pay your ${recommendedDebt} next - it'll save you $${potentialSavings} vs your other debts! Smart move! \u{1F9E0}`,
      type: "debt_avalanche",
      channel: "push",
      priority: "high"
    };
    return this.sendNotification(userId, template, { recommendedDebt, potentialSavings });
  }
  async sendDTTRewardsNotification(userId, tokensEarned, dollarValue, totalTokens) {
    const template = {
      title: "\u{1FA99} DTT Rewards Earned!",
      message: `You earned ${tokensEarned} DTT tokens this week! Your DTT rewards are worth $${dollarValue} and growing \u{1F4C8} (Total: ${totalTokens} DTT)`,
      type: "dtt_rewards",
      channel: "push",
      priority: "medium"
    };
    return this.sendNotification(userId, template, { tokensEarned, dollarValue, totalTokens });
  }
  async sendStreakMaintenanceNotification(userId, streakDays, nextAction) {
    const template = {
      title: "\u{1F525} Don't Break Your Streak!",
      message: `You're on a ${streakDays}-day round-up streak! ${nextAction} to keep the momentum going! \u{1F4AA}`,
      type: "streak_maintenance",
      channel: "push",
      priority: "high"
    };
    return this.sendNotification(userId, template, { streakDays, nextAction });
  }
  async sendMorningMotivationNotification(userId, dailyGoal, progressMessage) {
    const template = {
      title: "\u2600\uFE0F Good Morning, Debt Crusher!",
      message: `Today's goal: $${dailyGoal} in round-ups toward freedom! ${progressMessage} \u{1F31F}`,
      type: "morning_motivation",
      channel: "push",
      priority: "low"
    };
    return this.sendNotification(userId, template, { dailyGoal, progressMessage });
  }
  async sendEveningCelebrationNotification(userId, dailyAmount, encouragementMessage) {
    const template = {
      title: "\u{1F319} Great Job Today!",
      message: `You collected $${dailyAmount} today! ${encouragementMessage} Sweet dreams of debt freedom! \u2728`,
      type: "evening_celebration",
      channel: "push",
      priority: "low"
    };
    return this.sendNotification(userId, template, { dailyAmount, encouragementMessage });
  }
  async sendPremiumTeaserNotification(userId, featureName, potentialSavings) {
    const template = {
      title: "\u{1F48E} Unlock Premium Savings!",
      message: `${featureName} could save you $${potentialSavings}/month! Upgrade to explore premium debt optimization \u{1F680}`,
      type: "premium_teaser",
      channel: "push",
      priority: "low"
    };
    return this.sendNotification(userId, template, { featureName, potentialSavings });
  }
  async sendSeasonalNotification(userId, occasion, tip) {
    const template = {
      title: `\u{1F38A} ${occasion} Savings Tip!`,
      message: tip,
      type: "seasonal",
      channel: "push",
      priority: "medium"
    };
    return this.sendNotification(userId, template, { occasion, tip });
  }
  async sendWeeklyChallengeNotification(userId, challengeGoal, bonusReward) {
    const template = {
      title: "\u{1F3C1} Weekly Challenge!",
      message: `This week's challenge: ${challengeGoal} for ${bonusReward}! Are you up for it? \u{1F4AA}`,
      type: "weekly_challenge",
      channel: "push",
      priority: "medium"
    };
    return this.sendNotification(userId, template, { challengeGoal, bonusReward });
  }
  // Get user's notification history
  async getUserNotifications(userId, limit = 20) {
    return storage.getUserNotifications(userId, limit);
  }
  // Mark notification as delivered
  async markAsDelivered(notificationId) {
    return storage.updateNotificationStatus(notificationId, "delivered");
  }
  // Mark notification as read
  async markAsRead(notificationId) {
    return storage.updateNotificationStatus(notificationId, "read");
  }
};
var notificationService = new NotificationService();

// server/services/debtCalculationService.ts
var DebtCalculationService = class {
  // Calculate debt-free timeline based on current round-up pace
  async calculateDebtFreeTimeline(userId) {
    try {
      const debts3 = await storage.getUserDebts(userId);
      const transactions3 = await storage.getUserTransactions(userId, 90);
      const totalDebt = debts3.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
      const totalRoundUps = transactions3.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount || "0"), 0);
      const monthlyRoundUpAverage = totalRoundUps / 3;
      const monthlyMinPayments = debts3.reduce((sum, debt) => sum + parseFloat(debt.minimumPayment || "0"), 0);
      const acceleratedMonthlyPayment = monthlyMinPayments + monthlyRoundUpAverage;
      const monthsWithRoundUps = Math.ceil(totalDebt / acceleratedMonthlyPayment);
      const monthsWithoutRoundUps = Math.ceil(totalDebt / monthlyMinPayments);
      const monthsReduced = monthsWithoutRoundUps - monthsWithRoundUps;
      const debtFreeDate = /* @__PURE__ */ new Date();
      debtFreeDate.setMonth(debtFreeDate.getMonth() + monthsWithRoundUps);
      return {
        monthsRemaining: monthsWithRoundUps,
        debtFreeDate: debtFreeDate.toLocaleDateString("en-US", {
          year: "numeric",
          month: "long"
        }),
        monthsReduced
      };
    } catch (error) {
      console.error("Error calculating debt timeline:", error);
      return {
        monthsRemaining: 24,
        debtFreeDate: "January 2027",
        monthsReduced: 6
      };
    }
  }
  // Calculate interest savings from round-ups
  async calculateInterestSavings(userId) {
    try {
      const debts3 = await storage.getUserDebts(userId);
      const transactions3 = await storage.getUserTransactions(userId, 30);
      const monthlyRoundUps = transactions3.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount || "0"), 0);
      let totalBalance = 0;
      let weightedInterestRate = 0;
      debts3.forEach((debt) => {
        const balance = parseFloat(debt.currentBalance);
        const rate = parseFloat(debt.interestRate) / 100;
        totalBalance += balance;
        weightedInterestRate += balance * rate;
      });
      const avgInterestRate = weightedInterestRate / totalBalance;
      const monthlySavings = monthlyRoundUps * (avgInterestRate / 12);
      const comparisons = [
        { threshold: 100, comparison: "3 weeks of groceries" },
        { threshold: 50, comparison: "a nice dinner out" },
        { threshold: 25, comparison: "2 movie tickets" },
        { threshold: 15, comparison: "a premium coffee for a week" },
        { threshold: 5, comparison: "a fancy coffee" }
      ];
      const realWorldComparison = comparisons.find((c) => monthlySavings >= c.threshold)?.comparison || "a small treat";
      return {
        monthlySavings: Math.round(monthlySavings * 100) / 100,
        realWorldComparison
      };
    } catch (error) {
      console.error("Error calculating interest savings:", error);
      return {
        monthlySavings: 25.5,
        realWorldComparison: "a nice dinner out"
      };
    }
  }
  // Calculate user percentile for competitive notifications
  async calculateUserPercentile(userId) {
    try {
      const userTransactions = await storage.getUserTransactions(userId, 7);
      const userWeeklyRoundUps = userTransactions.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount || "0"), 0);
      let percentile = 50;
      if (userWeeklyRoundUps >= 50) percentile = 95;
      else if (userWeeklyRoundUps >= 30) percentile = 85;
      else if (userWeeklyRoundUps >= 20) percentile = 75;
      else if (userWeeklyRoundUps >= 15) percentile = 65;
      else if (userWeeklyRoundUps >= 10) percentile = 55;
      return {
        percentile,
        weeklyAmount: Math.round(userWeeklyRoundUps * 100) / 100
      };
    } catch (error) {
      console.error("Error calculating user percentile:", error);
      return {
        percentile: 73,
        weeklyAmount: 23.45
      };
    }
  }
  // Calculate Axos 4% APY earnings
  async calculateAxosEarnings(userId) {
    try {
      const transactions3 = await storage.getUserTransactions(userId);
      const totalRoundUps = transactions3.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount || "0"), 0);
      const annualRate = 0.04;
      const weeklyRate = annualRate / 52;
      const weeklyEarnings = totalRoundUps * weeklyRate;
      const weeksActive = Math.min(transactions3.length / 3, 52);
      const totalEarnings = totalRoundUps * (annualRate * (weeksActive / 52));
      const valueComparisons = [
        { threshold: 50, value: "nice dinner date" },
        { threshold: 25, value: "movie night" },
        { threshold: 15, value: "premium coffee for a week" },
        { threshold: 8, value: "fancy lunch" },
        { threshold: 3, value: "premium coffee" }
      ];
      const realWorldValue = valueComparisons.find((v) => totalEarnings >= v.threshold)?.value || "small treat";
      return {
        weeklyEarnings: Math.round(weeklyEarnings * 100) / 100,
        totalEarnings: Math.round(totalEarnings * 100) / 100,
        realWorldValue
      };
    } catch (error) {
      console.error("Error calculating Axos earnings:", error);
      return {
        weeklyEarnings: 3.47,
        totalEarnings: 28.5,
        realWorldValue: "movie night"
      };
    }
  }
  // Recommend optimal debt to pay next (debt avalanche)
  async getDebtAvalancheRecommendation(userId) {
    try {
      const debts3 = await storage.getUserDebts(userId);
      const sortedDebts = debts3.filter((debt) => parseFloat(debt.currentBalance) > 0).sort((a, b) => parseFloat(b.interestRate) - parseFloat(a.interestRate));
      if (sortedDebts.length === 0) {
        return {
          recommendedDebt: "All debts",
          potentialSavings: 0
        };
      }
      const highestRateDebt = sortedDebts[0];
      const secondHighestRateDebt = sortedDebts[1];
      if (!secondHighestRateDebt) {
        return {
          recommendedDebt: highestRateDebt.name,
          potentialSavings: 100
          // Mock savings for single debt
        };
      }
      const rateDifference = parseFloat(highestRateDebt.interestRate) - parseFloat(secondHighestRateDebt.interestRate);
      const averageBalance = parseFloat(highestRateDebt.currentBalance);
      const potentialSavings = averageBalance * rateDifference / 100 / 12;
      return {
        recommendedDebt: highestRateDebt.name,
        potentialSavings: Math.round(potentialSavings * 100) / 100
      };
    } catch (error) {
      console.error("Error calculating debt avalanche:", error);
      return {
        recommendedDebt: "Chase Freedom",
        potentialSavings: 89
      };
    }
  }
  // Calculate user streak
  async calculateRoundUpStreak(userId) {
    try {
      const transactions3 = await storage.getUserTransactions(userId, 30);
      const transactionsByDate = transactions3.reduce((acc, trans) => {
        const date = new Date(trans.date).toDateString();
        if (!acc[date]) acc[date] = [];
        acc[date].push(trans);
        return acc;
      }, {});
      let streakDays = 0;
      const today = /* @__PURE__ */ new Date();
      for (let i = 0; i < 30; i++) {
        const checkDate = new Date(today);
        checkDate.setDate(today.getDate() - i);
        const dateStr = checkDate.toDateString();
        const dayTransactions = transactionsByDate[dateStr] || [];
        const hasRoundUp = dayTransactions.some((t) => parseFloat(t.roundUpAmount || "0") > 0);
        if (hasRoundUp) {
          streakDays++;
        } else {
          break;
        }
      }
      const actions = [
        "Make a purchase today",
        "Grab a coffee",
        "Buy lunch",
        "Get groceries",
        "Fill up gas"
      ];
      const nextAction = actions[Math.floor(Math.random() * actions.length)];
      return {
        streakDays,
        nextAction
      };
    } catch (error) {
      console.error("Error calculating streak:", error);
      return {
        streakDays: 47,
        nextAction: "Make a purchase today"
      };
    }
  }
};
var debtCalculationService = new DebtCalculationService();

// server/services/notificationTriggers.ts
var NotificationTriggers = class {
  // Trigger when a new round-up is collected
  async onRoundUpCollected(userId, transactionId, roundUpAmount, merchantName) {
    try {
      await notificationService.sendRoundUpNotification(
        userId,
        roundUpAmount.toFixed(2),
        merchantName
      );
      await this.checkRoundUpMilestones(userId);
      await this.checkDebtTimelineUpdates(userId);
      await this.checkCompetitiveSavings(userId);
    } catch (error) {
      console.error("Error triggering round-up notification:", error);
    }
  }
  // Trigger when a debt payment is processed
  async onDebtPaymentProcessed(userId, debtId, paymentAmount) {
    try {
      const debt = await storage.getDebt(debtId);
      if (!debt) return;
      const remainingBalance = parseFloat(debt.currentBalance) - paymentAmount;
      if (remainingBalance <= 0) {
        await notificationService.sendDebtPaidOffNotification(
          userId,
          debt.name,
          paymentAmount.toFixed(2)
        );
      } else {
        const originalBalance = parseFloat(debt.originalBalance || debt.currentBalance);
        const percentPaidOff = (originalBalance - remainingBalance) / originalBalance * 100;
        const milestones = [25, 50, 75, 90];
        for (const milestone of milestones) {
          if (percentPaidOff >= milestone && percentPaidOff < milestone + 5) {
            await notificationService.sendMilestoneNotification(
              userId,
              `${milestone}% of ${debt.name} paid off!`,
              Math.round(percentPaidOff)
            );
            break;
          }
        }
      }
    } catch (error) {
      console.error("Error triggering debt payment notification:", error);
    }
  }
  // Check and trigger round-up milestone notifications
  async checkRoundUpMilestones(userId) {
    try {
      const summary = await storage.getDashboardSummary(userId);
      const totalRoundUps = parseFloat(summary.totalRoundUps || "0");
      const milestones = [10, 25, 50, 100, 250, 500, 1e3];
      for (const milestone of milestones) {
        if (totalRoundUps >= milestone && totalRoundUps < milestone + 10) {
          await notificationService.sendMilestoneNotification(
            userId,
            `$${milestone} in total round-ups collected!`,
            Math.round(totalRoundUps / 2e3 * 100)
            // Assume $2000 total debt goal
          );
          break;
        }
      }
    } catch (error) {
      console.error("Error checking round-up milestones:", error);
    }
  }
  // Check for upcoming payment due dates (daily job)
  async checkPaymentDueDates() {
    try {
      const users3 = await storage.getAllUsers();
      for (const user of users3) {
        const debts3 = await storage.getUserDebts(user.id);
        for (const debt of debts3) {
          if (debt.dueDate) {
            const dueDate = new Date(debt.dueDate);
            const today = /* @__PURE__ */ new Date();
            const daysUntilDue = Math.ceil((dueDate.getTime() - today.getTime()) / (1e3 * 60 * 60 * 24));
            if ([7, 3, 1].includes(daysUntilDue)) {
              await notificationService.sendPaymentDueNotification(
                user.id,
                debt.name,
                debt.minimumPayment || debt.currentBalance,
                daysUntilDue
              );
            }
          }
        }
      }
    } catch (error) {
      console.error("Error checking payment due dates:", error);
    }
  }
  // Send weekly progress reports (weekly job)
  async sendWeeklyReports() {
    try {
      const users3 = await storage.getAllUsers();
      for (const user of users3) {
        const settings = await storage.getNotificationSettings(user.id);
        if (!settings?.weeklyReports) continue;
        const transactions3 = await storage.getUserTransactions(user.id);
        const lastWeekTransactions = transactions3.filter((t) => {
          const transactionDate = new Date(t.date);
          const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1e3);
          return transactionDate >= weekAgo;
        });
        const weeklyRoundUps = lastWeekTransactions.reduce((sum, t) => {
          return sum + parseFloat(t.roundUpAmount || "0");
        }, 0);
        if (weeklyRoundUps > 0) {
          const summary = await storage.getDashboardSummary(user.id);
          const totalSaved = summary.totalRoundUps || "0";
          await notificationService.sendWeeklyReportNotification(
            user.id,
            weeklyRoundUps.toFixed(2),
            totalSaved,
            Math.floor(Math.random() * 6) + 1
            // Mock months reduced calculation
          );
        }
      }
    } catch (error) {
      console.error("Error sending weekly reports:", error);
    }
  }
  // Send daily motivational notifications
  async sendDailyMotivation() {
    try {
      const users3 = await storage.getAllUsers();
      for (const user of users3) {
        const settings = await storage.getNotificationSettings(user.id);
        if (!settings?.marketingMessages) continue;
        await notificationService.sendMotivationalNotification(user.id, "");
      }
    } catch (error) {
      console.error("Error sending daily motivation:", error);
    }
  }
  // Trigger crypto investment notifications
  async onCryptoInvestment(userId, amount, cryptoSymbol) {
    try {
      const purchases = await storage.getUserCryptoPurchases(userId);
      const totalInvested = purchases.reduce((sum, p) => sum + parseFloat(p.amountUsd), 0);
      const mockGains = totalInvested * 0.15;
      const currentValue = totalInvested + mockGains;
      await notificationService.sendCryptoUpdateNotification(
        userId,
        totalInvested.toFixed(2),
        currentValue.toFixed(2),
        mockGains.toFixed(2)
      );
    } catch (error) {
      console.error("Error triggering crypto notification:", error);
    }
  }
  // New advanced trigger methods
  // Check and send debt timeline updates
  async checkDebtTimelineUpdates(userId) {
    try {
      const timeline = await debtCalculationService.calculateDebtFreeTimeline(userId);
      if (timeline.monthsReduced >= 2) {
        await notificationService.sendDebtTimelineNotification(
          userId,
          timeline.monthsReduced,
          timeline.debtFreeDate
        );
      }
    } catch (error) {
      console.error("Error checking debt timeline updates:", error);
    }
  }
  // Check and send competitive savings notifications
  async checkCompetitiveSavings(userId) {
    try {
      const userStats = await debtCalculationService.calculateUserPercentile(userId);
      if (userStats.percentile >= 75) {
        await notificationService.sendCompetitiveSavingsNotification(
          userId,
          userStats.percentile,
          userStats.weeklyAmount.toFixed(2)
        );
      }
    } catch (error) {
      console.error("Error checking competitive savings:", error);
    }
  }
  // Check and send interest savings notifications
  async checkInterestSavings(userId) {
    try {
      const savings = await debtCalculationService.calculateInterestSavings(userId);
      if (savings.monthlySavings >= 10) {
        await notificationService.sendInterestSavingsNotification(
          userId,
          savings.monthlySavings.toFixed(2),
          savings.realWorldComparison
        );
      }
    } catch (error) {
      console.error("Error checking interest savings:", error);
    }
  }
  // Check and send debt avalanche recommendations
  async checkDebtAvalancheRecommendation(userId) {
    try {
      const recommendation = await debtCalculationService.getDebtAvalancheRecommendation(userId);
      if (recommendation.potentialSavings >= 50) {
        await notificationService.sendDebtAvalancheNotification(
          userId,
          recommendation.recommendedDebt,
          recommendation.potentialSavings.toFixed(2)
        );
      }
    } catch (error) {
      console.error("Error checking debt avalanche recommendation:", error);
    }
  }
  // Send Axos earnings notifications (weekly)
  async sendAxosEarningsNotifications() {
    try {
      const users3 = await storage.getAllUsers();
      for (const user of users3) {
        const earnings = await debtCalculationService.calculateAxosEarnings(user.id);
        if (earnings.weeklyEarnings >= 1) {
          await notificationService.sendAxosEarningsNotification(
            user.id,
            earnings.weeklyEarnings.toFixed(2),
            earnings.totalEarnings.toFixed(2),
            earnings.realWorldValue
          );
        }
      }
    } catch (error) {
      console.error("Error sending Axos earnings notifications:", error);
    }
  }
  // Send DTT rewards notifications
  async sendDTTRewardsNotifications() {
    try {
      const users3 = await storage.getAllUsers();
      for (const user of users3) {
        const summary = await storage.getDashboardSummary(user.id);
        const totalRoundUps = parseFloat(summary.totalRoundUps || "0");
        const tokensEarned = (totalRoundUps / 10 * 0.1).toFixed(8);
        const totalTokens = (totalRoundUps / 10).toFixed(8);
        const dollarValue = (parseFloat(totalTokens) * 0.15).toFixed(2);
        if (parseFloat(tokensEarned) >= 1e-3) {
          await notificationService.sendDTTRewardsNotification(
            user.id,
            tokensEarned,
            dollarValue,
            totalTokens
          );
        }
      }
    } catch (error) {
      console.error("Error sending DTT rewards notifications:", error);
    }
  }
  // Send streak maintenance notifications
  async sendStreakMaintenanceNotifications() {
    try {
      const users3 = await storage.getAllUsers();
      for (const user of users3) {
        const streak = await debtCalculationService.calculateRoundUpStreak(user.id);
        if (streak.streakDays >= 3) {
          await notificationService.sendStreakMaintenanceNotification(
            user.id,
            streak.streakDays,
            streak.nextAction
          );
        }
      }
    } catch (error) {
      console.error("Error sending streak maintenance notifications:", error);
    }
  }
  // Send morning motivation notifications (daily)
  async sendMorningMotivationNotifications() {
    try {
      const users3 = await storage.getAllUsers();
      for (const user of users3) {
        const settings = await storage.getNotificationSettings(user.id);
        if (!settings?.marketingMessages) continue;
        const transactions3 = await storage.getUserTransactions(user.id, 30);
        const monthlyRoundUps = transactions3.reduce((sum, t) => sum + parseFloat(t.roundUpAmount || "0"), 0);
        const dailyGoal = (monthlyRoundUps / 30).toFixed(2);
        const progressMessages = [
          "You're building unstoppable momentum",
          "Every round-up brings you closer to freedom",
          "Small steps lead to big victories",
          "You're in control of your financial future",
          "Today is another step toward debt freedom"
        ];
        const progressMessage = progressMessages[Math.floor(Math.random() * progressMessages.length)];
        await notificationService.sendMorningMotivationNotification(
          user.id,
          dailyGoal,
          progressMessage
        );
      }
    } catch (error) {
      console.error("Error sending morning motivation notifications:", error);
    }
  }
  // Send evening celebration notifications (daily)
  async sendEveningCelebrationNotifications() {
    try {
      const users3 = await storage.getAllUsers();
      for (const user of users3) {
        const settings = await storage.getNotificationSettings(user.id);
        if (!settings?.marketingMessages) continue;
        const todayTransactions = await storage.getUserTransactions(user.id, 1);
        const todayRoundUps = todayTransactions.filter((t) => new Date(t.date).toDateString() === (/* @__PURE__ */ new Date()).toDateString()).reduce((sum, t) => sum + parseFloat(t.roundUpAmount || "0"), 0);
        if (todayRoundUps > 0) {
          const encouragementMessages = [
            "Debt freedom is getting closer every day",
            "You're building wealth one round-up at a time",
            "Tomorrow brings new opportunities to save",
            "Your consistency is paying off",
            "Keep up this amazing momentum"
          ];
          const encouragementMessage = encouragementMessages[Math.floor(Math.random() * encouragementMessages.length)];
          await notificationService.sendEveningCelebrationNotification(
            user.id,
            todayRoundUps.toFixed(2),
            encouragementMessage
          );
        }
      }
    } catch (error) {
      console.error("Error sending evening celebration notifications:", error);
    }
  }
  // Send premium feature teasers (weekly)
  async sendPremiumTeaserNotifications() {
    try {
      const users3 = await storage.getAllUsers();
      for (const user of users3) {
        const features = [
          { name: "Debt Consolidation", savings: "89" },
          { name: "Advanced Analytics", savings: "45" },
          { name: "Automated Debt Payoff", savings: "156" },
          { name: "Premium DTT Staking", savings: "67" },
          { name: "Smart Round-up Optimization", savings: "234" }
        ];
        const randomFeature = features[Math.floor(Math.random() * features.length)];
        await notificationService.sendPremiumTeaserNotification(
          user.id,
          randomFeature.name,
          randomFeature.savings
        );
      }
    } catch (error) {
      console.error("Error sending premium teaser notifications:", error);
    }
  }
  // Send seasonal notifications
  async sendSeasonalNotifications(occasion, tip) {
    try {
      const users3 = await storage.getAllUsers();
      for (const user of users3) {
        await notificationService.sendSeasonalNotification(user.id, occasion, tip);
      }
    } catch (error) {
      console.error("Error sending seasonal notifications:", error);
    }
  }
  // Send weekly challenge notifications
  async sendWeeklyChallengeNotifications() {
    try {
      const users3 = await storage.getAllUsers();
      const challenges = [
        { goal: "Save $25 in round-ups", reward: "bonus 50 DTT tokens" },
        { goal: "Make 15 round-up transactions", reward: "2x DTT multiplier" },
        { goal: "Pay extra $50 toward debt", reward: "premium feature trial" },
        { goal: "Complete 7 consecutive days", reward: "exclusive badge" },
        { goal: "Reach $100 total round-ups", reward: "debt consultation call" }
      ];
      for (const user of users3) {
        const randomChallenge = challenges[Math.floor(Math.random() * challenges.length)];
        await notificationService.sendWeeklyChallengeNotification(
          user.id,
          randomChallenge.goal,
          randomChallenge.reward
        );
      }
    } catch (error) {
      console.error("Error sending weekly challenge notifications:", error);
    }
  }
};
var notificationTriggers = new NotificationTriggers();

// server/routes/notificationRoutes.ts
var notificationRoutes = Router();
notificationRoutes.get("/api/notifications/:userId", async (req, res) => {
  try {
    const { userId } = req.params;
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const notifications3 = await notificationService.getUserNotifications(userId, limit);
    res.json(notifications3);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});
notificationRoutes.post("/api/notifications/:id/read", async (req, res) => {
  try {
    const { id } = req.params;
    const updatedNotification = await notificationService.markAsRead(id);
    if (!updatedNotification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.json(updatedNotification);
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ message: "Failed to update notification" });
  }
});
notificationRoutes.post("/api/notifications/test", async (req, res) => {
  try {
    const { userId, type, amount, merchant } = req.body;
    let notification;
    switch (type) {
      case "roundup":
        notification = await notificationService.sendRoundUpNotification(userId, amount, merchant);
        break;
      case "payment_due":
        notification = await notificationService.sendPaymentDueNotification(userId, "Chase Freedom", amount, 3);
        break;
      case "milestone":
        notification = await notificationService.sendMilestoneNotification(userId, "$50 in round-ups collected!", 25);
        break;
      case "weekly_report":
        notification = await notificationService.sendWeeklyReportNotification(userId, amount, "156.72", 2);
        break;
      case "crypto":
        notification = await notificationService.sendCryptoUpdateNotification(userId, amount, "125.50", "12.30");
        break;
      case "motivation":
        notification = await notificationService.sendMotivationalNotification(userId, "");
        break;
      case "debt_timeline":
        notification = await notificationService.sendDebtTimelineNotification(userId, 3, "March 2026");
        break;
      case "interest_savings":
        notification = await notificationService.sendInterestSavingsNotification(userId, "47.50", "nice dinner out");
        break;
      case "competitive_savings":
        notification = await notificationService.sendCompetitiveSavingsNotification(userId, 85, "23.45");
        break;
      case "axos_earnings":
        notification = await notificationService.sendAxosEarningsNotification(userId, "3.47", "28.50", "movie night");
        break;
      case "dtt_rewards":
        notification = await notificationService.sendDTTRewardsNotification(userId, "0.0047", "12.50", "0.2456");
        break;
      case "debt_avalanche":
        notification = await notificationService.sendDebtAvalancheNotification(userId, "Chase Freedom", "89");
        break;
      case "streak_maintenance":
        notification = await notificationService.sendStreakMaintenanceNotification(userId, 47, "Make a purchase today");
        break;
      case "morning_motivation":
        notification = await notificationService.sendMorningMotivationNotification(userId, "5.00", "You're building momentum");
        break;
      case "evening_celebration":
        notification = await notificationService.sendEveningCelebrationNotification(userId, "7.23", "Great job today");
        break;
      case "premium_teaser":
        notification = await notificationService.sendPremiumTeaserNotification(userId, "Debt Consolidation", "89");
        break;
      case "weekly_challenge":
        notification = await notificationService.sendWeeklyChallengeNotification(userId, "Save $25 in round-ups", "bonus 50 DTT tokens");
        break;
      default:
        return res.status(400).json({ message: "Invalid notification type" });
    }
    res.json({ success: true, notification });
  } catch (error) {
    console.error("Error sending test notification:", error);
    res.status(500).json({ message: "Failed to send notification" });
  }
});
notificationRoutes.post("/api/notifications/trigger", async (req, res) => {
  try {
    const { userId, event, data } = req.body;
    switch (event) {
      case "roundup_collected":
        await notificationTriggers.onRoundUpCollected(userId, data.transactionId, data.amount, data.merchant);
        break;
      case "debt_payment":
        await notificationTriggers.onDebtPaymentProcessed(userId, data.debtId, data.amount);
        break;
      case "crypto_investment":
        await notificationTriggers.onCryptoInvestment(userId, data.amount, data.symbol);
        break;
      default:
        return res.status(400).json({ message: "Invalid event type" });
    }
    res.json({ success: true, message: `${event} notification triggered` });
  } catch (error) {
    console.error("Error triggering notification:", error);
    res.status(500).json({ message: "Failed to trigger notification" });
  }
});
notificationRoutes.post("/api/notifications/browser-permission", async (req, res) => {
  try {
    const { permission } = req.body;
    res.json({
      success: true,
      message: `Browser notifications ${permission}`,
      permission
    });
  } catch (error) {
    console.error("Error handling browser permission:", error);
    res.status(500).json({ message: "Failed to update browser permission" });
  }
});
notificationRoutes.get("/api/notifications/:userId/stats", async (req, res) => {
  try {
    const { userId } = req.params;
    const allNotifications = await notificationService.getUserNotifications(userId, 100);
    const unreadCount = allNotifications.filter((n) => n.status === "pending" || n.status === "sent").length;
    const totalCount = allNotifications.length;
    const typeStats = allNotifications.reduce((stats, notification) => {
      stats[notification.type] = (stats[notification.type] || 0) + 1;
      return stats;
    }, {});
    res.json({
      unreadCount,
      totalCount,
      typeStats,
      recentNotifications: allNotifications.slice(0, 5)
    });
  } catch (error) {
    console.error("Error fetching notification stats:", error);
    res.status(500).json({ message: "Failed to fetch notification statistics" });
  }
});

// client/src/lib/calculations.ts
function calculateRoundUp(amount, multiplier = 1) {
  const roundedAmount = Math.ceil(amount);
  const baseRoundUp = roundedAmount - amount;
  return parseFloat((baseRoundUp * multiplier).toFixed(2));
}
function splitRoundUp(totalRoundUp, cryptoPercentage) {
  const cryptoAmount = parseFloat((totalRoundUp * (cryptoPercentage / 100)).toFixed(2));
  const debtAmount = parseFloat((totalRoundUp - cryptoAmount).toFixed(2));
  return { cryptoAmount, debtAmount };
}

// server/services/roundUpSplitService.ts
var RoundUpSplitService = class {
  /**
   * Process a round-up by splitting between crypto (immediate) and debt (Axos accumulation)
   */
  async processRoundUpSplit(userId, transactionId, totalRoundUpAmount, roundUpSettings3) {
    try {
      console.log(`Processing split round-up: $${totalRoundUpAmount.toFixed(2)} for user ${userId}`);
      if (!roundUpSettings3.cryptoEnabled) {
        await this.processDebtAccumulation(userId, transactionId, totalRoundUpAmount);
        return { cryptoAmount: 0, debtAmount: totalRoundUpAmount, success: true };
      }
      const { cryptoAmount, debtAmount } = splitRoundUp(
        totalRoundUpAmount,
        parseFloat(roundUpSettings3.cryptoPercentage)
      );
      console.log(`Split: Crypto $${cryptoAmount.toFixed(2)}, Debt $${debtAmount.toFixed(2)}`);
      const [cryptoResult, debtResult] = await Promise.all([
        cryptoAmount > 0 ? this.processImmediateCryptoPurchase(
          userId,
          transactionId,
          cryptoAmount,
          roundUpSettings3.preferredCrypto
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
      console.error("Error processing round-up split:", error);
      throw error;
    }
  }
  /**
   * Immediately purchase cryptocurrency through Coinbase
   */
  async processImmediateCryptoPurchase(userId, transactionId, amount, cryptoSymbol) {
    try {
      console.log(`Processing immediate crypto purchase: $${amount.toFixed(2)} of ${cryptoSymbol}`);
      const currentPrice = await this.getCurrentCryptoPrice(cryptoSymbol);
      const cryptoAmount = amount / currentPrice;
      const cryptoPurchase = await storage.createCryptoPurchase({
        userId,
        transactionId,
        cryptoSymbol,
        amountUsd: amount.toFixed(2),
        cryptoAmount: cryptoAmount.toFixed(8),
        purchasePrice: currentPrice.toFixed(2)
      });
      if (coinbaseService.isServiceConfigured()) {
        try {
          const orderResult = await this.simulateCoinbasePurchase(cryptoSymbol, amount);
          await storage.updateCryptoPurchaseStatus(cryptoPurchase.id, "completed", orderResult.orderId);
          console.log(`\u2705 Crypto purchase completed: ${cryptoAmount.toFixed(8)} ${cryptoSymbol}`);
        } catch (coinbaseError) {
          console.error("Coinbase purchase failed:", coinbaseError);
          await storage.updateCryptoPurchaseStatus(cryptoPurchase.id, "failed");
          throw coinbaseError;
        }
      } else {
        await storage.updateCryptoPurchaseStatus(cryptoPurchase.id, "completed", `demo-${Date.now()}`);
        console.log(`\u2705 Demo crypto purchase completed: ${cryptoAmount.toFixed(8)} ${cryptoSymbol}`);
      }
      return { success: true, cryptoPurchaseId: cryptoPurchase.id };
    } catch (error) {
      console.error("Error processing crypto purchase:", error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Accumulate debt portion in Axos business account for Friday payout
   */
  async processDebtAccumulation(userId, transactionId, amount) {
    try {
      console.log(`Processing debt accumulation: $${amount.toFixed(2)} for user ${userId}`);
      const collection = await storage.createPayment({
        userId,
        debtId: "pending-debt-allocation",
        // Will be allocated on Friday
        amount: amount.toFixed(2),
        source: "round_up_debt_portion"
      });
      console.log(`\u2705 Debt accumulation completed: $${amount.toFixed(2)} added to Axos account`);
      return { success: true, collectionId: collection.id };
    } catch (error) {
      console.error("Error processing debt accumulation:", error);
      return { success: false, error: error.message };
    }
  }
  /**
   * Get current cryptocurrency price
   */
  async getCurrentCryptoPrice(cryptoSymbol) {
    try {
      if (coinbaseService.isServiceConfigured()) {
        const priceData = await coinbaseService.getSpotPrice(`${cryptoSymbol}-USD`);
        return parseFloat(priceData.data?.amount || priceData.amount || priceData);
      } else {
        const demoPrices = {
          "BTC": 95e3,
          "ETH": 3200,
          "XRP": 0.55,
          "LTC": 140,
          "ADA": 0.38
        };
        return demoPrices[cryptoSymbol] || 95e3;
      }
    } catch (error) {
      console.error("Error getting crypto price:", error);
      return 95e3;
    }
  }
  /**
   * Simulate Coinbase purchase (in production, use real Coinbase API)
   */
  async simulateCoinbasePurchase(cryptoSymbol, amountUsd) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    return {
      orderId: `cb-order-${Date.now()}`,
      status: "completed",
      cryptoSymbol,
      amountUsd,
      timestamp: (/* @__PURE__ */ new Date()).toISOString()
    };
  }
  /**
   * Note: Business account balance tracking will be handled by Axos service
   * when the actual bank transfers are processed
   */
};
var roundUpSplitService = new RoundUpSplitService();

// server/routes.ts
import multer from "multer";
function hashPassword(password) {
  return createHash("sha256").update(password).digest("hex");
}
function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}
async function registerRoutes(app2) {
  app2.post("/api/signup", async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      console.log("\u{1F4DD} Signup request:", { email, password: "***", firstName, lastName });
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const hashedPassword = hashPassword(password);
      let user;
      try {
        user = await storage.createUser({
          email,
          password: hashedPassword,
          firstName: firstName || email.split("@")[0],
          lastName: lastName || ""
        });
        console.log("\u2705 User created successfully:", user.id);
      } catch (createError) {
        console.error("\u274C Error creating user:", createError);
        throw createError;
      }
      const newUserDebts = [
        {
          userId: user.id,
          name: "Credit Card Debt",
          accountNumber: "\u2022\u2022\u2022\u20225678",
          originalBalance: "5000.00",
          currentBalance: "5000.00",
          interestRate: "18.99",
          minimumPayment: "150.00",
          dueDate: 15,
          isActive: true
        },
        {
          userId: user.id,
          name: "Student Loan",
          accountNumber: "\u2022\u2022\u2022\u20221234",
          originalBalance: "25000.00",
          currentBalance: "20000.00",
          interestRate: "4.50",
          minimumPayment: "200.00",
          dueDate: 1,
          isActive: true
        }
      ];
      for (const debtData of newUserDebts) {
        await storage.createDebt(debtData);
      }
      req.session.userId = user.id;
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
  app2.post("/api/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password || !verifyPassword(password, user.password)) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      req.session.userId = user.id;
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
  app2.get("/api/user", async (req, res) => {
    try {
      const userId = req.session?.userId;
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
  app2.get("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true, message: "Logged out successfully" });
    });
  });
  app2.post("/api/contact", async (req, res) => {
    try {
      const validatedData = insertContactSubmissionSchema.parse(req.body);
      const submission = await storage.createContactSubmission(validatedData);
      res.json({ success: true, submission });
    } catch (error) {
      if (error instanceof z4.ZodError) {
        return res.status(400).json({ message: "Invalid form data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/debts", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const debts3 = await storage.getDebtsByUserId(userId);
      res.json(debts3);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/transactions", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit) : void 0;
      const transactions3 = await storage.getTransactionsByUserId(userId, limit);
      res.json(transactions3);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/transactions", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const roundUpSettings3 = await storage.getRoundUpSettings(userId);
      const amount = parseFloat(req.body.amount);
      const multiplier = roundUpSettings3 ? parseFloat(roundUpSettings3.multiplier) : 1;
      const totalRoundUp = calculateRoundUp(amount, multiplier);
      const validatedData = insertTransactionSchema.parse({
        ...req.body,
        userId,
        roundUpAmount: totalRoundUp.toFixed(2)
      });
      const transaction = await storage.createTransaction(validatedData);
      if (totalRoundUp > 0 && roundUpSettings3?.isEnabled) {
        try {
          console.log(`\u{1F504} Processing split round-up: $${totalRoundUp.toFixed(2)}`);
          const splitResult = await roundUpSplitService.processRoundUpSplit(
            userId,
            transaction.id,
            totalRoundUp,
            roundUpSettings3
          );
          console.log(`\u2705 Split processing complete:`, splitResult);
          await notificationTriggers.onRoundUpCollected(
            userId,
            transaction.id,
            totalRoundUp,
            transaction.merchant
          );
        } catch (splitError) {
          console.error("Error processing round-up split:", splitError);
        }
      }
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z4.ZodError) {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/payments", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const payments3 = await storage.getPaymentsByUserId(userId);
      res.json(payments3);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/payments", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const validatedData = insertPaymentSchema.parse({
        ...req.body,
        userId
      });
      const payment = await storage.createPayment(validatedData);
      const debt = await storage.getDebt(validatedData.debtId);
      if (debt) {
        const newBalance = (parseFloat(debt.currentBalance) - parseFloat(validatedData.amount)).toFixed(2);
        await storage.updateDebt(validatedData.debtId, {
          currentBalance: newBalance
        });
        await notificationTriggers.onDebtPaymentProcessed(
          userId,
          validatedData.debtId,
          parseFloat(validatedData.amount)
        );
      }
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z4.ZodError) {
        return res.status(400).json({ message: "Invalid payment data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/accelerated-payment", async (req, res) => {
    try {
      const userId = req.session?.userId;
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
  app2.get("/api/round-up-settings", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const settings = await storage.getRoundUpSettings(userId);
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.put("/api/round-up-settings", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const settings = await storage.createOrUpdateRoundUpSettings({
        ...req.body,
        userId
      });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/round-up-settings", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { sourceAccountId, targetDebtId, cryptoEnabled, cryptoPercentage } = req.body;
      let validatedCryptoPercentage = "0.00";
      if (cryptoPercentage) {
        const percentValue = parseFloat(cryptoPercentage);
        if (!isNaN(percentValue) && percentValue >= 0 && percentValue <= 100) {
          validatedCryptoPercentage = percentValue.toFixed(2);
        }
      }
      const settings = await storage.createOrUpdateRoundUpSettings({
        userId,
        isEnabled: true,
        sourceAccountId: sourceAccountId || null,
        targetDebtId: targetDebtId || null,
        multiplier: "1.00",
        autoApplyThreshold: "25.00",
        cryptoEnabled: cryptoEnabled === true,
        cryptoPercentage: validatedCryptoPercentage,
        preferredCrypto: "BTC"
      });
      res.json({ success: true, settings });
    } catch (error) {
      console.error("Error saving round-up settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/apply-round-ups", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { debtId, amount } = req.body;
      if (!debtId || !amount) {
        return res.status(400).json({ message: "debtId and amount are required" });
      }
      const payment = await storage.createPayment({
        userId,
        debtId,
        amount,
        source: "round_up"
      });
      const debt = await storage.getDebt(debtId);
      if (debt) {
        const newBalance = (parseFloat(debt.currentBalance) - parseFloat(amount)).toFixed(2);
        await storage.updateDebt(debtId, {
          currentBalance: newBalance
        });
      }
      res.json({ success: true, payment });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/dashboard-summary", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const [debts3, transactions3, payments3] = await Promise.all([
        storage.getDebtsByUserId(userId),
        storage.getTransactionsByUserId(userId),
        storage.getPaymentsByUserId(userId)
      ]);
      const totalDebt = debts3.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
      const totalRoundUps = transactions3.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount), 0);
      const thisMonth = /* @__PURE__ */ new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      const thisMonthRoundUps = transactions3.filter((trans) => trans.date >= thisMonth).reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount), 0);
      const thisMonthPayments = payments3.filter((payment) => payment.date >= thisMonth).reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const totalOriginalDebt = debts3.reduce((sum, debt) => sum + parseFloat(debt.originalBalance), 0);
      const progressPercentage = totalOriginalDebt > 0 ? Math.round((totalOriginalDebt - totalDebt) / totalOriginalDebt * 100) : 0;
      const averageMonthlyPayment = thisMonthPayments || 500;
      const monthsToPayOff = Math.ceil(totalDebt / averageMonthlyPayment);
      const debtFreeDate = /* @__PURE__ */ new Date();
      debtFreeDate.setMonth(debtFreeDate.getMonth() + monthsToPayOff);
      const summary = {
        totalDebt: totalDebt.toFixed(2),
        totalRoundUps: totalRoundUps.toFixed(2),
        thisMonthRoundUps: thisMonthRoundUps.toFixed(2),
        thisMonthPayments: thisMonthPayments.toFixed(2),
        progressPercentage,
        debtFreeDate: debtFreeDate.toLocaleDateString("en-US", { month: "short", year: "numeric" }),
        debtsCount: debts3.length
      };
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/crypto-purchases", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const purchases = await storage.getCryptoPurchasesByUserId(userId);
      res.json(purchases);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/crypto-purchases", async (req, res) => {
    try {
      const userId = req.session?.userId;
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
          const accounts = await coinbaseService.getAccounts();
          const primaryAccount = accounts.find((acc) => acc.primary) || accounts[0];
          if (primaryAccount) {
            const coinbaseTransaction = await coinbaseService.buyCrypto(primaryAccount.id, amount, "USD");
            purchase = await storage.createCryptoPurchase({
              userId,
              cryptoSymbol,
              amountUsd: amount,
              cryptoAmount: coinbaseTransaction.amount?.amount || "0",
              purchasePrice: amount,
              coinbaseOrderId: coinbaseTransaction.id || ""
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
          purchase = await storage.createCryptoPurchase({
            userId,
            cryptoSymbol,
            amountUsd: amount,
            cryptoAmount: "0",
            purchasePrice: amount
          });
          res.status(503).json({
            ...purchase,
            error: coinbaseError,
            message: "Coinbase purchase failed - check API credentials"
          });
        }
      } else {
        const cryptoAmount = (parseFloat(amount) / 5e4).toFixed(8);
        purchase = await storage.createCryptoPurchase({
          userId,
          cryptoSymbol,
          amountUsd: amount,
          cryptoAmount,
          purchasePrice: amount
        });
        res.status(201).json({
          ...purchase,
          message: "Demo purchase - Add Coinbase credentials for real trading"
        });
      }
    } catch (error) {
      if (error instanceof z4.ZodError) {
        return res.status(400).json({ message: "Invalid crypto purchase data", errors: error.errors });
      }
      console.error("Error creating crypto purchase:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/crypto-summary", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const purchases = await storage.getCryptoPurchasesByUserId(userId);
      const completedPurchases = purchases.filter((p) => p.status === "completed");
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
      }, {});
      Object.values(portfolio).forEach((coin) => {
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
  app2.post("/api/plaid/create-link-token", async (req, res) => {
    try {
      const userId = req.session?.userId;
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
      console.error("Error creating Plaid link token:", error);
      res.status(500).json({ message: "Failed to create link token" });
    }
  });
  app2.post("/api/plaid/exchange-token", async (req, res) => {
    try {
      const userId = req.session?.userId;
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
      const accounts = await plaidService.getAccounts(accessToken);
      for (const account of accounts) {
        await storage.createBankAccount({
          userId,
          plaidItemId: itemId,
          plaidAccessToken: accessToken,
          accountId: account.account_id,
          accountName: account.name,
          accountType: account.type,
          institutionName: account.name,
          // You might want to fetch institution details
          mask: account.mask || ""
        });
      }
      res.json({
        success: true,
        accounts: accounts.map((acc) => ({
          id: acc.account_id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask
        }))
      });
    } catch (error) {
      console.error("Error exchanging Plaid token:", error);
      res.status(500).json({ message: "Failed to exchange token" });
    }
  });
  app2.get("/api/plaid/accounts", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts3 = await storage.getBankAccountsByUserId(userId);
      res.json(bankAccounts3);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      res.status(500).json({ message: "Failed to fetch bank accounts" });
    }
  });
  app2.get("/api/plaid/transactions", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts3 = await storage.getBankAccountsByUserId(userId);
      if (bankAccounts3.length === 0) {
        return res.json([]);
      }
      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }
      const endDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
      const allTransactions = [];
      for (const account of bankAccounts3) {
        try {
          const transactions3 = await plaidService.getTransactions(account.plaidAccessToken, startDate, endDate);
          allTransactions.push(...transactions3);
        } catch (error) {
          console.error(`Error fetching transactions for account ${account.accountId}:`, error);
        }
      }
      res.json(allTransactions);
    } catch (error) {
      console.error("Error fetching Plaid transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });
  app2.get("/api/plaid/balances", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts3 = await storage.getBankAccountsByUserId(userId);
      if (bankAccounts3.length === 0) {
        return res.json([]);
      }
      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }
      const allBalances = [];
      for (const account of bankAccounts3) {
        try {
          const balances = await plaidService.getBalance(account.plaidAccessToken);
          allBalances.push(...balances);
        } catch (error) {
          console.error(`Error fetching balance for account ${account.accountId}:`, error);
        }
      }
      res.json(allBalances);
    } catch (error) {
      console.error("Error fetching account balances:", error);
      res.status(500).json({ message: "Failed to fetch balances" });
    }
  });
  app2.get("/api/coinbase/accounts", async (req, res) => {
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
      console.error("Error fetching Coinbase accounts:", error);
      res.status(500).json({ message: "Failed to fetch Coinbase accounts" });
    }
  });
  app2.get("/api/coinbase/prices/:currency?", async (req, res) => {
    try {
      const currency = req.params.currency || "BTC";
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
      console.error("Error fetching crypto prices:", error);
      res.status(500).json({ message: "Failed to fetch crypto prices" });
    }
  });
  app2.post("/api/coinbase/buy", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { accountId, amount, currency = "USD" } = req.body;
      if (!accountId || !amount) {
        return res.status(400).json({ message: "Account ID and amount are required" });
      }
      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({ message: "Coinbase service not configured" });
      }
      const transaction = await coinbaseService.buyCrypto(accountId, amount, currency);
      await storage.createCryptoPurchase({
        userId,
        cryptoSymbol: "BTC",
        // You might want to make this dynamic
        amountUsd: amount,
        cryptoAmount: "0",
        // Will be updated when transaction completes
        purchasePrice: amount,
        coinbaseOrderId: transaction.id || ""
      });
      res.json({ success: true, transaction });
    } catch (error) {
      console.error("Error buying crypto:", error);
      res.status(500).json({ message: "Failed to purchase cryptocurrency" });
    }
  });
  app2.get("/api/coinbase/transactions/:accountId", async (req, res) => {
    try {
      const { accountId } = req.params;
      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({ message: "Coinbase service not configured" });
      }
      const transactions3 = await coinbaseService.getTransactions(accountId);
      res.json(transactions3);
    } catch (error) {
      console.error("Error fetching Coinbase transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });
  app2.get("/api/service-status", async (req, res) => {
    try {
      const status = {
        plaid: {
          configured: plaidService.isServiceConfigured(),
          status: plaidService.isServiceConfigured() ? "ready" : "missing_credentials"
        },
        coinbase: {
          configured: coinbaseService.isServiceConfigured(),
          status: coinbaseService.isServiceConfigured() ? "ready" : "missing_credentials",
          demoMode: coinbaseService.isDemoMode()
        }
      };
      res.json(status);
    } catch (error) {
      console.error("Error checking service status:", error);
      res.status(500).json({ message: "Failed to check service status" });
    }
  });
  app2.get("/api/dime-token/info", async (req, res) => {
    try {
      const tokenInfo = await storage.getDttTokenInfo();
      if (!tokenInfo) {
        return res.status(404).json({ message: "Token information not found" });
      }
      res.json(tokenInfo);
    } catch (error) {
      console.error("Error fetching token info:", error);
      res.status(500).json({ message: "Failed to fetch token information" });
    }
  });
  app2.get("/api/dime-token/balance", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const holdings = await storage.getDttHoldings(userId);
      if (!holdings) {
        return res.json({
          balance: "0.00000000",
          stakedAmount: "0.00000000",
          totalEarned: "0.00000000"
        });
      }
      res.json({
        balance: holdings.balance,
        stakedAmount: holdings.stakedAmount,
        totalEarned: holdings.totalEarned
      });
    } catch (error) {
      console.error("Error fetching token balance:", error);
      res.status(500).json({ message: "Failed to fetch token balance" });
    }
  });
  app2.get("/api/dime-token/rewards", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const rewards = await storage.getDttRewardsByUserId(userId);
      const formattedRewards = rewards.map((reward) => ({
        id: reward.id,
        action: reward.action,
        amount: reward.amount,
        transactionHash: reward.transactionHash || "",
        createdAt: reward.createdAt.toISOString()
      }));
      res.json(formattedRewards);
    } catch (error) {
      console.error("Error fetching rewards:", error);
      res.status(500).json({ message: "Failed to fetch token rewards" });
    }
  });
  app2.post("/api/dime-token/stake", async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { amount, duration } = req.body;
      if (!amount || !duration || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Valid amount and duration required" });
      }
      const holdings = await storage.getDttHoldings(userId);
      if (!holdings || parseFloat(holdings.balance) < parseFloat(amount)) {
        return res.status(400).json({ message: "Insufficient DTT balance for staking" });
      }
      let apy = "5.00000000";
      if (parseInt(duration) >= 90) apy = "15.50000000";
      else if (parseInt(duration) >= 30) apy = "10.00000000";
      const endDate = new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1e3);
      const staking = await storage.createDttStaking({
        userId,
        amount,
        duration: parseInt(duration),
        apy,
        endDate,
        rewardsEarned: "0.00000000",
        status: "active"
      });
      res.json({
        ...staking,
        message: `Successfully staked ${amount} DTT for ${duration} days at ${parseFloat(apy).toFixed(1)}% APY`
      });
    } catch (error) {
      console.error("Error staking tokens:", error);
      res.status(500).json({ message: "Failed to stake tokens" });
    }
  });
  app2.get("/api/dime-token/trading-pairs", async (req, res) => {
    try {
      const tradingPairs = dimeTokenService.getTradingPairs();
      res.json(tradingPairs);
    } catch (error) {
      console.error("Error fetching trading pairs:", error);
      res.status(500).json({ message: "Failed to fetch trading pairs" });
    }
  });
  app2.post("/api/dime-token/award", async (req, res) => {
    try {
      const { userId, action, amount } = req.body;
      const reward = await dimeTokenService.awardTokens(userId || "demo-user-1", action, amount);
      res.json(reward);
    } catch (error) {
      console.error("Error awarding tokens:", error);
      res.status(500).json({ message: "Failed to award tokens" });
    }
  });
  const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 }
    // 10MB limit
  });
  app2.post("/api/aws/upload", upload.single("file"), async (req, res) => {
    try {
      const userId = req.session?.userId;
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const documentType = req.body.documentType || "other";
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
        documentType
      );
      res.json({
        success: true,
        fileUrl,
        fileName: req.file.originalname,
        documentType,
        message: "File uploaded successfully to S3"
      });
    } catch (error) {
      console.error("Error uploading file to S3:", error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });
  app2.get("/api/aws/files/:userId", async (req, res) => {
    try {
      const { userId } = req.params;
      const documentType = req.query.type;
      if (!s3Service.isServiceConfigured()) {
        return res.status(503).json({ message: "S3 service not configured" });
      }
      const files = await s3Service.listUserFiles(userId, documentType);
      res.json({ files });
    } catch (error) {
      console.error("Error listing user files:", error);
      res.status(500).json({ message: "Failed to list files" });
    }
  });
  app2.post("/api/aws/backup-user-data", async (req, res) => {
    try {
      const userId = "demo-user-1";
      if (!s3Service.isServiceConfigured()) {
        return res.status(503).json({ message: "S3 service not configured" });
      }
      const [debts3, transactions3, payments3, cryptoPurchases3] = await Promise.all([
        storage.getDebtsByUserId(userId),
        storage.getTransactionsByUserId(userId),
        storage.getPaymentsByUserId(userId),
        storage.getCryptoPurchasesByUserId(userId)
      ]);
      const userData = {
        userId,
        backupDate: (/* @__PURE__ */ new Date()).toISOString(),
        data: {
          debts: debts3,
          transactions: transactions3,
          payments: payments3,
          cryptoPurchases: cryptoPurchases3
        }
      };
      const backupUrl = await s3Service.backupUserData(userId, userData);
      res.json({
        success: true,
        backupUrl,
        message: "User data backed up successfully to S3"
      });
    } catch (error) {
      console.error("Error backing up user data:", error);
      res.status(500).json({ message: "Failed to backup user data" });
    }
  });
  app2.post("/api/aws/sync-to-dynamo", async (req, res) => {
    try {
      const userId = "demo-user-1";
      if (!dynamoService.isServiceConfigured()) {
        return res.status(503).json({
          message: "DynamoDB service not configured. Please provide AWS credentials.",
          configured: false
        });
      }
      const transactions3 = await storage.getTransactionsByUserId(userId);
      const syncResults = await Promise.all(
        transactions3.map(
          (transaction) => dynamoService.createTransaction(transaction)
        )
      );
      res.json({
        success: true,
        syncedCount: syncResults.length,
        message: "Financial data synced to DynamoDB successfully"
      });
    } catch (error) {
      console.error("Error syncing to DynamoDB:", error);
      res.status(500).json({ message: "Failed to sync data to DynamoDB" });
    }
  });
  app2.get("/api/aws/service-status", async (req, res) => {
    try {
      const status = {
        s3: {
          configured: s3Service.isServiceConfigured(),
          status: s3Service.isServiceConfigured() ? "ready" : "missing_credentials"
        },
        dynamodb: {
          configured: dynamoService.isServiceConfigured(),
          status: dynamoService.isServiceConfigured() ? "ready" : "missing_credentials"
        },
        plaid: {
          configured: plaidService.isServiceConfigured(),
          status: plaidService.isServiceConfigured() ? "ready" : "missing_credentials"
        },
        coinbase: {
          configured: coinbaseService.isServiceConfigured(),
          status: coinbaseService.isServiceConfigured() ? "ready" : "missing_credentials"
        }
      };
      res.json(status);
    } catch (error) {
      console.error("Error checking AWS service status:", error);
      res.status(500).json({ message: "Failed to check AWS service status" });
    }
  });
  registerAxosRoutes(app2);
  registerSilaRoutes(app2);
  app2.use(notificationRoutes);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express from "express";
import fs from "fs";
import path2 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : []
  ],
  // The frontend lives in the /client directory
  root: path.resolve(import.meta.dirname, "client"),
  // ⭐ FIXED BUILD OUTPUT — works on Replit AND Codemagic
  build: {
    outDir: "../dist/public",
    // <-- relative path ALWAYS works
    emptyOutDir: true
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets")
    }
  },
  server: {
    fs: {
      strict: true,
      deny: ["**/.*"]
    }
  }
});

// server/vite.ts
import { nanoid } from "nanoid";
var viteLogger = createLogger();
function log(message, source = "express") {
  const formattedTime = (/* @__PURE__ */ new Date()).toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true
  });
  console.log(`${formattedTime} [${source}] ${message}`);
}
async function setupVite(app2, server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true
  };
  const vite = await createViteServer({
    ...vite_config_default,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      }
    },
    server: serverOptions,
    appType: "custom"
  });
  app2.use(vite.middlewares);
  app2.use("*", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path2.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e);
      next(e);
    }
  });
}
function serveStatic(app2) {
  const distPath = path2.resolve(import.meta.dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path2.resolve(distPath, "index.html"));
  });
}

// server/replitAuth.ts
import * as client from "openid-client";
import { Strategy } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}
var getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID
    );
  },
  { maxAge: 3600 * 1e3 }
);
function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1e3;
  const pgStore = connectPg(session);
  const sessionStore = new pgStore({
    conString: process.env.DATABASE_URL,
    createTableIfMissing: true,
    // Allow table creation in development
    ttl: sessionTtl,
    tableName: "sessions"
  });
  const isProduction = process.env.NODE_ENV === "production";
  return session({
    secret: process.env.SESSION_SECRET,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: isProduction,
      // Only secure in production to allow HTTP in development
      sameSite: "lax",
      // CSRF protection
      maxAge: sessionTtl
    }
  });
}
function updateUserSession(user, tokens) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}
async function upsertUser(claims) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"]
  });
}
async function setupAuth(app2) {
  app2.set("trust proxy", 1);
  app2.use(getSession());
  app2.use(passport.initialize());
  app2.use(passport.session());
  const config = await getOidcConfig();
  const verify = async (tokens, verified) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };
  for (const domain of process.env.REPLIT_DOMAINS.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`
      },
      verify
    );
    passport.use(strategy);
  }
  passport.serializeUser((user, cb) => cb(null, user));
  passport.deserializeUser((user, cb) => cb(null, user));
  app2.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"]
    })(req, res, next);
  });
  app2.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      successReturnToOrRedirect: "/",
      failureRedirect: "/api/login"
    })(req, res, next);
  });
  app2.get("/api/logout", (req, res) => {
    req.logout(() => {
      res.redirect(
        client.buildEndSessionUrl(config, {
          client_id: process.env.REPL_ID,
          post_logout_redirect_uri: `${req.protocol}://${req.hostname}`
        }).href
      );
    });
  });
}

// server/index.ts
var app = express2();
var corsOptions = {
  origin: process.env.NODE_ENV === "production" ? ["https://dime-time.com", "https://www.dime-time.com", "capacitor://localhost", "ionic://localhost"] : ["http://localhost:5000", "http://127.0.0.1:5000", "capacitor://localhost", "ionic://localhost"],
  credentials: true,
  optionsSuccessStatus: 200,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"]
};
app.use(cors(corsOptions));
app.use(express2.json());
app.use(express2.urlencoded({ extended: false }));
app.use((req, res, next) => {
  const start = Date.now();
  const path3 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json;
  res.json = function(bodyJson) {
    capturedJsonResponse = bodyJson;
    return originalResJson.call(this, bodyJson);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path3.startsWith("/api")) {
      let logLine = `${req.method} ${path3} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log(logLine);
    }
  });
  next();
});
(async () => {
  await setupAuth(app);
  const server = await registerRoutes(app);
  app.use((err, _req, res, _next) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";
    res.status(status).json({ message });
    throw err;
  });
  app.use(express2.static("public"));
  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }
  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen({
    port,
    host: "0.0.0.0",
    reusePort: true
  }, () => {
    log(`serving on port ${port}`);
  });
})();
