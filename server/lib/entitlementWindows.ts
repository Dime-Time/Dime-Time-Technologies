/**
 * Finite entitlement windows (server-only configuration).
 *
 * PROVISIONAL ACH WINDOW — how long an `incomplete` subscription with a
 * server-verified `processing` ACH PaymentIntent keeps provisional premium
 * access while the first debit settles (ACH takes 2–4 business days).
 *
 *   Env: SUBSCRIPTION_PROVISIONAL_ACH_DAYS
 *   Default: UNSET → 0 → NO provisional access is granted.
 *   This is deliberate: no provisional-access duration has been approved by
 *   the founder yet, and inventing one is prohibited. Until the env var is
 *   set, an `incomplete` subscription gets no paid access and the UI shows a
 *   truthful "payment processing" state. (Recommended value once approved: 7
 *   calendar days — covers 4–5 business days of ACH settlement.)
 *
 * PAST-DUE GRACE WINDOW — how long a previously-active subscription keeps
 * access after a renewal payment fails while Stripe retries.
 *
 *   Env: SUBSCRIPTION_PAST_DUE_GRACE_DAYS
 *   Default: 14 days — finite, bounds Stripe's ACH smart-retry window, and
 *   matches the previously approved semantics ("keep premium during
 *   retries") while guaranteeing expiration even if a terminal webhook is
 *   missed. Documented for founder sign-off; override via env.
 *
 * Both values are read at call time (not module load) so tests and the
 * founder's env changes apply without process rebuilds.
 */

function daysFromEnv(name: string, fallbackDays: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw === "") return fallbackDays;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0 || n > 60) return fallbackDays; // sane bounds, fail safe
  return n;
}

export function provisionalAchWindowDays(): number {
  return daysFromEnv("SUBSCRIPTION_PROVISIONAL_ACH_DAYS", 0);
}

export function pastDueGraceDays(): number {
  return daysFromEnv("SUBSCRIPTION_PAST_DUE_GRACE_DAYS", 14);
}

export function addDays(base: Date, days: number): Date {
  return new Date(base.getTime() + days * 24 * 60 * 60 * 1000);
}
