import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, integer, index, jsonb, uniqueIndex } from "drizzle-orm/pg-core";
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
  emailVerifiedAt: timestamp("email_verified_at"),
  // Real-money ACH rollout allowlist (operator-controlled, instantly revocable).
  // The hot-path gate for live transfers — a user must be explicitly enabled
  // here before any real Stripe ACH debit can be created, even when the
  // ENABLE_REAL_TRANSFERS master switch is ON. Toggled only via the admin
  // surface; never settable through user-facing inserts.
  realTransfersEnabled: boolean("real_transfers_enabled").default(false).notNull(),
  realTransfersEnabledAt: timestamp("real_transfers_enabled_at"),
  realTransfersEnabledBy: varchar("real_transfers_enabled_by"),
  realTransfersNotes: text("real_transfers_notes"),
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
  // --- Automatic debt import (provider-agnostic) ---
  source: text("source").default('manual').notNull(), // 'manual' (user-entered) | 'imported'
  provider: text("provider"), // 'sandbox' | 'plaid' | 'method' — null for manual debts
  providerAccountId: text("provider_account_id"), // stable id from the provider; null for manual
  institutionName: text("institution_name"),
  accountType: text("account_type"), // 'credit_card' | 'student_loan' | 'auto_loan' | ...
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  availableCredit: decimal("available_credit", { precision: 12, scale: 2 }),
  paymentStatus: text("payment_status"),
  lastImportedAt: timestamp("last_imported_at"),
  isHidden: boolean("is_hidden").default(false).notNull(),
  // Fields the user manually overrode after import — refresh skips these so a
  // re-import never clobbers the user's edits.
  userEditedFields: text("user_edited_fields").array().default(sql`'{}'::text[]`).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  // Duplicate detection: one row per (user, provider, provider account).
  // NULLs (manual debts) are distinct in Postgres, so manual debts are unaffected.
  uniqueIndex("debts_provider_account_uq").on(table.userId, table.provider, table.providerAccountId),
]);

// A user's connection to a liability-data provider (one row per user+provider).
// Holds the encrypted access token (same AES-256-GCM scheme as Plaid/Stripe)
// plus the consent timestamp for compliance.
export const debtProviderConnections = pgTable("debt_provider_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  providerItemId: text("provider_item_id"),
  accessTokenEnc: text("access_token_enc"), // AES-256-GCM encrypted; never a raw token
  institutionName: text("institution_name"),
  status: text("status").default('active').notNull(), // 'active' | 'disconnected' | 'error'
  consentAt: timestamp("consent_at"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  uniqueIndex("debt_provider_conn_user_provider_uq").on(table.userId, table.provider),
]);

