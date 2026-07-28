import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { useFlag } from "@/hooks/useFlag";
import { Sparkles } from "lucide-react";
import type { RoundUpSettings } from "@shared/schema";

/**
 * Shown on the dashboard and transactions pages when round-up automation is
 * paused because the user isn't subscribed (ENABLE_SUBSCRIPTIONS on, round-ups
 * enabled, not entitled). Transactions still record their computed round-up,
 * but collection is skipped server-side — without this banner that skip is
 * silent outside the Settings page.
 *
 * Renders nothing when the flag is off, the user is entitled, round-ups are
 * disabled, or data hasn't loaded yet — so entitled/pre-flag users see zero
 * change.
 */
export function RoundUpPausedBanner() {
  const subscriptionsEnabled = useFlag("ENABLE_SUBSCRIPTIONS");
  const { data: subscriptionState } = useQuery<{ entitled: boolean }>({
    queryKey: ["/api/subscription"],
    enabled: subscriptionsEnabled,
  });
  const { data: roundUpSettings } = useQuery<RoundUpSettings>({
    queryKey: ["/api/round-up-settings"],
    enabled: subscriptionsEnabled,
  });

  const show =
    subscriptionsEnabled &&
    subscriptionState?.entitled === false &&
    roundUpSettings?.isEnabled === true;

  if (!show) return null;

  return (
    <div
      className="mb-6 rounded-xl border border-purple-200 bg-purple-50/60 p-4"
      data-testid="banner-roundups-paused"
    >
      <div className="flex items-start gap-3">
        <div className="w-8 h-8 rounded-lg bg-dime-purple/10 text-dime-purple flex items-center justify-center shrink-0">
          <Sparkles className="h-4 w-4" />
        </div>
        <div className="flex-1">
          <p className="font-medium text-slate-900 text-sm">
            Round-ups paused — subscribe to resume
          </p>
          <p className="text-xs text-slate-500 mb-2">
            Your purchases are still recorded with their round-up amounts, but
            automatic collection is paused because you don't have an active
            Dime Time Debt subscription. Debt tracking stays free.
          </p>
          <Link href="/subscription">
            <Button
              size="sm"
              className="bg-dime-purple hover:bg-dime-accent text-white press-scale"
              data-testid="button-resume-roundups"
            >
              Subscribe to Resume
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
}
