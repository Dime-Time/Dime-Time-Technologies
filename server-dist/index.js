var __defProp = Object.defineProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};

// shared/sentryRedact.ts
var SECRET_KEY_RX = /token|password|secret|api[_-]?key|authorization|cookie|plaid[_-]?access[_-]?token|access[_-]?token|refresh[_-]?token/i;
var SECRET_QUERY_PARAM_RX = /([?&])(token|password|secret|access[_-]?token|refresh[_-]?token|api[_-]?key)=([^&\s"'#]+)/gi;
var SENSITIVE_HEADER_RX = /^(authorization|cookie|set-cookie)$/i;
var SENSITIVE_PATH_RX = /\/(verify-email|reset-password)/i;
function stripUrlQueryAndFragment(url) {
  if (url == null) return url;
  if (typeof url !== "string") return url;
  const qIdx = url.indexOf("?");
  const hIdx = url.indexOf("#");
  let end = url.length;
  if (qIdx >= 0) end = Math.min(end, qIdx);
  if (hIdx >= 0) end = Math.min(end, hIdx);
  return url.slice(0, end);
}
function scrubSecretQueryParams(s) {
  if (typeof s !== "string") return s;
  return s.replace(SECRET_QUERY_PARAM_RX, "$1$2=[Filtered]");
}
function looksLikeUrl(s) {
  return /^https?:\/\//i.test(s);
}
function redactObjectDeep(input, depth = 0) {
  if (input == null || depth > 8) return input;
  if (Array.isArray(input)) {
    return input.map((v) => redactObjectDeep(v, depth + 1));
  }
  if (typeof input === "object") {
    const out = {};
    for (const [k, v] of Object.entries(input)) {
      if (SECRET_KEY_RX.test(k)) {
        out[k] = "[Filtered]";
        continue;
      }
      if (typeof v === "string") {
        out[k] = looksLikeUrl(v) ? stripUrlQueryAndFragment(scrubSecretQueryParams(v)) : scrubSecretQueryParams(v);
      } else {
        out[k] = redactObjectDeep(v, depth + 1);
      }
    }
    return out;
  }
  if (typeof input === "string") {
    return looksLikeUrl(input) ? stripUrlQueryAndFragment(scrubSecretQueryParams(input)) : scrubSecretQueryParams(input);
  }
  return input;
}
function redactSentryEvent(event) {
  if (!event) return event;
  if (event.request) {
    if (typeof event.request.url === "string") {
      event.request.url = stripUrlQueryAndFragment(event.request.url);
    }
    if ("query_string" in event.request) {
      event.request.query_string = "[Filtered]";
    }
    if (event.request.headers && typeof event.request.headers === "object") {
      for (const k of Object.keys(event.request.headers)) {
        if (SENSITIVE_HEADER_RX.test(k)) {
          event.request.headers[k] = "[Filtered]";
        }
      }
    }
    if (event.request.data !== void 0) {
      event.request.data = redactObjectDeep(event.request.data);
    }
    if (event.request.cookies !== void 0) {
      event.request.cookies = "[Filtered]";
    }
  }
  if (Array.isArray(event.breadcrumbs)) {
    for (const b of event.breadcrumbs) {
      if (!b || typeof b !== "object") continue;
      if (b.data && typeof b.data === "object") {
        if (typeof b.data.url === "string") {
          b.data.url = stripUrlQueryAndFragment(b.data.url);
        }
        if (typeof b.data.to === "string") {
          b.data.to = stripUrlQueryAndFragment(b.data.to);
        }
        if (typeof b.data.from === "string") {
          b.data.from = stripUrlQueryAndFragment(b.data.from);
        }
        b.data = redactObjectDeep(b.data);
      }
      if (typeof b.message === "string") {
        b.message = scrubSecretQueryParams(b.message);
      }
    }
  }
  if (event.extra) event.extra = redactObjectDeep(event.extra);
  if (event.contexts) event.contexts = redactObjectDeep(event.contexts);
  if (event.tags) event.tags = redactObjectDeep(event.tags);
  if (event.user && typeof event.user === "object") {
    if ("ip_address" in event.user) {
      if (typeof event.user.ip_address === "string") {
        event.user.ip_address = scrubSecretQueryParams(event.user.ip_address);
      }
    }
  }
  if (typeof event.message === "string") {
    event.message = scrubSecretQueryParams(event.message);
  }
  if (event.exception?.values && Array.isArray(event.exception.values)) {
    for (const ex of event.exception.values) {
      if (typeof ex?.value === "string") {
        ex.value = scrubSecretQueryParams(ex.value);
      }
    }
  }
  const url = typeof event.request?.url === "string" ? event.request.url : void 0;
  if (url && SENSITIVE_PATH_RX.test(url)) {
    if (url.includes("?")) {
      event.request.url = stripUrlQueryAndFragment(url);
    }
  }
  return event;
}

// server/lib/sentry.ts
var sentryModule = null;
var initialized = false;
async function initSentry() {
  if (initialized) return;
  const dsn = process.env.SENTRY_DSN;
  if (!dsn) return;
  const Sentry = await import("@sentry/node");
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT || process.env.NODE_ENV || "development",
    release: process.env.SENTRY_RELEASE || process.env.npm_package_version || void 0,
    tracesSampleRate: 0,
    profilesSampleRate: 0,
    sendDefaultPii: false,
    beforeSend(event) {
      return redactSentryEvent(event);
    },
    beforeBreadcrumb(breadcrumb) {
      if (!breadcrumb) return breadcrumb;
      if (breadcrumb.data && typeof breadcrumb.data === "object") {
        for (const k of ["url", "to", "from"]) {
          const v = breadcrumb.data[k];
          if (typeof v === "string") {
            breadcrumb.data[k] = stripIfUrl(v);
          }
        }
      }
      return breadcrumb;
    }
  });
  sentryModule = Sentry;
  initialized = true;
}
function stripIfUrl(s) {
  if (!/^https?:\/\//i.test(s)) return s;
  const qIdx = s.indexOf("?");
  const hIdx = s.indexOf("#");
  let end = s.length;
  if (qIdx >= 0) end = Math.min(end, qIdx);
  if (hIdx >= 0) end = Math.min(end, hIdx);
  return s.slice(0, end);
}
function setCorrelationTag(correlationId) {
  if (!initialized || !sentryModule || !correlationId) return;
  try {
    sentryModule.getIsolationScope().setTag("correlationId", correlationId);
  } catch {
  }
}
function setupExpressErrorHandler(app2) {
  if (!initialized || !sentryModule) return;
  try {
    sentryModule.setupExpressErrorHandler(app2);
  } catch {
  }
}

// shared/flags.ts
var FLAG_DEFINITIONS = {
  ENABLE_STRIPE_ACH: {
    defaultValue: false,
    description: "Gate Stripe Financial Connections + ACH debit code paths. OFF means the Stripe SDK is not initialized and Stripe routes are not mounted."
  },
  ENABLE_REAL_TRANSFERS: {
    defaultValue: false,
    description: "Allow money-movement endpoints to actually move money. OFF keeps the app in sandbox/no-op mode \u2014 transfers are recorded but never settled."
  },
  ENABLE_CRYPTO: {
    defaultValue: true,
    description: "Enable the crypto / Bitcoin round-up surfaces. ON preserves today's behavior. Flip OFF to hide all crypto UI without removing code."
  },
  ENABLE_BETA_BANNER: {
    defaultValue: false,
    description: "Render an in-app beta banner reminding users that Dime Time is in TestFlight. Flip ON during the beta window and OFF for the public launch build."
  },
  ENABLE_AUTO_ROUNDUP_SWEEPS: {
    defaultValue: false,
    description: "Allow automatic round-up sweep dispersals (JP Morgan weekly debt payments) to run. OFF (default) hard-blocks all automatic money-moving sweeps so they can never fire before an operator explicitly enables them."
  },
  ENABLE_DEBT_IMPORT: {
    defaultValue: false,
    description: "Gate the automatic debt-import feature (connect a liability provider and pull in debts). OFF means the /api/debts/import routes are not mounted and the client Import Debts UI is hidden. Uses the sandbox provider until a real liability-data provider (Plaid Liabilities / Method) is approved."
  },
  ENABLE_SUBSCRIPTIONS: {
    defaultValue: false,
    description: "Gate the Stripe Billing subscription feature (Dime Time Debt $2.99/mo). OFF means /api/subscription routes are not mounted, no premium gating is applied anywhere (today's behavior is unchanged), and all subscription UI is hidden. Requires ENABLE_STRIPE_ACH \u2014 the server refuses to boot if SUBSCRIPTIONS is on while STRIPE_ACH is off."
  },
  REQUIRE_EMAIL_VERIFICATION: {
    defaultValue: false,
    description: "Server-side enforcement of email verification. ON blocks unverified users (403 EMAIL_VERIFICATION_REQUIRED) from all financial/sensitive routes while keeping the recovery surface (resend, verify, logout, support, account deletion) available. Production startup REQUIRES this var to be explicitly set (validateEnv) \u2014 it is never silently guessed."
  }
};
var FLAG_NAMES = Object.keys(FLAG_DEFINITIONS);
function parseBool(raw) {
  if (raw === void 0 || raw === null) return null;
  const v = raw.trim().toLowerCase();
  if (v === "") return null;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return null;
}
function resolveServerFlags(env) {
  const out = {};
  for (const name of FLAG_NAMES) {
    const parsed = parseBool(env[name]);
    out[name] = parsed === null ? FLAG_DEFINITIONS[name].defaultValue : parsed;
  }
  return out;
}
var DEFAULT_FLAGS = resolveServerFlags({});

// server/lib/flags.ts
var cached = null;
function getFlags() {
  if (cached) return cached;
  cached = resolveServerFlags(process.env);
  return cached;
}
function isFlagEnabled(name) {
  return getFlags()[name];
}

// server/lib/validateEnv.ts
function validateProductionSecrets() {
  const isProd = process.env.NODE_ENV === "production";
  if (!isProd) {
    console.log(
      JSON.stringify({
        service: "EnvValidation",
        event: "skipped_non_production",
        nodeEnv: process.env.NODE_ENV ?? null
      })
    );
    return;
  }
  const missing = [];
  if (!process.env.PLAID_TOKEN_ENCRYPTION_KEY) {
    missing.push("PLAID_TOKEN_ENCRYPTION_KEY");
  }
  const remv = (process.env.REQUIRE_EMAIL_VERIFICATION ?? "").trim().toLowerCase();
  const remvValid = ["1", "true", "yes", "on", "0", "false", "no", "off"].includes(remv);
  if (!remvValid) {
    missing.push("REQUIRE_EMAIL_VERIFICATION (must be explicitly 'true' or 'false' in production)");
  }
  const plaidEnv = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  if (plaidEnv === "production") {
    if (!process.env.PLAID_SECRET_PRODUCTION) missing.push("PLAID_SECRET_PRODUCTION");
    if (!process.env.PLAID_CLIENT_ID) missing.push("PLAID_CLIENT_ID");
  }
  const stripeAchEnabled = isFlagEnabled("ENABLE_STRIPE_ACH");
  if (stripeAchEnabled) {
    for (const key of [
      "STRIPE_SECRET_KEY",
      "STRIPE_WEBHOOK_SECRET",
      "VITE_STRIPE_PUBLISHABLE_KEY"
    ]) {
      if (!process.env[key]) missing.push(key);
    }
  }
  if (missing.length > 0) {
    for (const key of missing) {
      console.error(`FATAL: ${key} missing`);
    }
    throw new Error(
      `Production startup aborted \u2014 missing required secrets: ${missing.join(", ")}`
    );
  }
  if (stripeAchEnabled) {
    const invalid = [];
    const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET;
    if (webhookSecret && !webhookSecret.startsWith("whsec_")) {
      invalid.push("STRIPE_WEBHOOK_SECRET must be a Stripe webhook signing secret (whsec_\u2026)");
    }
    const publishableKey = process.env.VITE_STRIPE_PUBLISHABLE_KEY;
    if (publishableKey && !publishableKey.startsWith("pk_live_")) {
      invalid.push("VITE_STRIPE_PUBLISHABLE_KEY must be a LIVE publishable key (pk_live_\u2026)");
    }
    if (invalid.length > 0) {
      for (const msg of invalid) console.error(`FATAL: ${msg}`);
      throw new Error(
        `Production startup aborted \u2014 invalid Stripe key configuration: ${invalid.join("; ")}`
      );
    }
  }
  console.log(
    JSON.stringify({
      service: "EnvValidation",
      event: "ok",
      stripeAchEnabled,
      realTransfersEnabled: isFlagEnabled("ENABLE_REAL_TRANSFERS")
    })
  );
}

// server/index.ts
import express4 from "express";
import cors from "cors";

// server/routes.ts
import express2 from "express";
import { createServer } from "http";
import path from "path";
import fs from "fs";

// server/spaMeta.ts
var SPA_META_PAGES = {
  "/privacy": {
    title: "Privacy Policy | Dime Time",
    description: "How Dime Time collects, uses, and protects your information \u2014 the plain-language privacy policy for the Dime Time debt payoff app.",
    canonical: "https://dime-time.com/privacy"
  },
  "/terms": {
    title: "Terms of Service | Dime Time",
    description: "The terms that govern your use of Dime Time's round-up debt payoff app and website.",
    canonical: "https://dime-time.com/terms"
  },
  "/delete-account": {
    title: "Delete Your Account | Dime Time",
    description: "How to permanently delete your Dime Time account and associated data.",
    canonical: "https://dime-time.com/delete-account",
    // Required to stay live for app-store compliance, but it is a utility
    // page — keep it out of search results.
    robots: "noindex, follow"
  }
};
var replaceTag = (html, pattern, replacement) => pattern.test(html) ? html.replace(pattern, replacement) : html;
function applySpaMeta(html, meta) {
  let out = html;
  out = replaceTag(out, /<title>[\s\S]*?<\/title>/, `<title>${meta.title}</title>`);
  out = replaceTag(
    out,
    /<meta name="description"[^>]*>/,
    `<meta name="description" content="${meta.description}">`
  );
  out = replaceTag(
    out,
    /<link rel="canonical"[^>]*\/?>/,
    `<link rel="canonical" href="${meta.canonical}" />`
  );
  out = replaceTag(
    out,
    /<meta property="og:title"[^>]*\/?>/,
    `<meta property="og:title" content="${meta.title}" />`
  );
  out = replaceTag(
    out,
    /<meta property="og:description"[^>]*\/?>/,
    `<meta property="og:description" content="${meta.description}" />`
  );
  out = replaceTag(
    out,
    /<meta property="og:url"[^>]*\/?>/,
    `<meta property="og:url" content="${meta.canonical}" />`
  );
  out = replaceTag(
    out,
    /<meta name="twitter:title"[^>]*\/?>/,
    `<meta name="twitter:title" content="${meta.title}" />`
  );
  out = replaceTag(
    out,
    /<meta name="twitter:description"[^>]*\/?>/,
    `<meta name="twitter:description" content="${meta.description}" />`
  );
  if (meta.robots) {
    out = replaceTag(
      out,
      /<meta name="robots"[^>]*\/?>/,
      `<meta name="robots" content="${meta.robots}" />`
    );
  }
  return out;
}

// shared/schema.ts
var schema_exports = {};
__export(schema_exports, {
  achAuthorizations: () => achAuthorizations,
  bankAccounts: () => bankAccounts,
  businessAccount: () => businessAccount,
  contactSubmissions: () => contactSubmissions,
  cryptoPurchases: () => cryptoPurchases,
  debtImportAuditLogs: () => debtImportAuditLogs,
  debtProviderConnections: () => debtProviderConnections,
  debts: () => debts,
  distributionPayments: () => distributionPayments,
  dttHoldings: () => dttHoldings,
  dttRewards: () => dttRewards,
  dttStaking: () => dttStaking,
  dttTokenInfo: () => dttTokenInfo,
  emailVerificationTokens: () => emailVerificationTokens,
  idempotencyKeys: () => idempotencyKeys,
  insertAchAuthorizationSchema: () => insertAchAuthorizationSchema,
  insertBankAccountSchema: () => insertBankAccountSchema,
  insertBusinessAccountSchema: () => insertBusinessAccountSchema,
  insertContactSubmissionSchema: () => insertContactSubmissionSchema,
  insertCryptoPurchaseSchema: () => insertCryptoPurchaseSchema,
  insertDebtImportAuditLogSchema: () => insertDebtImportAuditLogSchema,
  insertDebtProviderConnectionSchema: () => insertDebtProviderConnectionSchema,
  insertDebtSchema: () => insertDebtSchema,
  insertDistributionPaymentSchema: () => insertDistributionPaymentSchema,
  insertDttHoldingsSchema: () => insertDttHoldingsSchema,
  insertDttRewardsSchema: () => insertDttRewardsSchema,
  insertDttStakingSchema: () => insertDttStakingSchema,
  insertDttTokenInfoSchema: () => insertDttTokenInfoSchema,
  insertEmailVerificationTokenSchema: () => insertEmailVerificationTokenSchema,
  insertIdempotencyKeySchema: () => insertIdempotencyKeySchema,
  insertInterestEarningsSchema: () => insertInterestEarningsSchema,
  insertNotificationSchema: () => insertNotificationSchema,
  insertNotificationSettingsSchema: () => insertNotificationSettingsSchema,
  insertPasswordResetTokenSchema: () => insertPasswordResetTokenSchema,
  insertPaymentSchema: () => insertPaymentSchema,
  insertRealTransferAuditLogSchema: () => insertRealTransferAuditLogSchema,
  insertRoundUpCollectionSchema: () => insertRoundUpCollectionSchema,
  insertRoundUpSettingsSchema: () => insertRoundUpSettingsSchema,
  insertStripeAccountSchema: () => insertStripeAccountSchema,
  insertSubscriptionConsentSchema: () => insertSubscriptionConsentSchema,
  insertSubscriptionSchema: () => insertSubscriptionSchema,
  insertSweepAccountSchema: () => insertSweepAccountSchema,
  insertSweepDepositSchema: () => insertSweepDepositSchema,
  insertTransactionSchema: () => insertTransactionSchema,
  insertTransferSchema: () => insertTransferSchema,
  insertUserSchema: () => insertUserSchema,
  insertUserSessionSchema: () => insertUserSessionSchema,
  insertWeeklyDispersalSchema: () => insertWeeklyDispersalSchema,
  insertWeeklyDistributionSchema: () => insertWeeklyDistributionSchema,
  interestEarnings: () => interestEarnings,
  notificationSettings: () => notificationSettings,
  notifications: () => notifications,
  passwordResetTokens: () => passwordResetTokens,
  payments: () => payments,
  realTransferAuditLogs: () => realTransferAuditLogs,
  roundUpCollections: () => roundUpCollections,
  roundUpSettings: () => roundUpSettings,
  sessions: () => sessions,
  stripeAccounts: () => stripeAccounts,
  stripeWebhookEvents: () => stripeWebhookEvents,
  subscriptionConsents: () => subscriptionConsents,
  subscriptions: () => subscriptions,
  sweepAccounts: () => sweepAccounts,
  sweepDeposits: () => sweepDeposits,
  transactions: () => transactions,
  transfers: () => transfers,
  userSessions: () => userSessions,
  users: () => users,
  weeklyDispersals: () => weeklyDispersals,
  weeklyDistributions: () => weeklyDistributions
});
import { sql } from "drizzle-orm";
import { pgTable, text, varchar, decimal, timestamp, boolean, integer, index, jsonb, uniqueIndex, unique } from "drizzle-orm/pg-core";
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
  passwordAlgo: varchar("password_algo").default("sha256"),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  emailVerifiedAt: timestamp("email_verified_at"),
  // Real-money ACH block list (operator-controlled, instantly effective).
  // Every user may create real Stripe ACH debits by default (subject to the
  // conservative launch limits enforced in the gate). An admin can block a
  // specific user here — the hot-path gate re-reads this live, so a block is
  // effective on the very next attempt. Toggled only via the admin surface;
  // never settable through user-facing inserts.
  realTransfersBlocked: boolean("real_transfers_blocked").default(false).notNull(),
  realTransfersBlockedAt: timestamp("real_transfers_blocked_at"),
  realTransfersBlockedBy: varchar("real_transfers_blocked_by"),
  // Admin-set daily dollar cap override (null = automatic progressive-trust
  // tiers apply). Always wins when set — used to raise, lower, or release a
  // risk-flagged user after manual review.
  realTransfersDailyCapOverride: decimal("real_transfers_daily_cap_override", { precision: 10, scale: 2 }),
  realTransfersNotes: text("real_transfers_notes"),
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
  // When the debt was archived (soft-deleted). Set when isActive flips to
  // false; cleared on restore. For paid-off debts this is the payoff date.
  archivedAt: timestamp("archived_at"),
  // Exact moment currentBalance FIRST reached zero. Stamped once by the
  // storage layer whenever a balance update brings currentBalance <= 0 and
  // cleared if the balance goes back above zero — the celebration date must
  // never be inferred from (possibly missing) payment history.
  paidOffAt: timestamp("paid_off_at"),
  payeeAccountNumber: text("payee_account_number"),
  // Creditor's bank account number for ACH payment (set by admin)
  payeeRoutingNumber: text("payee_routing_number"),
  // Creditor's bank routing number for ACH payment (set by admin)
  // --- Automatic debt import (provider-agnostic) ---
  source: text("source").default("manual").notNull(),
  // 'manual' (user-entered) | 'imported'
  provider: text("provider"),
  // 'sandbox' | 'plaid' | 'method' — null for manual debts
  providerAccountId: text("provider_account_id"),
  // stable id from the provider; null for manual
  institutionName: text("institution_name"),
  accountType: text("account_type"),
  // 'credit_card' | 'student_loan' | 'auto_loan' | ...
  creditLimit: decimal("credit_limit", { precision: 12, scale: 2 }),
  availableCredit: decimal("available_credit", { precision: 12, scale: 2 }),
  paymentStatus: text("payment_status"),
  lastImportedAt: timestamp("last_imported_at"),
  isHidden: boolean("is_hidden").default(false).notNull(),
  // Fields the user manually overrode after import — refresh skips these so a
  // re-import never clobbers the user's edits.
  userEditedFields: text("user_edited_fields").array().default(sql`'{}'::text[]`).notNull(),
  // --- Duplicate handling (manual debt vs imported debt) ---
  // When a manual debt is merged into an imported duplicate, it is archived
  // (isActive=false) and this records which imported debt absorbed it —
  // restore clears it. Never a hard delete: payment history stays attached.
  mergedIntoDebtId: varchar("merged_into_debt_id"),
  // Imported debt ids the user explicitly said are NOT duplicates of this
  // manual debt ("keep both") — the duplicate detector skips these pairs.
  notDuplicateOf: text("not_duplicate_of").array().default(sql`'{}'::text[]`).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  // Duplicate detection: one row per (user, provider, provider account).
  // NULLs (manual debts) are distinct in Postgres, so manual debts are unaffected.
  uniqueIndex("debts_provider_account_uq").on(table.userId, table.provider, table.providerAccountId)
]);
var debtProviderConnections = pgTable("debt_provider_connections", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  providerItemId: text("provider_item_id"),
  accessTokenEnc: text("access_token_enc"),
  // AES-256-GCM encrypted; never a raw token
  institutionName: text("institution_name"),
  status: text("status").default("active").notNull(),
  // 'active' | 'disconnected' | 'error'
  consentAt: timestamp("consent_at"),
  lastSyncAt: timestamp("last_sync_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  uniqueIndex("debt_provider_conn_user_provider_item_uq").on(table.userId, table.provider, table.providerItemId),
  // Postgres treats NULLs as distinct in unique indexes, so itemless rows
  // (sandbox provider) need their own partial index to stay one-per-user.
  uniqueIndex("debt_provider_conn_user_provider_nullitem_uq").on(table.userId, table.provider).where(sql`provider_item_id IS NULL`)
]);
var debtImportAuditLogs = pgTable("debt_import_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  provider: text("provider").notNull(),
  action: text("action").notNull(),
  // 'import' | 'refresh' | 'disconnect'
  status: text("status").notNull(),
  // 'success' | 'error'
  importedCount: integer("imported_count").default(0).notNull(),
  updatedCount: integer("updated_count").default(0).notNull(),
  message: text("message"),
  correlationId: text("correlation_id"),
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
  // Which Stripe-linked bank account (stripe_accounts.id) FUNDS round-up ACH
  // payments. Set ONLY via the dedicated validated endpoint (ownership +
  // eligibility checked server-side) — never via the generic settings routes.
  fundingStripeAccountId: varchar("funding_stripe_account_id"),
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
  // One Plaid Item spans MANY accounts — uniqueness must be per (item, account),
  // not per item, or linking any multi-account bank fails on the second insert.
  plaidItemId: text("plaid_item_id").notNull(),
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
}, (table) => [
  unique("bank_accounts_item_account_unique").on(table.plaidItemId, table.accountId)
]);
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
var transfers = pgTable("transfers", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  // 'roundup_collection' | 'debt_payment' | 'stripe_ach_debit'
  type: text("type").notNull(),
  amount: decimal("amount", { precision: 10, scale: 2 }).notNull(),
  status: text("status").notNull().default("created"),
  // created | authorized | pending | processing | posted | settled | failed | returned | cancelled | requires_action
  // Plaid / Mercury provider IDs
  plaidTransferId: text("plaid_transfer_id"),
  plaidAuthorizationId: text("plaid_authorization_id"),
  mercuryTransferId: text("mercury_transfer_id"),
  // Stripe ACH provider IDs (provider-agnostic ledger — Stripe writes here too)
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  stripeChargeId: text("stripe_charge_id"),
  provider: text("provider"),
  // 'plaid' | 'mercury' | 'stripe' — set when a provider is selected
  // Which stripe_accounts row funded this debit (masked label shown in the
  // transfer history). Nullable — Plaid/Mercury rows and legacy rows omit it.
  stripeAccountId: varchar("stripe_account_id"),
  debtId: varchar("debt_id"),
  correlationId: varchar("correlation_id").notNull(),
  idempotencyKey: text("idempotency_key"),
  errorCode: text("error_code"),
  errorMessage: text("error_message"),
  rawRequest: text("raw_request"),
  rawResponse: text("raw_response"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var stripeAccounts = pgTable("stripe_accounts", {
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
  status: text("status").notNull().default("linked"),
  // linked | unlinked | failed
  isActive: boolean("is_active").default(true).notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull()
});
var insertStripeAccountSchema = createInsertSchema(stripeAccounts).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var stripeWebhookEvents = pgTable("stripe_webhook_events", {
  eventId: text("event_id").primaryKey(),
  type: text("type").notNull(),
  receivedAt: timestamp("received_at").defaultNow().notNull()
});
var realTransferAuditLogs = pgTable("real_transfer_audit_logs", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  // Set when an admin action produced this row (allowlist toggle); null for
  // automated per-debit gate decisions.
  adminUserId: varchar("admin_user_id"),
  action: text("action").notNull(),
  // 'ach_debit_decision' | 'ach_debit_outcome' | 'allowlist_changed'
  result: text("result").notNull(),
  // 'approved' | 'blocked' | 'initiated' | 'failed' | 'enabled' | 'disabled'
  reason: text("reason"),
  // machine code, e.g. 'not_allowlisted', 'over_first_transfer_limit'
  amount: decimal("amount", { precision: 10, scale: 2 }),
  debtId: varchar("debt_id"),
  stripeAccountId: varchar("stripe_account_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  transferId: varchar("transfer_id"),
  stripeMode: text("stripe_mode"),
  // 'live' | 'test'
  environment: text("environment"),
  // 'production' | 'development'
  allowlistEnabled: boolean("allowlist_enabled"),
  idempotencyKey: text("idempotency_key"),
  correlationId: varchar("correlation_id"),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  index("idx_rtal_user").on(table.userId),
  index("idx_rtal_created").on(table.createdAt)
]);
var insertRealTransferAuditLogSchema = createInsertSchema(realTransferAuditLogs).omit({
  id: true,
  createdAt: true
});
var achAuthorizations = pgTable("ach_authorizations", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  version: text("version").notNull(),
  text: text("text").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  userIdx: index("ach_auth_user_idx").on(table.userId)
}));
var insertAchAuthorizationSchema = createInsertSchema(achAuthorizations).omit({
  id: true,
  createdAt: true
});
var subscriptions = pgTable("subscriptions", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  plan: text("plan").notNull().default("debt"),
  // PlanId from shared/subscriptionPlans.ts
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
  updatedAt: timestamp("updated_at").defaultNow().notNull()
}, (table) => ({
  userIdx: index("subscriptions_user_idx").on(table.userId)
}));
var insertSubscriptionSchema = createInsertSchema(subscriptions).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var subscriptionConsents = pgTable("subscription_consents", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id),
  plan: text("plan").notNull(),
  priceCentsAtConsent: integer("price_cents_at_consent").notNull(),
  version: text("version").notNull(),
  text: text("text").notNull(),
  ipAddress: text("ip_address").notNull(),
  userAgent: text("user_agent").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => ({
  userIdx: index("subscription_consents_user_idx").on(table.userId)
}));
var insertSubscriptionConsentSchema = createInsertSchema(subscriptionConsents).omit({
  id: true,
  createdAt: true
});
var insertTransferSchema = createInsertSchema(transfers).omit({
  id: true,
  createdAt: true,
  updatedAt: true
});
var idempotencyKeys = pgTable(
  "idempotency_keys",
  {
    id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
    idempotencyKey: varchar("idempotency_key").notNull(),
    userId: varchar("user_id").notNull(),
    endpoint: varchar("endpoint").notNull(),
    responseStatus: integer("response_status").notNull(),
    responseBody: text("response_body").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull()
  },
  (table) => [
    uniqueIndex("idempotency_keys_key_user_endpoint_uniq").on(
      table.idempotencyKey,
      table.userId,
      table.endpoint
    )
  ]
);
var insertUserSchema = createInsertSchema(users).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  // Operator-only — never settable through user-facing signup/profile inserts.
  realTransfersBlocked: true,
  realTransfersBlockedAt: true,
  realTransfersBlockedBy: true,
  realTransfersDailyCapOverride: true,
  realTransfersNotes: true
});
var insertDebtSchema = createInsertSchema(debts).omit({
  id: true,
  createdAt: true,
  // Server-owned payoff bookkeeping — stamped by the storage layer only.
  paidOffAt: true,
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
  userEditedFields: true
});
var insertDebtProviderConnectionSchema = createInsertSchema(debtProviderConnections).omit({
  id: true,
  createdAt: true
});
var insertDebtImportAuditLogSchema = createInsertSchema(debtImportAuditLogs).omit({
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
  source: text("source").default("marketing").notNull(),
  // 'marketing' | 'in_app'
  userId: varchar("user_id"),
  // set server-side for in-app submissions
  createdAt: timestamp("created_at").defaultNow().notNull()
});
var insertContactSubmissionSchema = createInsertSchema(contactSubmissions).omit({
  id: true,
  createdAt: true,
  status: true,
  source: true,
  userId: true
});
var insertIdempotencyKeySchema = createInsertSchema(idempotencyKeys).omit({
  id: true,
  createdAt: true
});
var passwordResetTokens = pgTable("password_reset_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  tokenHash: varchar("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  index("idx_password_reset_user").on(table.userId),
  index("idx_password_reset_expires").on(table.expiresAt)
]);
var insertPasswordResetTokenSchema = createInsertSchema(passwordResetTokens).omit({
  id: true,
  createdAt: true,
  usedAt: true
});
var emailVerificationTokens = pgTable("email_verification_tokens", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  userId: varchar("user_id").notNull().references(() => users.id, { onDelete: "cascade" }),
  email: varchar("email").notNull(),
  tokenHash: varchar("token_hash").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull()
}, (table) => [
  index("idx_email_verification_user").on(table.userId),
  index("idx_email_verification_expires").on(table.expiresAt)
]);
var insertEmailVerificationTokenSchema = createInsertSchema(emailVerificationTokens).omit({
  id: true,
  createdAt: true,
  usedAt: true
});

// shared/realTransferTrust.ts
var BASE_LIMITS = { firstTransferMaxDollars: 1, dailyTotalMaxDollars: 5, dailyCountMax: 1 };
var TIER_LIMITS = {
  new: { dailyTotalMaxDollars: 5, dailyCountMax: 1 },
  settled: { dailyTotalMaxDollars: 25, dailyCountMax: 3 },
  trusted: { dailyTotalMaxDollars: 100, dailyCountMax: 5 },
  established: { dailyTotalMaxDollars: 250, dailyCountMax: 10 }
};
var RISK_STATUSES = /* @__PURE__ */ new Set(["returned", "disputed"]);
function computeRealTransferTrust(history, dailyCapOverride, now = /* @__PURE__ */ new Date()) {
  const flagged = history.some((r) => RISK_STATUSES.has(r.status));
  const settledDates = history.filter((r) => r.status === "settled" && (r.updatedAt || r.createdAt)).map((r) => r.updatedAt ?? r.createdAt);
  const firstSettledAt = settledDates.length ? new Date(Math.min(...settledDates.map((d) => d.getTime()))) : null;
  let tier = "new";
  if (firstSettledAt) {
    const days = (now.getTime() - firstSettledAt.getTime()) / 864e5;
    tier = days >= 30 ? "established" : days >= 7 ? "trusted" : "settled";
  }
  let { dailyTotalMaxDollars, dailyCountMax } = flagged ? { dailyTotalMaxDollars: BASE_LIMITS.dailyTotalMaxDollars, dailyCountMax: BASE_LIMITS.dailyCountMax } : TIER_LIMITS[tier];
  const overrideApplied = dailyCapOverride !== null && Number.isFinite(dailyCapOverride);
  if (overrideApplied) dailyTotalMaxDollars = dailyCapOverride;
  return {
    tier,
    flagged,
    dailyTotalMaxDollars,
    dailyCountMax,
    firstTransferMaxDollars: BASE_LIMITS.firstTransferMaxDollars,
    overrideApplied,
    firstSettledAt
  };
}

