import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useToast } from "@/hooks/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Loader2, Building2 } from "lucide-react";
import { useFlag } from "@/hooks/useFlag";
import { ACH_AUTHORIZATION_TEXT } from "@shared/achAuthorization";

/**
 * Stripe Financial Connections "Connect Bank" CTA (BETA — gated by
 * `ENABLE_STRIPE_ACH`). Renders nothing when the flag is off, so the
 * `@stripe/stripe-js` chunk is only loaded when the flag is on AND the
 * user clicks the button.
 *
 * Before any bank link, the user must explicitly accept the ACH debit
 * authorization (Nacha "online" mandate). We POST that consent first — the
 * server records the real IP / User-Agent / wording version — and only then
 * run the Financial Connections flow. No consent → no debit later (the
 * `/api/stripe/ach/debit` route fails closed without a stored authorization).
 */
export function StripeConnectButton() {
  const enabled = useFlag("ENABLE_STRIPE_ACH");
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);

  if (!enabled) return null;

  const runConnectFlow = async () => {
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

  const handleAuthorizeAndConnect = async () => {
    setLoading(true);
    try {
      const authRes = await apiRequest("POST", "/api/stripe/ach/authorize");
      if (!authRes.ok) {
        const body = await authRes.json().catch(() => ({}));
        throw new Error(body?.message || "Failed to record authorization");
      }
    } catch (err: any) {
      setLoading(false);
      setShowAuth(false);
      toast({
        title: "Could not save authorization",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
      return;
    }
    setShowAuth(false);
    await runConnectFlow();
  };

  return (
    <>
      <Button
        type="button"
        onClick={() => setShowAuth(true)}
        disabled={loading}
        variant="outline"
        className="flex items-center gap-2"
        data-testid="button-stripe-connect"
      >
        {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Building2 className="w-4 h-4" />}
        Connect bank account (beta)
      </Button>

      <AlertDialog open={showAuth} onOpenChange={(open) => !loading && setShowAuth(open)}>
        <AlertDialogContent data-testid="dialog-ach-authorization">
          <AlertDialogHeader>
            <AlertDialogTitle>Authorize ACH debits</AlertDialogTitle>
            <AlertDialogDescription className="text-left whitespace-pre-line max-h-64 overflow-y-auto">
              {ACH_AUTHORIZATION_TEXT}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={loading} data-testid="button-ach-cancel">
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void handleAuthorizeAndConnect();
              }}
              disabled={loading}
              data-testid="button-ach-authorize"
            >
              {loading ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
              I Authorize
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