// Append-only audit trail for every import / refresh / disconnect (compliance).
export const debtImportAuditLogs = pgTable("debt_import_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  action: text("action").notNull(), // 'import' | 'refresh' | 'disconnect'
  status: text("status").notNull(), // 'success' | 'error'
  importedCount: integer("imported_count").default(0).notNull(),
  updatedCount: integer("updated_count").default(0).notNull(),
  message: text("message"),
  correlationId: text("correlation_id"),
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
  // 'roundup_collection' | 'debt_payment' | 'stripe_ach_debit'
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default('created'), // created | authorized | pending | processing | posted | settled | failed | returned | cancelled | requires_action
  // Plaid / Mercury provider IDs
  plaidTransferId: text("plaid_transfer_id"),
  plaidAuthorizationId: text("plaid_authorization_id"),
  mercuryTransferId: text("mercury_transfer_id"),
  // Stripe ACH provider IDs (provider-agnostic ledger — Stripe writes here too)
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  provider: text("provider"), // 'plaid' | 'mercury' | 'stripe' — set when a provider is selected
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

// Stripe Financial Connections accounts — separate from bank_accounts (Plaid)
// so the two adapters stay independent and the Plaid encryption / decryption
// path is untouched.
export const stripeAccounts = pgTable("stripe_accounts", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  // Stripe Customer ID (created lazily on first Financial Connections session)
  stripeCustomerId: text("stripe_customer_id").notNull(),
  // Stripe Financial Connections account id (fca_...)
  stripeFcAccountId: text("stripe_fc_account_id").notNull().unique(),
  // Stripe PaymentMethod id (ba_... / pm_...) created from the FC account.
  // Encrypted at rest via encryptionService (same AES-256-GCM key as Plaid tokens).
  stripePaymentMethodEnc: text("stripe_payment_method_enc"),
  institutionName: text("institution_name"),
  last4: text("last4"),
  status: text("status").notNull().default('linked'), // linked | unlinked | failed
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertStripeAccountSchema = createInsertSchema(stripeAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type StripeAccount = typeof stripeAccounts.$inferSelect;
export type InsertStripeAccount = z.infer<typeof insertStripeAccountSchema>;

// Stripe webhook event dedup — `event.id` is unique per delivery.
export const stripeWebhookEvents = pgTable("stripe_webhook_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull(),
});

// Real-money decision audit trail. One row per real-transfer GATE decision
// (approve/block), per real-debit outcome (initiated/failed), and per
// allowlist change. This is a durable money-audit record — structured logs
// alone are insufficient. NEVER stores a plaintext payment-method id; the
// encrypted PM lives in `stripe_accounts` and is resolvable via
// `stripeAccountId`.
export const realTransferAuditLogs = pgTable("real_transfer_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  // Set when an admin action produced this row (allowlist toggle); null for
  // automated per-debit gate decisions.
  adminUserId: varchar("admin_user_id"),
  action: text("action").notNull(), // 'ach_debit_decision' | 'ach_debit_outcome' | 'allowlist_changed'
  result: text("result").notNull(), // 'approved' | 'blocked' | 'initiated' | 'failed' | 'enabled' | 'disabled'
  reason: text("reason"), // machine code, e.g. 'not_allowlisted', 'over_first_transfer_limit'
  amount: decimal("amount", { precision: 10, scale: 2 }),
  debtId: varchar("debt_id"),
  stripeAccountId: varchar("stripe_account_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  transferId: varchar("transfer_id"),
  stripeMode: text("stripe_mode"), // 'live' | 'test'
  environment: text("environment"), // 'production' | 'development'
  allowlistEnabled: boolean("allowlist_enabled"),
  idempotencyKey: text("idempotency_key"),
  correlationId: varchar("correlation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_rtal_user").on(table.userId),
  index("idx_rtal_created").on(table.createdAt),
]);

export const insertRealTransferAuditLogSchema = createInsertSchema(realTransferAuditLogs).omit({
  id: true,
  createdAt: true,
});

export type RealTransferAuditLog = typeof realTransferAuditLogs.$inferSelect;
export type InsertRealTransferAuditLog = z.infer<typeof insertRealTransferAuditLogSchema>;

// ACH debit authorization (Nacha "online" mandate) evidence. One row per
// time a user explicitly accepts the authorization text — captures the exact
// wording version plus the real client IP / User-Agent at the moment of
// consent. The most recent row feeds `mandate_data.customer_acceptance.online`
// on every Stripe ACH debit (no more hardcoded 0.0.0.0).
export const achAuthorizations = pgTable("ach_authorizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  version: text("version").notNull(),
  text: text("text").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("ach_auth_user_idx").on(table.userId),
}));

export const insertAchAuthorizationSchema = createInsertSchema(achAuthorizations).omit({
  id: true,
  createdAt: true,
});

export type AchAuthorization = typeof achAuthorizations.$inferSelect;
export type InsertAchAuthorization = z.infer<typeof insertAchAuthorizationSchema>;

// ── Subscriptions (Stripe Billing) ─────────────────────────────────────────
// One row PER STRIPE SUBSCRIPTION (unique stripeSubscriptionId), not per
// user — cancel→resubscribe creates a new Stripe subscription id and we keep
// the full history. "Current" subscription for a user = latest by createdAt.
// Rows are written via upsert keyed on stripeSubscriptionId by BOTH the
// subscribe route and the webhook handler, so delivery order can't race.
// Stripe owns product/price objects; we store only ids + normalized state.
export const subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  plan: text("plan").notNull().default("debt"), // PlanId from shared/subscriptionPlans.ts
  stripeCustomerId: text("stripe_customer_id").notNull(),
  stripeSubscriptionId: text("stripe_subscription_id").notNull().unique(),
  stripePriceId: text("stripe_price_id").notNull(),
  // Stripe subscription status verbatim (see shared/subscriptionPlans.ts):
  // incomplete | incomplete_expired | trialing | active | past_due |
  // canceled | unpaid | paused
  status: text("status").notNull().default("incomplete"),
  currentPeriodStart: timestamp("current_period_start"),
  currentPeriodEnd: timestamp("current_period_end"),
  cancelAtPeriodEnd: boolean("cancel_at_period_end").default(false).notNull(),
  canceledAt: timestamp("canceled_at"),
  latestInvoiceId: text("latest_invoice_id"),
  lastPaymentError: text("last_payment_error"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("subscriptions_user_idx").on(table.userId),
}));

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Subscription = typeof subscriptions.$inferSelect;
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;