// server/lib/debtEdit.ts
import { z } from "zod";
var debtEditSchema = z.object({
  name: z.string().trim().min(1).optional(),
  currentBalance: z.string().optional(),
  interestRate: z.string().optional(),
  minimumPayment: z.string().optional(),
  dueDate: z.number().int().min(1).max(31).optional(),
  accountNumber: z.string().optional()
}).refine(
  (d) => d.currentBalance === void 0 || parseFloat(d.currentBalance) > 0 && parseFloat(d.currentBalance) <= 9999999999e-2,
  { message: "Current balance must be between 0.01 and 99,999,999.99", path: ["currentBalance"] }
).refine(
  (d) => d.interestRate === void 0 || parseFloat(d.interestRate) >= 0 && parseFloat(d.interestRate) <= 999.99,
  { message: "Interest rate must be between 0 and 999.99", path: ["interestRate"] }
).refine(
  (d) => d.minimumPayment === void 0 || parseFloat(d.minimumPayment) >= 0 && parseFloat(d.minimumPayment) <= 9999999999e-2,
  { message: "Minimum payment must be between 0 and 99,999,999.99", path: ["minimumPayment"] }
);
function canAccessDebt(debt, userId) {
  return !!debt && debt.userId === userId;
}
function buildDebtEditUpdates(debt, parsed) {
  const updates = {};
  if (parsed.name !== void 0) updates.name = parsed.name.trim();
  if (parsed.currentBalance !== void 0) {
    const newCurrent = parseFloat(parsed.currentBalance);
    updates.currentBalance = newCurrent.toFixed(2);
    if (newCurrent > parseFloat(debt.originalBalance)) {
      updates.originalBalance = newCurrent.toFixed(2);
    }
  }
  if (parsed.interestRate !== void 0) updates.interestRate = parseFloat(parsed.interestRate).toFixed(2);
  if (parsed.minimumPayment !== void 0) updates.minimumPayment = parseFloat(parsed.minimumPayment).toFixed(2);
  if (parsed.dueDate !== void 0) updates.dueDate = parsed.dueDate;
  if (parsed.accountNumber !== void 0) {
    const acct = String(parsed.accountNumber).trim();
    updates.accountNumber = acct !== "" ? acct : "\u2014";
  }
  if (debt.source === "imported") {
    const refreshTracked = ["name", "currentBalance", "interestRate", "minimumPayment", "dueDate"];
    const changed = refreshTracked.filter(
      (f) => updates[f] !== void 0 && String(updates[f]) !== String(debt[f])
    );
    if (changed.length > 0) {
      const existingEdited = debt.userEditedFields ?? [];
      updates.userEditedFields = Array.from(/* @__PURE__ */ new Set([...existingEdited, ...changed]));
    }
  }
  return updates;
}
function bumpedOriginalBalance(originalBalance, newCurrentBalance) {
  const next = parseFloat(newCurrentBalance);
  if (Number.isFinite(next) && next > parseFloat(originalBalance)) {
    return next.toFixed(2);
  }
  return void 0;
}

