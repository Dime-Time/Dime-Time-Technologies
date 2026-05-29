/**
 * Canonical ACH debit authorization (Nacha "online" mandate) text + version.
 *
 * Shared by client and server so the exact string the user agreed to is the
 * exact string we persist as evidence — never let the two drift. Bump
 * `ACH_AUTHORIZATION_VERSION` whenever the text changes so historical
 * authorizations remain attributable to the wording in force at the time.
 */

export const ACH_AUTHORIZATION_VERSION = "2026-05-29.v1";

export const ACH_AUTHORIZATION_TEXT =
  "By selecting \u201CI Authorize\u201D, you authorize Dime Time to electronically " +
  "debit your linked bank account via the ACH network for the payment amounts " +
  "and on the schedule you approve in the app, and, if necessary, to " +
  "electronically credit your account to correct any erroneous debit. This " +
  "authorization will remain in effect until you revoke it. You may revoke this " +
  "authorization at any time by removing the linked account in the app or by " +
  "contacting us at tim@dime-time.com. You agree that ACH transactions you " +
  "authorize comply with applicable U.S. law. Dime Time is a financial " +
  "technology platform and is not a bank; banking services and payment " +
  "infrastructure are provided through regulated financial partners.";
