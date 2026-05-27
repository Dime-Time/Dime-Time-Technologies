import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, integer, index, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  password: varchar("password"),
  passwordAlgo: varchar("password_algo").default("sha256"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

export const debts = pgTable("debts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  name: text("name").notNull(),
  accountNumber: text("account_number").notNull(),
  originalBalance: decimal("original_balance", { precision: 10, scale: 2 }).notNull(),
  currentBalance: decimal("current_balance", { precision: 10, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 2 }).notNull(),
  minimumPayment: decimal("minimum_payment", { precision: 10, scale: 2 }).notNull(),
  dueDate: integer("due_date").notNull(), // day of month
  isActive: boolean("is_active").default(true).notNull(),
  payeeAccountNumber: text("payee_account_number"), // Creditor's bank account number for ACH payment (set by admin)
  payeeRoutingNumber: text("payee_routing_number"), // Creditor's bank routing number for ACH payment (set by admin)
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const transactions = pgTable("transactions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  merchant: text("merchant").notNull(),
  category: text("category").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  roundUpAmount: decimal("round_up_amount", { precision: 10, scale: 2 }).notNull(),
  date: timestamp("date").defaultNow().notNull(),
  description: text("description"),
});

export const payments = pgTable("payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  debtId: varchar("debt_id").notNull().references(() => debts.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  source: text("source").notNull(), // 'round_up', 'manual', 'scheduled'
  date: timestamp("date").defaultNow().notNull(),
  status: text("status").default('completed').notNull(),
});

export const roundUpSettings = pgTable("round_up_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  isEnabled: boolean("is_enabled").default(true).notNull(),
  sourceAccountId: varchar("source_account_id"), // Bank account ID for pulling round-ups (e.g., JP Morgan Chase checking)
  targetDebtId: varchar("target_debt_id"), // Debt account to pay (e.g., Carmax car loan)
  multiplier: decimal("multiplier", { precision: 3, scale: 2 }).default('1.00').notNull(), // 1.00 = normal, 2.00 = double round-ups
  autoApplyThreshold: decimal("auto_apply_threshold", { precision: 10, scale: 2 }).default('25.00').notNull(),
  cryptoEnabled: boolean("crypto_enabled").default(false).notNull(),
  cryptoPercentage: decimal("crypto_percentage", { precision: 5, scale: 2 }).default('0.00').notNull(), // 0-100%
  preferredCrypto: text("preferred_crypto").default('BTC').notNull(),
});

