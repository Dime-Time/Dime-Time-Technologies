import { useState } from "react";
import { Link } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient, getApiErrorMessage } from "@/lib/queryClient";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { useFlag } from "@/hooks/useFlag";
import { formatPlanPrice } from "@shared/subscriptionPlans";
import {
  Sparkles,
  CheckCircle2,
  Landmark,
  CalendarClock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

interface SubscriptionRow {
  id: string;
  status: string;
  cancelAtPeriodEnd: boolean;
  currentPeriodEnd: string | null;
  lastPaymentError: string | null;
}

interface SubscriptionState {
  plan: {
    name: string;
    priceCents: number;
    interval: string;
    blurb: string;
    features: string[];
  };
  subscription: SubscriptionRow | null;
  entitled: boolean;
  bankLinked: boolean;
  bankAccounts: { id: string; institutionName: string | null; last4: string | null }[];
  consent: { text: string; version: string };
}

function statusBadge(sub: SubscriptionRow) {
  if (sub.cancelAtPeriodEnd) {
    return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Ends at period close</Badge>;
  }
  switch (sub.status) {
    case "active":
    case "trialing":
      return <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-100">Active</Badge>;
    case "incomplete":
      return <Badge className="bg-blue-100 text-blue-800 hover:bg-blue-100">Active — first payment processing</Badge>;
    case "past_due":
      return <Badge className="bg-amber-100 text-amber-800 hover:bg-amber-100">Payment issue — retrying</Badge>;
    default:
      return <Badge className="bg-slate-100 text-slate-700 hover:bg-slate-100">{sub.status}</Badge>;
  }
}

export default function SubscriptionPage() {
  const { toast } = useToast();
  const subscriptionsEnabled = useFlag("ENABLE_SUBSCRIPTIONS");
  const [consentChecked, setConsentChecked] = useState(false);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);
  // One idempotency key per subscribe attempt-session. Kept stable across
  // retries of a failed attempt (server + Stripe dedupe on it); the page
  // remounts with a fresh key after success.
  const [idempotencyKey] = useState(() =>
    (globalThis.crypto?.randomUUID?.() ?? `sub-${Date.now()}-${Math.random().toString(36).slice(2)}`),
  );

  const { data, isLoading } = useQuery<SubscriptionState>({
    queryKey: ["/api/subscription"],
    enabled: subscriptionsEnabled,
  });

  const subscribeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest(
        "POST",
        "/api/subscription/subscribe",
        { consentAccepted: true },
        { "Idempotency-Key": idempotencyKey },
      );
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({
        title: "Welcome to Dime Time Debt!",
        description: "Round-up automation is unlocked. Your first payment is processing via bank transfer (2\u20134 business days).",
      });
    },
    onError: (err) => {
      toast({
        title: "Couldn't start subscription",
        description: getApiErrorMessage(err),
        variant: "destructive",
      });
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/cancel");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      setShowCancelConfirm(false);
      toast({
        title: "Cancellation scheduled",
        description: "You keep premium until the end of your paid month. You can undo this anytime before then.",
      });
    },
    onError: (err) => {
      toast({ title: "Couldn't cancel", description: getApiErrorMessage(err), variant: "destructive" });
    },
  });

  const reactivateMutation = useMutation({
    mutationFn: async () => {
      const res = await apiRequest("POST", "/api/subscription/reactivate");
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/subscription"] });
      toast({ title: "Subscription resumed", description: "Your plan will renew as usual." });
    },
    onError: (err) => {
      toast({ title: "Couldn't resume", description: getApiErrorMessage(err), variant: "destructive" });
    },
  });

  if (!subscriptionsEnabled) {
    return (
      <div className="min-h-screen bg-background pt-8 animate-fade-in">
        <div className="container mx-auto px-4 max-w-2xl text-center py-16">
          <h1 className="text-2xl font-bold text-slate-900 mb-2">Subscriptions aren't available yet</h1>
          <p className="text-slate-500 mb-6">Check back soon — premium plans are on the way.</p>
          <Link href="/dashboard">
            <Button className="bg-dime-purple hover:bg-dime-accent text-white">Back to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  if (isLoading || !data) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-dime-purple" data-testid="loader-subscription" />
      </div>
    );
  }

  const { plan, subscription, entitled, bankLinked, bankAccounts, consent } = data;
  const hasLiveSubscription = subscription && entitled;
  const price = formatPlanPrice(plan.priceCents);

  return (
    <div className="min-h-screen bg-background pb-20 pt-4 md:pt-8 animate-fade-in">
      <div className="container mx-auto px-4 max-w-2xl">
        <div className="mb-8 px-2">
          <h1 className="text-3xl font-bold text-slate-900">Subscription</h1>
        </div>

        {hasLiveSubscription ? (
          /* ── MANAGE VIEW ─────────────────────────────────────────────── */
          <div className="bg-card rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in-up">
            <div className="p-6 border-b border-slate-100">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-dime-purple flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900" data-testid="text-plan-name">{plan.name}</p>
                    <p className="text-sm text-slate-500">{price}/{plan.interval}</p>
                  </div>
                </div>
                <div data-testid="badge-subscription-status">{statusBadge(subscription)}</div>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {subscription.status === "incomplete" && (
                <div className="flex items-start gap-3 rounded-xl bg-blue-50 p-4">
                  <CalendarClock className="h-5 w-5 text-blue-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-blue-900">
                    Your first payment is processing via bank transfer (ACH). This
                    typically takes 2–4 business days — premium features are already unlocked.
                  </p>
                </div>
              )}

              {subscription.status === "past_due" && (
                <div className="flex items-start gap-3 rounded-xl bg-amber-50 p-4">
                  <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                  <p className="text-sm text-amber-900">
                    Your last payment didn't go through. We'll retry automatically —
                    make sure your linked bank account has funds available.
                  </p>
                </div>
              )}

              {subscription.currentPeriodEnd && (
                <p className="text-sm text-slate-600" data-testid="text-period-end">
                  {subscription.cancelAtPeriodEnd ? "Premium ends" : "Renews"} on{" "}
                  <span className="font-medium text-slate-900">
                    {new Date(subscription.currentPeriodEnd).toLocaleDateString(undefined, {
                      year: "numeric", month: "long", day: "numeric",
                    })}
                  </span>
                </p>
              )}

              {subscription.cancelAtPeriodEnd ? (
                <Button
                  onClick={() => reactivateMutation.mutate()}
                  disabled={reactivateMutation.isPending}
                  className="bg-dime-purple hover:bg-dime-accent text-white press-scale"
                  data-testid="button-reactivate"
                >
                  {reactivateMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                  Keep My Subscription
                </Button>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowCancelConfirm(true)}
                  className="text-slate-700 press-scale"
                  data-testid="button-cancel-subscription"
                >
                  Cancel Subscription
                </Button>
              )}
            </div>
          </div>
        ) : (
          /* ── SUBSCRIBE VIEW ──────────────────────────────────────────── */
          <div className="space-y-6">
            <div className="bg-card rounded-2xl border border-slate-200 shadow-sm overflow-hidden animate-fade-in-up">
              <div className="p-6 border-b border-slate-100">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-purple-50 text-dime-purple flex items-center justify-center shrink-0">
                    <Sparkles className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900" data-testid="text-plan-name">{plan.name}</p>
                    <p className="text-sm text-slate-500">
                      <span className="text-xl font-bold text-slate-900">{price}</span>/{plan.interval} · billed via bank transfer (ACH)
                    </p>
                  </div>
                </div>
                <p className="text-sm text-slate-600">{plan.blurb}</p>
              </div>
              <div className="p-6 space-y-3">
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-3">
                    <CheckCircle2 className="h-5 w-5 text-emerald-500 shrink-0 mt-0.5" />
                    <p className="text-sm text-slate-700">{feature}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Bank requirement */}
            {!bankLinked ? (
              <div className="bg-card rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in-up">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-slate-900 text-sm mb-1">Link a bank account first</p>
                    <p className="text-xs text-slate-500 mb-3">
                      Your {price}/month is collected from your linked bank account — the
                      same one that powers your round-ups.
                    </p>
                    <Link href="/banking">
                      <Button size="sm" className="bg-dime-purple hover:bg-dime-accent text-white press-scale" data-testid="button-link-bank">
                        Connect Bank Account
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            ) : (
              <div className="bg-card rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in-up">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                    <Landmark className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-medium text-slate-900 text-sm">Billing account</p>
                    <p className="text-xs text-slate-500" data-testid="text-billing-account">
                      {bankAccounts[0]?.institutionName ?? "Linked bank"}
                      {bankAccounts[0]?.last4 ? ` ••••${bankAccounts[0].last4}` : ""}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* Consent + subscribe */}
            <div className="bg-card rounded-2xl border border-slate-200 shadow-sm p-6 animate-fade-in-up">
              <div className="max-h-44 overflow-y-auto rounded-xl bg-slate-50 border border-slate-200 p-4 mb-4">
                <p className="text-xs text-slate-600 whitespace-pre-line" data-testid="text-consent">
                  {consent.text}
                </p>
              </div>
              <label className="flex items-start gap-3 cursor-pointer mb-5">
                <Checkbox
                  checked={consentChecked}
                  onCheckedChange={(v) => setConsentChecked(v === true)}
                  className="mt-0.5"
                  data-testid="checkbox-consent"
                />
                <span className="text-sm text-slate-700">
                  I agree to the subscription terms and authorize recurring{" "}
                  {price} monthly bank transfers (ACH).
                </span>
              </label>
              <Button
                className="w-full bg-dime-purple hover:bg-dime-accent text-white press-scale"
                disabled={!consentChecked || !bankLinked || subscribeMutation.isPending}
                onClick={() => subscribeMutation.mutate()}
                data-testid="button-subscribe"
              >
                {subscribeMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Subscribe for {price}/month
              </Button>
              <p className="text-[11px] text-slate-400 text-center mt-3">
                Cancel anytime — you keep premium until the end of the paid month.
                Consent version {consent.version}.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Cancel confirmation */}
      <Dialog open={showCancelConfirm} onOpenChange={setShowCancelConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel your subscription?</DialogTitle>
            <DialogDescription>
              Round-up automation stays active until the end of your current paid
              month, then turns off. You can resume anytime before then.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setShowCancelConfirm(false)} data-testid="button-keep-plan">
              Keep My Plan
            </Button>
            <Button
              variant="destructive"
              onClick={() => cancelMutation.mutate()}
              disabled={cancelMutation.isPending}
              data-testid="button-confirm-cancel"
            >
              {cancelMutation.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Cancel Subscription
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
