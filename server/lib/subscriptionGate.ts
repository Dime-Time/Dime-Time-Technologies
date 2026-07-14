/**
 * Premium gating helper for round-up AUTOMATION (the paid feature).
 *
 * Contract (founder-locked):
 *   - Flag OFF  → returns true for everyone. ZERO behavior change; today's
 *     users keep round-up automation exactly as-is.
 *   - Flag ON   → true only when the user's latest subscription status grants
 *     entitlement (active / trialing / incomplete-first-charge-in-flight /
 *     past_due grace — see shared/subscriptionPlans.ts).
 *
 * Free tier (never gated): debt tracking, payoff projections, transaction
 * recording (round-up amounts are still COMPUTED and displayed — only the
 * automated collection/application of money is premium).
 */

import { isFlagEnabled } from "./flags";
import { storage } from "../storage";
import { isSubscriptionEntitled } from "@shared/subscriptionPlans";

export async function hasRoundUpAutomationAccess(userId: string): Promise<boolean> {
  if (!isFlagEnabled("ENABLE_SUBSCRIPTIONS")) return true;
  const sub = await storage.getLatestSubscriptionByUserId(userId);
  return isSubscriptionEntitled(sub?.status);
}

/** Standard 402 payload so every gated endpoint speaks the same language. */
export const SUBSCRIPTION_REQUIRED_RESPONSE = {
  message: "An active Dime Time subscription is required for round-up automation.",
  code: "subscription_required",
} as const;
