import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "wouter";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Landmark, Repeat, X, ArrowRight, Rocket } from "lucide-react";
import type { Debt } from "@shared/schema";

interface RoundUpSettingsLite {
  isEnabled: boolean;
}

const DISMISS_KEY = "dt_get_started_dismissed";

/**
 * New-user setup card shown at the top of the dashboard until the two core
 * actions are done: (1) import/add debts, (2) turn on round-ups.
 * Auto-hides when both are complete; dismissable via localStorage.
 */
export default function GetStartedCard() {
  const [dismissed, setDismissed] = useState<boolean>(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      return false;
    }
  });

  const { data: debts, isSuccess: debtsLoaded } = useQuery<Debt[]>({
    queryKey: ["/api/debts"],
  });
  const { data: roundUp, isSuccess: roundUpLoaded } = useQuery<RoundUpSettingsLite>({
    queryKey: ["/api/round-up-settings"],
  });

  // Only render once both queries SUCCEED — an errored fetch must not make a
  // configured user look brand-new.
  if (dismissed || !debtsLoaded || !roundUpLoaded) return null;

  const hasDebts = (debts ?? []).some((d) => d.isActive);
  const roundUpsOn = roundUp?.isEnabled === true;
  if (hasDebts && roundUpsOn) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* ignore */
    }
    setDismissed(true);
  };

  return (
    <section className="mb-6" data-testid="card-get-started">
      <Card className="border-dime-purple/30 bg-gradient-to-br from-indigo-50 via-white to-purple-50 shadow-card overflow-hidden relative">
        <CardContent className="p-5 sm:p-6">
          <button
            onClick={dismiss}
            aria-label="Dismiss setup guide"
            data-testid="button-get-started-dismiss"
            className="absolute top-3 right-3 text-slate-400 hover:text-slate-700 rounded-full p-1 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>

          <div className="flex items-center gap-2 mb-1">
            <Rocket className="w-5 h-5 text-dime-purple" />
            <h2 className="text-lg font-bold text-slate-900">
              Set up Dime Time in 2 steps
            </h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">
            Import your debts, turn on round-ups, and your spare change starts
            chipping away at debt automatically.
          </p>

          <div className="grid gap-3 sm:grid-cols-2">
            {/* Step 1 — Import debts */}
            <div
              className={`rounded-xl border p-4 flex flex-col gap-2 ${
                hasDebts ? "border-green-200 bg-green-50/60" : "border-slate-200 bg-white"
              }`}
              data-testid="step-import-debts"
            >
              <div className="flex items-center gap-2">
                {hasDebts ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <Landmark className="w-5 h-5 text-dime-purple" />
                )}
                <span className="font-semibold text-slate-900 text-sm">
                  1. Import your debts
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Connect your bank to pull in balances, rates, and minimums
                automatically.
              </p>
              {!hasDebts && (
                <Link href="/debts?import=1">
                  <Button
                    size="sm"
                    className="mt-1 w-full sm:w-auto bg-dime-purple hover:bg-dime-purple/90 text-white"
                    data-testid="button-get-started-import"
                  >
                    Import debts <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>

            {/* Step 2 — Start round-ups */}
            <div
              className={`rounded-xl border p-4 flex flex-col gap-2 ${
                roundUpsOn ? "border-green-200 bg-green-50/60" : "border-slate-200 bg-white"
              }`}
              data-testid="step-start-roundups"
            >
              <div className="flex items-center gap-2">
                {roundUpsOn ? (
                  <CheckCircle2 className="w-5 h-5 text-green-600" />
                ) : (
                  <Repeat className="w-5 h-5 text-dime-purple" />
                )}
                <span className="font-semibold text-slate-900 text-sm">
                  2. Start round-ups
                </span>
              </div>
              <p className="text-xs text-slate-600">
                Round every purchase up to the next dollar and put the change
                toward your target debt.
              </p>
              {!roundUpsOn && (
                <Link href="/settings">
                  <Button
                    size="sm"
                    variant={hasDebts ? "default" : "outline"}
                    className={`mt-1 w-full sm:w-auto ${
                      hasDebts
                        ? "bg-dime-purple hover:bg-dime-purple/90 text-white"
                        : "border-dime-purple/40 text-dime-purple hover:bg-dime-purple/10"
                    }`}
                    data-testid="button-get-started-roundups"
                  >
                    Turn on round-ups <ArrowRight className="w-4 h-4 ml-1" />
                  </Button>
                </Link>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