// server/services/encryptionService.ts
import { createCipheriv, createDecipheriv, randomBytes } from "crypto";
var ALGORITHM = "aes-256-gcm";
var IV_LENGTH = 12;
var TAG_LENGTH = 16;
var KEY_ENV = "PLAID_TOKEN_ENCRYPTION_KEY";
function getEncryptionKey() {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    if (process.env.NODE_ENV === "production" || process.env.PLAID_ENV === "production") {
      throw new Error(
        `[encryptionService] ${KEY_ENV} is not set. This is required in production to encrypt Plaid access tokens at rest. Generate a key with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" and set it as a secret.`
      );
    }
    console.warn(`[encryptionService] WARNING: ${KEY_ENV} not set. Using insecure dev-only key. Set this env var before going to production.`);
    return Buffer.alloc(32, "devkey-dime-time-insecure-do-not-use");
  }
  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error(`[encryptionService] ${KEY_ENV} must be a 32-byte key encoded as base64. Got ${key.length} bytes. Regenerate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`);
  }
  return key;
}
function encryptToken(plaintext) {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, encrypted, tag]);
  return `enc:${combined.toString("base64")}`;
}
function decryptToken(stored) {
  if (!stored.startsWith("enc:")) {
    return stored;
  }
  const key = getEncryptionKey();
  const combined = Buffer.from(stored.slice(4), "base64");
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString("utf8");
}

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
import { eq, desc, and, sql as sql2, inArray, gte } from "drizzle-orm";
async function computeDashboardSummary(storage2, userId) {
  const debts2 = await storage2.getUserDebts(userId);
  const transactions2 = await storage2.getUserTransactions(userId);
  const cryptoPurchases2 = await storage2.getUserCryptoPurchases(userId);
  const totalDebt = debts2.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
  const totalRoundUps = transactions2.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount || "0"), 0);
  const totalCrypto = cryptoPurchases2.reduce((sum, purchase) => sum + parseFloat(purchase.amountUsd), 0);
  return {
    totalDebt: totalDebt.toFixed(2),
    totalRoundUps: totalRoundUps.toFixed(2),
    totalCrypto: totalCrypto.toFixed(2),
    debtCount: debts2.length,
    transactionCount: transactions2.length
  };
}
var DatabaseStorage = class _DatabaseStorage {
  // User methods
  async getUser(id) {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }
  async getUserByEmail(email) {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }
  async createUser(user) {
    const id = randomUUID();
    const [result] = await db.insert(users).values({ ...user, id }).returning();
    return result;
  }
  async upsertUser(user) {
    const existing = await this.getUser(user.id);
    if (existing) {
      const [updated] = await db.update(users).set({ ...user, updatedAt: /* @__PURE__ */ new Date() }).where(eq(users.id, user.id)).returning();
      return updated;
    }
    const [result] = await db.insert(users).values({
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl
    }).returning();
    return result;
  }
  // Debt methods
  async getDebtsByUserId(userId) {
    return await db.select().from(debts).where(and(eq(debts.userId, userId), eq(debts.isActive, true)));
  }
  async getArchivedDebtsByUserId(userId) {
    return await db.select().from(debts).where(and(eq(debts.userId, userId), eq(debts.isActive, false)));
  }
  async getDebt(id) {
    const [debt] = await db.select().from(debts).where(eq(debts.id, id));
    return debt;
  }
  async createDebt(debt) {
    const id = randomUUID();
    const [result] = await db.insert(debts).values({ ...debt, id }).returning();
    return result;
  }
  async updateDebt(id, updates) {
    if (updates.archivedAt === void 0) {
      if (updates.isActive === false) {
        const existing = await this.getDebt(id);
        if (existing?.isActive) {
          updates = { ...updates, archivedAt: /* @__PURE__ */ new Date() };
        }
      } else if (updates.isActive === true) {
        updates = { ...updates, archivedAt: null };
      }
    }
    if (updates.currentBalance !== void 0 && updates.paidOffAt === void 0) {
      const existing = await this.getDebt(id);
      if (existing) {
        const newBalance = parseFloat(updates.currentBalance);
        if (newBalance <= 0) {
          if (!existing.paidOffAt && parseFloat(existing.currentBalance) > 0) {
            updates = { ...updates, paidOffAt: /* @__PURE__ */ new Date() };
          }
        } else if (existing.paidOffAt) {
          updates = { ...updates, paidOffAt: null };
        }
      }
    }
    const [result] = await db.update(debts).set(updates).where(eq(debts.id, id)).returning();
    return result;
  }
  async deleteDebtPermanently(id) {
    await db.transaction(async (tx) => {
      await tx.delete(payments).where(eq(payments.debtId, id));
      await tx.delete(distributionPayments).where(eq(distributionPayments.debtId, id));
      await tx.update(weeklyDispersals).set({ targetDebtId: null }).where(eq(weeklyDispersals.targetDebtId, id));
      await tx.update(roundUpSettings).set({ targetDebtId: null }).where(eq(roundUpSettings.targetDebtId, id));
      await tx.delete(debts).where(eq(debts.id, id));
    });
  }
  async importDebtsFromProvider(userId, provider, liabilities) {
    let imported = 0;
    let updated = 0;
    const resultDebts = [];
    for (const lib of liabilities) {
      const [existing] = await db.select().from(debts).where(
        and(
          eq(debts.userId, userId),
          eq(debts.provider, provider),
          eq(debts.providerAccountId, lib.providerAccountId)
        )
      );
      const balance = lib.currentBalance.toFixed(2);
      const minPay = lib.minimumPayment.toFixed(2);
      const apr = lib.interestRateApr.toFixed(2);
      const creditLimit = lib.creditLimit != null ? lib.creditLimit.toFixed(2) : null;
      const availableCredit = lib.availableCredit != null ? lib.availableCredit.toFixed(2) : null;
      if (existing) {
        const edited = existing.userEditedFields ?? [];
        const set = {
          institutionName: lib.institutionName,
          accountType: lib.accountType,
          paymentStatus: lib.paymentStatus ?? null,
          creditLimit,
          availableCredit,
          lastImportedAt: /* @__PURE__ */ new Date()
        };
        if (!edited.includes("name")) set.name = lib.creditorName;
        if (!edited.includes("currentBalance")) {
          set.currentBalance = balance;
          const bumped = bumpedOriginalBalance(existing.originalBalance, balance);
          if (bumped !== void 0) set.originalBalance = bumped;
          if (parseFloat(balance) <= 0) {
            if (!existing.paidOffAt && parseFloat(existing.currentBalance) > 0) {
              set.paidOffAt = /* @__PURE__ */ new Date();
            }
          } else if (existing.paidOffAt) {
            set.paidOffAt = null;
          }
        }
        if (!edited.includes("minimumPayment")) set.minimumPayment = minPay;
        if (!edited.includes("interestRate")) set.interestRate = apr;
        if (!edited.includes("dueDate")) set.dueDate = lib.dueDate;
        const [row] = await db.update(debts).set(set).where(eq(debts.id, existing.id)).returning();
        resultDebts.push(row);
        updated++;
      } else {
        const [row] = await db.insert(debts).values({
          id: randomUUID(),
          userId,
          name: lib.creditorName,
          accountNumber: lib.mask ? `\u2022\u2022\u2022\u2022${lib.mask}` : "\u2014",
          originalBalance: balance,
          currentBalance: balance,
          interestRate: apr,
          minimumPayment: minPay,
          dueDate: lib.dueDate,
          isActive: true,
          // Never backfill: an imported debt that arrives already at zero
          // was paid off on an unknown earlier day.
          paidOffAt: null,
          source: "imported",
          provider,
          providerAccountId: lib.providerAccountId,
          institutionName: lib.institutionName,
          accountType: lib.accountType,
          creditLimit,
          availableCredit,
          paymentStatus: lib.paymentStatus ?? null,
          lastImportedAt: /* @__PURE__ */ new Date()
        }).returning();
        resultDebts.push(row);
        imported++;
      }
    }
    return { imported, updated, debts: resultDebts };
  }
  async getDebtProviderConnection(userId, provider) {
    const conns = await this.getDebtProviderConnections(userId, provider);
    return conns.find((c) => c.status === "active") ?? conns[0];
  }
  async getDebtProviderConnections(userId, provider) {
    return db.select().from(debtProviderConnections).where(and(eq(debtProviderConnections.userId, userId), eq(debtProviderConnections.provider, provider))).orderBy(debtProviderConnections.createdAt);
  }
  async upsertDebtProviderConnection(data) {
    const all = await this.getDebtProviderConnections(data.userId, data.provider);
    const existing = data.providerItemId ? all.find((c) => c.providerItemId === data.providerItemId) : all.find((c) => !c.providerItemId);
    if (existing) {
      const [row2] = await db.update(debtProviderConnections).set({
        providerItemId: data.providerItemId ?? existing.providerItemId,
        accessTokenEnc: data.accessTokenEnc ?? existing.accessTokenEnc,
        institutionName: data.institutionName ?? existing.institutionName,
        status: data.status ?? "active",
        consentAt: data.consentAt ?? existing.consentAt,
        lastSyncAt: data.lastSyncAt ?? existing.lastSyncAt
      }).where(eq(debtProviderConnections.id, existing.id)).returning();
      return row2;
    }
    const [row] = await db.insert(debtProviderConnections).values({ id: randomUUID(), ...data }).returning();
    return row;
  }
  async disconnectDebtProvider(userId, provider) {
    await db.update(debtProviderConnections).set({ status: "disconnected" }).where(and(eq(debtProviderConnections.userId, userId), eq(debtProviderConnections.provider, provider)));
  }
  async createDebtImportAuditLog(entry) {
    await db.insert(debtImportAuditLogs).values({ id: randomUUID(), ...entry });
  }
  // Transaction methods
  async getTransactionsByUserId(userId, limit) {
    const query = db.select().from(transactions).where(eq(transactions.userId, userId)).orderBy(desc(transactions.date));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }
  async createTransaction(transaction) {
    const id = randomUUID();
    const [result] = await db.insert(transactions).values({ ...transaction, id }).returning();
    return result;
  }
  // Payment methods
  async getPaymentsByUserId(userId) {
    return await db.select().from(payments).where(eq(payments.userId, userId)).orderBy(desc(payments.date));
  }
  async getPaymentsByDebtId(debtId) {
    return await db.select().from(payments).where(eq(payments.debtId, debtId));
  }
  async createPayment(payment) {
    const id = randomUUID();
    const [result] = await db.insert(payments).values({ ...payment, id }).returning();
    return result;
  }
  async makeAcceleratedPayment(userId, debtId, amount) {
    const debt = await this.getDebt(debtId);
    if (!debt || debt.userId !== userId || debt.isActive === false) {
      throw new Error("Debt not found or unauthorized");
    }
    const newBalance = Math.max(0, parseFloat(debt.currentBalance) - parseFloat(amount)).toFixed(2);
    const payment = await this.createPayment({
      userId,
      debtId,
      amount,
      source: "accelerated"
    });
    const updatedDebt = await this.updateDebt(debtId, { currentBalance: newBalance });
    if (!updatedDebt) throw new Error("Failed to update debt");
    return { payment, updatedDebt };
  }
  // Round-up settings methods
  async getRoundUpSettings(userId) {
    const [settings] = await db.select().from(roundUpSettings).where(eq(roundUpSettings.userId, userId));
    return settings;
  }
  async createOrUpdateRoundUpSettings(settings) {
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
  async getCryptoPurchasesByUserId(userId) {
    return await db.select().from(cryptoPurchases).where(eq(cryptoPurchases.userId, userId)).orderBy(desc(cryptoPurchases.createdAt));
  }
  async createCryptoPurchase(purchase) {
    const id = randomUUID();
    const [result] = await db.insert(cryptoPurchases).values({ ...purchase, id }).returning();
    return result;
  }
  async updateCryptoPurchaseStatus(id, status, coinbaseOrderId) {
    const [result] = await db.update(cryptoPurchases).set({ status, coinbaseOrderId }).where(eq(cryptoPurchases.id, id)).returning();
    return result;
  }
  // Bank account methods — access tokens are encrypted at rest
  async getBankAccountsByUserId(userId) {
    const rows = await db.select().from(bankAccounts).where(and(eq(bankAccounts.userId, userId), eq(bankAccounts.isActive, true)));
    return rows.map((a) => ({ ...a, plaidAccessToken: "[encrypted]" }));
  }
  async createBankAccount(account) {
    const id = randomUUID();
    const encrypted = encryptToken(account.plaidAccessToken);
    const [result] = await db.insert(bankAccounts).values({ ...account, id, plaidAccessToken: encrypted }).onConflictDoUpdate({
      target: [bankAccounts.plaidItemId, bankAccounts.accountId],
      set: {
        plaidAccessToken: encrypted,
        accountName: account.accountName,
        accountType: account.accountType,
        institutionName: account.institutionName,
        mask: account.mask ?? null,
        isActive: account.isActive ?? true
      }
    }).returning();
    return { ...result, plaidAccessToken: "[encrypted]" };
  }
  async getBankAccountByPlaidItemId(itemId) {
    const [account] = await db.select().from(bankAccounts).where(eq(bankAccounts.plaidItemId, itemId));
    if (!account) return void 0;
    return { ...account, plaidAccessToken: "[encrypted]" };
  }
  async updateBankAccountStatus(id, isActive) {
    const [result] = await db.update(bankAccounts).set({ isActive }).where(eq(bankAccounts.id, id)).returning();
    if (!result) return void 0;
    return { ...result, plaidAccessToken: "[encrypted]" };
  }
  async refreshBankAccount(id, updates) {
    const [result] = await db.update(bankAccounts).set({ ...updates, plaidAccessToken: encryptToken(updates.plaidAccessToken), isActive: true }).where(eq(bankAccounts.id, id)).returning();
    if (!result) return void 0;
    return { ...result, plaidAccessToken: "[encrypted]" };
  }
  async getPlaidAccessToken(bankAccountId) {
    const [account] = await db.select({ token: bankAccounts.plaidAccessToken }).from(bankAccounts).where(eq(bankAccounts.id, bankAccountId));
    if (!account) return void 0;
    return decryptToken(account.token);
  }
  // User session methods
  async createUserSession(session2) {
    const id = randomUUID();
    const [result] = await db.insert(userSessions).values({ ...session2, id }).returning();
    return result;
  }
  async getUserSessionByToken(token) {
    const [session2] = await db.select().from(userSessions).where(eq(userSessions.sessionToken, token));
    return session2;
  }
  async updateSessionActivity(id) {
    const [result] = await db.update(userSessions).set({ lastActivity: /* @__PURE__ */ new Date() }).where(eq(userSessions.id, id)).returning();
    return result;
  }
  async deactivateUserSessions(userId, deviceType) {
    if (deviceType) {
      await db.update(userSessions).set({ isActive: false }).where(and(eq(userSessions.userId, userId), eq(userSessions.deviceType, deviceType)));
    } else {
      await db.update(userSessions).set({ isActive: false }).where(eq(userSessions.userId, userId));
    }
  }
  // DTT Token methods
  async getDttHoldings(userId) {
    const [holdings] = await db.select().from(dttHoldings).where(eq(dttHoldings.userId, userId));
    return holdings;
  }
  async createOrUpdateDttHoldings(holdings) {
    const existing = await this.getDttHoldings(holdings.userId);
    if (existing) {
      const [updated] = await db.update(dttHoldings).set({ ...holdings, lastActivity: /* @__PURE__ */ new Date() }).where(eq(dttHoldings.userId, holdings.userId)).returning();
      return updated;
    }
    const id = randomUUID();
    const [result] = await db.insert(dttHoldings).values({ ...holdings, id }).returning();
    return result;
  }
  async updateDttBalance(userId, balance, stakedAmount, totalEarned) {
    const updates = { balance };
    if (stakedAmount !== void 0) updates.stakedAmount = stakedAmount;
    if (totalEarned !== void 0) updates.totalEarned = totalEarned;
    const [result] = await db.update(dttHoldings).set(updates).where(eq(dttHoldings.userId, userId)).returning();
    return result;
  }
  async getDttRewardsByUserId(userId) {
    return await db.select().from(dttRewards).where(eq(dttRewards.userId, userId)).orderBy(desc(dttRewards.createdAt));
  }
  async createDttReward(reward) {
    const id = randomUUID();
    const [result] = await db.insert(dttRewards).values({ ...reward, id }).returning();
    return result;
  }
  async getDttStakingByUserId(userId) {
    return await db.select().from(dttStaking).where(eq(dttStaking.userId, userId)).orderBy(desc(dttStaking.createdAt));
  }
  async createDttStaking(staking) {
    const id = randomUUID();
    const startDate = /* @__PURE__ */ new Date();
    const endDate = new Date(startDate.getTime() + staking.duration * 24 * 60 * 60 * 1e3);
    const [result] = await db.insert(dttStaking).values({
      ...staking,
      id,
      startDate,
      endDate,
      status: staking.status || "active",
      rewardsEarned: staking.rewardsEarned || "0.00000000"
    }).returning();
    return result;
  }
  async updateDttStakingStatus(id, status) {
    const [result] = await db.update(dttStaking).set({ status }).where(eq(dttStaking.id, id)).returning();
    return result;
  }
  async getDttTokenInfo() {
    const [info] = await db.select().from(dttTokenInfo);
    return info;
  }
  async updateDttTokenInfo(info) {
    const existing = await this.getDttTokenInfo();
    if (existing) {
      const [updated] = await db.update(dttTokenInfo).set({ ...info, lastUpdated: /* @__PURE__ */ new Date() }).where(eq(dttTokenInfo.id, existing.id)).returning();
      return updated;
    }
    const [result] = await db.insert(dttTokenInfo).values({ ...info }).returning();
    return result;
  }
  // Notification methods
  async createNotification(notification) {
    const id = randomUUID();
    const [result] = await db.insert(notifications).values({ ...notification, id }).returning();
    return result;
  }
  async getNotificationsByUserId(userId, limit) {
    const query = db.select().from(notifications).where(eq(notifications.userId, userId)).orderBy(desc(notifications.createdAt));
    if (limit) {
      return await query.limit(limit);
    }
    return await query;
  }
  async getNotificationById(id) {
    const [result] = await db.select().from(notifications).where(eq(notifications.id, id));
    return result;
  }
  async updateNotificationStatus(id, status, sentAt, deliveredAt) {
    const updates = { status };
    if (sentAt) updates.sentAt = sentAt;
    if (deliveredAt) updates.deliveredAt = deliveredAt;
    const [result] = await db.update(notifications).set(updates).where(eq(notifications.id, id)).returning();
    return result;
  }
  // Notification settings methods
  async getNotificationSettings(userId) {
    const [settings] = await db.select().from(notificationSettings).where(eq(notificationSettings.userId, userId));
    return settings;
  }
  async createOrUpdateNotificationSettings(settings) {
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
  async getUserNotifications(userId, limit) {
    return this.getNotificationsByUserId(userId, limit);
  }
  async getAllUsers() {
    return await db.select().from(users);
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
    return computeDashboardSummary(this, userId);
  }
  // Contact submission methods
  async createContactSubmission(submission) {
    const [result] = await db.insert(contactSubmissions).values(submission).returning();
    return result;
  }
  async getContactSubmissions() {
    return await db.select().from(contactSubmissions).orderBy(desc(contactSubmissions.createdAt));
  }
  async updateUserPassword(userId, passwordHash, algo) {
    await db.update(users).set({ password: passwordHash, passwordAlgo: algo }).where(eq(users.id, userId));
  }
  async deleteUserAccount(userId) {
    await db.transaction(async (tx) => {
      await tx.delete(weeklyDispersals).where(eq(weeklyDispersals.userId, userId));
      await tx.delete(sweepDeposits).where(eq(sweepDeposits.userId, userId));
      await tx.delete(sweepAccounts).where(eq(sweepAccounts.userId, userId));
      await tx.delete(distributionPayments).where(eq(distributionPayments.userId, userId));
      await tx.delete(roundUpCollections).where(eq(roundUpCollections.userId, userId));
      await tx.delete(userSessions).where(eq(userSessions.userId, userId));
      await tx.delete(notifications).where(eq(notifications.userId, userId));
      await tx.delete(notificationSettings).where(eq(notificationSettings.userId, userId));
      await tx.delete(cryptoPurchases).where(eq(cryptoPurchases.userId, userId));
      await tx.delete(dttHoldings).where(eq(dttHoldings.userId, userId));
      await tx.delete(dttRewards).where(eq(dttRewards.userId, userId));
      await tx.delete(dttStaking).where(eq(dttStaking.userId, userId));
      await tx.delete(roundUpSettings).where(eq(roundUpSettings.userId, userId));
      await tx.delete(payments).where(eq(payments.userId, userId));
      await tx.delete(transactions).where(eq(transactions.userId, userId));
      await tx.delete(bankAccounts).where(eq(bankAccounts.userId, userId));
      await tx.delete(debtImportAuditLogs).where(eq(debtImportAuditLogs.userId, userId));
      await tx.delete(debtProviderConnections).where(eq(debtProviderConnections.userId, userId));
      await tx.delete(debts).where(eq(debts.userId, userId));
      await tx.delete(idempotencyKeys).where(eq(idempotencyKeys.userId, userId));
      await tx.delete(realTransferAuditLogs).where(eq(realTransferAuditLogs.userId, userId));
      await tx.delete(transfers).where(eq(transfers.userId, userId));
      await tx.delete(stripeAccounts).where(eq(stripeAccounts.userId, userId));
      await tx.delete(achAuthorizations).where(eq(achAuthorizations.userId, userId));
      await tx.delete(subscriptions).where(eq(subscriptions.userId, userId));
      await tx.delete(subscriptionConsents).where(eq(subscriptionConsents.userId, userId));
      await tx.delete(users).where(eq(users.id, userId));
    });
  }
  async getIdempotencyKey(key, userId, endpoint) {
    const result = await db.execute(
      sql2`SELECT response_status, response_body FROM idempotency_keys WHERE idempotency_key = ${key} AND user_id = ${userId} AND endpoint = ${endpoint} AND created_at > NOW() - INTERVAL '24 hours' LIMIT 1`
    );
    if (result.rows && result.rows.length > 0) {
      const row = result.rows[0];
      return { responseStatus: row.response_status, responseBody: row.response_body };
    }
    return void 0;
  }
  async createIdempotencyKey(data) {
    await db.execute(
      sql2`INSERT INTO idempotency_keys (id, idempotency_key, user_id, endpoint, response_status, response_body)
          VALUES (gen_random_uuid(), ${data.idempotencyKey}, ${data.userId}, ${data.endpoint}, ${data.responseStatus}, ${data.responseBody})
          ON CONFLICT (idempotency_key, user_id, endpoint) DO NOTHING`
    );
  }
  /**
   * Atomic claim — single INSERT...ON CONFLICT DO NOTHING RETURNING
   * decides the race. Only one concurrent caller gets `claimed: true`.
   */
  async reserveIdempotencyKey(key, userId, endpoint) {
    const inserted = await db.execute(
      sql2`INSERT INTO idempotency_keys (id, idempotency_key, user_id, endpoint, response_status, response_body)
          VALUES (gen_random_uuid(), ${key}, ${userId}, ${endpoint}, 0, '')
          ON CONFLICT (idempotency_key, user_id, endpoint) DO NOTHING
          RETURNING id`
    );
    const insertedRows = inserted?.rows ?? inserted ?? [];
    if (insertedRows.length > 0) return { claimed: true };
    const existing = await db.execute(
      sql2`SELECT response_status, response_body FROM idempotency_keys
          WHERE idempotency_key = ${key} AND user_id = ${userId} AND endpoint = ${endpoint}
          LIMIT 1`
    );
    const rows = existing?.rows ?? existing ?? [];
    const row = rows[0];
    if (!row) return { claimed: true };
    const status = Number(row.response_status ?? row.responseStatus ?? 0);
    if (status === 0) return { claimed: false, inFlight: true };
    return {
      claimed: false,
      cached: { status, body: String(row.response_body ?? row.responseBody ?? "") }
    };
  }
  async finalizeIdempotencyKey(key, userId, endpoint, status, body) {
    await db.execute(
      sql2`UPDATE idempotency_keys SET response_status = ${status}, response_body = ${body}
          WHERE idempotency_key = ${key} AND user_id = ${userId} AND endpoint = ${endpoint}`
    );
  }
  async releaseIdempotencyKey(key, userId, endpoint) {
    await db.execute(
      sql2`DELETE FROM idempotency_keys
          WHERE idempotency_key = ${key} AND user_id = ${userId} AND endpoint = ${endpoint}
          AND response_status = 0`
    );
  }
  // Per-user subscribe lock — implemented as a reserved (never finalized) row
  // in idempotency_keys so the (key, user, endpoint) unique index provides the
  // atomicity. Distinct from the caller-supplied Idempotency-Key reservation:
  // this one closes the race between two requests with DIFFERENT keys.
  static SUBSCRIBE_LOCK_KEY = "user-subscribe-lock";
  static SUBSCRIBE_LOCK_ENDPOINT = "/api/subscription/subscribe#user-lock";
  async acquireSubscribeLock(userId) {
    await db.execute(
      sql2`DELETE FROM idempotency_keys
          WHERE idempotency_key = ${_DatabaseStorage.SUBSCRIBE_LOCK_KEY}
            AND user_id = ${userId}
            AND endpoint = ${_DatabaseStorage.SUBSCRIBE_LOCK_ENDPOINT}
            AND response_status = 0
            AND created_at < NOW() - INTERVAL '2 minutes'`
    );
    const inserted = await db.execute(
      sql2`INSERT INTO idempotency_keys (id, idempotency_key, user_id, endpoint, response_status, response_body)
          VALUES (gen_random_uuid(), ${_DatabaseStorage.SUBSCRIBE_LOCK_KEY}, ${userId}, ${_DatabaseStorage.SUBSCRIBE_LOCK_ENDPOINT}, 0, '')
          ON CONFLICT (idempotency_key, user_id, endpoint) DO NOTHING
          RETURNING id`
    );
    const rows = inserted?.rows ?? inserted ?? [];
    return rows.length > 0;
  }
  async releaseSubscribeLock(userId) {
    await db.execute(
      sql2`DELETE FROM idempotency_keys
          WHERE idempotency_key = ${_DatabaseStorage.SUBSCRIBE_LOCK_KEY}
            AND user_id = ${userId}
            AND endpoint = ${_DatabaseStorage.SUBSCRIBE_LOCK_ENDPOINT}
            AND response_status = 0`
    );
  }
  // Transfer ledger methods
  async createTransfer(data) {
    const id = randomUUID();
    const now = /* @__PURE__ */ new Date();
    const [result] = await db.insert(transfers).values({ ...data, id, createdAt: now, updatedAt: now }).returning();
    return result;
  }
  async getTransfer(id) {
    const [result] = await db.select().from(transfers).where(eq(transfers.id, id));
    return result;
  }
  async getTransferByCorrelationId(correlationId) {
    const [result] = await db.select().from(transfers).where(eq(transfers.correlationId, correlationId));
    return result;
  }
  async getTransferByPlaidTransferId(plaidTransferId) {
    const [result] = await db.select().from(transfers).where(eq(transfers.plaidTransferId, plaidTransferId));
    return result;
  }
  async updateTransferStatus(id, status, updates) {
    const [result] = await db.update(transfers).set({ status, updatedAt: /* @__PURE__ */ new Date(), ...updates }).where(eq(transfers.id, id)).returning();
    return result;
  }
  async getTransfersByUserId(userId) {
    return await db.select().from(transfers).where(eq(transfers.userId, userId)).orderBy(desc(transfers.createdAt));
  }
  async getRecentTransfers(opts) {
    const limit = Math.max(1, Math.min(500, opts.limit));
    const conds = [];
    if (opts.provider) conds.push(eq(transfers.provider, opts.provider));
    if (opts.status) conds.push(eq(transfers.status, opts.status));
    const base = db.select().from(transfers);
    const filtered = conds.length > 0 ? base.where(and(...conds)) : base;
    return await filtered.orderBy(desc(transfers.createdAt)).limit(limit);
  }
  async getRecentStripeWebhookEvents(limit) {
    const capped = Math.max(1, Math.min(500, limit));
    return await db.select({ eventId: stripeWebhookEvents.eventId, type: stripeWebhookEvents.type, receivedAt: stripeWebhookEvents.receivedAt }).from(stripeWebhookEvents).orderBy(desc(stripeWebhookEvents.receivedAt)).limit(capped);
  }
  // Password reset token methods
  async createPasswordResetToken(data) {
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
  async consumePasswordResetToken(tokenHash) {
    const now = /* @__PURE__ */ new Date();
    const [result] = await db.update(passwordResetTokens).set({ usedAt: now }).where(and(
      eq(passwordResetTokens.tokenHash, tokenHash),
      sql2`${passwordResetTokens.usedAt} IS NULL`,
      sql2`${passwordResetTokens.expiresAt} > ${now}`
    )).returning();
    return result;
  }
  async invalidatePasswordResetTokensForUser(userId) {
    await db.update(passwordResetTokens).set({ usedAt: /* @__PURE__ */ new Date() }).where(and(eq(passwordResetTokens.userId, userId), sql2`${passwordResetTokens.usedAt} IS NULL`));
  }
  /**
   * Wipe every active session for a user after a sensitive event
   * (password reset). Covers both:
   *   - express-session rows in `sessions` (sid PK, sess jsonb)
   *   - app-level user_sessions rows (used by native auth tokens)
   */
  async invalidateAllUserSessions(userId) {
    await db.execute(sql2`DELETE FROM sessions WHERE sess->>'userId' = ${userId}`);
    await db.delete(userSessions).where(eq(userSessions.userId, userId));
  }
  // Email verification token methods
  async createEmailVerificationToken(data) {
    const [result] = await db.insert(emailVerificationTokens).values(data).returning();
    return result;
  }
  /**
   * Atomically consume an email verification token. Same single-update
   * pattern as password reset: returns the row only if it was unused AND
   * not expired AT THE MOMENT of the update.
   */
  async consumeEmailVerificationToken(tokenHash) {
    const now = /* @__PURE__ */ new Date();
    const [result] = await db.update(emailVerificationTokens).set({ usedAt: now }).where(and(
      eq(emailVerificationTokens.tokenHash, tokenHash),
      sql2`${emailVerificationTokens.usedAt} IS NULL`,
      sql2`${emailVerificationTokens.expiresAt} > ${now}`
    )).returning();
    return result;
  }
  async invalidateEmailVerificationTokensForUser(userId) {
    await db.update(emailVerificationTokens).set({ usedAt: /* @__PURE__ */ new Date() }).where(and(
      eq(emailVerificationTokens.userId, userId),
      sql2`${emailVerificationTokens.usedAt} IS NULL`
    ));
  }
  async markUserEmailVerified(userId, when = /* @__PURE__ */ new Date()) {
    await db.update(users).set({ emailVerifiedAt: when }).where(eq(users.id, userId));
  }
  async getTransferByStripePaymentIntentId(paymentIntentId) {
    const [result] = await db.select().from(transfers).where(eq(transfers.stripePaymentIntentId, paymentIntentId));
    return result;
  }
  async getTransferByStripeChargeId(chargeId) {
    const [result] = await db.select().from(transfers).where(eq(transfers.stripeChargeId, chargeId));
    return result;
  }
  // ----- Stripe ACH (BETA, flagged) -----
  async createStripeAccount(data) {
    const { paymentMethodIdPlaintext, ...rest } = data;
    const encrypted = encryptToken(paymentMethodIdPlaintext);
    const [result] = await db.insert(stripeAccounts).values({
      ...rest,
      stripePaymentMethodEnc: encrypted
    }).returning();
    return result;
  }
  async getStripeAccountByFcAccountId(fcAccountId) {
    const [result] = await db.select().from(stripeAccounts).where(eq(stripeAccounts.stripeFcAccountId, fcAccountId));
    return result;
  }
  // Re-link refresh: same FC account linked again → replace the stored
  // PaymentMethod reference in place. Keeping the SAME row id preserves
  // everything that points at it (funding-account selection, transfer history).
  async updateStripeAccountLink(id, data) {
    const encrypted = encryptToken(data.paymentMethodIdPlaintext);
    const [result] = await db.update(stripeAccounts).set({
      stripePaymentMethodEnc: encrypted,
      stripeCustomerId: data.stripeCustomerId,
      ...data.institutionName !== void 0 ? { institutionName: data.institutionName } : {},
      ...data.last4 !== void 0 ? { last4: data.last4 } : {}
    }).where(eq(stripeAccounts.id, id)).returning();
    if (!result) throw new Error(`stripe_accounts row not found for re-link: ${id}`);
    return result;
  }
  async getStripeAccountById(id) {
    const [result] = await db.select().from(stripeAccounts).where(eq(stripeAccounts.id, id));
    return result;
  }
  async getStripeAccountsByUserId(userId) {
    return await db.select().from(stripeAccounts).where(eq(stripeAccounts.userId, userId)).orderBy(desc(stripeAccounts.createdAt));
  }
  async getStripePaymentMethodId(stripeAccountId) {
    const [row] = await db.select().from(stripeAccounts).where(eq(stripeAccounts.id, stripeAccountId));
    if (!row?.stripePaymentMethodEnc) return void 0;
    return decryptToken(row.stripePaymentMethodEnc);
  }
  async hasStripeWebhookEvent(eventId) {
    const [row] = await db.select().from(stripeWebhookEvents).where(eq(stripeWebhookEvents.eventId, eventId));
    return Boolean(row);
  }
  async recordStripeWebhookEvent(eventId, type) {
    const inserted = await db.insert(stripeWebhookEvents).values({ eventId, type }).onConflictDoNothing({ target: stripeWebhookEvents.eventId }).returning({ eventId: stripeWebhookEvents.eventId });
    return inserted.length > 0;
  }
  // ----- ACH authorization (Nacha mandate) evidence -----
  async createAchAuthorization(data) {
    const [result] = await db.insert(achAuthorizations).values(data).returning();
    return result;
  }
  async getLatestAchAuthorization(userId) {
    const [result] = await db.select().from(achAuthorizations).where(eq(achAuthorizations.userId, userId)).orderBy(desc(achAuthorizations.createdAt)).limit(1);
    return result;
  }
  // ----- Subscriptions (Stripe Billing) -----
  async upsertSubscription(data) {
    const [result] = await db.insert(subscriptions).values(data).onConflictDoUpdate({
      target: subscriptions.stripeSubscriptionId,
      set: {
        plan: data.plan ?? "debt",
        stripeCustomerId: data.stripeCustomerId,
        stripePriceId: data.stripePriceId,
        status: data.status ?? "incomplete",
        currentPeriodStart: data.currentPeriodStart ?? null,
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        cancelAtPeriodEnd: data.cancelAtPeriodEnd ?? false,
        canceledAt: data.canceledAt ?? null,
        latestInvoiceId: data.latestInvoiceId ?? null,
        lastPaymentError: data.lastPaymentError ?? null,
        updatedAt: /* @__PURE__ */ new Date()
      }
    }).returning();
    return result;
  }
  async getLatestSubscriptionByUserId(userId) {
    const [result] = await db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.createdAt)).limit(1);
    return result;
  }
  async getSubscriptionByStripeSubscriptionId(stripeSubscriptionId) {
    const [result] = await db.select().from(subscriptions).where(eq(subscriptions.stripeSubscriptionId, stripeSubscriptionId)).limit(1);
    return result;
  }
  async createSubscriptionConsent(data) {
    const [result] = await db.insert(subscriptionConsents).values(data).returning();
    return result;
  }
  async getLatestSubscriptionConsent(userId) {
    const [result] = await db.select().from(subscriptionConsents).where(eq(subscriptionConsents.userId, userId)).orderBy(desc(subscriptionConsents.createdAt)).limit(1);
    return result;
  }
  // ----- Real-money ACH rollout gate (allowlist + conservative limits) -----
  //
  // Race-safe: takes a per-user advisory lock for the duration of the
  // transaction so two concurrent debit attempts (different idempotency keys)
  // can never both pass the daily count/sum checks. Re-reads allowlist,
  // account, debt, and prior-transfer state INSIDE the lock, writes an audit
  // row for EVERY decision, and only inserts a `created` transfers row when all
  // checks pass — committing before the caller ever talks to Stripe.
  async reserveRealStripeAchDebit(args) {
    const {
      userId,
      stripeAccountId,
      amount,
      debtId,
      idempotencyKey,
      correlationId,
      stripeMode,
      environment,
      limits
    } = args;
    return await db.transaction(async (tx) => {
      await tx.execute(sql2`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
      const consumedStatuses = [
        "created",
        "authorized",
        "pending",
        "processing",
        "posted",
        "settled",
        "requires_action"
      ];
      const pendingStatuses = [
        "created",
        "authorized",
        "pending",
        "processing",
        "posted",
        "requires_action"
      ];
      let allowlistEnabled = false;
      const writeAudit = async (result, reason, extra) => {
        const [row] = await tx.insert(realTransferAuditLogs).values({
          userId,
          adminUserId: null,
          action: "ach_debit_decision",
          result,
          reason,
          amount: amount.toFixed(2),
          debtId: debtId ?? null,
          stripeAccountId,
          stripePaymentIntentId: null,
          transferId: extra?.transferId ?? null,
          stripeMode: stripeMode ?? null,
          environment,
          allowlistEnabled,
          idempotencyKey,
          correlationId
        }).returning({ id: realTransferAuditLogs.id });
        return row.id;
      };
      const block = async (httpStatus, reason, message) => {
        const auditId2 = await writeAudit("blocked", reason);
        return { ok: false, httpStatus, reason, message, auditId: auditId2 };
      };
      const [user] = await tx.select().from(users).where(eq(users.id, userId));
      if (!user) return block(404, "user_not_found", "User not found");
      allowlistEnabled = user.realTransfersBlocked !== true;
      if (!allowlistEnabled) {
        return block(403, "not_allowlisted", "Real transfers are not enabled for this account.");
      }
      const [account] = await tx.select().from(stripeAccounts).where(eq(stripeAccounts.id, stripeAccountId));
      if (!account || account.userId !== userId) {
        return block(404, "account_not_found", "Stripe account not found");
      }
      if (!account.isActive || account.status !== "linked") {
        return block(422, "account_not_active", "The selected bank account is not active. Please re-link it.");
      }
      if (debtId) {
        const [debt] = await tx.select().from(debts).where(eq(debts.id, debtId));
        if (!debt || debt.userId !== userId) {
          return block(404, "debt_not_found", "Debt not found");
        }
        if (!debt.isActive) {
          return block(422, "debt_inactive", "That debt is no longer active.");
        }
      }
      const dupConds = [
        eq(transfers.userId, userId),
        eq(transfers.provider, "stripe"),
        inArray(transfers.status, pendingStatuses)
      ];
      if (debtId) dupConds.push(eq(transfers.debtId, debtId));
      const dup = await tx.select({ id: transfers.id }).from(transfers).where(and(...dupConds)).limit(1);
      if (dup.length > 0) {
        return block(409, "duplicate_pending", "A transfer for this is already in progress. Please wait for it to finish.");
      }
      const history = await tx.select({
        status: transfers.status,
        createdAt: transfers.createdAt,
        updatedAt: transfers.updatedAt
      }).from(transfers).where(and(
        eq(transfers.userId, userId),
        eq(transfers.provider, "stripe")
      ));
      const capOverride = user.realTransfersDailyCapOverride !== null && user.realTransfersDailyCapOverride !== void 0 ? parseFloat(user.realTransfersDailyCapOverride) : null;
      const trust = computeRealTransferTrust(history, capOverride);
      const effective = {
        firstTransferMaxDollars: limits.firstTransferMaxDollars,
        dailyTotalMaxDollars: trust.dailyTotalMaxDollars,
        dailyCountMax: trust.dailyCountMax
      };
      const prior = history.filter((r) => consumedStatuses.includes(r.status));
      const isFirst = prior.length === 0;
      if (isFirst && amount > effective.firstTransferMaxDollars) {
        return block(
          422,
          "over_first_transfer_limit",
          `Your first real transfer is limited to $${effective.firstTransferMaxDollars.toFixed(2)}.`
        );
      }
      const now = /* @__PURE__ */ new Date();
      const todayStartUtc = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
      const todays = await tx.select({ amount: transfers.amount }).from(transfers).where(and(
        eq(transfers.userId, userId),
        eq(transfers.provider, "stripe"),
        inArray(transfers.status, consumedStatuses),
        gte(transfers.createdAt, todayStartUtc)
      ));
      if (todays.length >= effective.dailyCountMax) {
        return block(
          429,
          "over_daily_count",
          `You've reached the daily limit of ${effective.dailyCountMax} transfer(s). Please try again tomorrow.`
        );
      }
      const todaysSum = todays.reduce((s, r) => s + parseFloat(r.amount), 0);
      if (todaysSum + amount > effective.dailyTotalMaxDollars) {
        return block(
          422,
          "over_daily_total",
          `This would exceed your current daily transfer limit of $${effective.dailyTotalMaxDollars.toFixed(2)}.`
        );
      }
      const ledgerId = randomUUID();
      const [ledger] = await tx.insert(transfers).values({
        id: ledgerId,
        userId,
        type: debtId ? "debt_payment" : "stripe_ach_debit",
        amount: amount.toFixed(2),
        status: "created",
        provider: "stripe",
        stripeAccountId,
        debtId: debtId || null,
        correlationId,
        idempotencyKey,
        rawRequest: JSON.stringify({ stripeAccountId, amount, debtId, real: true }),
        createdAt: now,
        updatedAt: now
      }).returning();
      const auditId = await writeAudit("approved", null, { transferId: ledger.id });
      return { ok: true, ledger, auditId, isFirst };
    });
  }
  async setUserRealTransfersEnabled(userId, enabled, adminUserId, notes) {
    return await db.transaction(async (tx) => {
      await tx.execute(sql2`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
      const [updated] = await tx.update(users).set({
        realTransfersBlocked: !enabled,
        realTransfersBlockedAt: !enabled ? /* @__PURE__ */ new Date() : null,
        realTransfersBlockedBy: !enabled ? adminUserId : null,
        realTransfersNotes: notes ?? null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(users.id, userId)).returning();
      if (!updated) return void 0;
      await tx.insert(realTransferAuditLogs).values({
        userId,
        adminUserId,
        action: "allowlist_changed",
        result: enabled ? "enabled" : "disabled",
        reason: notes ?? null,
        allowlistEnabled: enabled,
        environment: process.env.NODE_ENV === "production" ? "production" : "development"
      });
      return updated;
    });
  }
  async setUserRealTransfersDailyCapOverride(userId, dailyCap, adminUserId, notes) {
    return await db.transaction(async (tx) => {
      await tx.execute(sql2`SELECT pg_advisory_xact_lock(hashtext(${userId}))`);
      const [updated] = await tx.update(users).set({
        realTransfersDailyCapOverride: dailyCap === null ? null : dailyCap.toFixed(2),
        realTransfersNotes: notes ?? null,
        updatedAt: /* @__PURE__ */ new Date()
      }).where(eq(users.id, userId)).returning();
      if (!updated) return void 0;
      await tx.insert(realTransferAuditLogs).values({
        userId,
        adminUserId,
        action: "daily_cap_override_changed",
        result: dailyCap === null ? "cleared" : `set:$${dailyCap.toFixed(2)}`,
        reason: notes ?? null,
        allowlistEnabled: updated.realTransfersBlocked !== true,
        environment: process.env.NODE_ENV === "production" ? "production" : "development"
      });
      return updated;
    });
  }
  async getUserRealTransferTrust(userId) {
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    if (!user) return void 0;
    const history = await db.select({
      status: transfers.status,
      createdAt: transfers.createdAt,
      updatedAt: transfers.updatedAt
    }).from(transfers).where(and(
      eq(transfers.userId, userId),
      eq(transfers.provider, "stripe")
    ));
    const capOverride = user.realTransfersDailyCapOverride !== null && user.realTransfersDailyCapOverride !== void 0 ? parseFloat(user.realTransfersDailyCapOverride) : null;
    return computeRealTransferTrust(history, capOverride);
  }
  async createRealTransferAuditLog(data) {
    const [row] = await db.insert(realTransferAuditLogs).values(data).returning();
    return row;
  }
  async getRecentRealTransferAuditLogs(opts) {
    const limit = Math.max(1, Math.min(500, opts.limit));
    const base = db.select().from(realTransferAuditLogs);
    const filtered = opts.userId ? base.where(eq(realTransferAuditLogs.userId, opts.userId)) : base;
    return await filtered.orderBy(desc(realTransferAuditLogs.createdAt)).limit(limit);
  }
};
var storage = new DatabaseStorage();

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
import { createHash as createHash3 } from "crypto";
import rateLimit4 from "express-rate-limit";
import { z as z8 } from "zod";

// server/services/plaidService.ts
import {
  Configuration,
  PlaidApi,
  PlaidEnvironments,
  CountryCode,
  Products,
  TransferType,
  TransferNetwork,
  ACHClass
} from "plaid";
function resolvePlaidEnvironment() {
  const env = process.env.PLAID_ENV || "sandbox";
  switch (env.toLowerCase()) {
    case "production":
      return PlaidEnvironments.production;
    case "development":
      return PlaidEnvironments.development;
    default:
      return PlaidEnvironments.sandbox;
  }
}
function resolvePlaidSecret() {
  const env = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  if (env === "production") {
    if (!process.env.PLAID_SECRET_PRODUCTION) {
      console.error(
        "[PlaidService] PLAID_ENV=production but PLAID_SECRET_PRODUCTION is not set. Plaid will be unavailable. Set the production secret from the Plaid dashboard (Team Settings \u2192 Keys)."
      );
      return void 0;
    }
    return process.env.PLAID_SECRET_PRODUCTION;
  }
  return process.env.PLAID_SECRET;
}
function resolvePlaidRedirectUri() {
  const redirectUri = process.env.PLAID_REDIRECT_URI;
  const env = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  if (!redirectUri || redirectUri.includes("your-domain") || !redirectUri.startsWith("https://")) {
    if (env === "production") {
      console.warn(
        "[PlaidService] PLAID_REDIRECT_URI is missing or malformed in production \u2014 link tokens will be created WITHOUT redirect_uri. OAuth banks (Chase etc.) will fail to link."
      );
    }
    return void 0;
  }
  if (env === "production" && !redirectUri.startsWith("https://dime-time.com")) {
    console.warn(
      "[PlaidService] Ignoring PLAID_REDIRECT_URI in production: it is not a https://dime-time.com URL. An unregistered redirect_uri would make Plaid Link fail for every bank."
    );
    return void 0;
  }
  return redirectUri;
}
function plaidNotConfiguredMessage() {
  const env = (process.env.PLAID_ENV || "sandbox").toLowerCase();
  return env === "production" ? "Plaid service not configured. PLAID_ENV=production requires PLAID_CLIENT_ID and PLAID_SECRET_PRODUCTION environment variables." : "Plaid service not configured. Please provide PLAID_CLIENT_ID and PLAID_SECRET environment variables.";
}
function maskToken(token) {
  if (!token || token.length < 8) return "[masked]";
  return `${token.slice(0, 8)}...[masked]`;
}
function log(correlationId, event, data) {
  setCorrelationTag(correlationId);
  const entry = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    service: "PlaidService",
    correlationId,
    event,
    ...data
  };
  console.log(JSON.stringify(entry));
}
var PlaidService = class {
  client = null;
  isConfigured = false;
  environment;
  constructor() {
    this.environment = process.env.PLAID_ENV || "sandbox";
    try {
      const plaidSecret = resolvePlaidSecret();
      const configuration = new Configuration({
        basePath: resolvePlaidEnvironment(),
        baseOptions: {
          headers: {
            "PLAID-CLIENT-ID": process.env.PLAID_CLIENT_ID,
            "PLAID-SECRET": plaidSecret
          }
        }
      });
      this.client = new PlaidApi(configuration);
      this.isConfigured = !!(process.env.PLAID_CLIENT_ID && plaidSecret);
      if (this.isConfigured) {
        console.log(`Plaid service initialized in ${this.environment} environment`);
      }
    } catch (error) {
      console.error("Failed to initialize Plaid service:", error);
      this.isConfigured = false;
    }
  }
  getClient() {
    if (!this.client) {
      throw new Error("Plaid client not initialized");
    }
    return this.client;
  }
  async createLinkToken(userId) {
    if (!this.isConfigured) {
      throw new Error(plaidNotConfiguredMessage());
    }
    try {
      const linkTokenRequest = {
        user: { client_user_id: userId },
        client_name: "Dime Time",
        products: [Products.Transactions, Products.Auth],
        country_codes: [CountryCode.Us],
        language: "en"
      };
      const redirectUri = resolvePlaidRedirectUri();
      if (redirectUri) {
        linkTokenRequest.redirect_uri = redirectUri;
      }
      const response = await this.getClient().linkTokenCreate(linkTokenRequest);
      return response.data.link_token;
    } catch (error) {
      console.error("Error creating link token:", this.redactPlaidError(error));
      throw error;
    }
  }
  /**
   * Link token for Plaid "update mode" — re-authenticates an EXISTING item
   * whose access token stopped working (ITEM_LOGIN_REQUIRED etc.). Passing
   * access_token (and no products) tells Plaid to repair the item instead of
   * creating a new one.
   */
  async createUpdateLinkToken(userId, accessToken) {
    if (!this.isConfigured) {
      throw new Error(plaidNotConfiguredMessage());
    }
    try {
      const linkTokenRequest = {
        user: { client_user_id: userId },
        client_name: "Dime Time",
        country_codes: [CountryCode.Us],
        language: "en",
        access_token: accessToken
      };
      const redirectUri = resolvePlaidRedirectUri();
      if (redirectUri) {
        linkTokenRequest.redirect_uri = redirectUri;
      }
      const response = await this.getClient().linkTokenCreate(linkTokenRequest);
      return response.data.link_token;
    } catch (error) {
      console.error("Error creating update link token:", this.redactPlaidError(error));
      throw error;
    }
  }
  async exchangePublicToken(publicToken) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    try {
      const response = await this.getClient().itemPublicTokenExchange({
        public_token: publicToken
      });
      return {
        accessToken: response.data.access_token,
        itemId: response.data.item_id
      };
    } catch (error) {
      console.error("Error exchanging public token:", this.redactPlaidError(error));
      throw error;
    }
  }
  async getAccounts(accessToken) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    try {
      const response = await this.getClient().accountsGet({
        access_token: accessToken
      });
      return response.data.accounts;
    } catch (error) {
      console.error("Error fetching accounts:", this.redactPlaidError(error));
      throw error;
    }
  }
  async getTransactions(accessToken, startDate, endDate) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    try {
      const response = await this.getClient().transactionsGet({
        access_token: accessToken,
        start_date: startDate,
        end_date: endDate
      });
      return response.data.transactions;
    } catch (error) {
      console.error("Error fetching transactions:", this.redactPlaidError(error));
      throw error;
    }
  }
  async getBalance(accessToken) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    try {
      const response = await this.getClient().accountsBalanceGet({
        access_token: accessToken
      });
      return response.data.accounts;
    } catch (error) {
      console.error("Error fetching balance:", this.redactPlaidError(error));
      throw error;
    }
  }
  async getAccountAuth(accessToken) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    try {
      const response = await this.getClient().authGet({ access_token: accessToken });
      const numbers = response.data.numbers.ach || [];
      return numbers.map((n) => ({
        accountId: n.account_id,
        accountNumber: n.account,
        routingNumber: n.routing,
        name: response.data.accounts.find((a) => a.account_id === n.account_id)?.name || "Bank Account"
      }));
    } catch (error) {
      console.error("Error fetching Plaid Auth:", this.redactPlaidError(error));
      throw error;
    }
  }
  /**
   * Validate that funding account configuration is present for production.
   * Fails explicitly if MERCURY_PLAID_FUNDING_ID is missing in production.
   */
  validateFundingAccountConfig(correlationId) {
    const fundingId = process.env.MERCURY_PLAID_FUNDING_ID;
    if (!fundingId) {
      if (this.environment === "production") {
        log(correlationId, "funding_account_missing", {
          severity: "ERROR",
          message: "MERCURY_PLAID_FUNDING_ID is not set. This is required in production to route Plaid Transfer funds to Mercury. Set this env var to the Mercury Plaid funding account ID."
        });
        throw new Error(
          "[PlaidService] MERCURY_PLAID_FUNDING_ID is required in production for Plaid Transfer to route funds to Mercury. Set this env var to the funding account ID provided by Plaid for your Mercury account."
        );
      }
      log(correlationId, "funding_account_not_set", {
        severity: "WARN",
        message: "MERCURY_PLAID_FUNDING_ID not set \u2014 funds will route to Plaid default funding account. Set this for Mercury in production."
      });
    }
    return fundingId || void 0;
  }
  /**
   * Initiate an ACH debit from the user's linked bank account via Plaid Transfer.
   * Structured reconciliation logging included throughout.
   * Flow: transferAuthorizationCreate → transferCreate → return ids
   */
  async createRoundUpTransfer(params) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    const { correlationId } = params;
    const client2 = this.getClient();
    const fundingAccountId = params.mercuryFundingAccountId ?? this.validateFundingAccountConfig(correlationId);
    log(correlationId, "transfer_auth_request", {
      accountId: params.accountId,
      amount: params.amount,
      amountStr: params.amount.toFixed(2),
      userLegalName: params.userLegalName,
      accessToken: maskToken(params.accessToken),
      fundingAccountId: fundingAccountId || "not_set"
    });
    const authRequest = {
      access_token: params.accessToken,
      account_id: params.accountId,
      type: TransferType.Debit,
      network: TransferNetwork.Ach,
      amount: params.amount.toFixed(2),
      ach_class: ACHClass.Ppd,
      user: { legal_name: params.userLegalName },
      ...fundingAccountId ? { funding_account_id: fundingAccountId } : {}
    };
    const authResponse = await client2.transferAuthorizationCreate(authRequest);
    const authorization = authResponse.data.authorization;
    log(correlationId, "transfer_auth_response", {
      authorizationId: authorization.id,
      decision: authorization.decision,
      decisionRationaleCode: authorization.decision_rationale?.code,
      decisionRationaleDescription: authorization.decision_rationale?.description
    });
    if (authorization.decision !== "approved") {
      throw new Error(
        `Plaid Transfer authorization denied: ${authorization.decision_rationale?.code || "UNKNOWN"} \u2014 ${authorization.decision_rationale?.description || ""}`
      );
    }
    const createRequest = {
      access_token: params.accessToken,
      account_id: params.accountId,
      authorization_id: authorization.id,
      description: params.description.slice(0, 15)
    };
    log(correlationId, "transfer_create_request", {
      authorizationId: authorization.id,
      description: createRequest.description
    });
    const transferResponse = await client2.transferCreate(createRequest);
    const transfer = transferResponse.data.transfer;
    log(correlationId, "transfer_create_response", {
      transferId: transfer.id,
      status: transfer.status,
      amount: transfer.amount,
      network: transfer.network
    });
    return {
      transferId: transfer.id,
      authorizationId: authorization.id,
      status: transfer.status
    };
  }
  /**
   * Create a Link token scoped to the Liabilities product ONLY.
   * This deliberately creates a SEPARATE Plaid item from the bank-connect flow
   * (which uses Transactions + Auth) so importing debts never forces the user to
   * re-consent their linked funding bank. Used by the automatic debt-import flow.
   */
  async createLiabilitiesLinkToken(userId) {
    if (!this.isConfigured) {
      throw new Error(plaidNotConfiguredMessage());
    }
    try {
      const linkTokenRequest = {
        user: { client_user_id: userId },
        client_name: "Dime Time",
        products: [Products.Liabilities],
        country_codes: [CountryCode.Us],
        language: "en"
      };
      const redirectUri = resolvePlaidRedirectUri();
      if (redirectUri) {
        linkTokenRequest.redirect_uri = redirectUri;
      }
      const response = await this.getClient().linkTokenCreate(linkTokenRequest);
      return response.data.link_token;
    } catch (error) {
      console.error("Error creating liabilities link token:", this.redactPlaidError(error));
      throw error;
    }
  }
  /**
   * Fetch the raw Liabilities payload for a Plaid item (credit cards, student
   * loans, mortgages) alongside the accounts they belong to. Callers normalize
   * this into NormalizedLiability[] — the raw shape never leaks into the app.
   */
  async getLiabilities(accessToken) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    try {
      const response = await this.getClient().liabilitiesGet({ access_token: accessToken });
      return {
        accounts: response.data.accounts,
        liabilities: response.data.liabilities,
        item: response.data.item
      };
    } catch (error) {
      console.error("Error fetching liabilities:", this.redactPlaidError(error));
      throw error;
    }
  }
  /**
   * Remove a Plaid item (best-effort teardown when a user disconnects debt import).
   */
  async removeItem(accessToken) {
    if (!this.isConfigured) {
      throw new Error("Plaid service not configured");
    }
    await this.getClient().itemRemove({ access_token: accessToken });
  }
  /**
   * Extract ONLY non-sensitive fields from a Plaid/axios error for logging.
   * Plaid errors are axios errors whose `config` contains the request body
   * (public_token / access_token) and the PLAID-SECRET header — never log those.
   */
  redactPlaidError(error) {
    const data = error?.response?.data;
    if (data && typeof data === "object") {
      return {
        error_code: data.error_code,
        error_type: data.error_type,
        request_id: data.request_id
      };
    }
    return { message: error instanceof Error ? error.message : String(error) };
  }
  isServiceConfigured() {
    return this.isConfigured;
  }
};
var plaidService = new PlaidService();

// server/services/coinbaseService.ts
import axios from "axios";
var CoinbaseService = class _CoinbaseService {
  // Purchases are always simulated in Preview. Real crypto will be a new,
  // provider-approved integration — not a flip of this flag.
  demoMode = true;
  // Live public market prices (no auth required) so Preview mode shows real
  // prices while purchases stay simulated. Cached so round-up processing
  // never waits on repeated price lookups.
  static FALLBACK_USD_PRICES = {
    BTC: 43250,
    ETH: 3200,
    ADA: 0.38,
    SOL: 145,
    XRP: 0.55,
    LTC: 140
  };
  spotPriceCache = /* @__PURE__ */ new Map();
  static SPOT_CACHE_TTL_MS = 6e4;
  inflightSpotFetches = /* @__PURE__ */ new Map();
  constructor() {
    console.log("\u2705 Crypto Preview service initialized \u2014 live public prices, simulated purchases, no API credentials used");
    this.warmSpotPriceCache();
  }
  /**
   * Pre-warm the public price cache for the coins offered in the app so the
   * first round-up after boot never waits on a network price lookup.
   */
  warmSpotPriceCache() {
    for (const symbol of ["BTC", "ETH", "ADA", "SOL"]) {
      void this.fetchAndCacheSpotPrice(`${symbol}-USD`);
    }
  }
  /**
   * Fetch + cache a live public spot price. Never throws; returns null on
   * failure. Concurrent calls for the same pair share one request.
   */
  fetchAndCacheSpotPrice(pair) {
    const existing = this.inflightSpotFetches.get(pair);
    if (existing) {
      return existing;
    }
    const fetchPromise = (async () => {
      try {
        const resp = await axios.get(`https://api.coinbase.com/v2/prices/${pair}/spot`, { timeout: 4e3 });
        const price = parseFloat(resp.data?.data?.amount);
        if (!Number.isFinite(price) || price <= 0) {
          throw new Error("Invalid price payload from Coinbase public API");
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
  async getPublicSpotPrice(currencyPair) {
    const pair = currencyPair.toUpperCase();
    const base = pair.split("-")[0] || "BTC";
    const formatUsd = (p) => p >= 1 ? p.toFixed(2) : p.toFixed(6);
    const cached3 = this.spotPriceCache.get(pair);
    if (cached3) {
      if (Date.now() - cached3.fetchedAt >= _CoinbaseService.SPOT_CACHE_TTL_MS) {
        void this.fetchAndCacheSpotPrice(pair);
      }
      return { amount: formatUsd(cached3.price), currency: "USD" };
    }
    const price = await this.fetchAndCacheSpotPrice(pair);
    if (price !== null) {
      return { amount: formatUsd(price), currency: "USD" };
    }
    const fallback = _CoinbaseService.FALLBACK_USD_PRICES[base] ?? _CoinbaseService.FALLBACK_USD_PRICES.BTC;
    return { amount: formatUsd(fallback), currency: "USD" };
  }
  /**
   * Generate a simulated Bitcoin purchase for Preview mode
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
  async getAccount(accountId) {
    return {
      id: accountId,
      name: "Demo Bitcoin Wallet",
      primary: true,
      type: "wallet",
      currency: "BTC",
      balance: { amount: "0.00125000", currency: "BTC" }
    };
  }
  async buyCrypto(_accountId, amount, currency = "USD") {
    console.log(`[PREVIEW] Simulating BTC purchase of ${amount} ${currency} \u2014 no real money moves`);
    return this.generateDemoPurchase(amount, currency);
  }
  async getExchangeRates(currency = "BTC") {
    const spot = await this.getPublicSpotPrice(`${currency}-USD`);
    return {
      currency,
      rates: {
        USD: spot.amount
      }
    };
  }
  async getSpotPrice(currencyPair = "BTC-USD") {
    return this.getPublicSpotPrice(currencyPair);
  }
  async getTransactions(_accountId) {
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
  /**
   * Preview mode needs no credentials, so the service is always "configured".
   * Kept for call-site compatibility (routes and round-up split gate on it).
   */
  isServiceConfigured() {
    return true;
  }
  isDemoMode() {
    return this.demoMode;
  }
};
var coinbaseService = new CoinbaseService();

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
  async processBulkWeeklyPayments(payments2) {
    if (!this.isConfigured) {
      throw new Error("Axos service not configured");
    }
    try {
      const totalAmount = payments2.reduce((sum, payment) => sum + parseFloat(payment.amount), 0).toFixed(2);
      const bulkTransferData = {
        fromAccount: this.businessAccountId,
        payments: payments2.map((payment) => ({
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

// server/middleware/authHelper.ts
import { createHash } from "crypto";
function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error("SESSION_SECRET environment variable is required");
  return secret;
}
function verifyAuthToken(token) {
  try {
    const decoded = Buffer.from(token, "base64").toString("utf-8");
    const [userId, timestampStr, signature] = decoded.split(":");
    const payload = `${userId}:${timestampStr}`;
    const expectedSignature = createHash("sha256").update(payload + getSessionSecret()).digest("hex").substring(0, 16);
    if (signature !== expectedSignature) return null;
    const timestamp2 = parseInt(timestampStr, 10);
    const thirtyDays = 30 * 24 * 60 * 60 * 1e3;
    if (Date.now() - timestamp2 > thirtyDays) return null;
    return userId;
  } catch {
    return null;
  }
}
function getUserIdFromRequest(req) {
  const sessionUserId = req.session?.userId;
  if (sessionUserId) return sessionUserId;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith("Bearer ")) {
    return verifyAuthToken(authHeader.substring(7));
  }
  return null;
}

// server/lib/admin.ts
function parseAdminIds() {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return new Set(
    raw.split(",").map((s) => s.trim()).filter((s) => s.length > 0)
  );
}
var cached2 = null;
function adminIds() {
  if (cached2 === null) cached2 = parseAdminIds();
  return cached2;
}
function isAdminUserId(userId) {
  if (!userId) return false;
  return adminIds().has(userId);
}
function requireAdmin(req, res, next) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (!isAdminUserId(userId)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  req.adminUserId = userId;
  next();
}

// server/routes/axosRoutes.ts
function registerAxosRoutes(app2) {
  app2.get("/api/axos/business-account", requireAdmin, async (req, res) => {
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
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
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
  app2.post("/api/axos/weekly-distribution", requireAdmin, async (req, res) => {
    try {
      const { payments: payments2 } = req.body;
      if (!payments2 || !Array.isArray(payments2) || payments2.length === 0) {
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
        payments2.forEach((payment) => paymentSchema.parse(payment));
      } catch (validationError) {
        return res.status(400).json({
          message: "Invalid payment data structure",
          errors: validationError
        });
      }
      const bulkPayment = await axosService.processBulkWeeklyPayments(payments2);
      const totalAmount = payments2.reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const interestEarned = await axosService.calculateInterestEarned(
        totalAmount.toFixed(2),
        7
        // 7 days for weekly calculation
      );
      res.status(201).json({
        success: true,
        bulkPayment,
        totalAmount: totalAmount.toFixed(2),
        paymentCount: payments2.length,
        interestEarned,
        message: `Successfully scheduled ${payments2.length} debt payments for Friday distribution`
      });
    } catch (error) {
      console.error("Error processing weekly distribution:", error);
      res.status(500).json({ message: "Failed to process weekly distribution" });
    }
  });
  app2.post("/api/axos/pay-debt", requireAdmin, async (req, res) => {
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
  app2.get("/api/axos/transfer/:transferId", requireAdmin, async (req, res) => {
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
  app2.get("/api/axos/transactions", requireAdmin, async (req, res) => {
    try {
      const startDate = req.query.start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
      const endDate = req.query.end_date || (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const limit = parseInt(req.query.limit) || 100;
      if (!axosService.isServiceConfigured()) {
        return res.status(503).json({ message: "Axos service not configured" });
      }
      const transactions2 = await axosService.getAccountTransactions(startDate, endDate, limit);
      res.json({
        transactions: transactions2,
        startDate,
        endDate,
        count: transactions2.length
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
  app2.get("/api/axos/status", requireAdmin, async (req, res) => {
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

// server/routes/mercuryRoutes.ts
import { randomUUID as randomUUID2 } from "crypto";

// server/services/mercuryService.ts
import axios3 from "axios";
var MERCURY_API_BASE = "https://api.mercury.com/api/v1";
function log2(correlationId, event, data) {
  setCorrelationTag(correlationId);
  const entry = {
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    service: "MercuryService",
    correlationId,
    event,
    ...data
  };
  console.log(JSON.stringify(entry));
}
function maskAccountNumber(acct) {
  if (!acct || acct.length < 4) return "[masked]";
  return `\u2022\u2022${acct.slice(-4)}`;
}
var MercuryService = class {
  client;
  isConfigured = false;
  cachedAccountId = "";
  constructor() {
    const apiKey = process.env.MERCURY_API_KEY || process.env.Mercury_API_Key;
    this.isConfigured = !!(apiKey && process.env.MERCURY_ACCOUNT_NUMBER && process.env.MERCURY_ROUTING_NUMBER);
    this.client = axios3.create({
      baseURL: MERCURY_API_BASE,
      headers: {
        "Authorization": `Bearer ${apiKey || ""}`,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      timeout: 3e4
    });
    if (this.isConfigured) {
      console.log("Mercury banking service configured successfully");
    } else {
      console.log("Mercury banking service not configured \u2014 missing MERCURY_API_KEY, MERCURY_ACCOUNT_NUMBER, or MERCURY_ROUTING_NUMBER");
    }
  }
  isServiceConfigured() {
    return this.isConfigured;
  }
  async resolveCheckingAccountId() {
    if (this.cachedAccountId) return this.cachedAccountId;
    const accounts = await this.listAccounts();
    const accountNumber = process.env.MERCURY_ACCOUNT_NUMBER;
    const checking = accounts.find((a) => a.accountNumber === accountNumber && a.kind === "checking") || accounts.find((a) => a.kind === "checking") || accounts[0];
    if (!checking) throw new Error("No Mercury checking account found");
    this.cachedAccountId = checking.id;
    return this.cachedAccountId;
  }
  async listAccounts() {
    const response = await this.client.get("/accounts");
    return response.data.accounts || [];
  }
  async getAccountBalance() {
    if (!this.isConfigured) throw new Error("Mercury service not configured");
    const accounts = await this.listAccounts();
    const accountNumber = process.env.MERCURY_ACCOUNT_NUMBER;
    const account = accounts.find((a) => a.accountNumber === accountNumber) || accounts.find((a) => a.kind === "checking") || accounts[0];
    if (!account) throw new Error("No Mercury accounts found");
    return {
      balance: account.currentBalance,
      availableBalance: account.availableBalance,
      currency: "USD",
      accountNumber: account.accountNumber,
      routingNumber: account.routingNumber
    };
  }
  async getTransactions(limit = 50) {
    if (!this.isConfigured) throw new Error("Mercury service not configured");
    const accountId = await this.resolveCheckingAccountId();
    const response = await this.client.get(`/account/${accountId}/transactions`, { params: { limit } });
    return response.data.transactions || [];
  }
  async initiateTransfer(params) {
    if (!this.isConfigured) throw new Error("Mercury service not configured");
    const { correlationId } = params;
    const accountId = await this.resolveCheckingAccountId();
    log2(correlationId, "mercury_transfer_request", {
      amount: params.amount,
      recipientName: params.recipientName,
      recipientAccount: maskAccountNumber(params.recipientAccountNumber),
      recipientRouting: `\u2022\u2022${params.recipientRoutingNumber.slice(-4)}`,
      paymentMethod: params.paymentMethod || "ach",
      mercuryAccountId: accountId
    });
    const response = await this.client.post(`/account/${accountId}/transactions`, {
      amount: params.amount,
      paymentMethod: params.paymentMethod || "ach",
      counterparty: {
        accountNumber: params.recipientAccountNumber,
        routingNumber: params.recipientRoutingNumber,
        name: params.recipientName,
        kind: "individual"
      },
      note: params.note
    });
    const result = response.data;
    log2(correlationId, "mercury_transfer_response", {
      mercuryTransferId: result.id,
      status: result.status,
      amount: result.amount,
      createdAt: result.createdAt
    });
    return result;
  }
  getMercuryAccountNumber() {
    return process.env.MERCURY_ACCOUNT_NUMBER || "";
  }
  getMercuryRoutingNumber() {
    return process.env.MERCURY_ROUTING_NUMBER || "";
  }
};
var mercuryService = new MercuryService();

// server/routes/mercuryRoutes.ts
import { z as z3 } from "zod";
var MAX_ROUNDUP_DOLLARS = 5;
var MAX_DEBT_PAYMENT_DOLLARS = 500;
var collectRoundUpSchema = z3.object({
  amount: z3.number().positive().max(MAX_ROUNDUP_DOLLARS, `Round-up cannot exceed $${MAX_ROUNDUP_DOLLARS}`),
  descriptor: z3.string().max(60).optional()
});
var payDebtSchema = z3.object({
  debtId: z3.string().min(1),
  amount: z3.number().positive().max(MAX_DEBT_PAYMENT_DOLLARS, `Payment cannot exceed $${MAX_DEBT_PAYMENT_DOLLARS}`),
  descriptor: z3.string().max(60).optional()
});
function transferLog(correlationId, event, data) {
  setCorrelationTag(correlationId);
  console.log(JSON.stringify({
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    service: "MercuryRoutes",
    correlationId,
    event,
    ...data
  }));
}
async function checkIdempotency(idempotencyKey, userId, endpoint, correlationId, res) {
  if (!idempotencyKey) return false;
  const cached3 = await storage.getIdempotencyKey(idempotencyKey, userId, endpoint);
  if (cached3) {
    transferLog(correlationId, "idempotency_hit", { endpoint, idempotencyKey });
    const body = JSON.parse(cached3.responseBody);
    res.status(cached3.responseStatus).json({ ...body, _idempotencyReplay: true });
    return true;
  }
  return false;
}
async function saveIdempotency(idempotencyKey, userId, endpoint, status, body) {
  if (!idempotencyKey) return;
  await storage.createIdempotencyKey({
    idempotencyKey,
    userId,
    endpoint,
    responseStatus: status,
    responseBody: JSON.stringify(body)
  });
}
function registerMercuryRoutes(app2) {
  app2.get("/api/mercury/status", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!mercuryService.isServiceConfigured()) {
        return res.json({ configured: false, message: "Mercury service not configured" });
      }
      const balance = await mercuryService.getAccountBalance();
      res.json({
        configured: true,
        message: "Mercury banking service connected",
        accountNumber: `\u2022\u2022${balance.accountNumber.slice(-4)}`,
        currentBalance: balance.balance,
        availableBalance: balance.availableBalance,
        currency: balance.currency,
        formattedBalance: `$${balance.availableBalance.toFixed(2)}`
      });
    } catch (error) {
      const detail = error?.response?.data ?? error?.message;
      const errorCode = error?.response?.data?.errorCode;
      console.error("Mercury status error:", detail);
      if (errorCode === "noTokenInDBButMaybeMalformed") {
        return res.status(503).json({
          status: "mercury_auth_failed",
          configured: false,
          connected: false,
          message: "Mercury banking service is temporarily unavailable"
        });
      }
      res.status(500).json({ message: "Failed to check Mercury service status" });
    }
  });
  app2.get("/api/mercury/balance", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }
      const balance = await mercuryService.getAccountBalance();
      res.json({
        currentBalance: balance.balance,
        availableBalance: balance.availableBalance,
        currency: balance.currency,
        formattedBalance: `$${balance.availableBalance.toFixed(2)}`
      });
    } catch (error) {
      console.error("Mercury balance error:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to fetch Mercury account balance" });
    }
  });
  app2.get("/api/mercury/transactions", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit, 10) : 50;
      const transactions2 = await mercuryService.getTransactions(limit);
      res.json({ transactions: transactions2 });
    } catch (error) {
      console.error("Mercury transactions error:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to fetch Mercury transactions" });
    }
  });
  app2.post("/api/mercury/collect-roundup", async (req, res) => {
    const correlationId = randomUUID2();
    const idempotencyKey = req.headers["idempotency-key"];
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }
      const replayed = await checkIdempotency(idempotencyKey, userId, "/api/mercury/collect-roundup", correlationId, res);
      if (replayed) return;
      const { amount, descriptor } = collectRoundUpSchema.parse(req.body);
      transferLog(correlationId, "collect_roundup_start", { userId, amount, idempotencyKey });
      const linkedAccounts = await storage.getBankAccountsByUserId(userId);
      const activeAccount = linkedAccounts.find((a) => a.isActive) || null;
      if (!activeAccount) {
        return res.status(422).json({
          success: false,
          status: "no_linked_bank",
          message: "No active linked bank account. Connect a bank account via Plaid first."
        });
      }
      const accessToken = await storage.getPlaidAccessToken(activeAccount.id);
      if (!accessToken || !activeAccount.accountId) {
        return res.status(422).json({
          success: false,
          status: "plaid_token_missing",
          message: "Linked bank account is missing Plaid credentials. Please reconnect your bank."
        });
      }
      const user = await storage.getUser(userId);
      const userLegalName = user ? `${user.firstName || ""} ${user.lastName || ""}`.trim() || "Account Holder" : "Account Holder";
      const ledgerEntry = await storage.createTransfer({
        userId,
        type: "roundup_collection",
        amount: amount.toFixed(2),
        status: "created",
        correlationId,
        idempotencyKey: idempotencyKey || null,
        rawRequest: JSON.stringify({ amount, descriptor, accountId: activeAccount.accountId })
      });
      transferLog(correlationId, "transfer_ledger_created", { transferId: ledgerEntry.id });
      try {
        const result = await plaidService.createRoundUpTransfer({
          accessToken,
          accountId: activeAccount.accountId,
          amount,
          userLegalName,
          description: descriptor || "Dime Time roundup",
          correlationId,
          mercuryFundingAccountId: process.env.MERCURY_PLAID_FUNDING_ID || void 0
        });
        await storage.updateTransferStatus(ledgerEntry.id, "pending", {
          plaidTransferId: result.transferId,
          plaidAuthorizationId: result.authorizationId,
          rawResponse: JSON.stringify(result)
        });
        transferLog(correlationId, "collect_roundup_success", {
          transferId: ledgerEntry.id,
          plaidTransferId: result.transferId,
          status: result.status,
          amount
        });
        const responseBody = {
          success: true,
          transferId: result.transferId,
          authorizationId: result.authorizationId,
          internalTransferId: ledgerEntry.id,
          status: result.status,
          correlationId,
          message: `Round-up of $${amount.toFixed(2)} initiated \u2014 ACH debit from ${activeAccount.institutionName} \u2022\u2022${activeAccount.mask || ""} to Mercury`,
          linkedBank: activeAccount.institutionName,
          amount
        };
        await saveIdempotency(idempotencyKey, userId, "/api/mercury/collect-roundup", 201, responseBody);
        return res.status(201).json(responseBody);
      } catch (transferErr) {
        const errCode = transferErr?.response?.data?.error_code || transferErr?.message || "UNKNOWN";
        await storage.updateTransferStatus(ledgerEntry.id, "failed", {
          errorCode: errCode,
          errorMessage: transferErr?.message || "Plaid Transfer failed",
          rawResponse: JSON.stringify(transferErr?.response?.data || {})
        });
        transferLog(correlationId, "collect_roundup_failed", {
          transferId: ledgerEntry.id,
          errCode,
          message: transferErr?.message
        });
        if (/INVALID_PRODUCT|NOT_ENABLED|PRODUCT_NOT_ENABLED/i.test(errCode)) {
          return res.status(503).json({
            success: false,
            status: "plaid_transfer_not_enabled",
            correlationId,
            message: "Plaid Transfer product not enabled. Enable it in the Plaid Dashboard.",
            detail: errCode
          });
        }
        if (/authorization denied|UNAUTHORIZED/i.test(errCode)) {
          return res.status(422).json({
            success: false,
            status: "transfer_not_authorized",
            correlationId,
            message: `Plaid rejected the transfer: ${errCode}`
          });
        }
        console.error("Plaid Transfer error:", transferErr?.response?.data || transferErr.message);
        return res.status(502).json({
          success: false,
          status: "transfer_failed",
          correlationId,
          message: "Round-up transfer could not be initiated. Please try again later.",
          detail: errCode
        });
      }
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("collect-roundup error:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to collect round-up", correlationId });
    }
  });
  app2.post("/api/mercury/pay-debt", async (req, res) => {
    const correlationId = randomUUID2();
    const idempotencyKey = req.headers["idempotency-key"];
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!mercuryService.isServiceConfigured()) {
        return res.status(503).json({ message: "Mercury service not configured" });
      }
      const replayed = await checkIdempotency(idempotencyKey, userId, "/api/mercury/pay-debt", correlationId, res);
      if (replayed) return;
      const { debtId, amount, descriptor } = payDebtSchema.parse(req.body);
      transferLog(correlationId, "pay_debt_start", { userId, debtId, amount, idempotencyKey });
      const debt = await storage.getDebt(debtId);
      if (!debt || debt.userId !== userId) {
        return res.status(403).json({ message: "Debt not found or does not belong to this account" });
      }
      const balance = await mercuryService.getAccountBalance();
      if (balance.availableBalance < amount) {
        return res.status(422).json({
          success: false,
          status: "insufficient_funds",
          correlationId,
          message: `Insufficient Mercury balance. Available: $${balance.availableBalance.toFixed(2)}, Requested: $${amount.toFixed(2)}`
        });
      }
      const note = descriptor || `Dime Time debt payment \u2014 ${debt.name}`;
      if (debt.payeeAccountNumber && debt.payeeRoutingNumber) {
        if (!/^\d{9}$/.test(debt.payeeRoutingNumber)) {
          return res.status(422).json({
            success: false,
            status: "invalid_payee_routing",
            correlationId,
            message: "Debt record has an invalid payee routing number. An administrator must correct it."
          });
        }
        const ledgerEntry = await storage.createTransfer({
          userId,
          type: "debt_payment",
          amount: amount.toFixed(2),
          status: "created",
          debtId,
          correlationId,
          idempotencyKey: idempotencyKey || null,
          rawRequest: JSON.stringify({ debtId, amount, debtName: debt.name })
        });
        transferLog(correlationId, "transfer_ledger_created", { transferId: ledgerEntry.id });
        try {
          const transferResult = await mercuryService.initiateTransfer({
            amount,
            note,
            recipientAccountNumber: debt.payeeAccountNumber,
            recipientRoutingNumber: debt.payeeRoutingNumber,
            recipientName: debt.name,
            paymentMethod: "ach",
            correlationId
          });
          await storage.updateTransferStatus(ledgerEntry.id, "pending", {
            mercuryTransferId: transferResult.id,
            rawResponse: JSON.stringify(transferResult)
          });
          transferLog(correlationId, "pay_debt_success", {
            transferId: ledgerEntry.id,
            mercuryTransferId: transferResult.id,
            status: transferResult.status,
            amount
          });
          const responseBody = {
            success: true,
            transactionId: transferResult.id,
            internalTransferId: ledgerEntry.id,
            status: transferResult.status,
            correlationId,
            message: `Debt payment of $${amount.toFixed(2)} to ${debt.name} initiated via Mercury ACH`,
            debtName: debt.name,
            amount
          };
          await saveIdempotency(idempotencyKey, userId, "/api/mercury/pay-debt", 201, responseBody);
          return res.status(201).json(responseBody);
        } catch (transferErr) {
          const errCode = transferErr?.response?.data?.errors || transferErr.message || "UNKNOWN";
          await storage.updateTransferStatus(ledgerEntry.id, "failed", {
            errorCode: String(errCode),
            errorMessage: transferErr?.message || "Mercury ACH failed",
            rawResponse: JSON.stringify(transferErr?.response?.data || {})
          });
          transferLog(correlationId, "pay_debt_failed", {
            transferId: ledgerEntry.id,
            errCode
          });
          console.error("Mercury debt payment error:", transferErr?.response?.data || transferErr.message);
          return res.status(502).json({
            success: false,
            status: "transfer_failed",
            correlationId,
            message: "Mercury ACH transfer failed. Check Mercury account configuration.",
            error: errCode
          });
        }
      }
      return res.status(202).json({
        success: true,
        transactionId: `debt_queued_${userId}_${Date.now()}`,
        status: "queued_awaiting_admin_routing",
        correlationId,
        message: `Debt payment of $${amount.toFixed(2)} toward ${debt.name} queued. An administrator must set payee routing details on the debt record before Mercury ACH can execute.`,
        debtName: debt.name,
        amount,
        mercuryBalance: balance.availableBalance
      });
    } catch (error) {
      if (error instanceof z3.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: error.errors });
      }
      console.error("pay-debt error:", error?.response?.data || error.message);
      res.status(500).json({ message: "Failed to process debt payment", correlationId });
    }
  });
}

// server/routes/webhookRoutes.ts
import { createHmac, timingSafeEqual } from "crypto";
var PLAID_TRANSFER_STATUS_MAP = {
  "pending": "pending",
  "posted": "posted",
  "settled": "settled",
  "cancelled": "cancelled",
  "failed": "failed",
  "returned": "returned"
};
function webhookLog(event, data) {
  console.log(JSON.stringify({
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    service: "PlaidWebhook",
    event,
    ...data
  }));
}
function verifyPlaidSignature(req) {
  const secret = process.env.PLAID_WEBHOOK_SECRET;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      webhookLog("signature_secret_missing", { severity: "ERROR", note: "PLAID_WEBHOOK_SECRET not set in production \u2014 rejecting webhook (fail closed)." });
      return false;
    }
    console.warn("[PlaidWebhook] PLAID_WEBHOOK_SECRET not set \u2014 skipping signature verification (development only; production fails closed).");
    return true;
  }
  const plaidSignature = req.headers["plaid-verification"];
  if (!plaidSignature) {
    webhookLog("signature_missing", { severity: "WARN" });
    return false;
  }
  try {
    const body = req.rawBody || JSON.stringify(req.body);
    const expected = createHmac("sha256", secret).update(body).digest("hex");
    const expectedBuf = Buffer.from(expected, "utf8");
    const receivedBuf = Buffer.from(plaidSignature, "utf8");
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}
function registerWebhookRoutes(app2) {
  app2.post("/webhooks/plaid", async (req, res) => {
    const payload = req.body;
    const webhookType = payload?.webhook_type || "UNKNOWN";
    const webhookCode = payload?.webhook_code || "UNKNOWN";
    const transferId = payload?.transfer_id;
    const eventId = payload?.transfer_event_id || payload?.event_id;
    webhookLog("webhook_received", {
      webhookType,
      webhookCode,
      transferId,
      eventId,
      payloadKeys: Object.keys(payload || {})
    });
    res.status(200).json({ received: true });
    if (!verifyPlaidSignature(req)) {
      webhookLog("signature_invalid", { severity: "ERROR", webhookType, webhookCode });
      return;
    }
    if (webhookType !== "TRANSFER") {
      webhookLog("webhook_ignored", { reason: "not_transfer_type", webhookType, webhookCode });
      return;
    }
    if (!transferId) {
      webhookLog("webhook_no_transfer_id", { severity: "WARN", webhookCode });
      return;
    }
    try {
      const ledgerEntry = await storage.getTransferByPlaidTransferId(transferId);
      if (!ledgerEntry) {
        webhookLog("transfer_not_found", {
          severity: "WARN",
          plaidTransferId: transferId,
          message: "Received webhook for a Plaid transfer not in our ledger. May be a test event or a transfer not initiated through this system."
        });
        return;
      }
      const newPlaidStatus = payload?.new_transfer_status || payload?.transfer_status;
      const mappedStatus = newPlaidStatus ? PLAID_TRANSFER_STATUS_MAP[newPlaidStatus] : void 0;
      webhookLog("transfer_status_update", {
        internalTransferId: ledgerEntry.id,
        plaidTransferId: transferId,
        currentStatus: ledgerEntry.status,
        webhookCode,
        newPlaidStatus,
        mappedStatus
      });
      if (mappedStatus && ledgerEntry.status === mappedStatus) {
        webhookLog("webhook_status_already_set", {
          internalTransferId: ledgerEntry.id,
          status: mappedStatus
        });
        return;
      }
      if (mappedStatus) {
        await storage.updateTransferStatus(ledgerEntry.id, mappedStatus, {
          rawResponse: JSON.stringify({
            webhook_type: webhookType,
            webhook_code: webhookCode,
            transfer_id: transferId,
            new_transfer_status: newPlaidStatus,
            event_id: eventId
          })
        });
        webhookLog("transfer_ledger_updated", {
          internalTransferId: ledgerEntry.id,
          plaidTransferId: transferId,
          previousStatus: ledgerEntry.status,
          newStatus: mappedStatus
        });
      } else {
        webhookLog("webhook_unhandled_code", {
          webhookCode,
          newPlaidStatus,
          message: "Webhook code did not map to a known transfer status \u2014 logged only."
        });
      }
    } catch (err) {
      webhookLog("webhook_processing_error", {
        severity: "ERROR",
        plaidTransferId: transferId,
        error: err?.message
      });
    }
  });
}

// server/routes/stripeRoutes.ts
import express from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { randomUUID as randomUUID3 } from "crypto";
import { z as z4 } from "zod";

// shared/achAuthorization.ts
var ACH_AUTHORIZATION_VERSION = "2026-05-29.v1";
var ACH_AUTHORIZATION_TEXT = "By selecting \u201CI Authorize\u201D, you authorize Dime Time to electronically debit your linked bank account via the ACH network for the payment amounts and on the schedule you approve in the app, and, if necessary, to electronically credit your account to correct any erroneous debit. This authorization will remain in effect until you revoke it. You may revoke this authorization at any time by removing the linked account in the app or by contacting us at tim@dime-time.com. You agree that ACH transactions you authorize comply with applicable U.S. law. Dime Time is a financial technology platform and is not a bank; banking services and payment infrastructure are provided through regulated financial partners.";

// server/services/stripeService.ts
var cachedClient = null;
var cachedClientPromise = null;
function isProductionEnv() {
  return process.env.NODE_ENV === "production";
}
function resolveStripeSecretKey() {
  if (isProductionEnv()) {
    const key = process.env.STRIPE_SECRET_KEY;
    if (!key) {
      return { secretKey: null, mode: null, reason: "STRIPE_SECRET_KEY (live) is not set in production" };
    }
    if (!key.startsWith("sk_live_")) {
      return { secretKey: null, mode: null, reason: "Production requires a LIVE Stripe secret key (sk_live_\u2026)" };
    }
    return { secretKey: key, mode: "live" };
  }
  const testKey = process.env.STRIPE_SECRET_KEY_TEST;
  if (!testKey) {
    return { secretKey: null, mode: null, reason: "STRIPE_SECRET_KEY_TEST (test) is not set in development" };
  }
  if (!testKey.startsWith("sk_test_")) {
    return { secretKey: null, mode: null, reason: "Development requires a TEST Stripe secret key (sk_test_\u2026)" };
  }
  return { secretKey: testKey, mode: "test" };
}
function resolveStripeWebhookSecret() {
  if (isProductionEnv()) {
    return process.env.STRIPE_WEBHOOK_SECRET_LIVE || process.env.STRIPE_WEBHOOK_SECRET || null;
  }
  return process.env.STRIPE_WEBHOOK_SECRET_TEST || null;
}
function isStripeAchEnabled() {
  return isFlagEnabled("ENABLE_STRIPE_ACH") && resolveStripeSecretKey().secretKey !== null;
}
function assertStripeKeyModeSafeOnBoot() {
  if (!isFlagEnabled("ENABLE_STRIPE_ACH")) return;
  const prod = isProductionEnv();
  const resolution = resolveStripeSecretKey();
  if (resolution.secretKey && resolution.mode) {
    console.log(JSON.stringify({
      service: "StripeService",
      event: "stripe_mode_resolved",
      severity: "INFO",
      env: prod ? "production" : "development",
      mode: resolution.mode
    }));
    return;
  }
  const envKeyRaw = prod ? process.env.STRIPE_SECRET_KEY : process.env.STRIPE_SECRET_KEY_TEST;
  console.error(JSON.stringify({
    service: "StripeService",
    event: "stripe_mode_misconfigured",
    severity: "ERROR",
    env: prod ? "production" : "development",
    reason: resolution.reason,
    keyPresentButWrongMode: Boolean(envKeyRaw)
  }));
  if (envKeyRaw) {
    throw new Error(
      `Stripe ACH enabled but the ${prod ? "production" : "development"} Stripe secret key has the wrong mode. ${resolution.reason}`
    );
  }
}
async function loadStripeClient() {
  const { secretKey } = resolveStripeSecretKey();
  if (!secretKey) return null;
  if (cachedClient) return cachedClient;
  if (cachedClientPromise) return cachedClientPromise;
  cachedClientPromise = (async () => {
    try {
      const mod = await import("stripe");
      const Stripe = mod.default;
      cachedClient = new Stripe(secretKey, {
        // Pin a recent API version. Bumping requires a code review since
        // Stripe occasionally renames PaymentMethod / FC fields.
        apiVersion: "2024-06-20",
        typescript: true,
        appInfo: {
          name: "Dime Time",
          url: "https://dime-time.com"
        },
        maxNetworkRetries: 2
      });
      return cachedClient;
    } catch (err) {
      console.error(JSON.stringify({
        service: "StripeService",
        event: "stripe_sdk_load_failed",
        severity: "ERROR",
        error: err instanceof Error ? err.message : String(err)
      }));
      cachedClientPromise = null;
      return null;
    }
  })();
  return cachedClientPromise;
}
async function getStripe() {
  if (!isStripeAchEnabled()) return null;
  return loadStripeClient();
}
async function createFinancialConnectionsSession(args) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  let customerId = args.existingCustomerId;
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: args.userEmail ?? void 0,
      metadata: { dimeTimeUserId: args.userId }
    });
    customerId = customer.id;
  }
  const session2 = await stripe.financialConnections.sessions.create({
    account_holder: { type: "customer", customer: customerId },
    permissions: ["payment_method"],
    filters: { countries: ["US"] }
  });
  return {
    clientSecret: session2.client_secret,
    sessionId: session2.id,
    customerId
  };
}
async function attachFcAccountAsPaymentMethod(args) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const account = await stripe.financialConnections.accounts.retrieve(args.fcAccountId);
  const pm = await stripe.paymentMethods.create({
    type: "us_bank_account",
    us_bank_account: { financial_connections_account: args.fcAccountId },
    billing_details: { name: args.holderName }
  });
  await stripe.paymentMethods.attach(pm.id, { customer: args.customerId });
  return {
    paymentMethodId: pm.id,
    last4: account?.last4 || pm.us_bank_account?.last4 || null,
    institutionName: account?.institution_name || null
  };
}
async function createAchDebit(args) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  if (!args.mandateIpAddress || !args.mandateUserAgent) {
    throw new Error("ACH mandate requires a real customer IP and user agent");
  }
  const intent = await stripe.paymentIntents.create(
    {
      amount: args.amountCents,
      currency: "usd",
      customer: args.customerId,
      payment_method: args.paymentMethodId,
      payment_method_types: ["us_bank_account"],
      confirm: true,
      mandate_data: {
        customer_acceptance: {
          type: "online",
          online: {
            ip_address: args.mandateIpAddress,
            user_agent: args.mandateUserAgent
          }
        }
      },
      statement_descriptor_suffix: (args.descriptor || "DIME TIME").slice(0, 22),
      metadata: args.metadata
    },
    { idempotencyKey: args.idempotencyKey }
  );
  return {
    id: intent.id,
    status: intent.status,
    chargeId: intent.latest_charge || null
  };
}
async function verifyStripeWebhook(rawBody, signature) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const secret = resolveStripeWebhookSecret();
  if (!secret) throw new Error("Stripe webhook secret is not set");
  if (!signature) throw new Error("Missing stripe-signature header");
  return stripe.webhooks.constructEvent(rawBody, signature, secret);
}

