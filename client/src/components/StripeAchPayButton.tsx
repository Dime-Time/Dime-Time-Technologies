import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
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
import { useFlag } from "@/hooks/useFlag";
import { Landmark, Loader2 } from "lucide-react";
import { formatCurrency } from "@/lib/calculations";
import type { Debt } from "@shared/schema";

interface StripeStatusAccount {
  id: string;
  institutionName: string | null;
  last4: string | null;
  status: string | null;
  isActive: boolean;
  createdAt: string;
}

interface StripeStatusResponse {
  configured: boolean;
  accounts: StripeStatusAccount[];
}

const MAX_DEBT_PAYMENT_DOLLARS = 500;

/**
 * Beta "Pay with linked bank" trigger for the Stripe ACH path (gated by
 * `ENABLE_STRIPE_ACH`). Renders nothing when the flag is off, so it never
 * appears in the public build.
 *
 * It exercises the full money-movement contract: it posts to
 * `/api/stripe/ach/debit` with a fresh `Idempotency-Key` header and writes to
 * the provider-agnostic transfers ledger. While `ENABLE_REAL_TRANSFERS` is OFF
 * the server records a `simulated` row and never contacts Stripe — the dialog
 * makes that explicit so we can verify the flow with zero risk of moving money.
 */
export function StripeAchPayButton({ debt }: { debt: Debt }) {
  const enabled = useFlag("ENABLE_STRIPE_ACH");
  const realTransfers = useFlag("ENABLE_REAL_TRANSFERS");
  const { toast } = useToast();
  const [open, setOpen] = useState(false);

  const { data: status } = useQuery<StripeStatusResponse>({
    queryKey: ["/api/stripe/status"],
    enabled,
  });

  // The user's chosen round-up funding account (server-validated selection).
  const { data: funding } = useQuery<{ selectedId: string | null }>({
    queryKey: ["/api/stripe/funding-account"],
    enabled,
  });

  // Prefer the explicitly selected funding account. If the user picked one but
  // it is no longer eligible (unlinked / deactivated), do NOT silently
  // substitute another bank — that would debit an account the user never
  // chose. Surface it and make them fix the selection in Settings instead.
  // Only when NO selection exists do we fall back to the first ACTIVE, linked
  // account. Never a stale / inactive row — otherwise the simulation E2E could
  // silently exercise the wrong account and mask a real linking problem. (The
  // server re-validates ownership + status on every debit anyway.)
  const activeAccounts = status?.configured
    ? status.accounts?.filter((a) => a.isActive && a.status === "linked") ?? []
    : [];
  const selectedId = funding?.selectedId ?? null;
  const selectedAccount = selectedId
    ? activeAccounts.find((a) => a.id === selectedId) ?? null
    : null;
  const selectedUnavailable =
    Boolean(selectedId) && !selectedAccount && Boolean(status?.configured);
  const account = selectedId ? selectedAccount : activeAccounts[0] ?? null;

  const rawAmount = parseFloat(debt.minimumPayment);
  const amount = Math.round(
    Math.min(Math.max(rawAmount > 0 ? rawAmount : 1, 0.01), MAX_DEBT_PAYMENT_DOLLARS) * 100,
  ) / 100;

  const payMutation = useMutation({
    mutationFn: async () => {
      if (!account) throw new Error("No linked bank account");
      const idempotencyKey = makeIdempotencyKey();
      const res = await apiRequest(
        "POST",
        "/api/stripe/ach/debit",
        {
          stripeAccountId: account.id,
          amount,
          debtId: debt.id,
          descriptor: "DIME TIME",
        },
        { "Idempotency-Key": idempotencyKey },
      );
      return (await res.json()) as { simulated?: boolean; status?: string };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/payments"] });
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/status"] });
      setOpen(false);
      toast({
        title: data?.simulated ? "Test payment recorded" : "Payment initiated",
        description: data?.simulated
          ? `Simulated ${formatCurrency(amount)} toward ${debt.name}. No real money moved.`
          : `${formatCurrency(amount)} toward ${debt.name} is on its way.`,
      });
    },
    onError: (err: any) => {
      toast({
        title: "Payment failed",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!enabled) return null;

  const bankLabel = account
    ? `${account.institutionName || "Linked bank"}${account.last4 ? ` ••${account.last4}` : ""}`
    : null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        className="w-full sm:flex-1 sm:w-auto min-w-0 whitespace-normal h-auto py-2"
        disabled={!account || payMutation.isPending}
        onClick={() => setOpen(true)}
        data-testid={`button-stripe-pay-${debt.id}`}
      >
        {payMutation.isPending ? (
          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
        ) : (
          <Landmark className="w-4 h-4 mr-2" />
        )}
        {account
          ? "Pay with linked bank (beta)"
          : selectedUnavailable
            ? "Selected bank unavailable — update in Settings"
            : "Connect a bank to pay (beta)"}
      </Button>

      <AlertDialog open={open} onOpenChange={(o) => !payMutation.isPending && setOpen(o)}>
        <AlertDialogContent data-testid={`dialog-stripe-pay-${debt.id}`}>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {realTransfers ? "Confirm bank payment" : "Run test payment (simulation)"}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              {realTransfers ? (
                <>
                  This will initiate a <strong>real</strong> ACH debit of{" "}
                  <strong>{formatCurrency(amount)}</strong> from {bankLabel} toward{" "}
                  <strong>{debt.name}</strong>. ACH transfers typically settle in 1–3
                  business days.
                </>
              ) : (
                <>
                  Simulation mode is on, so <strong>no real money will move</strong>. This
                  records a test payment of <strong>{formatCurrency(amount)}</strong> from{" "}
                  {bankLabel} toward <strong>{debt.name}</strong> so we can verify the full
                  flow safely.
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={payMutation.isPending}
              data-testid={`button-stripe-pay-cancel-${debt.id}`}
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                payMutation.mutate();
              }}
              disabled={payMutation.isPending}
              data-testid={`button-stripe-pay-confirm-${debt.id}`}
            >
              {payMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              {realTransfers ? `Pay ${formatCurrency(amount)}` : "Run test payment"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

function makeIdempotencyKey(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
      return crypto.randomUUID();
    }
  } catch {
    /* fall through to manual key */
  }
  return `idem_${Date.now()}_${Math.random().toString(36).slice(2)}`;
}