export const cryptoPurchases = pgTable("crypto_purchases", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  cryptoSymbol: text("crypto_symbol").notNull(),
  amountUsd: decimal("amount_usd", { precision: 10, scale: 2 }).notNull(),
  cryptoAmount: decimal("crypto_amount", { precision: 18, scale: 8 }).notNull(),
  purchasePrice: decimal("purchase_price", { precision: 10, scale: 2 }).notNull(),
  coinbaseOrderId: text("coinbase_order_id"),
  status: text("status").default('pending').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const bankAccounts = pgTable("bank_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  plaidItemId: text("plaid_item_id").notNull().unique(),
  plaidAccessToken: text("plaid_access_token").notNull(),
  accountId: text("account_id").notNull(),
  accountName: text("account_name").notNull(),
  accountType: text("account_type").notNull(), // checking, savings, credit
  institutionName: text("institution_name").notNull(),
  mask: text("mask"), // last 4 digits
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const userSessions = pgTable("user_sessions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sessionToken: text("session_token").notNull().unique(),
  deviceType: text("device_type").notNull(), // web, mobile
  deviceId: text("device_id"),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Business Account Management for Axos Integration
export const businessAccount = pgTable("business_account", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  bankName: text("bank_name").default('Axos Bank').notNull(),
  accountId: text("account_id").notNull(), // Axos account ID
  accountNumber: text("account_number").notNull(),
  routingNumber: text("routing_number").notNull(),
  accountType: text("account_type").default('business_checking').notNull(),
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).default('0.00').notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).default('0.0400').notNull(), // 4% APY
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Round-up Collections from Users to Business Account
export const roundUpCollections = pgTable("round_up_collections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  userAccountId: text("user_account_id").notNull(), // User's bank account
  userRoutingNumber: text("user_routing_number").notNull(),
  businessAccountId: varchar("business_account_id").notNull().references(() => businessAccount.id),
  axosTransferId: text("axos_transfer_id"), // Axos API transfer ID
  status: text("status").default('pending').notNull(), // pending, completed, failed
  collectionDate: timestamp("collection_date").defaultNow().notNull(),
  effectiveDate: timestamp("effective_date"), // When funds are available
  failureReason: text("failure_reason"),
});

// Weekly Bulk Distributions (Every Friday)
export const weeklyDistributions = pgTable("weekly_distributions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  distributionDate: timestamp("distribution_date").notNull(), // Friday date
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  paymentCount: integer("payment_count").notNull(),
  businessAccountId: varchar("business_account_id").notNull().references(() => businessAccount.id),
  axosBulkTransferId: text("axos_bulk_transfer_id"), // Axos bulk payment ID
  status: text("status").default('scheduled').notNull(), // scheduled, processing, completed, failed
  scheduledDate: timestamp("scheduled_date").notNull(),
  completedDate: timestamp("completed_date"),
  interestEarned: decimal("interest_earned", { precision: 10, scale: 2 }).default('0.00').notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Individual Debt Payments within Weekly Distributions
export const distributionPayments = pgTable("distribution_payments", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  distributionId: varchar("distribution_id").notNull().references(() => weeklyDistributions.id),
  userId: varchar("user_id").notNull().references(() => users.id),
  debtId: varchar("debt_id").notNull().references(() => debts.id),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  debtAccountId: text("debt_account_id").notNull(), // Debt account number
  debtRoutingNumber: text("debt_routing_number").notNull(),
  axosTransferId: text("axos_transfer_id"), // Individual transfer ID
  status: text("status").default('scheduled').notNull(), // scheduled, completed, failed
  failureReason: text("failure_reason"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Interest Earnings Tracking (4% APY)
export const interestEarnings = pgTable("interest_earnings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  businessAccountId: varchar("business_account_id").notNull().references(() => businessAccount.id),
  periodStart: timestamp("period_start").notNull(),
  periodEnd: timestamp("period_end").notNull(),
  averageBalance: decimal("average_balance", { precision: 12, scale: 2 }).notNull(),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).notNull(),
  interestEarned: decimal("interest_earned", { precision: 10, scale: 2 }).notNull(),
  daysInPeriod: integer("days_in_period").notNull(),
  calculatedDate: timestamp("calculated_date").defaultNow().notNull(),
});

// User types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;

// Transfer ledger — every money movement attempt (round-up collections and debt payments)
export const transfers = pgTable("transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'roundup_collection' | 'debt_payment'
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default('created'), // created | authorized | pending | posted | settled | failed | returned | cancelled
  plaidTransferId: text("plaid_transfer_id"),
  plaidAuthorizationId: text("plaid_authorization_id"),
  mercuryTransferId: text("mercury_transfer_id"),
  debtId: varchar("debt_id"),
  correlationId: varchar("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  rawRequest: text("raw_request"),
  rawResponse: text("raw_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTransferSchema = createInsertSchema(transfers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Transfer = typeof transfers.$inferSelect;
export type InsertTransfer = z.infer<typeof insertTransferSchema>;

// Idempotency keys table for request deduplication
export const idempotencyKeys = pgTable("idempotency_keys", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  idempotencyKey: varchar("idempotency_key").notNull(),
  userId: varchar("user_id").notNull(),
  endpoint: varchar("endpoint").notNull(),
  responseStatus: integer("response_status").notNull(),
  responseBody: text("response_body").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertDebtSchema = createInsertSchema(debts).omit({
  id: true,
  createdAt: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  date: true,
});

export const insertPaymentSchema = createInsertSchema(payments).omit({
  id: true,
  date: true,
  status: true,
});

export const insertRoundUpSettingsSchema = createInsertSchema(roundUpSettings).omit({
  id: true,
});

// Axos Business Account integration insert schemas
export const insertBusinessAccountSchema = createInsertSchema(businessAccount).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertRoundUpCollectionSchema = createInsertSchema(roundUpCollections).omit({
  id: true,
  collectionDate: true,
});

export const insertWeeklyDistributionSchema = createInsertSchema(weeklyDistributions).omit({
  id: true,
  createdAt: true,
});

export const insertDistributionPaymentSchema = createInsertSchema(distributionPayments).omit({
  id: true,
  createdAt: true,
});

export const insertInterestEarningsSchema = createInsertSchema(interestEarnings).omit({
  id: true,
  calculatedDate: true,
});

// DTT Token Holdings
export const dttHoldings = pgTable("dtt_holdings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  balance: decimal("balance", { precision: 18, scale: 8 }).notNull().default("0.00000000"),
  stakedAmount: decimal("staked_amount", { precision: 18, scale: 8 }).notNull().default("0.00000000"),
  totalEarned: decimal("total_earned", { precision: 18, scale: 8 }).notNull().default("0.00000000"),
  lastActivity: timestamp("last_activity").defaultNow().notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// DTT Token Rewards
export const dttRewards = pgTable("dtt_rewards", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  paymentId: varchar("payment_id").references(() => payments.id),
  action: text("action").notNull(), // 'round_up', 'debt_payment', 'milestone', 'daily_login', 'referral'
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  transactionHash: text("transaction_hash"), // For future blockchain integration
  status: text("status").default('completed').notNull(),
  metadata: text("metadata"), // JSON string for additional data
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// DTT Token Staking
export const dttStaking = pgTable("dtt_staking", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  duration: integer("duration").notNull(), // days
  apy: decimal("apy", { precision: 5, scale: 2 }).notNull(), // annual percentage yield
  startDate: timestamp("start_date").defaultNow().notNull(),
  endDate: timestamp("end_date").notNull(),
  status: text("status").default('active').notNull(), // active, completed, withdrawn
  rewardsEarned: decimal("rewards_earned", { precision: 18, scale: 8 }).default("0.00000000").notNull(),
  lastRewardCalculation: timestamp("last_reward_calculation"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// DTT Token Info (singleton for market data)
export const dttTokenInfo = pgTable("dtt_token_info", {
  id: varchar("id").primaryKey().default("dtt-info"),
  currentPrice: decimal("current_price", { precision: 10, scale: 6 }).notNull().default("0.250000"),
  marketCap: decimal("market_cap", { precision: 15, scale: 2 }).notNull().default("2500000.00"),
  volume24h: decimal("volume_24h", { precision: 12, scale: 2 }).notNull().default("125000.00"),
  priceChange24h: decimal("price_change_24h", { precision: 5, scale: 2 }).notNull().default("5.25"),
  totalSupply: decimal("total_supply", { precision: 20, scale: 0 }).notNull().default("10000000"),
  circulatingSupply: decimal("circulating_supply", { precision: 20, scale: 0 }).notNull().default("2500000"),
  lastUpdated: timestamp("last_updated").defaultNow().notNull(),
});

// Sweep Account for JP Morgan Chase integration
export const sweepAccounts = pgTable("sweep_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  jpMorganAccountId: varchar("jp_morgan_account_id").notNull(),
  accountNumber: varchar("account_number").notNull(),
  routingNumber: varchar("routing_number").notNull(),
  accountType: varchar("account_type").notNull().default("sweep"), // sweep, checking, savings
  currentBalance: decimal("current_balance", { precision: 12, scale: 2 }).notNull().default("0.00"),
  interestRate: decimal("interest_rate", { precision: 5, scale: 4 }).notNull().default("0.0200"), // 2%
  status: varchar("status").notNull().default("active"), // active, inactive, suspended
  lastInterestCalculation: timestamp("last_interest_calculation"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Round-up Collections in Sweep Account
export const sweepDeposits = pgTable("sweep_deposits", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sweepAccountId: varchar("sweep_account_id").notNull().references(() => sweepAccounts.id),
  transactionId: varchar("transaction_id").references(() => transactions.id),
  roundUpAmount: decimal("round_up_amount", { precision: 10, scale: 2 }).notNull(),
  interestEarned: decimal("interest_earned", { precision: 10, scale: 6 }).notNull().default("0.000000"),
  depositDate: timestamp("deposit_date").defaultNow(),
  status: varchar("status").notNull().default("collected"), // collected, earning_interest, dispersed
});

// Friday Debt Dispersals
export const weeklyDispersals = pgTable("weekly_dispersals", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  sweepAccountId: varchar("sweep_account_id").notNull().references(() => sweepAccounts.id),
  dispersalDate: timestamp("dispersal_date").notNull(),
  totalAmount: decimal("total_amount", { precision: 12, scale: 2 }).notNull(),
  principalAmount: decimal("principal_amount", { precision: 12, scale: 2 }).notNull(),
  interestAmount: decimal("interest_amount", { precision: 12, scale: 6 }).notNull(),
  targetDebtId: varchar("target_debt_id").references(() => debts.id),
  jpMorganTransactionId: varchar("jp_morgan_transaction_id"),
  status: varchar("status").notNull().default("pending"), // pending, processing, completed, failed
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Insert schemas for new tables
export const insertSweepAccountSchema = createInsertSchema(sweepAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const insertSweepDepositSchema = createInsertSchema(sweepDeposits).omit({
  id: true,
  depositDate: true,
});

export const insertWeeklyDispersalSchema = createInsertSchema(weeklyDispersals).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

// Type exports for new tables
export type SweepAccount = typeof sweepAccounts.$inferSelect;
export type InsertSweepAccount = z.infer<typeof insertSweepAccountSchema>;

export type SweepDeposit = typeof sweepDeposits.$inferSelect;
export type InsertSweepDeposit = z.infer<typeof insertSweepDepositSchema>;

export type WeeklyDispersal = typeof weeklyDispersals.$inferSelect;
export type InsertWeeklyDispersal = z.infer<typeof insertWeeklyDispersalSchema>;

export const insertCryptoPurchaseSchema = createInsertSchema(cryptoPurchases).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertBankAccountSchema = createInsertSchema(bankAccounts).omit({
  id: true,
  createdAt: true,
});

export const insertUserSessionSchema = createInsertSchema(userSessions).omit({
  id: true,
  createdAt: true,
  lastActivity: true,
});

// DTT Token Insert Schemas
export const insertDttHoldingsSchema = createInsertSchema(dttHoldings).omit({
  id: true,
  createdAt: true,
  lastActivity: true,
});

export const insertDttRewardsSchema = createInsertSchema(dttRewards).omit({
  id: true,
  createdAt: true,
  status: true,
});

export const insertDttStakingSchema = createInsertSchema(dttStaking).omit({
  id: true,
  createdAt: true,
  startDate: true,
  lastRewardCalculation: true,
});

export const insertDttTokenInfoSchema = createInsertSchema(dttTokenInfo).omit({
  lastUpdated: true,
});

// DTT Token Types
export type DttHoldings = typeof dttHoldings.$inferSelect;
export type InsertDttHoldings = z.infer<typeof insertDttHoldingsSchema>;

export type DttRewards = typeof dttRewards.$inferSelect;
export type InsertDttRewards = z.infer<typeof insertDttRewardsSchema>;

export type DttStaking = typeof dttStaking.$inferSelect;
export type InsertDttStaking = z.infer<typeof insertDttStakingSchema>;

export type DttTokenInfo = typeof dttTokenInfo.$inferSelect;
export type InsertDttTokenInfo = z.infer<typeof insertDttTokenInfoSchema>;

// Types  
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Debt = typeof debts.$inferSelect;
export type InsertDebt = z.infer<typeof insertDebtSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type Payment = typeof payments.$inferSelect;
export type InsertPayment = z.infer<typeof insertPaymentSchema>;

export type RoundUpSettings = typeof roundUpSettings.$inferSelect;
export type InsertRoundUpSettings = z.infer<typeof insertRoundUpSettingsSchema>;

export type CryptoPurchase = typeof cryptoPurchases.$inferSelect;
export type InsertCryptoPurchase = z.infer<typeof insertCryptoPurchaseSchema>;

export type BankAccount = typeof bankAccounts.$inferSelect;
export type InsertBankAccount = z.infer<typeof insertBankAccountSchema>;

export type UserSession = typeof userSessions.$inferSelect;
export type InsertUserSession = z.infer<typeof insertUserSessionSchema>;

// Axos Business Account Types
export type BusinessAccount = typeof businessAccount.$inferSelect;
export type InsertBusinessAccount = z.infer<typeof insertBusinessAccountSchema>;

export type RoundUpCollection = typeof roundUpCollections.$inferSelect;
export type InsertRoundUpCollection = z.infer<typeof insertRoundUpCollectionSchema>;

export type WeeklyDistribution = typeof weeklyDistributions.$inferSelect;
export type InsertWeeklyDistribution = z.infer<typeof insertWeeklyDistributionSchema>;

export type DistributionPayment = typeof distributionPayments.$inferSelect;
export type InsertDistributionPayment = z.infer<typeof insertDistributionPaymentSchema>;

export type InterestEarnings = typeof interestEarnings.$inferSelect;
export type InsertInterestEarnings = z.infer<typeof insertInterestEarningsSchema>;

// Notifications table
export const notifications = pgTable("notifications", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  type: text("type").notNull(), // 'sms', 'email', 'push', 'system'
  channel: text("channel").notNull(), // 'sms', 'email', 'push', 'toast'
  title: text("title").notNull(),
  message: text("message").notNull(),
  recipient: text("recipient").notNull(), // phone number for SMS, email for email
  status: text("status").notNull().default('pending'), // 'pending', 'sent', 'delivered', 'failed'
  priority: text("priority").notNull().default('medium'), // 'low', 'medium', 'high'
  metadata: text("metadata"), // JSON string for additional data
  sentAt: timestamp("sent_at"),
  deliveredAt: timestamp("delivered_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// User notification preferences
export const notificationSettings = pgTable("notification_settings", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id).unique(),
  smsEnabled: boolean("sms_enabled").default(true).notNull(),
  emailEnabled: boolean("email_enabled").default(true).notNull(),
  pushEnabled: boolean("push_enabled").default(true).notNull(),
  phoneNumber: text("phone_number"), // User's phone number for SMS
  paymentReminders: boolean("payment_reminders").default(true).notNull(),
  roundupMilestones: boolean("roundup_milestones").default(true).notNull(),
  cryptoUpdates: boolean("crypto_updates").default(true).notNull(),
  weeklyReports: boolean("weekly_reports").default(true).notNull(),
  marketingMessages: boolean("marketing_messages").default(false).notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

// Insert schemas for notifications
export const insertNotificationSchema = createInsertSchema(notifications).omit({
  id: true,
  createdAt: true,
  sentAt: true,
  deliveredAt: true,
});

export const insertNotificationSettingsSchema = createInsertSchema(notificationSettings).omit({
  id: true,
  updatedAt: true,
});

// Types for notifications
export type Notification = typeof notifications.$inferSelect;
export type InsertNotification = z.infer<typeof insertNotificationSchema>;
export type NotificationSettings = typeof notificationSettings.$inferSelect;
export type InsertNotificationSettings = z.infer<typeof insertNotificationSettingsSchema>;

// Contact form submissions
export const contactSubmissions = pgTable("contact_submissions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  name: text("name").notNull(),
  email: text("email").notNull(),
  message: text("message").notNull(),
  status: text("status").default('new').notNull(), // 'new', 'read', 'responded'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({
  id: true,
  createdAt: true,
  status: true,
});

export type ContactSubmission = typeof contactSubmissions.$inferSelect;
export type InsertContactSubmission = z.infer<typeof insertContactSubmissionSchema>;

export const insertIdempotencyKeySchema = createInsertSchema(idempotencyKeys).omit({
  id: true,
  createdAt: true,
});

export type IdempotencyKey = typeof idempotencyKeys.$inferSelect;
export type InsertIdempotencyKey = z.infer<typeof insertIdempotencyKeySchema>;

// Password reset tokens — single-use, time-limited, SHA-256 hashed at rest
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_password_reset_user").on(table.userId),
  index("idx_password_reset_expires").on(table.expiresAt),
]);

export const insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
export type InsertPasswordResetToken = z.infer<typeof insertPasswordResetTokenSchema>;
