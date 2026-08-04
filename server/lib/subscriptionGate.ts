/**
 * Premium gating helper for round-up AUTOMATION (the paid feature).
 *
 * Contract (founder-locked):
 *   - Flag OFF  → returns true for everyone. ZERO behavior change; today's
 *     users keep round-up automation exactly as-is.
 *   - Flag ON   → true only when the central entitlement evaluator grants
 *     access from the user's latest subscription row: `active`, a verified
 *     finite provisional-ACH window, or a finite past-due grace window
 *     (see shared/subscriptionPlans.ts evaluateEntitlement). The flag itself
 *     never grants entitlement — it only decides whether gating applies.
 *
 * Free tier (never gated): debt tracking, payoff projections, transaction
 * recording (round-up amounts are still COMPUTED and displayed — only the
 * automated collection/application of money is premium).
 */

import { isFlagEnabled } from "./flags";
import { storage } from "../storage";
import { evaluateEntitlement } from "@shared/subscriptionPlans";

export async function hasRoundUpAutomationAccess(userId: string): Promise<boolean> {
  if (!isFlagEnabled("ENABLE_SUBSCRIPTIONS")) return true;
  const sub = await storage.getLatestSubscriptionByUserId(userId);
  const result = evaluateEntitlement(sub ?? null);
  if (result.unexpected) {
    console.warn(JSON.stringify({
      service: "SubscriptionGate",
      event: "unexpected_entitlement_state",
      severity: "WARN",
      userId,
      reason: result.reason,
      status: sub?.status ?? null,
    }));
  }
  return result.entitled;
}

/** Standard 402 payload so every gated endpoint speaks the same language. */
export const SUBSCRIPTION_REQUIRED_RESPONSE = {
  message: "An active Dime Time subscription is required for round-up automation.",
  code: "subscription_required",
} as const;