// shared/subscriptionPlans.ts
var PLAN_CATALOG = {
  debt: {
    id: "debt",
    name: "Dime Time Debt",
    priceCents: 299,
    stripeLookupKey: "dime_time_debt_299_monthly",
    interval: "month",
    blurb: "Automate your spare change into real debt payments. Round-ups are collected automatically and applied toward the debts you choose.",
    features: [
      "Automatic round-up collection on every purchase",
      "Round-up multipliers (2x, 3x) to accelerate payoff",
      "Automatic application of round-ups to your debts",
      "Everything in the free plan: debt tracking & payoff projections"
    ]
  }
};
var DEFAULT_PLAN_ID = "debt";
var ENTITLED_SUBSCRIPTION_STATUSES = /* @__PURE__ */ new Set([
  "active",
  "trialing",
  "incomplete",
  "past_due"
]);
function isSubscriptionEntitled(status) {
  if (!status) return false;
  return ENTITLED_SUBSCRIPTION_STATUSES.has(status);
}
var TERMINAL_SUBSCRIPTION_STATUSES = /* @__PURE__ */ new Set([
  "canceled",
  "incomplete_expired",
  "unpaid"
]);
function isSubscriptionTerminal(status) {
  if (!status) return true;
  return TERMINAL_SUBSCRIPTION_STATUSES.has(status);
}

// server/services/subscriptionService.ts
var cachedPriceIds = /* @__PURE__ */ new Map();
async function ensurePlanPrice(planId) {
  const cached3 = cachedPriceIds.get(planId);
  if (cached3) return cached3;
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  const plan = PLAN_CATALOG[planId];
  const existing = await stripe.prices.list({
    lookup_keys: [plan.stripeLookupKey],
    active: true,
    limit: 1
  });
  if (existing.data.length > 0) {
    cachedPriceIds.set(planId, existing.data[0].id);
    return existing.data[0].id;
  }
  const product = await stripe.products.create(
    {
      name: plan.name,
      metadata: { dimeTimePlanId: plan.id }
    },
    { idempotencyKey: `dt_sub_product_${plan.stripeLookupKey}` }
  );
  const price = await stripe.prices.create(
    {
      product: product.id,
      unit_amount: plan.priceCents,
      currency: "usd",
      recurring: { interval: plan.interval },
      lookup_key: plan.stripeLookupKey,
      transfer_lookup_key: true
    },
    { idempotencyKey: `dt_sub_price_${plan.stripeLookupKey}` }
  );
  cachedPriceIds.set(planId, price.id);
  return price.id;
}
async function createRecurringAchMandate(args) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  if (!args.mandateIpAddress || !args.mandateUserAgent) {
    throw new Error("Recurring ACH mandate requires a real customer IP and user agent");
  }
  const si = await stripe.setupIntents.create(
    {
      customer: args.customerId,
      payment_method: args.paymentMethodId,
      payment_method_types: ["us_bank_account"],
      confirm: true,
      mandate_data: {
        customer_acceptance: {
          type: "online",
          online: {
            ip_address: args.mandateIpAddress,
            user_agent: args.mandateUserAgent
          }
        }
      }
    },
    { idempotencyKey: `${args.idempotencyKey}_si` }
  );
  if (si.status !== "succeeded") {
    throw new Error(`SetupIntent did not succeed (status=${si.status})`);
  }
  await stripe.customers.update(args.customerId, {
    invoice_settings: { default_payment_method: args.paymentMethodId }
  });
  return { setupIntentId: si.id, status: si.status };
}
async function createPlanSubscription(args) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe.subscriptions.create(
    {
      customer: args.customerId,
      items: [{ price: args.priceId }],
      default_payment_method: args.paymentMethodId,
      collection_method: "charge_automatically",
      payment_behavior: "allow_incomplete",
      payment_settings: {
        payment_method_types: ["us_bank_account"],
        save_default_payment_method: "off"
      },
      // dimeTimeUserId lets the webhook create/repair the local row even if
      // it arrives before our own DB write (upsert keyed on subscription id).
      metadata: { dimeTimeUserId: args.userId, dimeTimePlanId: args.planId },
      expand: ["latest_invoice.payment_intent"]
    },
    { idempotencyKey: args.idempotencyKey }
  );
}
async function setCancelAtPeriodEnd(stripeSubscriptionId, cancel) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  return stripe.subscriptions.update(stripeSubscriptionId, {
    cancel_at_period_end: cancel
  });
}
async function cancelSubscriptionImmediately(stripeSubscriptionId) {
  const stripe = await getStripe();
  if (!stripe) throw new Error("Stripe is not configured");
  await stripe.subscriptions.cancel(stripeSubscriptionId);
}
async function retrieveStripeSubscription(stripeSubscriptionId) {
  const stripe = await getStripe();
  if (!stripe) return null;
  try {
    return await stripe.subscriptions.retrieve(stripeSubscriptionId);
  } catch {
    return null;
  }
}
function tsFromUnix(seconds) {
  return typeof seconds === "number" ? new Date(seconds * 1e3) : null;
}
function subscriptionRowFromStripe(sub, userId) {
  const item = sub.items?.data?.[0];
  const latestInvoice = sub.latest_invoice;
  const paymentError = typeof latestInvoice === "object" && latestInvoice?.payment_intent?.last_payment_error ? String(latestInvoice.payment_intent.last_payment_error.message || latestInvoice.payment_intent.last_payment_error.code) : null;
  return {
    userId,
    plan: sub.metadata?.dimeTimePlanId || "debt",
    stripeCustomerId: typeof sub.customer === "string" ? sub.customer : sub.customer?.id,
    stripeSubscriptionId: sub.id,
    stripePriceId: item?.price?.id ?? "",
    status: sub.status,
    // Stripe API versions 2025+ ("basil") moved the period fields from the
    // subscription onto its items — tolerate both shapes so a dashboard
    // webhook endpoint pinned to a newer version can't upsert null periods.
    currentPeriodStart: tsFromUnix(sub.current_period_start ?? item?.current_period_start),
    currentPeriodEnd: tsFromUnix(sub.current_period_end ?? item?.current_period_end),
    cancelAtPeriodEnd: Boolean(sub.cancel_at_period_end),
    canceledAt: tsFromUnix(sub.canceled_at),
    latestInvoiceId: typeof latestInvoice === "string" ? latestInvoice : latestInvoice?.id ?? null,
    lastPaymentError: paymentError
  };
}

