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

export interface LiabilityProvider {
  readonly name: string;
  /** Establish/verify the user's connection to the provider. */
  initializeConnection(userId: string): Promise<ProviderConnectionResult>;
  /** Fetch the user's liabilities, already normalized. */
  fetchLiabilities(userId: string): Promise<NormalizedLiability[]>;
  /** Tear down the provider-side connection (best-effort). */
  disconnect(userId: string): Promise<void>;
}
