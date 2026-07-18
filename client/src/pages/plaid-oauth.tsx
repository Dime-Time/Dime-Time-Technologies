import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { usePlaidLink } from "react-plaid-link";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  loadPlaidOauthState,
  clearPlaidOauthState,
  type PlaidOauthState,
} from "@/lib/plaidOauth";

type Status = "resuming" | "finishing" | "success" | "error";

/**
 * Plaid OAuth return page (https://dime-time.com/plaid/oauth).
 *
 * OAuth banks (Chase, Wells Fargo, ...) redirect the browser here after the
 * user authorizes at their bank. We resume the Link session by re-initializing
 * Link with the SAME link_token that started the flow (persisted in
 * localStorage) plus receivedRedirectUri, then finish the token exchange for
 * whichever flow launched Link (bank connection or debt import).
 */
export default function PlaidOauthPage() {
  const [, navigate] = useLocation();
  const [state] = useState<PlaidOauthState | null>(() => loadPlaidOauthState());
  const [status, setStatus] = useState<Status>(state ? "resuming" : "error");
  const [errorMessage, setErrorMessage] = useState(
    state
      ? ""
      : "We couldn't find your in-progress bank connection. Please return to the app and try connecting again.",
  );
  const submitted = useRef(false);

  const destination = state?.flow === "debt_import" ? "/debts" : "/banking";
  const destinationLabel = state?.flow === "debt_import" ? "Go to My Debts" : "Go to Banking";

  const onSuccess = useCallback(
    async (publicToken: string, metadata: any) => {
      if (submitted.current) return;
      submitted.current = true;
      clearPlaidOauthState();
      setStatus("finishing");
      try {
        if (state?.flow === "debt_import") {
          // Consent was explicitly granted in the import modal before Link
          // launched (the flow cannot start without it).
          await apiRequest("POST", "/api/debts/import/exchange", {
            publicToken,
            institutionName: metadata?.institution?.name,
            consent: true,
          });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/debts"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/debts/import/status"] }),
          ]);
        } else {
          await apiRequest("POST", "/api/plaid/exchange-token", { publicToken });
          await Promise.all([
            queryClient.invalidateQueries({ queryKey: ["/api/plaid/accounts"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/plaid/balances"] }),
            queryClient.invalidateQueries({ queryKey: ["/api/plaid/transactions"] }),
          ]);
        }
        setStatus("success");
      } catch {
        setErrorMessage(
          "Your bank authorized the connection, but we couldn't finish setting it up. Please try again from the app.",
        );
        setStatus("error");
      }
    },
    [state],
  );

  const onExit = useCallback(() => {
    clearPlaidOauthState();
    navigate(destination);
  }, [navigate, destination]);

  const { open, ready } = usePlaidLink({
    token: state?.linkToken ?? null,
    receivedRedirectUri: typeof window !== "undefined" ? window.location.href : undefined,
    onSuccess,
    onExit,
  });

  useEffect(() => {
    if (state && ready) open();
  }, [state, ready, open]);

  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center px-4 safe-area-top safe-area-bottom">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-sm border border-slate-200 p-8 text-center">
        {(status === "resuming" || status === "finishing") && (
          <div className="flex flex-col items-center" data-testid="state-oauth-resuming">
            <div className="w-16 h-16 bg-dime-purple/10 rounded-full flex items-center justify-center mb-4">
              <Loader2 className="w-8 h-8 text-dime-purple animate-spin" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {status === "resuming" ? "Resuming your connection" : "Finishing up"}
            </h1>
            <p className="text-slate-600 mt-2 font-medium">
              {status === "resuming"
                ? "Picking up where you left off with your bank…"
                : "Securely completing your bank connection…"}
            </p>
          </div>
        )}

        {status === "success" && (
          <div className="flex flex-col items-center" data-testid="state-oauth-success">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              {state?.flow === "debt_import" ? "Debts imported" : "Bank connected"}
            </h1>
            <p className="text-slate-600 mt-2 font-medium">
              {state?.flow === "debt_import"
                ? "Your debts were imported successfully."
                : "Your bank account is now linked to Dime Time."}
            </p>
            <Button
              className="w-full mt-6 bg-dime-purple hover:bg-dime-purple/90 text-white font-bold h-12 text-lg rounded-xl"
              onClick={() => navigate(destination)}
              data-testid="button-oauth-continue"
            >
              {destinationLabel}
            </Button>
          </div>
        )}

        {status === "error" && (
          <div className="flex flex-col items-center" data-testid="state-oauth-error">
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
              <AlertCircle className="w-8 h-8 text-red-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
              Connection interrupted
            </h1>
            <p className="text-slate-600 mt-2 font-medium">{errorMessage}</p>
            <Button
              className="w-full mt-6 bg-dime-purple hover:bg-dime-purple/90 text-white font-bold h-12 text-lg rounded-xl"
              onClick={() => navigate("/banking")}
              data-testid="button-oauth-back"
            >
              Back to Dime Time
            </Button>
          </div>
        )}
      </div>
    </div>
  );
}
