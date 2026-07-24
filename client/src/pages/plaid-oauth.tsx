import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation } from "wouter";
import { Capacitor } from "@capacitor/core";
import { usePlaidLink } from "react-plaid-link";
import { Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  loadPlaidOauthState,
  clearPlaidOauthState,
  reportPlaidLinkEvent,
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
  const [errorDetail, setErrorDetail] = useState("");
  const submitted = useRef(false);

  // Tell the server when the resume page lands with no stored state — that
  // failure otherwise never leaves the browser (usePlaidLink is skipped).
  useEffect(() => {
    if (!state) reportPlaidLinkEvent("oauth_resume_no_state");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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

  // Plaid Link calls onExit BOTH when the user cancels AND when Link fails to
  // initialize (missing/expired/invalid resume state). Only a genuine user
  // cancel should navigate away — init failures must show the calm recovery
  // card instead of silently dumping the user on /banking (which renders the
  // marketing page when the session is gone).
  const onExit = useCallback(
    (
      error: {
        error_type?: string;
        error_code?: string;
        error_message?: string;
      } | null,
      metadata?: { request_id?: string; link_session_id?: string },
    ) => {
      clearPlaidOauthState();
      if (!state || error) {
        reportPlaidLinkEvent(
          state ? "oauth_resume_exit_error" : "oauth_resume_no_state",
          error,
          metadata,
        );
        setErrorMessage(
          "We couldn't resume your bank connection. Please return to the app and try connecting again.",
        );
        setErrorDetail(
          [error?.error_code, metadata?.request_id && `ref ${metadata.request_id}`]
            .filter(Boolean)
            .join(" · "),
        );
        setStatus("error");
        return;
      }
      reportPlaidLinkEvent("oauth_resume_user_cancel", null, metadata);
      navigate(destination);
    },
    [state, navigate, destination],
  );

  // On the web, the browser is literally at https://dime-time.com/plaid/oauth?...
  // so window.location.href IS the redirect URI Plaid expects. Inside the native
  // app the WebView origin is capacitor://localhost — the universal link that
  // brought us here carried the real https URL, whose pathname+search wouter
  // preserved, so we reconstruct the exact https redirect URI from those.
  const receivedRedirectUri =
    typeof window === "undefined"
      ? undefined
      : Capacitor.isNativePlatform()
        ? `https://dime-time.com${window.location.pathname}${window.location.search}`
        : window.location.href;

  const { open, ready } = usePlaidLink({
    token: state?.linkToken ?? null,
    receivedRedirectUri,
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
            {errorDetail && (
              <p className="text-slate-400 mt-2 text-xs" data-testid="text-oauth-error-detail">
                {errorDetail}
              </p>
            )}
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
