/**
 * Centralized email-verification enforcement (flag: REQUIRE_EMAIL_VERIFICATION).
 *
 * When the flag is ON, an authenticated-but-unverified user receives a 403
 * with `code: "EMAIL_VERIFICATION_REQUIRED"` on every sensitive route below.
 * The restricted session keeps working for exactly the recovery surface:
 *   GET /api/user, GET /api/logout, POST /api/auth/send-verification,
 *   POST /api/auth/verify-email, DELETE /api/account (user's right to leave),
 *   GET /api/service-status, POST /api/contact — none of those are listed in
 *   VERIFICATION_PROTECTED_PREFIXES, so this middleware never sees them.
 *
 * Design rules:
 *   - Flag OFF (the default, and the initial production posture) → no-op.
 *   - Unauthenticated requests pass through untouched: each route's own auth
 *     check owns the 401 contract. This middleware only ever ADDS a 403 for
 *     users who are logged in but unverified — it can't weaken auth.
 *   - Webhook endpoints are signature-verified machine surfaces with no user
 *     session; they are matched here defensively via EXEMPT_PATHS anyway.
 *   - Fail closed on lookup errors: if we cannot load the user while the
 *     flag is ON, the sensitive route is blocked (503), never silently open.
 */
import type { NextFunction, Request, Response } from "express";
import { isFlagEnabled } from "../lib/flags";
import { getUserIdFromRequest } from "./authHelper";
import { storage } from "../storage";

/**
 * Every sensitive route prefix, matched against req.path via startsWith.
 * Keep this list in ONE place — do not scatter per-route checks.
 */
export const VERIFICATION_PROTECTED_PREFIXES: readonly string[] = [
  "/api/debts",          // debt CRUD + /api/debts/import + /api/debts/provider + refresh
  "/api/transactions",
  "/api/transfers",
  "/api/payments",
  "/api/accelerated-payment",
  "/api/round-up-settings",
  "/api/apply-round-ups",
  "/api/dashboard-summary",
  "/api/crypto-purchases",
  "/api/crypto-summary",
  "/api/plaid",          // link tokens, exchange, accounts, balances, transactions
  "/api/coinbase",
  "/api/axos",
  "/api/mercury",
  "/api/stripe",         // ACH authorize/debit, financial connections (webhook exempted below)
  "/api/subscription",
  "/api/dime-token",     // Dime Time Token balance/stake/award
  "/api/notifications",
  "/api/admin",
] as const;

/** Machine/webhook endpoints that must never be gated (no user session). */
const EXEMPT_PATHS: readonly string[] = [
  "/webhooks/stripe",
  "/webhooks/plaid",
] as const;

function isProtectedPath(path: string): boolean {
  if (EXEMPT_PATHS.some((p) => path === p || path.startsWith(p + "/"))) return false;
  return VERIFICATION_PROTECTED_PREFIXES.some(
    (p) => path === p || path.startsWith(p + "/"),
  );
}

export const EMAIL_VERIFICATION_REQUIRED_RESPONSE = {
  code: "EMAIL_VERIFICATION_REQUIRED",
  message: "Please verify your email address to use this feature.",
} as const;

export async function requireVerifiedEmail(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!isFlagEnabled("REQUIRE_EMAIL_VERIFICATION")) return next();
  if (!isProtectedPath(req.path)) return next();

  const userId = getUserIdFromRequest(req);
  if (!userId) return next(); // route's own auth check owns the 401

  try {
    const user = await storage.getUser(userId);
    if (!user) return next(); // route's own auth handles unknown users
    if (!user.emailVerifiedAt) {
      res.status(403).json(EMAIL_VERIFICATION_REQUIRED_RESPONSE);
      return;
    }
    return next();
  } catch (err) {
    console.error(
      "requireVerifiedEmail lookup failed:",
      err instanceof Error ? err.message : "unknown",
    );
    // Fail closed while the flag is on: never open a sensitive route on error.
    res.status(503).json({ message: "Please try again in a moment." });
    return;
  }
}
