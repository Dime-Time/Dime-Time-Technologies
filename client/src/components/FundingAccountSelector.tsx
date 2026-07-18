import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Link } from "wouter";
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
import { Check, Landmark, Loader2 } from "lucide-react";

interface FundingAccount {
  id: string;
  institutionName: string | null;
  last4: string | null;
  eligible: boolean;
  ineligibleReason: string | null;
  selected: boolean;
}

interface FundingAccountResponse {
  configured: boolean;
  selectedId: string | null;
  accounts: FundingAccount[];
}

function accountLabel(a: FundingAccount): string {
  return `${a.institutionName || "Linked bank"}${a.last4 ? ` ••${a.last4}` : ""}`;
}

/**
 * Round-up funding-account picker (gated by `ENABLE_STRIPE_ACH`).
 *
 * Lets a user with multiple linked bank accounts choose which one FUNDS
 * round-up ACH payments. The selection is stored and validated server-side —
 * changing it never moves money. Only masked digits are ever shown.
 */
export function FundingAccountSelector() {
  const enabled = useFlag("ENABLE_STRIPE_ACH");
  const { toast } = useToast();
  const [pendingAccount, setPendingAccount] = useState<FundingAccount | null>(null);

  const { data, isLoading } = useQuery<FundingAccountResponse>({
    queryKey: ["/api/stripe/funding-account"],
    enabled,
  });

  const selectMutation = useMutation({
    mutationFn: async (stripeAccountId: string) => {
      const res = await apiRequest("PUT", "/api/stripe/funding-account", { stripeAccountId });
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/funding-account"] });
      setPendingAccount(null);
      toast({
        title: "Funding account updated",
        description: "Future round-up payments will come from this account. No payment was made.",
      });
    },
    onError: (err: any) => {
      setPendingAccount(null);
      queryClient.invalidateQueries({ queryKey: ["/api/stripe/funding-account"] });
      toast({
        title: "Couldn't update funding account",
        description: err?.message || "Please try again.",
        variant: "destructive",
      });
    },
  });

  if (!enabled) return null;

  const accounts = data?.accounts ?? [];
  const selected = accounts.find((a) => a.selected) ?? null;

  return (
    <div className="w-full" data-testid="section-funding-account">
      <div className="flex items-center gap-3 mb-3">
        <div className="w-8 h-8 rounded-lg bg-sky-50 text-sky-600 flex items-center justify-center shrink-0">
          <Landmark className="h-4 w-4" />
        </div>
        <div>
          <p className="font-medium text-slate-900 text-sm">Round-Up Funding Account</p>
          <p className="text-xs text-slate-500">
            The bank account that funds round-up payments toward your debt
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500 py-2" data-testid="state-funding-loading">
          <Loader2 className="w-4 h-4 animate-spin" /> Loading accounts…
        </div>
      ) : accounts.length === 0 ? (
        <div
          className="rounded-xl border border-dashed border-slate-300 p-4 text-center"
          data-testid="state-funding-empty"
        >
          <p className="text-sm text-slate-600 mb-2">
            No eligible bank account is connected yet.
          </p>
          <Link href="/banking">
            <Button size="sm" variant="outline" data-testid="button-funding-connect-bank">
              Connect a bank account
            </Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {accounts.map((a) => (
            <button
              key={a.id}
              type="button"
              disabled={!a.eligible || a.selected || selectMutation.isPending}
              onClick={() => setPendingAccount(a)}
              className={`w-full flex items-center justify-between rounded-xl border p-3 text-left transition-colors ${
                a.selected
                  ? "border-dime-purple bg-purple-50/60"
                  : a.eligible
                    ? "border-slate-200 hover:border-slate-300"
                    : "border-slate-200 opacity-60 cursor-not-allowed"
              }`}
              data-testid={`option-funding-account-${a.id}`}
            >
              <div>
                <p className="text-sm font-medium text-slate-900">{accountLabel(a)}</p>
                {a.selected ? (
                  <p className="text-xs text-dime-purple font-medium">
                    Current funding account
                  </p>
                ) : !a.eligible ? (
                  <p className="text-xs text-slate-500" data-testid={`text-funding-ineligible-${a.id}`}>
                    {a.ineligibleReason || "This account can't be used for bank payments."}
                  </p>
                ) : (
                  <p className="text-xs text-slate-500">Tap to use this account</p>
                )}
              </div>
              {a.selected && (
                <span className="w-6 h-6 rounded-full bg-dime-purple text-white flex items-center justify-center shrink-0">
                  <Check className="w-4 h-4" />
                </span>
              )}
            </button>
          ))}
          <p className="text-[11px] text-slate-400 px-1">
            Changing your funding account never starts a payment. Only the last 4
            digits of your account are ever shown.
          </p>
        </div>
      )}

      <AlertDialog
        open={!!pendingAccount}
        onOpenChange={(o) => !selectMutation.isPending && !o && setPendingAccount(null)}
      >
        <AlertDialogContent data-testid="dialog-funding-confirm">
          <AlertDialogHeader>
            <AlertDialogTitle>Change funding account?</AlertDialogTitle>
            <AlertDialogDescription className="text-left">
              Future round-up payments will be funded from{" "}
              <strong>{pendingAccount ? accountLabel(pendingAccount) : ""}</strong>
              {selected ? (
                <>
                  {" "}instead of <strong>{accountLabel(selected)}</strong>
                </>
              ) : null}
              . This only changes where future payments come from — no money moves now.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel
              disabled={selectMutation.isPending}
              data-testid="button-funding-cancel"
            >
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                if (pendingAccount) selectMutation.mutate(pendingAccount.id);
              }}
              disabled={selectMutation.isPending}
              data-testid="button-funding-confirm"
            >
              {selectMutation.isPending ? (
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              ) : null}
              Use this account
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
