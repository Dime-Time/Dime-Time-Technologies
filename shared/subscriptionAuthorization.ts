/**
 * Canonical recurring-billing authorization (subscription consent) text +
 * version.
 *
 * Shared by client and server so the exact string the user agreed to is the
 * exact string we persist as evidence — never let the two drift. Bump
 * `SUBSCRIPTION_CONSENT_VERSION` whenever the text changes so historical
 * consents remain attributable to the wording in force at the time.
 *
 * This is the mandate-acceptance evidence for Stripe's recurring ACH debits
 * (Nacha "online" authorization for a recurring schedule), recorded alongside
 * timestamp, IP address, and user agent in `subscription_consents`.
 */

export const SUBSCRIPTION_CONSENT_VERSION = "2026-07-14.v1";

export const SUBSCRIPTION_CONSENT_TEXT =
  "By selecting \u201CSubscribe\u201D, you agree to the Dime Time Terms of " +
  "Service and authorize Dime Time to electronically debit your linked bank " +
  "account via the ACH network for the recurring monthly subscription fee " +
  "shown above, on or about the same day each month, beginning today, and, " +
  "if necessary, to electronically credit your account to correct any " +
  "erroneous debit. This authorization remains in effect until you cancel " +
  "your subscription in the app or contact us at tim@dime-time.com. " +
  "Canceling stops future charges at the end of your current billing " +
  "period; fees already charged are non-refundable except as required by " +
  "law. You agree that ACH transactions you authorize comply with " +
  "applicable U.S. law. Dime Time is a financial technology platform and " +
  "is not a bank; banking services and payment infrastructure are provided " +
  "through regulated financial partners.";
