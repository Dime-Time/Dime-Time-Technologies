/**
 * Provider-agnostic types for automatic debt import.
 *
 * The rest of the application only ever sees `NormalizedLiability` — never a
 * raw provider payload. Concrete providers (sandbox, Plaid, Method, ...) live
 * behind the `LiabilityProvider` interface and are selected by a factory
 * (see ./index.ts), so swapping providers is an implementation detail.
 */

/** A single debt/liability, normalized into the shape our `debts` table needs. */
export interface NormalizedLiability {
  provider: string;
  /** Stable id from the provider — our duplicate-detection key. */
  providerAccountId: string;
  institutionName: string;
  /** Human-facing creditor/account name -> `debts.name`. */
  creditorName: string;
  /** 'credit_card' | 'student_loan' | 'auto_loan' | 'mortgage' | 'personal_loan' | 'other' */
  accountType: string;
  /** Last-4 (or masked) account number. */
  mask: string;
  currentBalance: number;
  interestRateApr: number;
  minimumPayment: number;
  /** Day of month, 1-31. */
  dueDate: number;
  creditLimit?: number | null;
  availableCredit?: number | null;
  paymentStatus?: string | null;
}

export interface ProviderConnectionResult {
  status: string;
  institutionName?: string;
}

/**
 * Optional client-side Link flow. Providers that require the user to connect an
 * institution via a client SDK (e.g. Plaid Link) expose this; server-only
 * providers (e.g. sandbox) leave it undefined.
 */
export interface ProviderLinkFlow {
  /** Create a provider Link token for the client SDK to open. */
  createLinkToken(userId: string): Promise<string>;
  /** Exchange the client's public token and persist the connection (encrypted). */
  completeLink(
    userId: string,
    publicToken: string,
    institutionName?: string,
  ): Promise<ProviderConnectionResult>;
}

export interface LiabilityProvider {
  readonly name: string;
  /** Present only for providers that need a client-side connect step. */
  linkFlow?: ProviderLinkFlow;
  /** Establish/verify the user's connection to the provider. */
  initializeConnection(userId: string): Promise<ProviderConnectionResult>;
  /** Fetch the user's liabilities, already normalized. */
  fetchLiabilities(userId: string): Promise<NormalizedLiability[]>;
  /** Tear down the provider-side connection (best-effort). */
  disconnect(userId: string): Promise<void>;
}

/**
 * Thrown by a provider when the user must (re)connect their institution before
 * we can fetch liabilities. Routes map this to HTTP 409 { code: "link_required" }
 * so the client can launch the Link flow instead of showing a generic error.
 */
export class LinkRequiredError extends Error {
  readonly code = "link_required";
  constructor(message = "A provider connection is required before importing debts.") {
    super(message);
    this.name = "LinkRequiredError";
  }
}

/**
 * Thrown when the provider account does not have the Liabilities product
 * entitlement yet (e.g. Plaid production before Liabilities approval — error
 * codes INVALID_PRODUCT / INVALID_PRODUCTS / PRODUCTS_NOT_SUPPORTED). Routes map
 * this to HTTP 503 { code: "PLAID_LIABILITIES_NOT_ENABLED" } so the client can
 * show a friendly "coming soon" state instead of a generic server error. Once
 * the entitlement is granted upstream this error simply stops occurring — no
 * flag flip or redeploy required.
 */
export class LiabilitiesNotEnabledError extends Error {
  readonly code = "PLAID_LIABILITIES_NOT_ENABLED";
  constructor(
    message = "Automatic debt import is coming soon. You can add your debts manually for now.",
  ) {
    super(message);
    this.name = "LiabilitiesNotEnabledError";
  }
}