// Durable evidence of the user's explicit recurring-billing consent (ToS +
// ACH mandate acceptance) — mirrors ach_authorizations. One row per consent
// action; never updated or deleted while the account exists.
export const subscriptionConsents = pgTable("subscription_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  plan: text("plan").notNull(),
  priceCentsAtConsent: integer("price_cents_at_consent").notNull(),
  version: text("version").notNull(),
  text: text("text").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => ({
  userIdx: index("subscription_consents_user_idx").on(table.userId),
}));

export const insertSubscriptionConsentSchema = createInsertSchema(subscriptionConsents).omit({
  id: true,
  createdAt: true,
});

export type SubscriptionConsent = typeof subscriptionConsents.$inferSelect;
export type InsertSubscriptionConsent = z.infer<typeof insertSubscriptionConsentSchema>;

export const insertTransferSchema = createInsertSchema(transfers).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type Transfer = typeof transfers.$inferSelect;
export type InsertTransfer = z.infer<typeof insertTransferSchema>;

// Idempotency keys table for request deduplication.
// UNIQUE (idempotency_key, user_id, endpoint) makes the reservation
// atomic — `reserveIdempotencyKey` does INSERT ... ON CONFLICT DO NOTHING
// RETURNING so two concurrent retries with the same key cannot both
// proceed past the reservation gate and create duplicate ledger rows.
// `response_status = 0` means "reserved / in-flight"; a real HTTP status
// is written by `finalizeIdempotencyKey` once the work completes.
export const idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    idempotencyKey: varchar("idempotency_key").notNull(),
    userId: varchar("user_id").notNull(),
    endpoint: varchar("endpoint").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: text("response_body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    uniqueIndex("idempotency_keys_key_user_endpoint_uniq").on(
      table.idempotencyKey,
      table.userId,
      table.endpoint,
    ),
  ],
);

// Insert schemas
export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  // Operator-only — never settable through user-facing signup/profile inserts.
  realTransfersEnabled: true,
  realTransfersEnabledAt: true,
  realTransfersEnabledBy: true,
  realTransfersNotes: true,
});

export const insertDebtSchema = createInsertSchema(debts).omit({
  id: true,
  createdAt: true,
  // Provider/import-owned columns are set SERVER-SIDE ONLY. Omitting them from
  // the public insert schema prevents mass-assignment (e.g. a user forging an
  // "imported from Chase" debt via POST /api/debts).
  source: true,
  provider: true,
  providerAccountId: true,
  institutionName: true,
  accountType: true,
  creditLimit: true,
  availableCredit: true,
  paymentStatus: true,
  lastImportedAt: true,
  isHidden: true,
  userEditedFields: true,
});

export const insertDebtProviderConnectionSchema = createInsertSchema(debtProviderConnections).omit({
  id: true,
  createdAt: true,
});
export type DebtProviderConnection = typeof debtProviderConnections.$inferSelect;
export type InsertDebtProviderConnection = z.infer<typeof insertDebtProviderConnectionSchema>;

export const insertDebtImportAuditLogSchema = createInsertSchema(debtImportAuditLogs).omit({
  id: true,
  createdAt: true,
});
export type DebtImportAuditLog = typeof debtImportAuditLogs.$inferSelect;
export type InsertDebtImportAuditLog = z.infer<typeof insertDebtImportAuditLogSchema>;

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
  source: text("source").default('marketing').notNull(), // 'marketing' | 'in_app'
  userId: varchar("user_id"), // set server-side for in-app submissions
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({
  id: true,
  createdAt: true,
  status: true,
  source: true,
  userId: true,
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

// Email verification tokens — single-use, time-limited, SHA-256 hashed at rest
export const emailVerificationTokens = pgTable("email_verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email").notNull(),
  tokenHash: varchar("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (table) => [
  index("idx_email_verification_user").on(table.userId),
  index("idx_email_verification_expires").on(table.expiresAt),
]);

export const insertEmailVerificationTokenSchema = createInsertSchema(emailVerificationTokens).omit({
  id: true,
  createdAt: true,
  usedAt: true,
});

export type EmailVerificationToken = typeof emailVerificationTokens.$inferSelect;
export type InsertEmailVerificationToken = z.infer<typeof insertEmailVerificationTokenSchema>;
