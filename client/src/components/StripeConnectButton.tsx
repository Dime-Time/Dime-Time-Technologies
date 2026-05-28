import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Building2 } from "lucide-react";
import { useFlag } from "@/hooks/useFlag";

/**
 * Stripe Financial Connections "Connect Bank" CTA (BETA — gated by
 * `ENABLE_STRIPE_ACH`). Renders nothing when the flag is off, so the
 * `@stripe/stripe-js` chunk is only loaded when the flag is on AND the
 * user clicks the button.
 */
export function StripeConnectButton() {
  const enabled = useFlag("ENABLE_STRIPE_ACH");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  if (!enabled) return null;

  const handleConnect = async () => {
    const publishableKey = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY as string | undefined;
    if (!publishableKey) {
      toast({
        title: "Bank connect not configured",
        description: "Payment provider key is missing in this build.",
        variant: "destructive",
      });
      return;
    }
    setLoading(true);
    try {
      // Lazy-load Stripe.js — only fetched on click.
      const { loadStripe } = await import("@stripe/stripe-js");
      const stripe = await loadStripe(publishableKey);
      if (!stripe) throw new Error("Failed to load Stripe.js");

      const sessionRes = await apiRequest(
        "POST",
        "/api/stripe/financial-connections/session",
      );
      if (!sessionRes.ok) throw new Error("Failed to start Stripe session");
      const { clientSecret, customerId } = await sessionRes.json();

      const result = await (stripe as any).collectFinancialConnectionsAccounts({
        clientSecret,
      });
      if (result.error) throw new Error(result.error.message || "Bank connect cancelled");

      const accounts = result.financialConnectionsSession?.accounts || [];
      if (accounts.length === 0) {
        toast({ title: "No account selected", description: "Pick a checking account to continue." });
        return;
      }

      for (const acct of accounts) {
        const ex = await apiRequest("POST", "/api/stripe/financial-connections/exchange", {
          fcAccountId: acct.id,
          customerId,
        });
        if (!ex.ok) {
          const body = await ex.json().catch(() => ({}));
          throw new Error(body?.message || "Failed to link account");
        }
      }

      queryClient.invalidateQueries({ queryKey: ["/api/stripe/status"] });
      toast({
        title: "Bank account linked",
        description: `Connected ${accounts.length} account${accounts.length === 1 ? "" : "s"}.`,
      });
    } catch (err: any) {
      toast({
        title: "Bank connect failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Button
      type="button"
      onClick={handleConnect}
      disabled={loading}
      variant="outline"
      className="flex items-center gap-2"
      data-testid="button-stripe-connect"
    >
      {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
      Connect bank account (beta)
    </Button>
  );
}