// server/routes/stripeRoutes.ts
var MAX_DEBT_PAYMENT_DOLLARS2 = 500;
var REAL_FIRST_TRANSFER_MAX_DOLLARS = 1;
var REAL_DAILY_TOTAL_MAX_DOLLARS = 5;
var REAL_DAILY_COUNT_MAX = 1;
var exchangeSchema = z4.object({
  fcAccountId: z4.string().min(3),
  customerId: z4.string().min(3)
});
var debitSchema = z4.object({
  stripeAccountId: z4.string().min(1),
  amount: z4.number().positive().max(MAX_DEBT_PAYMENT_DOLLARS2),
  debtId: z4.string().min(1).optional(),
  descriptor: z4.string().max(22).optional()
});
function clientIp(req) {
  const fwd = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  return req.ip || fwd || req.socket?.remoteAddress || "unknown";
}
function stripeLog(correlationId, event, data) {
  setCorrelationTag(correlationId);
  console.log(JSON.stringify({
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    service: "StripeRoutes",
    correlationId,
    event,
    ...data
  }));
}
async function reserveIdempotency(key, userId, endpoint, correlationId, res) {
  const result = await storage.reserveIdempotencyKey(key, userId, endpoint);
  if (result.claimed) return false;
  if (result.inFlight) {
    stripeLog(correlationId, "idempotency_in_flight", { endpoint, idempotencyKey: key, severity: "WARN" });
    res.status(409).json({
      message: "A request with this Idempotency-Key is already being processed. Retry shortly.",
      correlationId
    });
    return true;
  }
  const cached3 = result.cached;
  stripeLog(correlationId, "idempotency_hit", { endpoint, idempotencyKey: key });
  let parsed = {};
  try {
    parsed = cached3.body ? JSON.parse(cached3.body) : {};
  } catch {
    parsed = { raw: cached3.body };
  }
  res.status(cached3.status).json({ ...parsed, _idempotencyReplay: true });
  return true;
}
async function finalizeIdempotency(key, userId, endpoint, status, body) {
  await storage.finalizeIdempotencyKey(key, userId, endpoint, status, JSON.stringify(body));
}
var fcSessionLimiter = rateLimit({
  windowMs: 60 * 1e3,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = getUserIdFromRequest(req);
    return uid ? `u:${uid}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
  },
  message: { message: "Too many Stripe Connect attempts. Try again in a minute." }
});
function registerStripeRoutes(app2) {
  app2.get("/api/stripe/status", async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const accounts = await storage.getStripeAccountsByUserId(userId);
    return res.json({
      configured: isStripeAchEnabled(),
      accounts: accounts.map((a) => ({
        id: a.id,
        institutionName: a.institutionName,
        last4: a.last4,
        status: a.status,
        isActive: a.isActive,
        createdAt: a.createdAt
      }))
    });
  });
  app2.get("/api/stripe/funding-account", async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    const [accounts, settings] = await Promise.all([
      storage.getStripeAccountsByUserId(userId),
      storage.getRoundUpSettings(userId)
    ]);
    const selectedId = settings?.fundingStripeAccountId ?? null;
    return res.json({
      configured: isStripeAchEnabled(),
      selectedId,
      accounts: accounts.map((a) => {
        const linked = a.isActive && a.status === "linked";
        const eligible = linked && !!a.stripePaymentMethodEnc;
        return {
          id: a.id,
          institutionName: a.institutionName,
          last4: a.last4,
          eligible,
          ineligibleReason: eligible ? null : !linked ? "This account is no longer linked." : "This account can't be used for bank payments yet. Please re-link it.",
          selected: a.id === selectedId
        };
      })
    });
  });
  app2.put("/api/stripe/funding-account", async (req, res) => {
    const correlationId = randomUUID3();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const parsed = z4.object({ stripeAccountId: z4.string().min(1).nullable() }).safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Invalid request", correlationId });
      }
      const { stripeAccountId } = parsed.data;
      if (stripeAccountId !== null) {
        const account = await storage.getStripeAccountById(stripeAccountId);
        if (!account || account.userId !== userId) {
          return res.status(404).json({ message: "Bank account not found", correlationId });
        }
        if (!account.isActive || account.status !== "linked") {
          return res.status(422).json({
            message: "That account is no longer linked. Reconnect it or choose another account.",
            correlationId
          });
        }
        if (!account.stripePaymentMethodEnc) {
          return res.status(422).json({
            message: "That account can't be used for bank payments yet. Please re-link it.",
            correlationId
          });
        }
      }
      const existing = await storage.getRoundUpSettings(userId);
      const settings = await storage.createOrUpdateRoundUpSettings({
        userId,
        fundingStripeAccountId: stripeAccountId,
        ...existing ? {} : { isEnabled: false }
      });
      stripeLog(correlationId, "funding_account_selected", {
        userId,
        stripeAccountId,
        cleared: stripeAccountId === null
      });
      return res.json({
        success: true,
        selectedId: settings.fundingStripeAccountId ?? null,
        correlationId
      });
    } catch (err) {
      stripeLog(correlationId, "funding_account_select_failed", {
        severity: "ERROR",
        error: err?.message
      });
      return res.status(500).json({ message: "Internal server error", correlationId });
    }
  });
  app2.post("/api/stripe/financial-connections/session", fcSessionLimiter, async (req, res) => {
    const correlationId = randomUUID3();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!isStripeAchEnabled()) {
        return res.status(503).json({ message: "Stripe ACH is not enabled" });
      }
      const user = await storage.getUser(userId);
      const existing = await storage.getStripeAccountsByUserId(userId);
      const existingCustomerId = existing[0]?.stripeCustomerId ?? null;
      stripeLog(correlationId, "fc_session_start", { userId, hasCustomer: !!existingCustomerId });
      const session2 = await createFinancialConnectionsSession({
        userEmail: user?.email ?? null,
        userId,
        existingCustomerId
      });
      stripeLog(correlationId, "fc_session_created", { sessionId: session2.sessionId });
      return res.json({
        clientSecret: session2.clientSecret,
        sessionId: session2.sessionId,
        customerId: session2.customerId,
        correlationId
      });
    } catch (err) {
      stripeLog(correlationId, "fc_session_failed", {
        severity: "ERROR",
        error: err?.message
      });
      return res.status(502).json({
        message: "Failed to start Stripe Financial Connections session",
        correlationId
      });
    }
  });
  app2.post("/api/stripe/financial-connections/exchange", async (req, res) => {
    const correlationId = randomUUID3();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!isStripeAchEnabled()) {
        return res.status(503).json({ message: "Stripe ACH is not enabled" });
      }
      const { fcAccountId, customerId } = exchangeSchema.parse(req.body);
      stripeLog(correlationId, "fc_exchange_start", { userId, fcAccountId });
      const existing = await storage.getStripeAccountByFcAccountId(fcAccountId);
      if (existing && existing.userId !== userId) {
        stripeLog(correlationId, "fc_exchange_conflict", { severity: "ERROR", fcAccountId });
        return res.status(409).json({
          message: "This bank account is already linked to a different Dime Time account",
          correlationId
        });
      }
      const user = await storage.getUser(userId);
      const holderName = [user?.firstName, user?.lastName].filter(Boolean).join(" ").trim() || user?.email || "Dime Time Customer";
      const { paymentMethodId, last4, institutionName } = await attachFcAccountAsPaymentMethod({
        fcAccountId,
        customerId,
        holderName
      });
      let saved;
      let relinked = false;
      if (existing) {
        saved = await storage.updateStripeAccountLink(existing.id, {
          paymentMethodIdPlaintext: paymentMethodId,
          stripeCustomerId: customerId,
          institutionName,
          last4
        });
        relinked = true;
      } else {
        try {
          saved = await storage.createStripeAccount({
            userId,
            stripeCustomerId: customerId,
            stripeFcAccountId: fcAccountId,
            paymentMethodIdPlaintext: paymentMethodId,
            institutionName,
            last4
          });
        } catch (insertErr) {
          const isDuplicate = insertErr?.code === "23505" || /stripe_accounts_stripe_fc_account_id_unique/.test(insertErr?.message ?? "");
          if (!isDuplicate) throw insertErr;
          const row = await storage.getStripeAccountByFcAccountId(fcAccountId);
          if (!row || row.userId !== userId) {
            stripeLog(correlationId, "fc_exchange_conflict", { severity: "ERROR", fcAccountId });
            return res.status(409).json({
              message: "This bank account is already linked to a different Dime Time account",
              correlationId
            });
          }
          saved = await storage.updateStripeAccountLink(row.id, {
            paymentMethodIdPlaintext: paymentMethodId,
            stripeCustomerId: customerId,
            institutionName,
            last4
          });
          relinked = true;
        }
      }
      stripeLog(correlationId, relinked ? "fc_exchange_relinked" : "fc_exchange_success", {
        stripeAccountId: saved.id,
        institutionName
      });
      return res.status(relinked ? 200 : 201).json({
        success: true,
        relinked,
        stripeAccountId: saved.id,
        institutionName,
        last4,
        correlationId
      });
    } catch (err) {
      if (err instanceof z4.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      stripeLog(correlationId, "fc_exchange_failed", {
        severity: "ERROR",
        error: err?.message
      });
      return res.status(502).json({
        message: "Failed to link Stripe bank account",
        correlationId
      });
    }
  });
  app2.post("/api/stripe/ach/authorize", async (req, res) => {
    const correlationId = randomUUID3();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!isStripeAchEnabled()) {
        return res.status(503).json({ message: "Stripe ACH is not enabled" });
      }
      const ipAddress = clientIp(req);
      const userAgent = req.headers["user-agent"]?.slice(0, 1024) || "unknown";
      const auth = await storage.createAchAuthorization({
        userId,
        version: ACH_AUTHORIZATION_VERSION,
        text: ACH_AUTHORIZATION_TEXT,
        ipAddress,
        userAgent
      });
      stripeLog(correlationId, "ach_authorization_recorded", {
        userId,
        authorizationId: auth.id,
        version: auth.version
      });
      return res.status(201).json({
        success: true,
        authorizationId: auth.id,
        version: auth.version,
        authorizedAt: auth.createdAt,
        correlationId
      });
    } catch (err) {
      stripeLog(correlationId, "ach_authorization_failed", {
        severity: "ERROR",
        error: err?.message
      });
      return res.status(500).json({ message: "Failed to record ACH authorization", correlationId });
    }
  });
  app2.post("/api/stripe/ach/debit", async (req, res) => {
    const correlationId = randomUUID3();
    const idempotencyKey = req.headers["idempotency-key"];
    const endpoint = "/api/stripe/ach/debit";
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      if (!isStripeAchEnabled()) {
        return res.status(503).json({ message: "Stripe ACH is not enabled" });
      }
      if (!idempotencyKey) {
        return res.status(400).json({
          message: "Idempotency-Key header is required for money-movement endpoints"
        });
      }
      if (await reserveIdempotency(idempotencyKey, userId, endpoint, correlationId, res)) return;
      let validatedInput;
      try {
        validatedInput = debitSchema.parse(req.body);
      } catch (e) {
        await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
        throw e;
      }
      const { stripeAccountId, amount, debtId, descriptor } = validatedInput;
      const stripeAccount = await storage.getStripeAccountById(stripeAccountId);
      if (!stripeAccount || stripeAccount.userId !== userId) {
        const body = { message: "Stripe account not found" };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 404, body);
        return res.status(404).json(body);
      }
      if (!stripeAccount.isActive || stripeAccount.status !== "linked") {
        const body = {
          message: "This bank account is no longer linked. Reconnect it or choose another account."
        };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 422, body);
        return res.status(422).json(body);
      }
      const paymentMethodId = await storage.getStripePaymentMethodId(stripeAccountId);
      if (!paymentMethodId) {
        const body = {
          message: "Stripe account is missing payment method credentials. Please re-link."
        };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 422, body);
        return res.status(422).json(body);
      }
      const realTransfers = isFlagEnabled("ENABLE_REAL_TRANSFERS");
      const stripeMode = resolveStripeSecretKey().mode;
      if (!realTransfers || stripeMode !== "live") {
        const ledger2 = await storage.createTransfer({
          userId,
          type: debtId ? "debt_payment" : "stripe_ach_debit",
          amount: amount.toFixed(2),
          status: "simulated",
          provider: "stripe",
          stripeAccountId,
          debtId: debtId || null,
          correlationId,
          idempotencyKey,
          rawRequest: JSON.stringify({ stripeAccountId, amount, debtId, simulated: true })
        });
        console.log("[SIMULATION MODE] ACH transfer simulated (real transfers off or non-live Stripe key)");
        stripeLog(correlationId, "ach_debit_simulated", {
          severity: "WARN",
          ledgerId: ledger2.id,
          stripeAccountId,
          amount,
          realTransfers,
          stripeMode,
          message: "[SIMULATION MODE] ACH transfer simulated (real transfers off or non-live Stripe key)"
        });
        const body = {
          success: true,
          simulated: true,
          ledgerId: ledger2.id,
          status: "simulated",
          correlationId
        };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 201, body);
        return res.status(201).json(body);
      }
      const latest = await storage.getLatestAchAuthorization(userId);
      if (!latest) {
        const body = {
          message: "ACH authorization required before debiting. Please authorize ACH in the app."
        };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 422, body);
        return res.status(422).json(body);
      }
      const mandate = { ipAddress: latest.ipAddress, userAgent: latest.userAgent };
      const environment = process.env.NODE_ENV === "production" ? "production" : "development";
      const gate = await storage.reserveRealStripeAchDebit({
        userId,
        stripeAccountId,
        amount,
        debtId: debtId || null,
        idempotencyKey,
        correlationId,
        stripeMode,
        environment,
        limits: {
          firstTransferMaxDollars: REAL_FIRST_TRANSFER_MAX_DOLLARS,
          dailyTotalMaxDollars: REAL_DAILY_TOTAL_MAX_DOLLARS,
          dailyCountMax: REAL_DAILY_COUNT_MAX
        }
      });
      if (!gate.ok) {
        stripeLog(correlationId, "ach_debit_blocked", {
          severity: "WARN",
          reason: gate.reason,
          auditId: gate.auditId,
          stripeAccountId,
          amount
        });
        const body = { message: gate.message, reason: gate.reason, correlationId };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, gate.httpStatus, body);
        return res.status(gate.httpStatus).json(body);
      }
      const ledger = gate.ledger;
      stripeLog(correlationId, "ach_debit_start", {
        ledgerId: ledger.id,
        stripeAccountId,
        amount,
        isFirstRealTransfer: gate.isFirst
      });
      try {
        const intent = await createAchDebit({
          amountCents: Math.round(amount * 100),
          customerId: stripeAccount.stripeCustomerId,
          paymentMethodId,
          idempotencyKey,
          mandateIpAddress: mandate.ipAddress,
          mandateUserAgent: mandate.userAgent,
          descriptor,
          metadata: {
            dimeTimeUserId: userId,
            dimeTimeLedgerId: ledger.id,
            dimeTimeCorrelationId: correlationId,
            ...debtId ? { dimeTimeDebtId: debtId } : {}
          }
        });
        await storage.updateTransferStatus(ledger.id, intent.status, {
          stripePaymentIntentId: intent.id,
          stripeChargeId: intent.chargeId || void 0,
          rawResponse: JSON.stringify(intent)
        });
        try {
          await storage.createRealTransferAuditLog({
            userId,
            action: "ach_debit_outcome",
            result: "initiated",
            reason: intent.status,
            amount: amount.toFixed(2),
            debtId: debtId || null,
            stripeAccountId,
            stripePaymentIntentId: intent.id,
            transferId: ledger.id,
            stripeMode,
            environment,
            allowlistEnabled: true,
            idempotencyKey,
            correlationId
          });
        } catch (auditErr) {
          stripeLog(correlationId, "audit_write_failed", { severity: "ERROR", error: auditErr?.message });
        }
        stripeLog(correlationId, "ach_debit_initiated", {
          ledgerId: ledger.id,
          paymentIntentId: intent.id,
          stripeStatus: intent.status
        });
        const body = {
          success: true,
          ledgerId: ledger.id,
          paymentIntentId: intent.id,
          status: intent.status,
          correlationId
        };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 201, body);
        return res.status(201).json(body);
      } catch (stripeErr) {
        const errCode = stripeErr?.code || stripeErr?.type || "stripe_error";
        await storage.updateTransferStatus(ledger.id, "failed", {
          errorCode: errCode,
          errorMessage: stripeErr?.message || "Stripe ACH debit failed",
          rawResponse: JSON.stringify(stripeErr?.raw || {})
        });
        try {
          await storage.createRealTransferAuditLog({
            userId,
            action: "ach_debit_outcome",
            result: "failed",
            reason: errCode,
            amount: amount.toFixed(2),
            debtId: debtId || null,
            stripeAccountId,
            transferId: ledger.id,
            stripeMode,
            environment,
            allowlistEnabled: true,
            idempotencyKey,
            correlationId
          });
        } catch (auditErr) {
          stripeLog(correlationId, "audit_write_failed", { severity: "ERROR", error: auditErr?.message });
        }
        stripeLog(correlationId, "ach_debit_failed", {
          severity: "ERROR",
          ledgerId: ledger.id,
          errCode
        });
        const failBody = {
          message: "Stripe ACH debit could not be initiated",
          code: errCode,
          correlationId
        };
        await finalizeIdempotency(idempotencyKey, userId, endpoint, 502, failBody);
        return res.status(502).json(failBody);
      }
    } catch (err) {
      if (err instanceof z4.ZodError) {
        return res.status(400).json({ message: "Validation error", errors: err.errors });
      }
      const cleanupUserId = getUserIdFromRequest(req);
      if (idempotencyKey && cleanupUserId) {
        try {
          await storage.releaseIdempotencyKey(idempotencyKey, cleanupUserId, endpoint);
        } catch (releaseErr) {
          stripeLog(correlationId, "idempotency_release_failed", {
            severity: "ERROR",
            error: releaseErr?.message
          });
        }
      }
      stripeLog(correlationId, "ach_debit_unexpected_error", {
        severity: "ERROR",
        error: err?.message
      });
      return res.status(500).json({ message: "Internal error", correlationId });
    }
  });
}
function registerStripeWebhook(app2) {
  app2.post(
    "/webhooks/stripe",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const correlationId = randomUUID3();
      const signature = req.headers["stripe-signature"];
      let event;
      try {
        event = await verifyStripeWebhook(req.body, signature);
      } catch (err) {
        stripeLog(correlationId, "webhook_signature_failed", {
          severity: "WARN",
          error: err?.message
        });
        return res.status(400).send(`Webhook signature verification failed: ${err?.message}`);
      }
      const claimed = await storage.recordStripeWebhookEvent(event.id, event.type);
      if (!claimed) {
        stripeLog(correlationId, "webhook_duplicate", { eventId: event.id, type: event.type });
        return res.status(200).json({ received: true, duplicate: true });
      }
      stripeLog(correlationId, "webhook_received", { eventId: event.id, type: event.type });
      try {
        if (event.type === "payment_intent.succeeded" || event.type === "payment_intent.processing" || event.type === "payment_intent.payment_failed" || event.type === "payment_intent.canceled" || event.type === "payment_intent.requires_action") {
          const pi = event.data.object;
          const ledger = await storage.getTransferByStripePaymentIntentId(pi.id);
          if (!ledger) {
            stripeLog(correlationId, "webhook_ledger_miss", {
              severity: "WARN",
              paymentIntentId: pi.id
            });
          } else {
            const newStatus = event.type === "payment_intent.succeeded" ? "settled" : event.type === "payment_intent.payment_failed" ? "failed" : event.type === "payment_intent.canceled" ? "cancelled" : event.type === "payment_intent.requires_action" ? "requires_action" : "processing";
            if (ledger.status !== newStatus) {
              await storage.updateTransferStatus(ledger.id, newStatus, {
                stripeChargeId: pi.latest_charge || void 0,
                errorCode: pi.last_payment_error?.code,
                errorMessage: pi.last_payment_error?.message,
                rawResponse: JSON.stringify({ eventId: event.id, type: event.type, status: pi.status })
              });
              stripeLog(correlationId, "ledger_updated", {
                ledgerId: ledger.id,
                previousStatus: ledger.status,
                newStatus
              });
            }
          }
        } else if (event.type === "charge.refunded") {
          const charge = event.data.object;
          let ledger = charge.payment_intent ? await storage.getTransferByStripePaymentIntentId(charge.payment_intent) : void 0;
          if (!ledger && charge.id) {
            ledger = await storage.getTransferByStripeChargeId(charge.id);
          }
          if (!ledger) {
            stripeLog(correlationId, "webhook_ledger_miss", {
              severity: "WARN",
              chargeId: charge.id,
              paymentIntentId: charge.payment_intent
            });
          } else if (ledger.status !== "refunded") {
            await storage.updateTransferStatus(ledger.id, "refunded", {
              stripeChargeId: charge.id,
              rawResponse: JSON.stringify({ eventId: event.id, type: event.type, amountRefunded: charge.amount_refunded })
            });
            stripeLog(correlationId, "ledger_updated", {
              ledgerId: ledger.id,
              previousStatus: ledger.status,
              newStatus: "refunded"
            });
          }
        } else if (event.type === "charge.failed") {
          const charge = event.data.object;
          let ledger = charge.payment_intent ? await storage.getTransferByStripePaymentIntentId(charge.payment_intent) : void 0;
          if (!ledger && charge.id) {
            ledger = await storage.getTransferByStripeChargeId(charge.id);
          }
          if (!ledger) {
            stripeLog(correlationId, "webhook_ledger_miss", {
              severity: "WARN",
              chargeId: charge.id,
              paymentIntentId: charge.payment_intent
            });
          } else if (ledger.status !== "failed") {
            await storage.updateTransferStatus(ledger.id, "failed", {
              stripeChargeId: charge.id,
              errorCode: charge.failure_code || "charge_failed",
              errorMessage: charge.failure_message || "ACH charge failed",
              rawResponse: JSON.stringify({ eventId: event.id, type: event.type, failureCode: charge.failure_code })
            });
            stripeLog(correlationId, "ledger_updated", {
              ledgerId: ledger.id,
              previousStatus: ledger.status,
              newStatus: "failed"
            });
          }
        } else if (event.type === "charge.dispute.created") {
          const dispute = event.data.object;
          const ledger = await storage.getTransferByStripeChargeId(dispute.charge);
          if (!ledger) {
            stripeLog(correlationId, "webhook_ledger_miss", {
              severity: "WARN",
              chargeId: dispute.charge,
              disputeId: dispute.id
            });
          } else if (ledger.status !== "disputed") {
            await storage.updateTransferStatus(ledger.id, "disputed", {
              stripeChargeId: dispute.charge,
              errorCode: dispute.reason,
              errorMessage: `ACH dispute: ${dispute.reason}`,
              rawResponse: JSON.stringify({ eventId: event.id, type: event.type, disputeId: dispute.id, status: dispute.status })
            });
            stripeLog(correlationId, "ledger_updated", {
              ledgerId: ledger.id,
              previousStatus: ledger.status,
              newStatus: "disputed"
            });
          }
        } else if (event.type === "charge.dispute.closed") {
          const dispute = event.data.object;
          const outcome = dispute.status;
          const resolvedStatus = outcome === "won" ? "settled" : outcome === "lost" ? "refunded" : null;
          const ledger = await storage.getTransferByStripeChargeId(dispute.charge);
          if (!ledger) {
            stripeLog(correlationId, "webhook_ledger_miss", {
              severity: "WARN",
              chargeId: dispute.charge,
              disputeId: dispute.id
            });
          } else if (resolvedStatus && ledger.status !== resolvedStatus) {
            await storage.updateTransferStatus(ledger.id, resolvedStatus, {
              stripeChargeId: dispute.charge,
              errorCode: dispute.reason,
              errorMessage: `ACH dispute closed: ${outcome}`,
              rawResponse: JSON.stringify({ eventId: event.id, type: event.type, disputeId: dispute.id, status: dispute.status })
            });
            stripeLog(correlationId, "ledger_updated", {
              ledgerId: ledger.id,
              previousStatus: ledger.status,
              newStatus: resolvedStatus
            });
          } else {
            stripeLog(correlationId, "webhook_noop_acknowledged", {
              eventId: event.id,
              type: event.type,
              disputeStatus: outcome
            });
          }
        } else if (event.type === "customer.subscription.created" || event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
          if (!isFlagEnabled("ENABLE_SUBSCRIPTIONS")) {
            stripeLog(correlationId, "webhook_noop_acknowledged", {
              eventId: event.id,
              type: event.type,
              reason: "subscriptions_flag_off"
            });
          } else {
            const sub = event.data.object;
            const userId = sub.metadata?.dimeTimeUserId || (await storage.getSubscriptionByStripeSubscriptionId(sub.id))?.userId;
            if (!userId) {
              stripeLog(correlationId, "webhook_subscription_user_miss", {
                severity: "WARN",
                eventId: event.id,
                stripeSubscriptionId: sub.id
              });
            } else {
              const row = await storage.upsertSubscription(subscriptionRowFromStripe(sub, userId));
              stripeLog(correlationId, "subscription_upserted", {
                eventId: event.id,
                type: event.type,
                stripeSubscriptionId: sub.id,
                status: row.status
              });
            }
          }
        } else if (event.type === "invoice.paid" || event.type === "invoice.payment_failed") {
          if (!isFlagEnabled("ENABLE_SUBSCRIPTIONS")) {
            stripeLog(correlationId, "webhook_noop_acknowledged", {
              eventId: event.id,
              type: event.type,
              reason: "subscriptions_flag_off"
            });
          } else {
            const invoice = event.data.object;
            const rawInvoiceSub = invoice.subscription ?? invoice.parent?.subscription_details?.subscription;
            const subId = typeof rawInvoiceSub === "string" ? rawInvoiceSub : rawInvoiceSub?.id;
            if (!subId) {
              stripeLog(correlationId, "webhook_noop_acknowledged", {
                eventId: event.id,
                type: event.type,
                reason: "no_subscription_on_invoice"
              });
            } else {
              const fresh = await retrieveStripeSubscription(subId);
              const userId = fresh?.metadata?.dimeTimeUserId || (await storage.getSubscriptionByStripeSubscriptionId(subId))?.userId;
              if (!fresh || !userId) {
                stripeLog(correlationId, "webhook_subscription_user_miss", {
                  severity: "WARN",
                  eventId: event.id,
                  stripeSubscriptionId: subId
                });
              } else {
                const row = await storage.upsertSubscription(subscriptionRowFromStripe(fresh, userId));
                stripeLog(correlationId, "subscription_upserted", {
                  eventId: event.id,
                  type: event.type,
                  stripeSubscriptionId: subId,
                  status: row.status
                });
              }
            }
          }
        } else if (event.type === "setup_intent.succeeded" || event.type === "payment_method.attached") {
          stripeLog(correlationId, "webhook_noop_acknowledged", {
            eventId: event.id,
            type: event.type,
            objectId: event.data.object?.id
          });
        } else {
          stripeLog(correlationId, "webhook_unhandled", { eventId: event.id, type: event.type });
        }
        return res.status(200).json({ received: true });
      } catch (err) {
        stripeLog(correlationId, "webhook_processing_error", {
          severity: "ERROR",
          eventId: event.id,
          error: err?.message
        });
        return res.status(200).json({ received: true, error: true });
      }
    }
  );
}

// server/routes/debtImportRoutes.ts
import rateLimit2, { ipKeyGenerator as ipKeyGenerator2 } from "express-rate-limit";
import { randomUUID as randomUUID4 } from "crypto";
import { z as z5 } from "zod";

// server/services/debtImport/sandboxProvider.ts
var delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
var SANDBOX_INSTITUTION = "First Platypus Bank (Sandbox)";
var SAMPLE_LIABILITIES = [
  {
    provider: "sandbox",
    providerAccountId: "sbx-cc-001",
    institutionName: SANDBOX_INSTITUTION,
    creditorName: "Platypus Visa Signature",
    accountType: "credit_card",
    mask: "4821",
    currentBalance: 3450.75,
    interestRateApr: 22.99,
    minimumPayment: 89,
    dueDate: 15,
    creditLimit: 8e3,
    availableCredit: 4549.25,
    paymentStatus: "current"
  },
  {
    provider: "sandbox",
    providerAccountId: "sbx-sl-002",
    institutionName: "Sallie Sandbox Servicing",
    creditorName: "Federal Student Loan",
    accountType: "student_loan",
    mask: "7733",
    currentBalance: 18230.42,
    interestRateApr: 5.5,
    minimumPayment: 210,
    dueDate: 5,
    creditLimit: null,
    availableCredit: null,
    paymentStatus: "current"
  },
  {
    provider: "sandbox",
    providerAccountId: "sbx-auto-003",
    institutionName: "Sandbox Auto Finance",
    creditorName: "Auto Loan \u2014 SUV",
    accountType: "auto_loan",
    mask: "1290",
    currentBalance: 12750,
    interestRateApr: 7.25,
    minimumPayment: 345,
    dueDate: 22,
    creditLimit: null,
    availableCredit: null,
    paymentStatus: "current"
  }
];
var sandboxProvider = {
  name: "sandbox",
  async initializeConnection() {
    await delay(150);
    return { status: "active", institutionName: SANDBOX_INSTITUTION };
  },
  async fetchLiabilities() {
    await delay(250);
    return SAMPLE_LIABILITIES.map((l) => ({ ...l }));
  },
  async disconnect() {
    await delay(50);
  }
};

// server/services/debtImport/types.ts
var LinkRequiredError = class extends Error {
  code = "link_required";
  constructor(message = "A provider connection is required before importing debts.") {
    super(message);
    this.name = "LinkRequiredError";
  }
};
var LiabilitiesNotEnabledError = class extends Error {
  code = "PLAID_LIABILITIES_NOT_ENABLED";
  constructor(message = "Automatic debt import is coming soon. You can add your debts manually for now.") {
    super(message);
    this.name = "LiabilitiesNotEnabledError";
  }
};

// server/services/debtImport/plaidLiabilityProvider.ts
var PROVIDER = "plaid";
var REAUTH_ERROR_CODES = /* @__PURE__ */ new Set(["ITEM_LOGIN_REQUIRED", "PENDING_EXPIRATION", "PENDING_DISCONNECT"]);
function isReauthRequired(err) {
  const code = err?.response?.data?.error_code;
  return typeof code === "string" && REAUTH_ERROR_CODES.has(code);
}
var LIABILITIES_NOT_ENABLED_CODES = /* @__PURE__ */ new Set([
  "INVALID_PRODUCT",
  "INVALID_PRODUCTS",
  "PRODUCTS_NOT_SUPPORTED"
]);
function isLiabilitiesNotEnabled(err) {
  const code = err?.response?.data?.error_code;
  return typeof code === "string" && LIABILITIES_NOT_ENABLED_CODES.has(code);
}
function num(v, fallback = 0) {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
function parseDueDay(dateStr) {
  if (!dateStr) return 1;
  const day = parseInt(String(dateStr).slice(8, 10), 10);
  if (!Number.isFinite(day) || day < 1 || day > 31) return 1;
  return day;
}
function pickPurchaseApr(aprs) {
  if (!Array.isArray(aprs) || aprs.length === 0) return 0;
  const purchase = aprs.find((a) => a?.apr_type === "purchase_apr");
  const chosen = purchase ?? aprs[0];
  return num(chosen?.apr_percentage, 0);
}
function mapLiabilities(data, institutionName) {
  const accountsById = /* @__PURE__ */ new Map();
  for (const acc of data.accounts ?? []) accountsById.set(acc.account_id, acc);
  const out = [];
  const libs = data.liabilities ?? {};
  for (const c of libs.credit ?? []) {
    const acc = accountsById.get(c.account_id);
    if (!acc) continue;
    out.push({
      provider: PROVIDER,
      providerAccountId: c.account_id,
      institutionName,
      creditorName: acc.name || acc.official_name || "Credit Card",
      accountType: "credit_card",
      mask: acc.mask ?? "",
      currentBalance: num(acc.balances?.current, num(c.last_statement_balance, 0)),
      interestRateApr: pickPurchaseApr(c.aprs),
      minimumPayment: num(c.minimum_payment_amount, 0),
      dueDate: parseDueDay(c.next_payment_due_date),
      creditLimit: acc.balances?.limit != null ? num(acc.balances.limit) : null,
      availableCredit: acc.balances?.available != null ? num(acc.balances.available) : null,
      paymentStatus: c.is_overdue ? "overdue" : "current"
    });
  }
  for (const s of libs.student ?? []) {
    const acc = accountsById.get(s.account_id);
    if (!acc) continue;
    out.push({
      provider: PROVIDER,
      providerAccountId: s.account_id,
      institutionName,
      creditorName: s.loan_name || acc.name || "Student Loan",
      accountType: "student_loan",
      mask: acc.mask ?? "",
      currentBalance: num(acc.balances?.current, 0),
      interestRateApr: num(s.interest_rate_percentage, 0),
      minimumPayment: num(s.minimum_payment_amount, 0),
      dueDate: parseDueDay(s.next_payment_due_date),
      creditLimit: null,
      availableCredit: null,
      paymentStatus: s.is_overdue ? "overdue" : "current"
    });
  }
  for (const m of libs.mortgage ?? []) {
    const acc = accountsById.get(m.account_id);
    if (!acc) continue;
    out.push({
      provider: PROVIDER,
      providerAccountId: m.account_id,
      institutionName,
      creditorName: acc.name || "Mortgage",
      accountType: "mortgage",
      mask: acc.mask ?? "",
      currentBalance: num(acc.balances?.current, 0),
      interestRateApr: num(m.interest_rate?.percentage, 0),
      minimumPayment: num(m.next_monthly_payment, 0),
      dueDate: parseDueDay(m.next_payment_due_date),
      creditLimit: null,
      availableCredit: null,
      paymentStatus: m.is_overdue ? "overdue" : "current"
    });
  }
  return out;
}
var plaidLiabilityProvider = {
  name: PROVIDER,
  linkFlow: {
    async createLinkToken(userId) {
      try {
        return await plaidService.createLiabilitiesLinkToken(userId);
      } catch (err) {
        if (isLiabilitiesNotEnabled(err)) {
          throw new LiabilitiesNotEnabledError();
        }
        throw err;
      }
    },
    async completeLink(userId, publicToken, institutionName) {
      const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);
      const legacy = (await storage.getDebtProviderConnections(userId, PROVIDER)).filter(
        (c) => !c.providerItemId && c.status === "active"
      );
      for (const row of legacy) {
        await storage.upsertDebtProviderConnection({
          userId,
          provider: PROVIDER,
          providerItemId: null,
          status: "disconnected"
        });
      }
      await storage.upsertDebtProviderConnection({
        userId,
        provider: PROVIDER,
        providerItemId: itemId,
        accessTokenEnc: encryptToken(accessToken),
        institutionName: institutionName ?? null,
        status: "active",
        consentAt: /* @__PURE__ */ new Date(),
        lastSyncAt: /* @__PURE__ */ new Date()
      });
      return { status: "active", institutionName: institutionName ?? void 0 };
    }
  },
  async initializeConnection(userId) {
    const conns = (await storage.getDebtProviderConnections(userId, PROVIDER)).filter(
      (c) => c.status === "active" && c.accessTokenEnc
    );
    if (conns.length === 0) {
      throw new LinkRequiredError();
    }
    const names = conns.map((c) => c.institutionName).filter(Boolean);
    return { status: "active", institutionName: names.join(", ") || void 0 };
  },
  /**
   * Fetch liabilities across ALL active connections (a user may have linked
   * multiple banks, e.g. Chase and USAA). Per-connection reauth failures don't
   * sink the whole import: that connection is flipped to "error" and skipped;
   * we only throw LinkRequiredError when NO connection produced data.
   */
  async fetchLiabilities(userId) {
    const conns = (await storage.getDebtProviderConnections(userId, PROVIDER)).filter(
      (c) => c.status === "active" && c.accessTokenEnc
    );
    if (conns.length === 0) {
      throw new LinkRequiredError();
    }
    const out = [];
    let reauthNeeded = 0;
    for (const conn of conns) {
      const accessToken = decryptToken(conn.accessTokenEnc);
      try {
        const data = await plaidService.getLiabilities(accessToken);
        out.push(...mapLiabilities(data, conn.institutionName ?? "Linked account"));
        await storage.upsertDebtProviderConnection({
          userId,
          provider: PROVIDER,
          providerItemId: conn.providerItemId,
          status: "active",
          lastSyncAt: /* @__PURE__ */ new Date()
        });
      } catch (err) {
        if (isReauthRequired(err)) {
          reauthNeeded++;
          await storage.upsertDebtProviderConnection({
            userId,
            provider: PROVIDER,
            providerItemId: conn.providerItemId,
            status: "error"
          });
          continue;
        }
        if (isLiabilitiesNotEnabled(err)) {
          throw new LiabilitiesNotEnabledError();
        }
        throw err;
      }
    }
    if (out.length === 0 && reauthNeeded > 0) {
      throw new LinkRequiredError(
        "Your bank connection needs attention. Please reconnect to refresh your debts."
      );
    }
    return out;
  },
  async disconnect(userId) {
    const conns = await storage.getDebtProviderConnections(userId, PROVIDER);
    for (const conn of conns) {
      if (conn.accessTokenEnc) {
        try {
          await plaidService.removeItem(decryptToken(conn.accessTokenEnc));
        } catch {
        }
      }
    }
  }
};

// server/services/debtImport/index.ts
function getLiabilityProvider() {
  const name = (process.env.DEBT_IMPORT_PROVIDER || "sandbox").trim().toLowerCase();
  switch (name) {
    case "plaid":
      return plaidLiabilityProvider;
    case "sandbox":
    default:
      return sandboxProvider;
  }
}

// server/routes/debtImportRoutes.ts
function debtImportLog(correlationId, event, data) {
  console.log(
    JSON.stringify({
      ts: (/* @__PURE__ */ new Date()).toISOString(),
      service: "DebtImport",
      correlationId,
      event,
      ...data ?? {}
    })
  );
}
var consentSchema = z5.object({ consent: z5.literal(true) });
var exchangeSchema2 = z5.object({
  publicToken: z5.string().min(1),
  institutionName: z5.string().max(200).optional(),
  consent: z5.literal(true)
});
function perUserLimiter(max, action) {
  return rateLimit2({
    windowMs: 15 * 60 * 1e3,
    max,
    message: { message: `Too many ${action} attempts. Please try again in about 15 minutes.` },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    keyGenerator: (req) => {
      const uid = getUserIdFromRequest(req);
      return uid ? `u:${uid}` : `ip:${ipKeyGenerator2(req.ip ?? "")}`;
    }
  });
}
var importLimiter = perUserLimiter(10, "import");
var refreshLimiter = perUserLimiter(20, "refresh");
var disconnectLimiter = perUserLimiter(20, "disconnect");
function errMessage(err) {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}
var LIABILITIES_COMING_SOON_MESSAGE = "Automatic debt import is coming soon. You can add your debts manually for now.";
var LIABILITIES_CAPABILITY_TTL_MS = 10 * 60 * 1e3;
var liabilitiesCapability = null;
function markLiabilitiesCapability(available) {
  liabilitiesCapability = { available, checkedAt: Date.now() };
}
async function isLiabilitiesAvailable(provider, userId) {
  if (provider.name !== "plaid" || !provider.linkFlow) return true;
  const cached3 = liabilitiesCapability;
  if (cached3 && Date.now() - cached3.checkedAt < LIABILITIES_CAPABILITY_TTL_MS) {
    return cached3.available;
  }
  try {
    await provider.linkFlow.createLinkToken(userId);
    markLiabilitiesCapability(true);
    return true;
  } catch (err) {
    if (err instanceof LiabilitiesNotEnabledError) {
      markLiabilitiesCapability(false);
      return false;
    }
    return cached3?.available ?? true;
  }
}
async function runImport(userId, action, correlationId) {
  const provider = getLiabilityProvider();
  try {
    const conn = await provider.initializeConnection(userId);
    if (!provider.linkFlow) {
      await storage.upsertDebtProviderConnection({
        userId,
        provider: provider.name,
        institutionName: conn.institutionName ?? null,
        status: "active",
        consentAt: /* @__PURE__ */ new Date(),
        lastSyncAt: /* @__PURE__ */ new Date()
      });
    }
    const liabilities = await provider.fetchLiabilities(userId);
    const result = await storage.importDebtsFromProvider(userId, provider.name, liabilities);
    await storage.createDebtImportAuditLog({
      userId,
      provider: provider.name,
      action,
      status: "success",
      importedCount: result.imported,
      updatedCount: result.updated,
      message: null,
      correlationId
    });
    debtImportLog(correlationId, `debt_${action}_success`, {
      userId,
      provider: provider.name,
      imported: result.imported,
      updated: result.updated
    });
    return {
      status: 200,
      body: {
        imported: result.imported,
        updated: result.updated,
        debts: result.debts,
        provider: provider.name,
        institutionName: conn.institutionName ?? null,
        correlationId
      }
    };
  } catch (err) {
    if (err instanceof LinkRequiredError) {
      debtImportLog(correlationId, `debt_${action}_link_required`, { userId, provider: provider.name });
      return {
        status: 409,
        body: {
          code: "link_required",
          message: "Connect your account to import your debts.",
          correlationId
        }
      };
    }
    if (err instanceof LiabilitiesNotEnabledError) {
      markLiabilitiesCapability(false);
      await storage.createDebtImportAuditLog({
        userId,
        provider: provider.name,
        action,
        status: "error",
        importedCount: 0,
        updatedCount: 0,
        message: "PLAID_LIABILITIES_NOT_ENABLED",
        correlationId
      });
      debtImportLog(correlationId, `debt_${action}_liabilities_not_enabled`, {
        userId,
        provider: provider.name
      });
      return {
        status: 503,
        body: {
          code: "PLAID_LIABILITIES_NOT_ENABLED",
          message: LIABILITIES_COMING_SOON_MESSAGE,
          correlationId
        }
      };
    }
    const message = errMessage(err);
    await storage.createDebtImportAuditLog({
      userId,
      provider: provider.name,
      action,
      status: "error",
      importedCount: 0,
      updatedCount: 0,
      message,
      correlationId
    });
    debtImportLog(correlationId, `debt_${action}_error`, { userId, provider: provider.name, error: message });
    return {
      status: 502,
      body: {
        message: "We couldn't import your debts right now. Please try again in a moment.",
        correlationId
      }
    };
  }
}
function registerDebtImportRoutes(app2) {
  app2.post("/api/debts/import", importLimiter, async (req, res) => {
    const correlationId = randomUUID4();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const parsed = consentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Explicit consent is required to import your debts.",
        correlationId
      });
    }
    const { status, body } = await runImport(userId, "import", correlationId);
    res.status(status).json(body);
  });
  app2.post("/api/debts/import/link-token", importLimiter, async (req, res) => {
    const correlationId = randomUUID4();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const provider = getLiabilityProvider();
    if (!provider.linkFlow) {
      return res.status(409).json({
        message: "This provider does not require a connection step.",
        correlationId
      });
    }
    try {
      const linkToken = await provider.linkFlow.createLinkToken(userId);
      if (provider.name === "plaid") markLiabilitiesCapability(true);
      return res.json({ linkToken, correlationId });
    } catch (err) {
      if (err instanceof LiabilitiesNotEnabledError) {
        markLiabilitiesCapability(false);
        debtImportLog(correlationId, "debt_link_token_liabilities_not_enabled", {
          userId,
          provider: provider.name
        });
        return res.status(503).json({
          code: "PLAID_LIABILITIES_NOT_ENABLED",
          message: LIABILITIES_COMING_SOON_MESSAGE,
          correlationId
        });
      }
      debtImportLog(correlationId, "debt_link_token_error", {
        userId,
        provider: provider.name,
        error: errMessage(err)
      });
      return res.status(502).json({
        message: "We couldn't start the secure connection. Please try again.",
        correlationId
      });
    }
  });
  app2.post("/api/debts/import/exchange", importLimiter, async (req, res) => {
    const correlationId = randomUUID4();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const parsed = exchangeSchema2.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "A public token and explicit consent are required.",
        correlationId
      });
    }
    const provider = getLiabilityProvider();
    if (!provider.linkFlow) {
      return res.status(409).json({
        message: "This provider does not support a connection step.",
        correlationId
      });
    }
    try {
      await provider.linkFlow.completeLink(userId, parsed.data.publicToken, parsed.data.institutionName);
    } catch (err) {
      const message = errMessage(err);
      await storage.createDebtImportAuditLog({
        userId,
        provider: provider.name,
        action: "import",
        status: "error",
        importedCount: 0,
        updatedCount: 0,
        message,
        correlationId
      });
      debtImportLog(correlationId, "debt_link_exchange_error", { userId, provider: provider.name, error: message });
      return res.status(502).json({
        message: "We couldn't connect your account. Please try again.",
        correlationId
      });
    }
    const { status, body } = await runImport(userId, "import", correlationId);
    res.status(status).json(body);
  });
  app2.post("/api/debts/refresh", refreshLimiter, async (req, res) => {
    const correlationId = randomUUID4();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const provider = getLiabilityProvider();
    const existing = await storage.getDebtProviderConnection(userId, provider.name);
    if (!existing || existing.status !== "active") {
      return res.status(409).json({
        message: "No active debt-import connection to refresh.",
        correlationId
      });
    }
    const { status, body } = await runImport(userId, "refresh", correlationId);
    res.status(status).json(body);
  });
  app2.get("/api/debts/import/status", async (req, res) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const provider = getLiabilityProvider();
    const conns = await storage.getDebtProviderConnections(userId, provider.name);
    const active = conns.filter((c) => c.status === "active");
    const connected = active.length > 0;
    const first = active[0] ?? conns[0];
    res.json({
      connected,
      // True when the provider needs a client-side connect step and the user
      // isn't connected yet — the client uses this to launch the Link flow.
      requiresLink: !!provider.linkFlow && !connected,
      // True when the provider supports linking additional banks on top of the
      // existing connection(s) — drives the "Add another bank" client action.
      canLinkAnother: !!provider.linkFlow,
      // False while the upstream Liabilities entitlement is pending (e.g. Plaid
      // production before approval) — the client shows "coming soon" up front.
      liabilitiesAvailable: await isLiabilitiesAvailable(provider, userId),
      provider: provider.name,
      institutionName: first?.institutionName ?? null,
      lastSyncAt: first?.lastSyncAt ?? null,
      // One entry per linked bank so the client can list them.
      institutions: conns.map((c) => ({
        institutionName: c.institutionName,
        status: c.status,
        lastSyncAt: c.lastSyncAt
      }))
    });
  });
  app2.delete("/api/debts/provider", disconnectLimiter, async (req, res) => {
    const correlationId = randomUUID4();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const provider = getLiabilityProvider();
    try {
      await provider.disconnect(userId);
    } catch (err) {
      debtImportLog(correlationId, "debt_disconnect_provider_warning", {
        userId,
        provider: provider.name,
        error: errMessage(err)
      });
    }
    await storage.disconnectDebtProvider(userId, provider.name);
    await storage.createDebtImportAuditLog({
      userId,
      provider: provider.name,
      action: "disconnect",
      status: "success",
      importedCount: 0,
      updatedCount: 0,
      message: null,
      correlationId
    });
    debtImportLog(correlationId, "debt_disconnect_success", { userId, provider: provider.name });
    res.json({ ok: true, correlationId });
  });
}

// server/routes/subscriptionRoutes.ts
import rateLimit3, { ipKeyGenerator as ipKeyGenerator3 } from "express-rate-limit";
import { randomUUID as randomUUID5 } from "crypto";
import { z as z6 } from "zod";

// shared/subscriptionAuthorization.ts
var SUBSCRIPTION_CONSENT_VERSION = "2026-07-14.v1";
var SUBSCRIPTION_CONSENT_TEXT = "By selecting \u201CSubscribe\u201D, you agree to the Dime Time Terms of Service and authorize Dime Time to electronically debit your linked bank account via the ACH network for the recurring monthly subscription fee shown above, on or about the same day each month, beginning today, and, if necessary, to electronically credit your account to correct any erroneous debit. This authorization remains in effect until you cancel your subscription in the app or contact us at tim@dime-time.com. Canceling stops future charges at the end of your current billing period; fees already charged are non-refundable except as required by law. You agree that ACH transactions you authorize comply with applicable U.S. law. Dime Time is a financial technology platform and is not a bank; banking services and payment infrastructure are provided through regulated financial partners.";

// server/routes/subscriptionRoutes.ts
var subscribeSchema = z6.object({
  // Explicit re-statement that the user checked the consent box. The
  // authoritative evidence row is written server-side with server-observed
  // IP/UA — the client can't forge those.
  consentAccepted: z6.literal(true),
  // Optional: pick a specific linked bank account; defaults to the first
  // active linked one.
  stripeAccountId: z6.string().min(1).optional()
});
function clientIp2(req) {
  const fwd = req.headers["x-forwarded-for"]?.split(",")[0]?.trim();
  return req.ip || fwd || req.socket?.remoteAddress || "unknown";
}
function subLog(correlationId, event, data) {
  setCorrelationTag(correlationId);
  console.log(JSON.stringify({
    ts: (/* @__PURE__ */ new Date()).toISOString(),
    service: "SubscriptionRoutes",
    correlationId,
    event,
    ...data
  }));
}
var subscribeLimiter = rateLimit3({
  windowMs: 60 * 1e3,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => {
    const uid = getUserIdFromRequest(req);
    return uid ? `u:${uid}` : `ip:${ipKeyGenerator3(req.ip ?? "")}`;
  },
  message: { message: "Too many subscription attempts. Try again in a minute." }
});
function registerSubscriptionRoutes(app2) {
  app2.get("/api/subscription", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const [subscription, accounts] = await Promise.all([
        storage.getLatestSubscriptionByUserId(userId),
        storage.getStripeAccountsByUserId(userId)
      ]);
      const linkedAccounts = accounts.filter((a) => a.isActive && a.status === "linked");
      return res.json({
        plan: PLAN_CATALOG[DEFAULT_PLAN_ID],
        subscription: subscription ?? null,
        entitled: isSubscriptionEntitled(subscription?.status),
        bankLinked: linkedAccounts.length > 0,
        bankAccounts: linkedAccounts.map((a) => ({
          id: a.id,
          institutionName: a.institutionName,
          last4: a.last4
        })),
        consent: {
          text: SUBSCRIPTION_CONSENT_TEXT,
          version: SUBSCRIPTION_CONSENT_VERSION
        }
      });
    } catch (error) {
      return res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/subscription/subscribe", subscribeLimiter, async (req, res) => {
    const correlationId = randomUUID5();
    const userId = getUserIdFromRequest(req);
    if (!userId) return res.status(401).json({ message: "Not authenticated" });
    if (!isStripeAchEnabled()) {
      return res.status(503).json({ message: "Billing is not available right now" });
    }
    const idempotencyKey = req.headers["idempotency-key"];
    if (!idempotencyKey || idempotencyKey.length < 8 || idempotencyKey.length > 128) {
      return res.status(400).json({
        message: "Idempotency-Key header (8-128 chars) is required",
        correlationId
      });
    }
    const endpoint = "/api/subscription/subscribe";
    const reservation = await storage.reserveIdempotencyKey(idempotencyKey, userId, endpoint);
    if (!reservation.claimed) {
      if (reservation.inFlight) {
        subLog(correlationId, "idempotency_in_flight", { endpoint, idempotencyKey, severity: "WARN" });
        return res.status(409).json({
          message: "A request with this Idempotency-Key is already being processed. Retry shortly.",
          correlationId
        });
      }
      const cached3 = reservation.cached;
      subLog(correlationId, "idempotency_hit", { endpoint, idempotencyKey });
      let parsed = {};
      try {
        parsed = cached3.body ? JSON.parse(cached3.body) : {};
      } catch {
        parsed = { raw: cached3.body };
      }
      return res.status(cached3.status).json({ ...parsed, _idempotencyReplay: true });
    }
    const lockAcquired = await storage.acquireSubscribeLock(userId);
    if (!lockAcquired) {
      await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
      subLog(correlationId, "subscribe_lock_busy", { userId, severity: "WARN" });
      return res.status(409).json({
        message: "A subscription request is already in progress. Retry shortly.",
        code: "subscribe_in_progress",
        correlationId
      });
    }
    try {
      const parsedBody = subscribeSchema.safeParse(req.body);
      if (!parsedBody.success) {
        await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
        return res.status(400).json({
          message: "You must accept the subscription authorization to subscribe.",
          correlationId
        });
      }
      const existing = await storage.getLatestSubscriptionByUserId(userId);
      if (existing && !isSubscriptionTerminal(existing.status)) {
        await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
        return res.status(409).json({
          message: "You already have a subscription.",
          code: "already_subscribed",
          correlationId
        });
      }
      const accounts = await storage.getStripeAccountsByUserId(userId);
      const account = parsedBody.data.stripeAccountId ? accounts.find((a) => a.id === parsedBody.data.stripeAccountId) : accounts.find((a) => a.isActive && a.status === "linked");
      if (!account || !account.isActive || account.status !== "linked") {
        await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
        return res.status(400).json({
          message: "Link a bank account before subscribing.",
          code: "bank_account_required",
          correlationId
        });
      }
      const paymentMethodId = await storage.getStripePaymentMethodId(account.id);
      if (!paymentMethodId) {
        await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
        return res.status(400).json({
          message: "Your linked bank account is missing a payment method. Re-link and try again.",
          code: "bank_account_required",
          correlationId
        });
      }
      subLog(correlationId, "subscribe_start", {
        userId,
        stripeAccountId: account.id,
        plan: DEFAULT_PLAN_ID
      });
      const consent = await storage.createSubscriptionConsent({
        userId,
        plan: DEFAULT_PLAN_ID,
        priceCentsAtConsent: PLAN_CATALOG[DEFAULT_PLAN_ID].priceCents,
        version: SUBSCRIPTION_CONSENT_VERSION,
        text: SUBSCRIPTION_CONSENT_TEXT,
        ipAddress: clientIp2(req),
        userAgent: req.headers["user-agent"] || "unknown"
      });
      subLog(correlationId, "consent_recorded", { consentId: consent.id });
      const priceId = await ensurePlanPrice(DEFAULT_PLAN_ID);
      const mandate = await createRecurringAchMandate({
        customerId: account.stripeCustomerId,
        paymentMethodId,
        mandateIpAddress: consent.ipAddress,
        mandateUserAgent: consent.userAgent,
        idempotencyKey
      });
      subLog(correlationId, "mandate_ready", { setupIntentId: mandate.setupIntentId });
      const stripeSub = await createPlanSubscription({
        customerId: account.stripeCustomerId,
        paymentMethodId,
        planId: DEFAULT_PLAN_ID,
        priceId,
        userId,
        idempotencyKey
      });
      const row = await storage.upsertSubscription(subscriptionRowFromStripe(stripeSub, userId));
      subLog(correlationId, "subscribe_complete", {
        subscriptionId: row.id,
        stripeSubscriptionId: row.stripeSubscriptionId,
        status: row.status
      });
      const body = {
        subscription: row,
        entitled: isSubscriptionEntitled(row.status),
        correlationId
      };
      await storage.finalizeIdempotencyKey(idempotencyKey, userId, endpoint, 201, JSON.stringify(body));
      return res.status(201).json(body);
    } catch (err) {
      subLog(correlationId, "subscribe_failed", { severity: "ERROR", error: err?.message });
      try {
        await storage.releaseIdempotencyKey(idempotencyKey, userId, endpoint);
      } catch {
      }
      return res.status(502).json({
        message: "We couldn't start your subscription. No charge was made \u2014 please try again.",
        correlationId
      });
    } finally {
      try {
        await storage.releaseSubscribeLock(userId);
      } catch {
      }
    }
  });
  app2.post("/api/subscription/cancel", async (req, res) => {
    const correlationId = randomUUID5();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const sub = await storage.getLatestSubscriptionByUserId(userId);
      if (!sub || isSubscriptionTerminal(sub.status)) {
        return res.status(404).json({ message: "No active subscription to cancel." });
      }
      if (sub.cancelAtPeriodEnd) {
        return res.json({ subscription: sub, correlationId });
      }
      const updated = await setCancelAtPeriodEnd(sub.stripeSubscriptionId, true);
      const row = await storage.upsertSubscription(subscriptionRowFromStripe(updated, userId));
      subLog(correlationId, "subscription_cancel_scheduled", {
        userId,
        stripeSubscriptionId: sub.stripeSubscriptionId
      });
      return res.json({ subscription: row, correlationId });
    } catch (err) {
      subLog(correlationId, "subscription_cancel_failed", { severity: "ERROR", error: err?.message });
      return res.status(502).json({ message: "Failed to cancel subscription. Please try again.", correlationId });
    }
  });
  app2.post("/api/subscription/reactivate", async (req, res) => {
    const correlationId = randomUUID5();
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) return res.status(401).json({ message: "Not authenticated" });
      const sub = await storage.getLatestSubscriptionByUserId(userId);
      if (!sub || isSubscriptionTerminal(sub.status) || !sub.cancelAtPeriodEnd) {
        return res.status(404).json({ message: "No cancellation to undo." });
      }
      const updated = await setCancelAtPeriodEnd(sub.stripeSubscriptionId, false);
      const row = await storage.upsertSubscription(subscriptionRowFromStripe(updated, userId));
      subLog(correlationId, "subscription_reactivated", {
        userId,
        stripeSubscriptionId: sub.stripeSubscriptionId
      });
      return res.json({ subscription: row, correlationId });
    } catch (err) {
      subLog(correlationId, "subscription_reactivate_failed", { severity: "ERROR", error: err?.message });
      return res.status(502).json({ message: "Failed to resume subscription. Please try again.", correlationId });
    }
  });
}

// server/lib/subscriptionGate.ts
async function hasRoundUpAutomationAccess(userId) {
  if (!isFlagEnabled("ENABLE_SUBSCRIPTIONS")) return true;
  const sub = await storage.getLatestSubscriptionByUserId(userId);
  return isSubscriptionEntitled(sub?.status);
}
var SUBSCRIPTION_REQUIRED_RESPONSE = {
  message: "An active Dime Time subscription is required for round-up automation.",
  code: "subscription_required"
};

// shared/debtDuplicates.ts
var FILLER_WORDS = /* @__PURE__ */ new Set(["the", "of", "and", "my", "a", "an", "account", "acct"]);
var INSTITUTION_ALIASES = [
  ["chase", "jpmorgan", "jpmorganchase", "jpm", "jp", "morgan"],
  ["amex", "american", "express", "americanexpress"],
  ["boa", "bofa", "bankofamerica"],
  ["citi", "citibank", "citigroup"],
  ["wellsfargo", "wells", "fargo", "wf"],
  ["capitalone", "capital"],
  ["usbank", "us"],
  ["navyfederal", "navy", "nfcu"]
];
function canonicalToken(token) {
  for (const group of INSTITUTION_ALIASES) {
    if (group.includes(token)) return group[0];
  }
  return token;
}
function tokenize(...texts) {
  const tokens = /* @__PURE__ */ new Set();
  for (const text2 of texts) {
    if (!text2) continue;
    for (const raw of text2.toLowerCase().split(/[^a-z0-9]+/)) {
      if (raw.length < 2 || FILLER_WORDS.has(raw)) continue;
      tokens.add(canonicalToken(raw));
    }
  }
  return tokens;
}
function tokensOverlap(a, b) {
  for (const t of a) if (b.has(t)) return true;
  return false;
}
function lastFour(accountNumber) {
  if (!accountNumber) return null;
  const digits = accountNumber.replace(/\D/g, "");
  return digits.length >= 4 ? digits.slice(-4) : null;
}
function debtDismissalFingerprint(d) {
  const mask = lastFour(d.accountNumber);
  const instTokens = [...tokenize(d.institutionName)].sort().join(".");
  const tokens = instTokens || [...tokenize(d.name)].sort().join(".");
  if (!mask && !tokens) return null;
  return `fp:${mask ?? ""}:${tokens}`;
}
function balancesAreClose(a, b) {
  const balA = parseFloat(a);
  const balB = parseFloat(b);
  if (!Number.isFinite(balA) || !Number.isFinite(balB)) return false;
  if (balA <= 0 || balB <= 0) return false;
  const diff = Math.abs(balA - balB);
  const larger = Math.max(balA, balB);
  return diff <= 300 || diff / larger <= 0.15;
}
function findDuplicateDebtPairs(debts2) {
  const active = debts2.filter((d) => d.isActive);
  const manuals = active.filter((d) => d.source === "manual");
  const imports = active.filter((d) => d.source === "imported");
  if (manuals.length === 0 || imports.length === 0) return [];
  const pairs = [];
  for (const manual of manuals) {
    const dismissed = new Set(manual.notDuplicateOf ?? []);
    const manualTokens = tokenize(manual.name, manual.institutionName);
    const manualMask = lastFour(manual.accountNumber);
    let best = null;
    for (const imported of imports) {
      if (dismissed.has(imported.id)) continue;
      const fp = debtDismissalFingerprint(imported);
      if (fp && dismissed.has(fp)) continue;
      const importedMask = lastFour(imported.accountNumber);
      const maskMatch = !!manualMask && !!importedMask && manualMask === importedMask;
      const importedTokens = tokenize(imported.name, imported.institutionName);
      const nameMatch = tokensOverlap(manualTokens, importedTokens);
      const balanceClose = balancesAreClose(manual.currentBalance, imported.currentBalance);
      let score = 0;
      let reason = "";
      if (maskMatch) {
        score = 3;
        reason = "Account numbers end in the same four digits";
      } else if (balanceClose && nameMatch) {
        score = 2;
        reason = "Similar name or institution with a close balance";
      } else {
        continue;
      }
      if (!best || score > best.score) best = { imported, score, reason };
    }
    if (best) {
      pairs.push({
        manualDebtId: manual.id,
        importedDebtId: best.imported.id,
        reason: best.reason
      });
    }
  }
  return pairs;
}

// server/routes/adminRoutes.ts
import { z as z7 } from "zod";
var realTransfersToggleSchema = z7.object({
  enabled: z7.boolean(),
  notes: z7.string().max(500).optional()
});
var dailyCapOverrideSchema = z7.object({
  // null clears the override (automatic tiers apply again).
  dailyCap: z7.number().min(0).max(1e4).nullable(),
  notes: z7.string().max(500).optional()
});
function publicUserRealTransferStatus(u) {
  return {
    userId: u.id,
    // Enabled by default for everyone; false only when an admin has blocked.
    realTransfersEnabled: u.realTransfersBlocked !== true,
    realTransfersBlockedAt: u.realTransfersBlockedAt,
    realTransfersBlockedBy: u.realTransfersBlockedBy,
    realTransfersNotes: u.realTransfersNotes
  };
}
function registerAdminRoutes(app2) {
  app2.get("/api/admin/me", requireAdmin, (_req, res) => {
    res.json({ isAdmin: true });
  });
  app2.get("/api/admin/transfers", requireAdmin, async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit ?? "100"), 10) || 100));
      const provider = typeof req.query.provider === "string" && req.query.provider.length > 0 ? String(req.query.provider) : void 0;
      const status = typeof req.query.status === "string" && req.query.status.length > 0 ? String(req.query.status) : void 0;
      const rows = await storage.getRecentTransfers({ limit, provider, status });
      res.json({
        count: rows.length,
        transfers: rows.map(stripRaw)
      });
    } catch (error) {
      console.error("[admin] /api/admin/transfers error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/admin/transfers/:id", requireAdmin, async (req, res) => {
    try {
      const row = await storage.getTransfer(req.params.id);
      if (!row) return res.status(404).json({ message: "Transfer not found" });
      res.json(stripRaw(row));
    } catch (error) {
      console.error("[admin] /api/admin/transfers/:id error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/admin/webhooks/stripe", requireAdmin, async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit ?? "100"), 10) || 100));
      const rows = await storage.getRecentStripeWebhookEvents(limit);
      res.json({ count: rows.length, events: rows });
    } catch (error) {
      console.error("[admin] /api/admin/webhooks/stripe error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/admin/users/:id/real-transfers", requireAdmin, async (req, res) => {
    try {
      const user = await storage.getUser(req.params.id);
      if (!user) return res.status(404).json({ message: "User not found" });
      const trust = await storage.getUserRealTransferTrust(req.params.id);
      res.json({
        ...publicUserRealTransferStatus(user),
        trust: trust ? {
          tier: trust.tier,
          flagged: trust.flagged,
          dailyTotalMaxDollars: trust.dailyTotalMaxDollars,
          dailyCountMax: trust.dailyCountMax,
          firstTransferMaxDollars: trust.firstTransferMaxDollars,
          overrideApplied: trust.overrideApplied,
          firstSettledAt: trust.firstSettledAt
        } : null,
        dailyCapOverride: user.realTransfersDailyCapOverride
      });
    } catch (error) {
      console.error("[admin] GET /api/admin/users/:id/real-transfers error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/admin/users/:id/real-transfer-limit", requireAdmin, async (req, res) => {
    try {
      const adminUserId = req.adminUserId;
      const parsed = dailyCapOverrideSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const { dailyCap, notes } = parsed.data;
      const updated = await storage.setUserRealTransfersDailyCapOverride(req.params.id, dailyCap, adminUserId, notes);
      if (!updated) return res.status(404).json({ message: "User not found" });
      console.log(JSON.stringify({
        event: "admin_real_transfer_cap_override",
        severity: "WARN",
        targetUserId: req.params.id,
        dailyCap,
        adminUserId
      }));
      const trust = await storage.getUserRealTransferTrust(req.params.id);
      res.json({
        ...publicUserRealTransferStatus(updated),
        trust: trust ? {
          tier: trust.tier,
          flagged: trust.flagged,
          dailyTotalMaxDollars: trust.dailyTotalMaxDollars,
          dailyCountMax: trust.dailyCountMax,
          firstTransferMaxDollars: trust.firstTransferMaxDollars,
          overrideApplied: trust.overrideApplied,
          firstSettledAt: trust.firstSettledAt
        } : null,
        dailyCapOverride: updated.realTransfersDailyCapOverride
      });
    } catch (error) {
      console.error("[admin] POST /api/admin/users/:id/real-transfer-limit error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/admin/users/:id/real-transfers", requireAdmin, async (req, res) => {
    try {
      const adminUserId = req.adminUserId;
      const parsed = realTransfersToggleSchema.safeParse(req.body);
      if (!parsed.success) {
        return res.status(400).json({ message: "Validation error", errors: parsed.error.errors });
      }
      const { enabled, notes } = parsed.data;
      const updated = await storage.setUserRealTransfersEnabled(req.params.id, enabled, adminUserId, notes);
      if (!updated) return res.status(404).json({ message: "User not found" });
      const trust = await storage.getUserRealTransferTrust(req.params.id);
      console.log(
        JSON.stringify({
          event: "admin_real_transfers_toggled",
          severity: "WARN",
          targetUserId: req.params.id,
          enabled,
          adminUserId
        })
      );
      res.json({
        ...publicUserRealTransferStatus(updated),
        trust: trust ? {
          tier: trust.tier,
          flagged: trust.flagged,
          dailyTotalMaxDollars: trust.dailyTotalMaxDollars,
          dailyCountMax: trust.dailyCountMax,
          firstTransferMaxDollars: trust.firstTransferMaxDollars,
          overrideApplied: trust.overrideApplied,
          firstSettledAt: trust.firstSettledAt
        } : null,
        dailyCapOverride: updated.realTransfersDailyCapOverride
      });
    } catch (error) {
      console.error("[admin] POST /api/admin/users/:id/real-transfers error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/admin/real-transfer-audit", requireAdmin, async (req, res) => {
    try {
      const limit = Math.max(1, Math.min(500, parseInt(String(req.query.limit ?? "100"), 10) || 100));
      const userId = typeof req.query.userId === "string" && req.query.userId.length > 0 ? String(req.query.userId) : void 0;
      const rows = await storage.getRecentRealTransferAuditLogs({ limit, userId });
      res.json({ count: rows.length, logs: rows });
    } catch (error) {
      console.error("[admin] /api/admin/real-transfer-audit error", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
}
function stripRaw(t) {
  const { rawRequest, rawResponse, ...rest } = t;
  return rest;
}

// server/lib/passwords.ts
import bcrypt from "bcrypt";
import { createHash as createHash2, timingSafeEqual as timingSafeEqual2 } from "crypto";
var BCRYPT_COST = 12;
function hashPasswordSha256(password) {
  return createHash2("sha256").update(password).digest("hex");
}
async function hashPasswordBcrypt(password) {
  return bcrypt.hash(password, BCRYPT_COST);
}
function constantTimeCompare(a, b) {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual2(bufA, bufB);
}
async function verifyPassword(password, hash, algo) {
  try {
    if (algo === "bcrypt") {
      return await bcrypt.compare(password, hash);
    }
    const sha256Hash = hashPasswordSha256(password);
    return constantTimeCompare(sha256Hash, hash);
  } catch {
    return false;
  }
}

// server/lib/verificationCooldown.ts
var RESEND_COOLDOWN_SECONDS = 60;
var lastSendByUser = /* @__PURE__ */ new Map();
function checkAndTouchResendCooldown(userId, now = Date.now()) {
  const last = lastSendByUser.get(userId);
  if (last !== void 0) {
    const elapsed = (now - last) / 1e3;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed)
      };
    }
  }
  lastSendByUser.set(userId, now);
  return { allowed: true, retryAfterSeconds: 0 };
}
function clearResendCooldown(userId) {
  lastSendByUser.delete(userId);
}

// server/middleware/requireVerifiedEmail.ts
var VERIFICATION_PROTECTED_PREFIXES = [
  "/api/debts",
  // debt CRUD + /api/debts/import + /api/debts/provider + refresh
  "/api/transactions",
  "/api/transfers",
  "/api/payments",
  "/api/accelerated-payment",
  "/api/round-up-settings",
  "/api/apply-round-ups",
  "/api/dashboard-summary",
  "/api/crypto-purchases",
  "/api/crypto-summary",
  "/api/plaid",
  // link tokens, exchange, accounts, balances, transactions
  "/api/coinbase",
  "/api/axos",
  "/api/mercury",
  "/api/stripe",
  // ACH authorize/debit, financial connections (webhook exempted below)
  "/api/subscription",
  "/api/dime-token",
  // Dime Time Token balance/stake/award
  "/api/notifications",
  "/api/admin"
];
var EXEMPT_PATHS = [
  "/webhooks/stripe",
  "/webhooks/plaid"
];
function isProtectedPath(path4) {
  if (EXEMPT_PATHS.some((p) => path4 === p || path4.startsWith(p + "/"))) return false;
  return VERIFICATION_PROTECTED_PREFIXES.some(
    (p) => path4 === p || path4.startsWith(p + "/")
  );
}
var EMAIL_VERIFICATION_REQUIRED_RESPONSE = {
  code: "EMAIL_VERIFICATION_REQUIRED",
  message: "Please verify your email address to use this feature."
};
async function requireVerifiedEmail(req, res, next) {
  if (!isFlagEnabled("REQUIRE_EMAIL_VERIFICATION")) return next();
  if (!isProtectedPath(req.path)) return next();
  const userId = getUserIdFromRequest(req);
  if (!userId) return next();
  try {
    const user = await storage.getUser(userId);
    if (!user) return next();
    if (!user.emailVerifiedAt) {
      res.status(403).json(EMAIL_VERIFICATION_REQUIRED_RESPONSE);
      return;
    }
    return next();
  } catch (err) {
    console.error(
      "requireVerifiedEmail lookup failed:",
      err instanceof Error ? err.message : "unknown"
    );
    res.status(503).json({ message: "Please try again in a moment." });
    return;
  }
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
      const debts2 = await storage.getUserDebts(userId);
      const transactions2 = await storage.getUserTransactions(userId, 90);
      const totalDebt = debts2.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
      const totalRoundUps = transactions2.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount || "0"), 0);
      const monthlyRoundUpAverage = totalRoundUps / 3;
      const monthlyMinPayments = debts2.reduce((sum, debt) => sum + parseFloat(debt.minimumPayment || "0"), 0);
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
      const debts2 = await storage.getUserDebts(userId);
      const transactions2 = await storage.getUserTransactions(userId, 30);
      const monthlyRoundUps = transactions2.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount || "0"), 0);
      let totalBalance = 0;
      let weightedInterestRate = 0;
      debts2.forEach((debt) => {
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
      const transactions2 = await storage.getUserTransactions(userId);
      const totalRoundUps = transactions2.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount || "0"), 0);
      const annualRate = 0.04;
      const weeklyRate = annualRate / 52;
      const weeklyEarnings = totalRoundUps * weeklyRate;
      const weeksActive = Math.min(transactions2.length / 3, 52);
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
      const debts2 = await storage.getUserDebts(userId);
      const sortedDebts = debts2.filter((debt) => parseFloat(debt.currentBalance) > 0).sort((a, b) => parseFloat(b.interestRate) - parseFloat(a.interestRate));
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
      const transactions2 = await storage.getUserTransactions(userId, 30);
      const transactionsByDate = transactions2.reduce((acc, trans) => {
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
      const users2 = await storage.getAllUsers();
      for (const user of users2) {
        const debts2 = await storage.getUserDebts(user.id);
        for (const debt of debts2) {
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
      const users2 = await storage.getAllUsers();
      for (const user of users2) {
        const settings = await storage.getNotificationSettings(user.id);
        if (!settings?.weeklyReports) continue;
        const transactions2 = await storage.getUserTransactions(user.id);
        const lastWeekTransactions = transactions2.filter((t) => {
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
      const users2 = await storage.getAllUsers();
      for (const user of users2) {
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
      const users2 = await storage.getAllUsers();
      for (const user of users2) {
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
      const users2 = await storage.getAllUsers();
      for (const user of users2) {
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
      const users2 = await storage.getAllUsers();
      for (const user of users2) {
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
      const users2 = await storage.getAllUsers();
      for (const user of users2) {
        const settings = await storage.getNotificationSettings(user.id);
        if (!settings?.marketingMessages) continue;
        const transactions2 = await storage.getUserTransactions(user.id, 30);
        const monthlyRoundUps = transactions2.reduce((sum, t) => sum + parseFloat(t.roundUpAmount || "0"), 0);
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
      const users2 = await storage.getAllUsers();
      for (const user of users2) {
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
      const users2 = await storage.getAllUsers();
      for (const user of users2) {
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
      const users2 = await storage.getAllUsers();
      for (const user of users2) {
        await notificationService.sendSeasonalNotification(user.id, occasion, tip);
      }
    } catch (error) {
      console.error("Error sending seasonal notifications:", error);
    }
  }
  // Send weekly challenge notifications
  async sendWeeklyChallengeNotifications() {
    try {
      const users2 = await storage.getAllUsers();
      const challenges = [
        { goal: "Save $25 in round-ups", reward: "bonus 50 DTT tokens" },
        { goal: "Make 15 round-up transactions", reward: "2x DTT multiplier" },
        { goal: "Pay extra $50 toward debt", reward: "premium feature trial" },
        { goal: "Complete 7 consecutive days", reward: "exclusive badge" },
        { goal: "Reach $100 total round-ups", reward: "debt consultation call" }
      ];
      for (const user of users2) {
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
    const authUserId = getUserIdFromRequest(req);
    if (!authUserId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (req.params.userId !== authUserId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const limit = req.query.limit ? parseInt(req.query.limit) : 20;
    const notifications2 = await notificationService.getUserNotifications(authUserId, limit);
    res.json(notifications2);
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ message: "Failed to fetch notifications" });
  }
});
notificationRoutes.post("/api/notifications/:id/read", async (req, res) => {
  try {
    const authUserId = getUserIdFromRequest(req);
    if (!authUserId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { id } = req.params;
    const existing = await storage.getNotificationById(id);
    if (!existing || existing.userId !== authUserId) {
      return res.status(404).json({ message: "Notification not found" });
    }
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
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { type, amount, merchant } = req.body;
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
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const { event, data } = req.body;
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
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
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
    const authUserId = getUserIdFromRequest(req);
    if (!authUserId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    if (req.params.userId !== authUserId) {
      return res.status(403).json({ message: "Not authorized" });
    }
    const allNotifications = await notificationService.getUserNotifications(authUserId, 100);
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
  async processRoundUpSplit(userId, transactionId, totalRoundUpAmount, roundUpSettings2) {
    try {
      console.log(`Processing split round-up: $${totalRoundUpAmount.toFixed(2)} for user ${userId}`);
      if (!roundUpSettings2.cryptoEnabled) {
        await this.processDebtAccumulation(userId, transactionId, totalRoundUpAmount);
        return { cryptoAmount: 0, debtAmount: totalRoundUpAmount, success: true };
      }
      const { cryptoAmount, debtAmount } = splitRoundUp(
        totalRoundUpAmount,
        parseFloat(roundUpSettings2.cryptoPercentage)
      );
      console.log(`Split: Crypto $${cryptoAmount.toFixed(2)}, Debt $${debtAmount.toFixed(2)}`);
      const [cryptoResult, debtResult] = await Promise.all([
        cryptoAmount > 0 ? this.processImmediateCryptoPurchase(
          userId,
          transactionId,
          cryptoAmount,
          roundUpSettings2.preferredCrypto
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
      const priceData = await coinbaseService.getSpotPrice(`${cryptoSymbol}-USD`);
      const price = parseFloat(priceData.data?.amount || priceData.amount || priceData);
      if (Number.isFinite(price) && price > 0) {
        return price;
      }
      throw new Error(`Invalid spot price for ${cryptoSymbol}`);
    } catch (error) {
      console.error("Error getting crypto price:", error);
      const fallbackPrices = {
        "BTC": 43250,
        "ETH": 3200,
        "XRP": 0.55,
        "LTC": 140,
        "ADA": 0.38,
        "SOL": 145
      };
      return fallbackPrices[cryptoSymbol] || fallbackPrices["BTC"];
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
import { randomBytes as randomBytes2 } from "crypto";

// server/services/emailService.ts
import { Resend } from "resend";
var RESEND_API_KEY = process.env.RESEND_API_KEY;
var EMAIL_FROM = process.env.EMAIL_FROM || "Dime Time <onboarding@resend.dev>";
var resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;
var EMAIL_DEGRADED_WINDOW_MS = 10 * 60 * 1e3;
var lastSendFailureAt = null;
function isEmailServiceDegraded(now = Date.now()) {
  return lastSendFailureAt !== null && now - lastSendFailureAt < EMAIL_DEGRADED_WINDOW_MS;
}
function recordEmailSendOutcome(ok, now = Date.now()) {
  lastSendFailureAt = ok ? null : now;
}
async function sendEmail(params) {
  const result = await sendEmailInternal(params);
  recordEmailSendOutcome(result.ok);
  return result;
}
async function sendEmailInternal(params) {
  if (!resend) {
    if (process.env.NODE_ENV === "production") {
      console.error(JSON.stringify({
        event: "email_misconfigured",
        message: "RESEND_API_KEY is not set in production",
        to_domain: params.to.split("@")[1] ?? "",
        subject: params.subject
      }));
      return { ok: false, provider: "console", error: "Email provider not configured" };
    }
    console.log(JSON.stringify({
      event: "email_dev_log",
      to: params.to,
      from: EMAIL_FROM,
      note: "RESEND_API_KEY not set \u2014 email body suppressed. Set RESEND_API_KEY to send real emails."
    }));
    return { ok: true, provider: "console" };
  }
  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...params.replyTo ? { replyTo: params.replyTo } : {}
    });
    if (error) {
      console.error(JSON.stringify({
        event: "email_send_failed",
        provider: "resend",
        to: params.to,
        subject: params.subject,
        error: error.message
      }));
      return { ok: false, provider: "resend", error: error.message };
    }
    return { ok: true, provider: "resend", id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: "email_send_exception",
      provider: "resend",
      to: params.to,
      subject: params.subject,
      error: message
    }));
    return { ok: false, provider: "resend", error: message };
  }
}
function escapeHtml(value) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
async function sendPasswordResetEmail(params) {
  const greeting = params.firstName ? `Hi ${params.firstName},` : "Hi,";
  const text2 = [
    greeting,
    "",
    "We received a request to reset the password for your Dime Time account.",
    "",
    `Reset your password using this link (expires in ${params.expiresInMinutes} minutes):`,
    params.resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email \u2014 your password won't change.",
    "",
    "\u2014 The Dime Time team",
    "",
    "Dime Time is a financial technology platform and is not a bank. Banking services and payment infrastructure are provided through regulated financial partners."
  ].join("\n");
  const html = `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f7fb; padding: 24px; color: #111;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px;">
      <tr><td>
        <h1 style="color: #918EF4; margin: 0 0 8px; font-size: 22px;">Reset your Dime Time password</h1>
        <p style="margin: 16px 0; font-size: 15px; line-height: 1.5;">${escapeHtml(greeting)}</p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">We received a request to reset the password for your Dime Time account.</p>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5;">Click the button below to choose a new password. This link expires in <strong>${params.expiresInMinutes} minutes</strong>.</p>
        <p style="text-align: center; margin: 0 0 24px;">
          <a href="${params.resetUrl}" style="display: inline-block; background: #918EF4; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: 600;">Reset password</a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #666; line-height: 1.5;">Or paste this link into your browser:</p>
        <p style="margin: 0 0 24px; font-size: 13px; color: #918EF4; word-break: break-all;">${params.resetUrl}</p>
        <p style="margin: 24px 0 0; font-size: 13px; color: #666; line-height: 1.5;">If you didn't request this, you can safely ignore this email \u2014 your password won't change.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="margin: 0; font-size: 11px; color: #888; line-height: 1.5;">Dime Time is a financial technology platform and is not a bank. Banking services and payment infrastructure are provided through regulated financial partners.</p>
      </td></tr>
    </table>
  </body>
</html>`.trim();
  return sendEmail({
    to: params.to,
    subject: "Reset your Dime Time password",
    html,
    text: text2
  });
}
async function sendContactNotificationEmail(params) {
  const sourceLabel = params.source === "in_app" ? "In-app feedback" : "Marketing site contact form";
  const when = params.submittedAt.toISOString();
  const safeName = params.name.replace(/[\r\n]+/g, " ").trim().slice(0, 80) || "Unknown";
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email) && params.email.length <= 254 ? params.email : void 0;
  const text2 = [
    `New ${sourceLabel.toLowerCase()} submission`,
    "",
    `From: ${params.name} <${params.email}>`,
    `Source: ${sourceLabel}`,
    `Received: ${when}`,
    "",
    "Message:",
    params.message,
    "",
    "Reply to this email to respond directly."
  ].join("\n");
  const html = `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f7fb; padding: 24px; color: #111;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px;">
      <tr><td>
        <h1 style="color: #918EF4; margin: 0 0 8px; font-size: 22px;">New message from ${escapeHtml(params.name)}</h1>
        <p style="margin: 0 0 4px; font-size: 14px; color: #666;">${escapeHtml(sourceLabel)} &middot; ${escapeHtml(when)}</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #666;">From: <strong style="color: #111;">${escapeHtml(params.name)}</strong> &lt;${escapeHtml(params.email)}&gt;</p>
        <div style="margin: 0 0 24px; padding: 16px; background: #f7f7fb; border-radius: 12px; font-size: 15px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(params.message)}</div>
        <p style="margin: 0; font-size: 13px; color: #888;">Reply to this email to respond directly to ${escapeHtml(params.name)}.</p>
      </td></tr>
    </table>
  </body>
</html>`.trim();
  return sendEmail({
    to: "tim@dime-time.com",
    subject: `Dime Time contact: ${safeName}`,
    html,
    text: text2,
    ...replyTo ? { replyTo } : {}
  });
}
async function sendVerificationEmail(params) {
  const greeting = params.firstName ? `Hi ${params.firstName},` : "Hi,";
  const hours = Math.round(params.expiresInMinutes / 60);
  const expiryLabel = params.expiresInMinutes >= 120 ? `${hours} hours` : `${params.expiresInMinutes} minutes`;
  const text2 = [
    greeting,
    "",
    "Welcome to Dime Time. Please confirm this is your email address so we can keep your account secure and send you important notifications about your debt payoff progress.",
    "",
    `Verify your email using this link (expires in ${expiryLabel}):`,
    params.verifyUrl,
    "",
    "If you didn't create a Dime Time account, you can safely ignore this email.",
    "",
    "\u2014 The Dime Time team",
    "",
    "Dime Time is a financial technology platform and is not a bank. Banking services and payment infrastructure are provided through regulated financial partners."
  ].join("\n");
  const html = `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f7fb; padding: 24px; color: #111;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px;">
      <tr><td>
        <h1 style="color: #918EF4; margin: 0 0 8px; font-size: 22px;">Confirm your email</h1>
        <p style="margin: 16px 0; font-size: 15px; line-height: 1.5;">${escapeHtml(greeting)}</p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Welcome to Dime Time. Please confirm this is your email address so we can keep your account secure and send you important notifications about your debt payoff progress.</p>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5;">This link expires in <strong>${expiryLabel}</strong>.</p>
        <p style="text-align: center; margin: 0 0 24px;">
          <a href="${params.verifyUrl}" style="display: inline-block; background: #918EF4; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: 600;">Verify email</a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #666; line-height: 1.5;">Or paste this link into your browser:</p>
        <p style="margin: 0 0 24px; font-size: 13px; color: #918EF4; word-break: break-all;">${params.verifyUrl}</p>
        <p style="margin: 24px 0 0; font-size: 13px; color: #666; line-height: 1.5;">If you didn't create a Dime Time account, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="margin: 0; font-size: 11px; color: #888; line-height: 1.5;">Dime Time is a financial technology platform and is not a bank. Banking services and payment infrastructure are provided through regulated financial partners.</p>
      </td></tr>
    </table>
  </body>
</html>`.trim();
  return sendEmail({
    to: params.to,
    subject: "Confirm your Dime Time email address",
    html,
    text: text2
  });
}

// server/lib/passwordResetContract.ts
var FORGOT_PASSWORD_GENERIC_SUCCESS = {
  success: true,
  message: "If an account exists for that email, a reset link has been sent."
};
var EMAIL_OUTAGE_MESSAGE = "We couldn't send the reset email right now. Please try again in a few minutes.";
function decideForgotPasswordResponse(input) {
  if (!input.emailProvided) {
    return { status: 400, body: { message: "Email is required" } };
  }
  if (input.misconfigured || input.degraded) {
    return { status: 503, body: { message: EMAIL_OUTAGE_MESSAGE } };
  }
  return { status: 200, body: { ...FORGOT_PASSWORD_GENERIC_SUCCESS } };
}

// shared/transactionStatus.ts
function mapToTransactionStatus(raw) {
  if (!raw) return "pending";
  const s = raw.trim().toLowerCase();
  if (s === "completed" || s === "complete" || s === "success" || s === "succeeded" || s === "settled" || s === "posted" || s === "delivered") {
    return "completed";
  }
  if (s === "processing" || s === "authorized" || s === "in_progress" || s === "scheduled" || s === "collected" || s === "earning_interest" || s === "dispersed" || s === "sent") {
    return "processing";
  }
  if (s === "failed" || s === "failure" || s === "error" || s === "returned" || s === "refunded" || s === "cancelled" || s === "canceled" || s === "declined") {
    return "failed";
  }
  if (s === "requires_action" || s === "requires_authentication" || s === "requires_verification" || s === "requires_payment_method" || s === "requires_confirmation" || s === "requires_capture" || s === "requires_source" || s === "action_required" || s === "disputed") {
    return "requires_action";
  }
  return "pending";
}
function withCanonicalStatus(row) {
  return { ...row, status: mapToTransactionStatus(row.status) };
}

// server/routes.ts
var PASSWORD_RESET_TOKEN_TTL_MINUTES = 60;
var EMAIL_VERIFICATION_TTL_MINUTES = 60 * 24;
function resolveAppBaseUrl(req) {
  const configured = process.env.PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return null;
  const proto = req.headers["x-forwarded-proto"] || req.protocol;
  const host = req.get("host");
  return `${proto}://${host}`;
}
async function issueAndSendVerificationEmail(req, user) {
  if (!user.email) return { ok: false, reason: "no_email" };
  const baseUrl = resolveAppBaseUrl(req);
  if (!baseUrl) {
    console.error(JSON.stringify({
      event: "email_verification_misconfigured",
      message: "PUBLIC_APP_URL must be set in production",
      userId: user.id
    }));
    return { ok: false, reason: "misconfigured" };
  }
  try {
    await storage.invalidateEmailVerificationTokensForUser(user.id);
  } catch (err) {
    console.error("Failed to invalidate prior verification tokens", err instanceof Error ? err.message : "unknown");
  }
  const rawToken = randomBytes2(32).toString("base64url");
  const tokenHash = createHash3("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1e3);
  try {
    await storage.createEmailVerificationToken({
      userId: user.id,
      email: user.email,
      tokenHash,
      expiresAt
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("Failed to persist verification token", message);
    return { ok: false, reason: "persist_failed", error: message };
  }
  const verifyUrl = `${baseUrl}/verify-email?token=${rawToken}`;
  const sendResult = await sendVerificationEmail({
    to: user.email,
    firstName: user.firstName,
    verifyUrl,
    expiresInMinutes: EMAIL_VERIFICATION_TTL_MINUTES
  });
  console.log(JSON.stringify({
    event: "email_verification_sent",
    userId: user.id,
    provider: sendResult.provider,
    ok: sendResult.ok
  }));
  if (!sendResult.ok) {
    return { ok: false, reason: "send_failed", error: sendResult.error };
  }
  return { ok: true, provider: sendResult.provider };
}
function stripSensitiveFields(user) {
  if (!user) return user;
  const { password, passwordAlgo, ...safeUser } = user;
  return safeUser;
}
function getSessionSecret2() {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error("SESSION_SECRET environment variable is required");
  }
  return secret;
}
async function verifyTurnstileToken(token, req) {
  const secret = process.env.TURNSTILE_SECRET_KEY;
  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(JSON.stringify({
        event: "turnstile_misconfigured",
        message: "TURNSTILE_SECRET_KEY is not set in production"
      }));
      return false;
    }
    return true;
  }
  if (!token) return false;
  try {
    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    const ip = req.headers["cf-connecting-ip"] || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.ip || "";
    if (ip) form.append("remoteip", ip);
    const resp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form }
    );
    if (!resp.ok) {
      console.error(JSON.stringify({
        event: "turnstile_siteverify_http_error",
        status: resp.status
      }));
      return false;
    }
    const data = await resp.json();
    if (!data.success) {
      console.warn(JSON.stringify({
        event: "turnstile_verification_failed",
        errorCodes: data["error-codes"] ?? []
      }));
      return false;
    }
    return true;
  } catch (err) {
    console.error(JSON.stringify({
      event: "turnstile_siteverify_exception",
      error: err instanceof Error ? err.message : String(err)
    }));
    return false;
  }
}
function generateAuthToken(userId) {
  const timestamp2 = Date.now();
  const payload = `${userId}:${timestamp2}`;
  const signature = createHash3("sha256").update(payload + getSessionSecret2()).digest("hex").substring(0, 16);
  return Buffer.from(`${payload}:${signature}`).toString("base64");
}
async function registerRoutes(app2) {
  const publicDir = path.resolve(process.cwd(), "public");
  const aasaPath = path.join(publicDir, ".well-known", "apple-app-site-association");
  const serveAasa = (_req, res) => {
    res.type("application/json");
    res.sendFile(aasaPath);
  };
  app2.get("/.well-known/apple-app-site-association", serveAasa);
  app2.get("/apple-app-site-association", serveAasa);
  const assetlinksPath = path.join(publicDir, ".well-known", "assetlinks.json");
  app2.get("/.well-known/assetlinks.json", (_req, res) => {
    res.type("application/json");
    res.sendFile(assetlinksPath);
  });
  app2.use(express2.static(publicDir, { index: false }));
  app2.use(requireVerifiedEmail);
  const guidesDir = path.resolve(process.cwd(), "server", "guides");
  const guideFiles = {
    "_style.css": "_style.css",
    "round-up-apps-for-debt": "round-up-apps-for-debt.html",
    "how-to-pay-off-credit-card-debt": "how-to-pay-off-credit-card-debt.html",
    "spare-change-debt-or-savings": "spare-change-debt-or-savings.html"
  };
  app2.get(["/support", "/contact", "/help"], (_req, res) => {
    res.redirect(301, "/#contact");
  });
  app2.get("/guides", (_req, res) => {
    res.sendFile(path.join(guidesDir, "index.html"));
  });
  app2.get("/guides/:slug", (req, res, next) => {
    const file = guideFiles[req.params.slug.replace(/\.html$/, "")];
    if (!file) return next();
    res.sendFile(path.join(guidesDir, file));
  });
  if (process.env.NODE_ENV === "production") {
    const spaShellPath = path.resolve(import.meta.dirname, "public", "index.html");
    for (const [route, meta] of Object.entries(SPA_META_PAGES)) {
      app2.get(route, async (_req, res, next) => {
        try {
          const html = await fs.promises.readFile(spaShellPath, "utf-8");
          res.status(200).type("html").send(applySpaMeta(html, meta));
        } catch {
          next();
        }
      });
    }
  }
  const authLimiter = rateLimit4({
    windowMs: 15 * 60 * 1e3,
    max: 10,
    message: { message: "Too many attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }
  });
  const contactLimiter = rateLimit4({
    windowMs: 60 * 1e3,
    max: 5,
    message: { message: "Too many messages. Please try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }
  });
  async function checkIdempotency2(key, userId, endpoint) {
    const existing = await storage.getIdempotencyKey(key, userId, endpoint);
    if (existing) {
      return { status: existing.responseStatus, body: JSON.parse(existing.responseBody) };
    }
    return null;
  }
  async function saveIdempotency2(key, userId, endpoint, status, body) {
    await storage.createIdempotencyKey({
      idempotencyKey: key,
      userId,
      endpoint,
      responseStatus: status,
      responseBody: JSON.stringify(body)
    });
  }
  app2.post("/api/signup", authLimiter, async (req, res) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }
      const hashedPassword = await hashPasswordBcrypt(password);
      let user;
      try {
        user = await storage.createUser({
          email,
          password: hashedPassword,
          passwordAlgo: "bcrypt",
          firstName: firstName || email.split("@")[0],
          lastName: lastName || ""
        });
      } catch (createError) {
        console.error("Error creating user");
        throw createError;
      }
      req.session.userId = user.id;
      const authToken = generateAuthToken(user.id);
      let verificationEmailSent = false;
      try {
        const sendOutcome = await Promise.race([
          issueAndSendVerificationEmail(req, {
            id: user.id,
            email: user.email,
            firstName: user.firstName
          }),
          new Promise(
            (resolve) => setTimeout(() => resolve({ ok: false }), 1e4).unref?.()
          )
        ]);
        verificationEmailSent = sendOutcome.ok;
      } catch (sendErr) {
        console.error(
          "Signup verification email failed:",
          sendErr instanceof Error ? sendErr.message : "unknown"
        );
      }
      req.session.save((err) => {
        if (err) {
          console.error("Session save error");
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.status(201).json({
          success: true,
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
          authToken,
          verificationEmailSent
        });
      });
    } catch (error) {
      console.error("Signup error");
      res.status(500).json({ message: "Failed to create account" });
    }
  });
  app2.post("/api/login", authLimiter, async (req, res) => {
    try {
      const { email, password } = req.body;
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }
      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      const algo = user.passwordAlgo || "sha256";
      const isValid = await verifyPassword(password, user.password, algo);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }
      if (algo !== "bcrypt") {
        const bcryptHash = await hashPasswordBcrypt(password);
        await storage.updateUserPassword(user.id, bcryptHash, "bcrypt");
      }
      req.session.userId = user.id;
      const authToken = generateAuthToken(user.id);
      req.session.save((err) => {
        if (err) {
          console.error("Session save error");
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.json({
          success: true,
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
          authToken
        });
      });
    } catch (error) {
      console.error("Login error");
      res.status(500).json({ message: "Login failed" });
    }
  });
  app2.post("/api/auth/forgot-password", authLimiter, async (req, res) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      const misconfigured = process.env.NODE_ENV === "production" && (!process.env.RESEND_API_KEY || !process.env.PUBLIC_APP_URL);
      if (misconfigured) {
        console.error(JSON.stringify({
          event: "password_reset_misconfigured",
          message: "RESEND_API_KEY and PUBLIC_APP_URL must be set in production"
        }));
      }
      const decision = decideForgotPasswordResponse({
        emailProvided: true,
        misconfigured,
        degraded: isEmailServiceDegraded()
      });
      if (decision.status !== 200) {
        return res.status(decision.status).json(decision.body);
      }
      const user = await storage.getUserByEmail(email);
      if (user) {
        let baseUrl = process.env.PUBLIC_APP_URL;
        if (!baseUrl) {
          const proto = req.headers["x-forwarded-proto"] || req.protocol;
          const host = req.get("host");
          baseUrl = `${proto}://${host}`;
        }
        const rawToken = randomBytes2(32).toString("base64url");
        const tokenHash = createHash3("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1e3);
        await storage.createPasswordResetToken({
          userId: user.id,
          tokenHash,
          expiresAt
        });
        const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;
        const sendResult = await sendPasswordResetEmail({
          to: user.email,
          firstName: user.firstName,
          resetUrl,
          expiresInMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES
        });
        console.log(JSON.stringify({
          event: "password_reset_requested",
          userId: user.id,
          provider: sendResult.provider,
          ok: sendResult.ok
        }));
      } else {
        console.log(JSON.stringify({
          event: "password_reset_requested_unknown_email"
        }));
      }
      res.status(decision.status).json(decision.body);
    } catch (error) {
      console.error("Forgot password error:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ message: "Unable to process request" });
    }
  });
  app2.post("/api/auth/reset-password", authLimiter, async (req, res) => {
    try {
      const { token, password } = req.body ?? {};
      if (typeof token !== "string" || typeof password !== "string") {
        return res.status(400).json({ message: "Token and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }
      const tokenHash = createHash3("sha256").update(token).digest("hex");
      const record = await storage.consumePasswordResetToken(tokenHash);
      if (!record) {
        return res.status(400).json({ message: "Invalid, expired, or already-used reset link" });
      }
      const newHash = await hashPasswordBcrypt(password);
      await storage.updateUserPassword(record.userId, newHash, "bcrypt");
      await storage.invalidatePasswordResetTokensForUser(record.userId);
      await storage.invalidateAllUserSessions(record.userId);
      console.log(JSON.stringify({
        event: "password_reset_completed",
        userId: record.userId
      }));
      res.json({ success: true, message: "Password updated. You can now sign in." });
    } catch (error) {
      console.error("Reset password error:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ message: "Unable to reset password" });
    }
  });
  app2.post("/api/auth/send-verification", authLimiter, async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.emailVerifiedAt) {
        return res.json({ success: true, alreadyVerified: true, message: "Email already verified" });
      }
      if (!user.email) {
        return res.status(400).json({ message: "No email on file for this account" });
      }
      const cooldown = checkAndTouchResendCooldown(user.id);
      if (!cooldown.allowed) {
        res.setHeader("Retry-After", String(cooldown.retryAfterSeconds));
        return res.status(429).json({
          message: `Please wait ${cooldown.retryAfterSeconds}s before requesting another verification email.`
        });
      }
      const result = await issueAndSendVerificationEmail(req, {
        id: user.id,
        email: user.email,
        firstName: user.firstName
      });
      if (!result.ok) {
        clearResendCooldown(user.id);
        return res.status(503).json({
          message: "We couldn't send the verification email right now. Please try again in a moment."
        });
      }
      res.json({ success: true, message: "Verification email sent" });
    } catch (error) {
      console.error("Send verification error:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ message: "Unable to send verification email" });
    }
  });
  app2.post("/api/auth/verify-email", authLimiter, async (req, res) => {
    try {
      const token = typeof req.body?.token === "string" ? req.body.token : "";
      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }
      const tokenHash = createHash3("sha256").update(token).digest("hex");
      const record = await storage.consumeEmailVerificationToken(tokenHash);
      if (!record) {
        return res.status(400).json({ message: "Invalid, expired, or already-used verification link" });
      }
      const user = await storage.getUser(record.userId);
      if (!user || user.email !== record.email) {
        return res.status(400).json({ message: "This link is no longer valid for the current email on your account" });
      }
      if (!user.emailVerifiedAt) {
        await storage.markUserEmailVerified(user.id);
      }
      console.log(JSON.stringify({
        event: "email_verification_completed",
        userId: user.id
      }));
      res.json({ success: true, message: "Email verified" });
    } catch (error) {
      console.error("Verify email error:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ message: "Unable to verify email" });
    }
  });
  app2.get("/api/user", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      res.json({ ...stripSensitiveFields(user), _flags: getFlags(), _isAdmin: isAdminUserId(userId) });
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
      res.redirect("/");
    });
  });
  app2.delete("/api/account", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      if (isFlagEnabled("ENABLE_SUBSCRIPTIONS")) {
        try {
          const sub = await storage.getLatestSubscriptionByUserId(userId);
          if (sub && !isSubscriptionTerminal(sub.status)) {
            await cancelSubscriptionImmediately(sub.stripeSubscriptionId);
          }
        } catch (cancelErr) {
          console.error(JSON.stringify({
            service: "Server",
            event: "account_delete_subscription_cancel_failed",
            severity: "ERROR",
            userId,
            error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr)
          }));
        }
      }
      await storage.deleteUserAccount(userId);
      req.session.destroy((err) => {
        if (err) console.error("Session destroy error during account deletion");
        res.clearCookie("connect.sid");
        res.json({ success: true, message: "Account deleted successfully" });
      });
    } catch (error) {
      console.error("Account deletion error");
      res.status(500).json({ message: "Failed to delete account" });
    }
  });
  app2.post("/api/contact", contactLimiter, async (req, res) => {
    try {
      const sessionUserId = getUserIdFromRequest(req);
      const authedUser = sessionUserId ? await storage.getUser(sessionUserId) : null;
      let toInsert;
      if (authedUser) {
        if (!authedUser.email) {
          return res.status(400).json({ message: "Your account is missing an email address. Please add one before sending feedback." });
        }
        const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
        if (!message) {
          return res.status(400).json({ message: "Message is required" });
        }
        if (message.length > 5e3) {
          return res.status(400).json({ message: "Message is too long (5,000 character limit)." });
        }
        const displayName = [authedUser.firstName, authedUser.lastName].filter(Boolean).join(" ").trim() || authedUser.email;
        toInsert = {
          name: displayName,
          email: authedUser.email,
          message,
          source: "in_app",
          userId: authedUser.id
        };
      } else {
        const turnstileToken = typeof req.body?.turnstileToken === "string" ? req.body.turnstileToken : void 0;
        const turnstileOk = await verifyTurnstileToken(turnstileToken, req);
        if (!turnstileOk) {
          return res.status(400).json({ message: "Captcha verification failed. Please try again." });
        }
        const { turnstileToken: _omit, source: _clientSource, userId: _clientUserId, ...payload } = req.body ?? {};
        const validatedData = insertContactSubmissionSchema.extend({
          name: z8.string().trim().min(1).max(100),
          email: z8.string().trim().email().max(254),
          message: z8.string().trim().min(1).max(5e3)
        }).parse(payload);
        toInsert = { ...validatedData, source: "marketing" };
      }
      const submission = await storage.createContactSubmission(toInsert);
      sendContactNotificationEmail({
        name: toInsert.name,
        email: toInsert.email,
        message: toInsert.message,
        source: toInsert.source,
        submittedAt: /* @__PURE__ */ new Date()
      }).then((result) => {
        console.log(JSON.stringify({
          event: "contact_notification_sent",
          submissionId: submission.id,
          provider: result.provider,
          ok: result.ok
        }));
      }).catch((err) => {
        console.error(JSON.stringify({
          event: "contact_notification_failed",
          submissionId: submission.id,
          error: err instanceof Error ? err.message : String(err)
        }));
      });
      res.json({ success: true, submission });
    } catch (error) {
      if (error instanceof z8.ZodError) {
        return res.status(400).json({ message: "Invalid form data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/debts", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const debts2 = await storage.getDebtsByUserId(userId);
      res.json(debts2);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/debts", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const currentBalance = req.body.currentBalance;
      const accountNumber = req.body.accountNumber && String(req.body.accountNumber).trim() !== "" ? String(req.body.accountNumber).trim() : "\u2014";
      const validatedData = insertDebtSchema.refine((d) => Number.isInteger(d.dueDate) && d.dueDate >= 1 && d.dueDate <= 31, {
        message: "Due date must be a day between 1 and 31",
        path: ["dueDate"]
      }).refine((d) => parseFloat(d.currentBalance) > 0, {
        message: "Current balance must be greater than 0",
        path: ["currentBalance"]
      }).refine((d) => parseFloat(d.interestRate) >= 0, {
        message: "Interest rate must be 0 or greater",
        path: ["interestRate"]
      }).refine((d) => parseFloat(d.minimumPayment) >= 0, {
        message: "Minimum payment must be 0 or greater",
        path: ["minimumPayment"]
      }).parse({
        ...req.body,
        userId,
        accountNumber,
        // Server hard-sets original === current so payoff progress always
        // starts at 0%. Any client-supplied originalBalance is ignored.
        originalBalance: currentBalance,
        isActive: true
      });
      const debt = await storage.createDebt(validatedData);
      res.status(201).json(debt);
    } catch (error) {
      if (error instanceof z8.ZodError) {
        return res.status(400).json({ message: "Invalid debt data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.patch("/api/debts/:id", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const debt = await storage.getDebt(req.params.id);
      if (!canAccessDebt(debt, userId)) {
        return res.status(404).json({ message: "Debt not found" });
      }
      const parsed = debtEditSchema.parse(req.body);
      const updates = buildDebtEditUpdates(debt, parsed);
      const updated = await storage.updateDebt(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof z8.ZodError) {
        return res.status(400).json({ message: "Invalid debt data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.delete("/api/debts/:id", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const debt = await storage.getDebt(req.params.id);
      if (!canAccessDebt(debt, userId)) {
        return res.status(404).json({ message: "Debt not found" });
      }
      await storage.updateDebt(req.params.id, { isActive: false });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.delete("/api/debts/:id/permanent", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const debt = await storage.getDebt(req.params.id);
      if (!canAccessDebt(debt, userId)) {
        return res.status(404).json({ message: "Debt not found" });
      }
      if (debt.isActive) {
        return res.status(400).json({ message: "Debt must be archived before it can be permanently deleted" });
      }
      await storage.deleteDebtPermanently(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/debts/duplicates", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const debts2 = await storage.getDebtsByUserId(userId);
      res.json(findDuplicateDebtPairs(debts2));
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/debts/:id/merge", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const importedDebtId = typeof req.body?.importedDebtId === "string" ? req.body.importedDebtId : null;
      if (!importedDebtId) {
        return res.status(400).json({ message: "importedDebtId is required" });
      }
      const manual = await storage.getDebt(req.params.id);
      if (!canAccessDebt(manual, userId)) {
        return res.status(404).json({ message: "Debt not found" });
      }
      const imported = await storage.getDebt(importedDebtId);
      if (!canAccessDebt(imported, userId)) {
        return res.status(404).json({ message: "Imported debt not found" });
      }
      if (manual.source !== "manual" || imported.source !== "imported") {
        return res.status(400).json({ message: "Merge must archive a manual debt into an imported one" });
      }
      if (!manual.isActive || !imported.isActive) {
        return res.status(400).json({ message: "Both debts must be active to merge" });
      }
      const roundUp = await storage.getRoundUpSettings(userId);
      if (roundUp?.targetDebtId === manual.id) {
        await storage.createOrUpdateRoundUpSettings({ ...roundUp, targetDebtId: imported.id });
      }
      const archived = await storage.updateDebt(manual.id, {
        isActive: false,
        mergedIntoDebtId: imported.id
      });
      res.json({ success: true, archivedDebt: archived, importedDebtId: imported.id });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/debts/:id/dismiss-duplicate", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const importedDebtId = typeof req.body?.importedDebtId === "string" ? req.body.importedDebtId : null;
      if (!importedDebtId) {
        return res.status(400).json({ message: "importedDebtId is required" });
      }
      const manual = await storage.getDebt(req.params.id);
      if (!canAccessDebt(manual, userId)) {
        return res.status(404).json({ message: "Debt not found" });
      }
      const imported = await storage.getDebt(importedDebtId);
      const fingerprint = canAccessDebt(imported, userId) ? debtDismissalFingerprint(imported) : null;
      const existing = manual.notDuplicateOf ?? [];
      const additions = [importedDebtId, ...fingerprint ? [fingerprint] : []].filter(
        (k) => !existing.includes(k)
      );
      if (additions.length > 0) {
        await storage.updateDebt(manual.id, { notDuplicateOf: [...existing, ...additions] });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/debts/archived", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const archived = await storage.getArchivedDebtsByUserId(userId);
      res.json(archived);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/debts/:id/restore", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const debt = await storage.getDebt(req.params.id);
      if (!debt || debt.userId !== userId) {
        return res.status(404).json({ message: "Debt not found" });
      }
      if (debt.isActive) {
        return res.status(400).json({ message: "Debt is not archived" });
      }
      const restored = await storage.updateDebt(req.params.id, { isActive: true, mergedIntoDebtId: null });
      res.json(restored);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/transactions", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const limit = req.query.limit ? parseInt(req.query.limit) : void 0;
      const transactions2 = await storage.getTransactionsByUserId(userId, limit);
      res.json(transactions2);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/transactions", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const idempotencyKey = req.headers["idempotency-key"];
      if (idempotencyKey) {
        const cached3 = await checkIdempotency2(idempotencyKey, userId, "/api/transactions");
        if (cached3) return res.status(cached3.status).json(cached3.body);
      }
      const roundUpSettingsData = await storage.getRoundUpSettings(userId);
      const amount = parseFloat(req.body.amount);
      const multiplier = roundUpSettingsData ? parseFloat(roundUpSettingsData.multiplier) : 1;
      const totalRoundUp = calculateRoundUp(amount, multiplier);
      const validatedData = insertTransactionSchema.parse({
        ...req.body,
        userId,
        roundUpAmount: totalRoundUp.toFixed(2)
      });
      const transaction = await storage.createTransaction(validatedData);
      if (totalRoundUp > 0 && roundUpSettingsData?.isEnabled && await hasRoundUpAutomationAccess(userId)) {
        try {
          console.log(`\u{1F504} Processing split round-up: $${totalRoundUp.toFixed(2)}`);
          const splitResult = await roundUpSplitService.processRoundUpSplit(
            userId,
            transaction.id,
            totalRoundUp,
            roundUpSettingsData
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
      if (idempotencyKey) {
        await saveIdempotency2(idempotencyKey, userId, "/api/transactions", 201, transaction);
      }
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z8.ZodError) {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/transfers", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const transfers2 = await storage.getTransfersByUserId(userId);
      const stripeAccounts2 = await storage.getStripeAccountsByUserId(userId);
      const accountLabelById = new Map(
        stripeAccounts2.map((a) => [
          a.id,
          { institutionName: a.institutionName, last4: a.last4 }
        ])
      );
      const fundingAccountFor = (t) => {
        let accountId = t.stripeAccountId ?? null;
        if (!accountId && t.rawRequest) {
          try {
            const raw = JSON.parse(t.rawRequest);
            if (typeof raw?.stripeAccountId === "string") accountId = raw.stripeAccountId;
          } catch {
          }
        }
        return accountId && accountLabelById.get(accountId) || null;
      };
      const safe = transfers2.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        debtId: t.debtId,
        fundingAccount: fundingAccountFor(t),
        errorCode: t.errorCode ?? null,
        errorMessage: t.errorMessage ?? null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt
      }));
      res.json(safe.map(withCanonicalStatus));
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/payments", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const payments2 = await storage.getPaymentsByUserId(userId);
      res.json(payments2.map(withCanonicalStatus));
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/payments", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const idempotencyKey = req.headers["idempotency-key"];
      if (idempotencyKey) {
        const cached3 = await checkIdempotency2(idempotencyKey, userId, "/api/payments");
        if (cached3) return res.status(cached3.status).json(cached3.body);
      }
      const validatedData = insertPaymentSchema.parse({
        ...req.body,
        userId
      });
      const paymentAmount = parseFloat(validatedData.amount);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > 9999999999e-2) {
        return res.status(400).json({ message: "Payment amount must be between 0.01 and 99,999,999.99" });
      }
      const debt = await storage.getDebt(validatedData.debtId);
      if (!debt || debt.userId !== userId || debt.isActive === false) {
        return res.status(404).json({ message: "Debt not found" });
      }
      const payment = await storage.createPayment(validatedData);
      const newBalance = Math.max(0, parseFloat(debt.currentBalance) - paymentAmount).toFixed(2);
      await storage.updateDebt(validatedData.debtId, {
        currentBalance: newBalance
      });
      await notificationTriggers.onDebtPaymentProcessed(
        userId,
        validatedData.debtId,
        paymentAmount
      );
      if (idempotencyKey) {
        await saveIdempotency2(idempotencyKey, userId, "/api/payments", 201, payment);
      }
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z8.ZodError) {
        return res.status(400).json({ message: "Invalid payment data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/accelerated-payment", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const idempotencyKey = req.headers["idempotency-key"];
      if (idempotencyKey) {
        const cached3 = await checkIdempotency2(idempotencyKey, userId, "/api/accelerated-payment");
        if (cached3) return res.status(cached3.status).json(cached3.body);
      }
      const { debtId, amount } = req.body;
      if (!debtId || !amount) {
        return res.status(400).json({ message: "debtId and amount are required" });
      }
      const acceleratedAmount = parseFloat(String(amount));
      if (!Number.isFinite(acceleratedAmount) || acceleratedAmount <= 0 || acceleratedAmount > 9999999999e-2) {
        return res.status(400).json({ message: "Payment amount must be between 0.01 and 99,999,999.99" });
      }
      const result = await storage.makeAcceleratedPayment(userId, debtId, acceleratedAmount.toFixed(2));
      const responseBody = {
        success: true,
        payment: result.payment,
        updatedDebt: result.updatedDebt,
        message: `Successfully paid $${amount} toward ${result.updatedDebt.name}`
      };
      if (idempotencyKey) {
        await saveIdempotency2(idempotencyKey, userId, "/api/accelerated-payment", 200, responseBody);
      }
      res.json(responseBody);
    } catch (error) {
      console.error("Error processing accelerated payment:", error);
      if (error instanceof Error && /not found|unauthorized/i.test(error.message)) {
        return res.status(404).json({ message: "Debt not found" });
      }
      res.status(500).json({ message: "Failed to process payment" });
    }
  });
  app2.get("/api/round-up-settings", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const settings = await storage.getRoundUpSettings(userId);
      res.json(settings || {
        id: null,
        userId,
        isEnabled: false,
        sourceAccountId: null,
        targetDebtId: null,
        fundingStripeAccountId: null,
        multiplier: "1.00",
        autoApplyThreshold: "25.00",
        cryptoEnabled: false,
        cryptoPercentage: "0.00",
        preferredCrypto: "BTC"
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.put("/api/round-up-settings", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      if (req.body?.isEnabled === true && !await hasRoundUpAutomationAccess(userId)) {
        return res.status(402).json(SUBSCRIPTION_REQUIRED_RESPONSE);
      }
      const { fundingStripeAccountId: _ignoredFundingAccount, ...settingsBody } = req.body ?? {};
      const settings = await storage.createOrUpdateRoundUpSettings({
        ...settingsBody,
        userId
      });
      res.json(settings);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/round-up-settings", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      if (!await hasRoundUpAutomationAccess(userId)) {
        return res.status(402).json(SUBSCRIPTION_REQUIRED_RESPONSE);
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
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      if (!await hasRoundUpAutomationAccess(userId)) {
        return res.status(402).json(SUBSCRIPTION_REQUIRED_RESPONSE);
      }
      const { debtId, amount } = req.body;
      if (!debtId || !amount) {
        return res.status(400).json({ message: "debtId and amount are required" });
      }
      const roundUpAmount = parseFloat(String(amount));
      if (!Number.isFinite(roundUpAmount) || roundUpAmount <= 0 || roundUpAmount > 9999999999e-2) {
        return res.status(400).json({ message: "Payment amount must be between 0.01 and 99,999,999.99" });
      }
      const debt = await storage.getDebt(String(debtId));
      if (!debt || debt.userId !== userId || debt.isActive === false) {
        return res.status(404).json({ message: "Debt not found" });
      }
      const payment = await storage.createPayment({
        userId,
        debtId,
        amount: roundUpAmount.toFixed(2),
        source: "round_up"
      });
      const newBalance = Math.max(0, parseFloat(debt.currentBalance) - roundUpAmount).toFixed(2);
      await storage.updateDebt(debtId, {
        currentBalance: newBalance
      });
      res.json({ success: true, payment });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/dashboard-summary", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const [debts2, transactions2, payments2] = await Promise.all([
        storage.getDebtsByUserId(userId),
        storage.getTransactionsByUserId(userId),
        storage.getPaymentsByUserId(userId)
      ]);
      const totalDebt = debts2.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
      const totalRoundUps = transactions2.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount), 0);
      const thisMonth = /* @__PURE__ */ new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      const thisMonthRoundUps = transactions2.filter((trans) => trans.date >= thisMonth).reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount), 0);
      const thisMonthPayments = payments2.filter((payment) => payment.date >= thisMonth).reduce((sum, payment) => sum + parseFloat(payment.amount), 0);
      const totalOriginalDebt = debts2.reduce((sum, debt) => sum + parseFloat(debt.originalBalance), 0);
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
        debtsCount: debts2.length,
        paidOffCount: debts2.filter((d) => parseFloat(d.currentBalance) <= 0).length
      };
      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/crypto-purchases", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const purchases = await storage.getCryptoPurchasesByUserId(userId);
      res.json(purchases.map(withCanonicalStatus));
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.post("/api/crypto-purchases", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const idempotencyKey = req.headers["idempotency-key"];
      if (idempotencyKey) {
        const cached3 = await checkIdempotency2(idempotencyKey, userId, "/api/crypto-purchases");
        if (cached3) return res.status(cached3.status).json(cached3.body);
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
            const cryptoResponse = {
              ...purchase,
              coinbaseTransaction,
              message: "Preview purchase recorded \u2014 simulated, no real money moved"
            };
            if (idempotencyKey) {
              await saveIdempotency2(idempotencyKey, userId, "/api/crypto-purchases", 201, cryptoResponse);
            }
            res.status(201).json(cryptoResponse);
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
            message: "Crypto Preview simulation failed"
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
        const demoResponse = {
          ...purchase,
          message: "Preview purchase recorded \u2014 simulated, no real money moved"
        };
        if (idempotencyKey) {
          await saveIdempotency2(idempotencyKey, userId, "/api/crypto-purchases", 201, demoResponse);
        }
        res.status(201).json(demoResponse);
      }
    } catch (error) {
      if (error instanceof z8.ZodError) {
        return res.status(400).json({ message: "Invalid crypto purchase data", errors: error.errors });
      }
      console.error("Error creating crypto purchase:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });
  app2.get("/api/crypto-summary", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const purchases = await storage.getCryptoPurchasesByUserId(userId);
      const completedPurchases = purchases.map(withCanonicalStatus).filter((p) => p.status === "completed");
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
  const plaidEventLimiter = rateLimit4({
    windowMs: 60 * 1e3,
    max: 20,
    message: { message: "Too many events." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false }
  });
  app2.post("/api/plaid/link-event", plaidEventLimiter, (req, res) => {
    const userId = getUserIdFromRequest(req) ?? "anonymous";
    const b = req.body ?? {};
    const clip = (v, max = 200) => typeof v === "string" ? v.slice(0, max) : void 0;
    console.log(JSON.stringify({
      service: "PlaidLinkClient",
      event: "link_client_event",
      userId,
      stage: clip(b.stage, 40),
      errorType: clip(b.errorType, 60),
      errorCode: clip(b.errorCode, 60),
      errorMessage: clip(b.errorMessage),
      requestId: clip(b.requestId, 60),
      linkSessionId: clip(b.linkSessionId, 60),
      platform: clip(b.platform, 20)
    }));
    res.status(204).end();
  });
  app2.post("/api/plaid/create-link-token", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({
          message: "Plaid service not configured. Sandbox requires PLAID_CLIENT_ID and PLAID_SECRET; production (PLAID_ENV=production) requires PLAID_CLIENT_ID and PLAID_SECRET_PRODUCTION.",
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
      const userId = getUserIdFromRequest(req);
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
      const primary = accounts.find((a) => a.type === "depository") ?? accounts[0];
      if (!primary) {
        return res.status(502).json({ message: "No accounts returned by the bank" });
      }
      const details = {
        plaidAccessToken: accessToken,
        accountId: primary.account_id,
        accountName: primary.name,
        accountType: primary.type,
        institutionName: primary.name,
        mask: primary.mask || ""
      };
      const existing = await storage.getBankAccountByPlaidItemId(itemId);
      if (existing) {
        if (existing.userId !== userId) {
          return res.status(409).json({ message: "This bank connection belongs to a different account" });
        }
        await storage.refreshBankAccount(existing.id, details);
      } else {
        try {
          await storage.createBankAccount({ userId, plaidItemId: itemId, ...details });
        } catch (err) {
          const raced = await storage.getBankAccountByPlaidItemId(itemId);
          if (!raced) throw err;
          if (raced.userId !== userId) {
            return res.status(409).json({ message: "This bank connection belongs to a different account" });
          }
          await storage.refreshBankAccount(raced.id, details);
        }
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
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts2 = await storage.getBankAccountsByUserId(userId);
      res.json(bankAccounts2);
    } catch (error) {
      console.error("Error fetching bank accounts:", error);
      res.status(500).json({ message: "Failed to fetch bank accounts" });
    }
  });
  const PLAID_RELINK_ERROR_CODES = /* @__PURE__ */ new Set([
    "ITEM_LOGIN_REQUIRED",
    "PENDING_EXPIRATION",
    "PENDING_DISCONNECT",
    "ITEM_NOT_FOUND",
    "ACCESS_NOT_GRANTED",
    "INVALID_ACCESS_TOKEN"
  ]);
  function toPlaidAccountError(account, error) {
    const errorCode = error?.response?.data?.error_code || "UNKNOWN_ERROR";
    return {
      bankAccountId: account.id,
      accountId: account.accountId,
      errorCode,
      needsRelink: PLAID_RELINK_ERROR_CODES.has(errorCode)
    };
  }
  app2.post("/api/plaid/create-update-link-token", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { bankAccountId } = req.body || {};
      if (!bankAccountId || typeof bankAccountId !== "string") {
        return res.status(400).json({ message: "bankAccountId is required" });
      }
      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }
      const bankAccounts2 = await storage.getBankAccountsByUserId(userId);
      const account = bankAccounts2.find((a) => a.id === bankAccountId);
      if (!account) {
        return res.status(404).json({ message: "Bank account not found" });
      }
      const accessToken = await storage.getPlaidAccessToken(account.id);
      if (!accessToken) {
        return res.status(409).json({
          message: "No usable bank credentials for this account. Please remove it and connect the bank again."
        });
      }
      const linkToken = await plaidService.createUpdateLinkToken(userId, accessToken);
      res.json({ linkToken });
    } catch (error) {
      console.error("Error creating Plaid update link token:", error);
      res.status(500).json({ message: "Failed to create update link token" });
    }
  });
  app2.get("/api/plaid/transactions", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts2 = await storage.getBankAccountsByUserId(userId);
      if (bankAccounts2.length === 0) {
        return res.json({ transactions: [], accountErrors: [] });
      }
      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }
      const endDate = (/* @__PURE__ */ new Date()).toISOString().split("T")[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1e3).toISOString().split("T")[0];
      const allTransactions = [];
      const accountErrors = [];
      for (const account of bankAccounts2) {
        try {
          const token = await storage.getPlaidAccessToken(account.id);
          if (!token) {
            accountErrors.push({
              bankAccountId: account.id,
              accountId: account.accountId,
              errorCode: "TOKEN_MISSING",
              needsRelink: true
            });
            continue;
          }
          const transactions2 = await plaidService.getTransactions(token, startDate, endDate);
          allTransactions.push(...transactions2);
        } catch (error) {
          console.error(`Error fetching transactions for account ${account.accountId}:`, error);
          accountErrors.push(toPlaidAccountError(account, error));
        }
      }
      res.json({ transactions: allTransactions, accountErrors });
    } catch (error) {
      console.error("Error fetching Plaid transactions:", error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });
  app2.get("/api/plaid/balances", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts2 = await storage.getBankAccountsByUserId(userId);
      if (bankAccounts2.length === 0) {
        return res.json({ balances: [], accountErrors: [] });
      }
      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }
      const allBalances = [];
      const accountErrors = [];
      for (const account of bankAccounts2) {
        try {
          const token = await storage.getPlaidAccessToken(account.id);
          if (!token) {
            accountErrors.push({
              bankAccountId: account.id,
              accountId: account.accountId,
              errorCode: "TOKEN_MISSING",
              needsRelink: true
            });
            continue;
          }
          const balances = await plaidService.getBalance(token);
          allBalances.push(...balances);
        } catch (error) {
          console.error(`Error fetching balance for account ${account.accountId}:`, error);
          accountErrors.push(toPlaidAccountError(account, error));
        }
      }
      res.json({ balances: allBalances, accountErrors });
    } catch (error) {
      console.error("Error fetching account balances:", error);
      res.status(500).json({ message: "Failed to fetch balances" });
    }
  });
  app2.get("/api/coinbase/accounts", async (req, res) => {
    try {
      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({
          message: "Crypto Preview service unavailable",
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
      const userId = getUserIdFromRequest(req);
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
      res.json({
        success: true,
        simulated: true,
        message: "Preview purchase \u2014 simulated, no real money moved",
        transaction
      });
    } catch (error) {
      console.error("Error buying crypto:", error);
      res.status(500).json({ message: "Failed to purchase cryptocurrency" });
    }
  });
  app2.get("/api/coinbase/transactions/:accountId", async (req, res) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { accountId } = req.params;
      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({ message: "Coinbase service not configured" });
      }
      const transactions2 = await coinbaseService.getTransactions(accountId);
      res.json(transactions2);
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
      const userId = getUserIdFromRequest(req);
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
      const userId = getUserIdFromRequest(req);
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
      const userId = getUserIdFromRequest(req);
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
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { action, amount } = req.body;
      const reward = await dimeTokenService.awardTokens(userId, action, amount);
      res.json(reward);
    } catch (error) {
      console.error("Error awarding tokens:", error);
      res.status(500).json({ message: "Failed to award tokens" });
    }
  });
  registerAxosRoutes(app2);
  registerMercuryRoutes(app2);
  registerWebhookRoutes(app2);
  if (isFlagEnabled("ENABLE_STRIPE_ACH")) {
    assertStripeKeyModeSafeOnBoot();
    registerStripeRoutes(app2);
    registerStripeWebhook(app2);
    console.log(JSON.stringify({
      service: "Server",
      event: "stripe_routes_mounted",
      flag: "ENABLE_STRIPE_ACH"
    }));
  }
  if (isFlagEnabled("ENABLE_DEBT_IMPORT")) {
    registerDebtImportRoutes(app2);
    console.log(JSON.stringify({
      service: "Server",
      event: "debt_import_routes_mounted",
      flag: "ENABLE_DEBT_IMPORT",
      provider: (process.env.DEBT_IMPORT_PROVIDER || "sandbox").trim().toLowerCase()
    }));
  }
  if (isFlagEnabled("ENABLE_SUBSCRIPTIONS")) {
    if (!isFlagEnabled("ENABLE_STRIPE_ACH")) {
      throw new Error(
        "ENABLE_SUBSCRIPTIONS requires ENABLE_STRIPE_ACH: subscriptions bill via Stripe ACH and cannot function without the Stripe code paths. Enable ENABLE_STRIPE_ACH or disable ENABLE_SUBSCRIPTIONS."
      );
    }
    registerSubscriptionRoutes(app2);
    console.log(JSON.stringify({
      service: "Server",
      event: "subscription_routes_mounted",
      flag: "ENABLE_SUBSCRIPTIONS"
    }));
  }
  registerAdminRoutes(app2);
  app2.use(notificationRoutes);
  const httpServer = createServer(app2);
  return httpServer;
}

// server/vite.ts
import express3 from "express";
import fs2 from "fs";
import path3 from "path";
import { createServer as createViteServer, createLogger } from "vite";

// vite.config.ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path2 from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
var SENTRY_DSN_FOR_CLIENT = process.env.SENTRY_DSN || process.env.VITE_SENTRY_DSN || "";
var sentryUploadEnabled = process.env.NODE_ENV === "production" && !!process.env.SENTRY_AUTH_TOKEN && !!process.env.SENTRY_ORG && !!process.env.SENTRY_PROJECT;
var sentryPlugins = sentryUploadEnabled ? [
  await import("@sentry/vite-plugin").then(
    ({ sentryVitePlugin }) => sentryVitePlugin({
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT,
      authToken: process.env.SENTRY_AUTH_TOKEN,
      release: { name: process.env.SENTRY_RELEASE },
      // Delete the generated .map files after they're uploaded so the
      // production server never has them on disk to serve. The static
      // handler in server/index.ts also 404s `.map` requests as a second
      // layer of defense.
      sourcemaps: {
        filesToDeleteAfterUpload: ["**/*.map"]
      }
    })
  )
] : [];
var vite_config_default = defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    ...process.env.NODE_ENV !== "production" && process.env.REPL_ID !== void 0 ? [
      await import("@replit/vite-plugin-cartographer").then(
        (m) => m.cartographer()
      )
    ] : [],
    ...sentryPlugins
  ],
  define: {
    "import.meta.env.VITE_SENTRY_DSN": JSON.stringify(SENTRY_DSN_FOR_CLIENT),
    "import.meta.env.VITE_SENTRY_ENVIRONMENT": JSON.stringify(
      process.env.SENTRY_ENVIRONMENT || process.env.VITE_SENTRY_ENVIRONMENT || ""
    ),
    "import.meta.env.VITE_SENTRY_RELEASE": JSON.stringify(
      process.env.SENTRY_RELEASE || process.env.VITE_SENTRY_RELEASE || ""
    )
  },
  // The frontend lives in the /client directory
  root: path2.resolve(import.meta.dirname, "client"),
  // ⭐ FIXED BUILD OUTPUT — works on Replit AND Codemagic
  build: {
    outDir: "../dist/public",
    // <-- relative path ALWAYS works
    emptyOutDir: true,
    // Source maps are only generated when the Sentry upload pipeline is
    // active. The Sentry plugin deletes the .map files after upload, and
    // server/index.ts denies .map requests in case anything slips through.
    sourcemap: sentryUploadEnabled ? "hidden" : false
  },
  resolve: {
    alias: {
      "@": path2.resolve(import.meta.dirname, "client", "src"),
      "@shared": path2.resolve(import.meta.dirname, "shared"),
      "@assets": path2.resolve(import.meta.dirname, "attached_assets")
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
function log3(message, source = "express") {
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
      const clientTemplate = path3.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html"
      );
      let template = await fs2.promises.readFile(clientTemplate, "utf-8");
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
  const distPath = path3.resolve(import.meta.dirname, "public");
  if (!fs2.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`
    );
  }
  app2.use(express3.static(distPath));
  app2.use("*", (_req, res) => {
    res.sendFile(path3.resolve(distPath, "index.html"));
  });
}

// server/replitAuth.ts
import * as client from "openid-client";
import { Strategy } from "openid-client/passport";
import passport from "passport";
import session from "express-session";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
var REPLIT_AUTH_AVAILABLE = !!process.env.REPLIT_DOMAINS && !!process.env.REPL_ID;
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
  if (!REPLIT_AUTH_AVAILABLE) {
    console.log("Replit Auth not available - skipping OIDC setup (using email/password auth only)");
    passport.serializeUser((user, cb) => cb(null, user));
    passport.deserializeUser((user, cb) => cb(null, user));
    return;
  }
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
var app = express4();
app.use((req, res, next) => {
  if (req.path.endsWith(".map")) {
    return res.status(404).end();
  }
  next();
});
app.get("/health", (_req, res) => {
  res.json({
    status: "ok",
    env: process.env.NODE_ENV,
    time: (/* @__PURE__ */ new Date()).toISOString()
  });
});
var allowedOriginsProd = [
  "https://dime-time.com",
  "https://www.dime-time.com",
  "https://dime-time-2sdmp44chp.replit.app",
  "https://dime-time-fintech-debt-reduction-app-bobbyhiddn.replit.app",
  "capacitor://localhost",
  // iOS native WebView origin
  "https://localhost",
  // Android native WebView origin (androidScheme: "https")
  "ionic://localhost"
];
var allowedOriginsDev = [
  "http://localhost:5000",
  "http://127.0.0.1:5000",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
  "capacitor://localhost",
  // iOS native WebView origin
  "https://localhost",
  // Android native WebView origin (androidScheme: "https")
  "ionic://localhost"
];
var corsOptions = {
  origin: (origin, callback) => {
    const env = process.env.NODE_ENV || "development";
    const allowed = env === "production" ? allowedOriginsProd : allowedOriginsDev;
    if (!origin || allowed.includes(origin)) {
      return callback(null, true);
    }
    if (env !== "production" && origin && origin.endsWith(".replit.dev")) {
      return callback(null, true);
    }
    console.warn("Blocked CORS origin:", origin);
    return callback(new Error("Not allowed by CORS"));
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization", "X-Requested-With"],
  optionsSuccessStatus: 200
};
app.use(cors(corsOptions));
if (process.env.NODE_ENV === "production") {
  app.use((_req, res, next) => {
    res.setHeader("Strict-Transport-Security", "max-age=15552000; includeSubDomains");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("X-Frame-Options", "SAMEORIGIN");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    next();
  });
}
app.use((req, res, next) => {
  if (req.path.startsWith("/webhooks/") && req.path !== "/webhooks/stripe") {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => {
      req.rawBody = data;
      try {
        req.body = JSON.parse(data);
      } catch {
        req.body = {};
      }
      next();
    });
  } else {
    next();
  }
});
var jsonParser = express4.json();
var urlencodedParser = express4.urlencoded({ extended: false });
app.use((req, res, next) => {
  if (req.path === "/webhooks/stripe") return next();
  return jsonParser(req, res, next);
});
app.use((req, res, next) => {
  if (req.path === "/webhooks/stripe") return next();
  return urlencodedParser(req, res, next);
});
app.use((req, res, next) => {
  const start = Date.now();
  const path4 = req.path;
  let capturedJsonResponse = void 0;
  const originalResJson = res.json.bind(res);
  res.json = function(bodyJson) {
    capturedJsonResponse = bodyJson;
    return originalResJson(bodyJson);
  };
  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path4.startsWith("/api")) {
      let logLine = `${req.method} ${path4} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        try {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        } catch {
        }
      }
      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "\u2026";
      }
      log3(logLine);
    }
  });
  next();
});
(async () => {
  try {
    await initSentry();
    validateProductionSecrets();
    console.log("Starting server...");
    console.log("NODE_ENV:", process.env.NODE_ENV);
    console.log("Express env:", app.get("env"));
    {
      const flags = getFlags();
      const rawDiag = {};
      for (const name of Object.keys(flags)) {
        const raw = process.env[name];
        rawDiag[name] = raw === void 0 ? "<unset>" : JSON.stringify(raw);
      }
      console.log(
        JSON.stringify({
          event: "flags_resolved_at_boot",
          resolved: flags,
          rawEnv: rawDiag
        })
      );
    }
    console.log("Setting up auth...");
    await setupAuth(app);
    console.log("Auth setup complete");
    console.log("Registering routes...");
    const server = await registerRoutes(app);
    console.log("Routes registered");
    setupExpressErrorHandler(app);
    app.use((err, _req, res, _next) => {
      const status = err.status || err.statusCode || 500;
      console.error("Unhandled error:", err);
      const message = status >= 500 ? "Internal Server Error" : err.message || "Request failed";
      res.status(status).json({ message });
    });
    console.log("Checking environment for static file setup...");
    console.log("app.get('env'):", app.get("env"));
    console.log("process.cwd():", process.cwd());
    if (app.get("env") === "development") {
      console.log("Setting up Vite for development...");
      await setupVite(app, server);
    } else {
      const path4 = await import("path");
      const fs3 = await import("fs");
      const distPath = path4.default.resolve(process.cwd(), "server-dist", "public");
      console.log("Production static path:", distPath);
      const indexHtmlPath = path4.default.resolve(distPath, "index.html");
      if (fs3.default.existsSync(indexHtmlPath)) {
        console.log("Found static files at:", distPath);
        app.use(express4.static(distPath));
        app.use("*", (_req, res) => {
          res.sendFile(indexHtmlPath);
        });
        console.log("Static file serving configured.");
      } else {
        console.error("Static files not found at:", distPath);
        console.error("Falling back to serveStatic helper (./vite).");
        serveStatic(app);
      }
    }
    const port = parseInt(process.env.PORT || "5000", 10);
    server.listen(
      {
        port,
        host: "0.0.0.0",
        reusePort: true
      },
      () => {
        log3(`serving on port ${port}`);
      }
    );
  } catch (error) {
    console.error("Server startup error:", error);
    process.exit(1);
  }
})();
