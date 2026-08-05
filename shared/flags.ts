/**
 * Centralized feature-flag definitions.
 *
 * Single source of truth shared by server and client. New flags MUST be
 * registered here — both sides import from this module so the names,
 * defaults, and types can never drift.
 *
 * Design rules (see replit.md "Feature Flags"):
 *   - Flags default to a safe/OFF state in production. Never throw when an
 *     env var is missing.
 *   - Treat flags as single-tenant booleans. No per-user overrides.
 *   - Read on the server via `resolveServerFlags(process.env)` (server/lib/flags.ts).
 *   - Read on the client via the `useFlag(name)` hook, which sources its
 *     values from the bootstrap `/api/user` response — never from
 *     `import.meta.env` (env vars at build time are baked into the bundle
 *     and can't be flipped without a rebuild + redeploy, which defeats
 *     the point of a feature flag for TestFlight).
 */

export type FlagName =
  | "ENABLE_STRIPE_ACH"
  | "ENABLE_REAL_TRANSFERS"
  | "ENABLE_CRYPTO"
  | "ENABLE_BETA_BANNER"
  | "ENABLE_AUTO_ROUNDUP_SWEEPS"
  | "ENABLE_DEBT_IMPORT"
  | "ENABLE_SUBSCRIPTIONS"
  | "ENABLE_WEEKLY_DISBURSEMENT"
  | "REQUIRE_EMAIL_VERIFICATION";

export interface FlagDefinition {
  /** Production default when the env var is unset or invalid. */
  defaultValue: boolean;
  /** Short human description — surfaces in docs and admin-readable logs. */
  description: string;
}

export const FLAG_DEFINITIONS: Record<FlagName, FlagDefinition> = {
  ENABLE_STRIPE_ACH: {
    defaultValue: false,
    description:
      "Gate Stripe Financial Connections + ACH debit code paths. " +
      "OFF means the Stripe SDK is not initialized and Stripe routes are not mounted.",
  },
  ENABLE_REAL_TRANSFERS: {
    defaultValue: false,
    description:
      "Allow money-movement endpoints to actually move money. " +
      "OFF keeps the app in sandbox/no-op mode — transfers are recorded but never settled.",
  },
  ENABLE_CRYPTO: {
    defaultValue: true,
    description:
      "Enable the crypto / Bitcoin round-up surfaces. " +
      "ON preserves today's behavior. Flip OFF to hide all crypto UI without removing code.",
  },
  ENABLE_BETA_BANNER: {
    defaultValue: false,
    description:
      "Render an in-app beta banner reminding users that Dime Time is in TestFlight. " +
      "Flip ON during the beta window and OFF for the public launch build.",
  },
  ENABLE_AUTO_ROUNDUP_SWEEPS: {
    defaultValue: false,
    description:
      "Allow automatic round-up sweep dispersals (JP Morgan weekly debt payments) to run. " +
      "OFF (default) hard-blocks all automatic money-moving sweeps so they can never fire " +
      "before an operator explicitly enables them.",
  },
  ENABLE_DEBT_IMPORT: {
    defaultValue: false,
    description:
      "Gate the automatic debt-import feature (connect a liability provider and pull in " +
      "debts). OFF means the /api/debts/import routes are not mounted and the client " +
      "Import Debts UI is hidden. Uses the sandbox provider until a real liability-data " +
      "provider (Plaid Liabilities / Method) is approved.",
  },
  ENABLE_SUBSCRIPTIONS: {
    defaultValue: false,
    description:
      "Gate the Stripe Billing subscription feature (Dime Time Debt $2.99/mo). " +
      "OFF means /api/subscription routes are not mounted, no premium gating is " +
      "applied anywhere (today's behavior is unchanged), and all subscription UI " +
      "is hidden. Requires ENABLE_STRIPE_ACH — the server refuses to boot if " +
      "SUBSCRIPTIONS is on while STRIPE_ACH is off.",
  },
  ENABLE_WEEKLY_DISBURSEMENT: {
    defaultValue: false,
    description:
      "Run the weekly Friday-midnight (ET) round-up disbursement: accumulated " +
      "round-up balances are paid from the Mercury account toward each user's " +
      "target debt. OFF (default) means the scheduler never fires and the " +
      "admin run endpoint only permits dry runs. Real money additionally " +
      "requires ENABLE_REAL_TRANSFERS — both must be ON to move funds.",
  },
  REQUIRE_EMAIL_VERIFICATION: {
    defaultValue: false,
    description:
      "Server-side enforcement of email verification. ON blocks unverified " +
      "users (403 EMAIL_VERIFICATION_REQUIRED) from all financial/sensitive " +
      "routes while keeping the recovery surface (resend, verify, logout, " +
      "support, account deletion) available. Production startup REQUIRES this " +
      "var to be explicitly set (validateEnv) — it is never silently guessed.",
  },
};

export type FlagMap = Record<FlagName, boolean>;

export const FLAG_NAMES = Object.keys(FLAG_DEFINITIONS) as FlagName[];

/**
 * Parse an env var value into a boolean using a tolerant rule set.
 *
 * Truthy: `1`, `true`, `yes`, `on` (case-insensitive).
 * Falsy:  `0`, `false`, `no`, `off`, `""` (case-insensitive).
 * Anything else returns `null` so the caller can fall back to the default.
 */
function parseBool(raw: string | undefined): boolean | null {
  if (raw === undefined || raw === null) return null;
  const v = raw.trim().toLowerCase();
  if (v === "" ) return null;
  if (v === "1" || v === "true" || v === "yes" || v === "on") return true;
  if (v === "0" || v === "false" || v === "no" || v === "off") return false;
  return null;
}

/**
 * Resolve every flag against a process-env-like dictionary.
 *
 * Pure function — no I/O, no `process.env` access — so it can be reused on
 * both the server and (in tests) the client.
 */
export function resolveServerFlags(
  env: Record<string, string | undefined>,
): FlagMap {
  const out = {} as FlagMap;
  for (const name of FLAG_NAMES) {
    const parsed = parseBool(env[name]);
    out[name] = parsed === null ? FLAG_DEFINITIONS[name].defaultValue : parsed;
  }
  return out;
}

/** All-defaults FlagMap. Useful for client fallbacks before bootstrap resolves. */
export const DEFAULT_FLAGS: FlagMap = resolveServerFlags({});
