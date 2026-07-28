import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { usePlaidLink } from "react-plaid-link";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { savePlaidOauthState, clearPlaidOauthState } from "@/lib/plaidOauth";
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle, Landmark, Clock } from "lucide-react";

interface ImportDebtsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "consent" | "linking" | "importing" | "complete" | "error" | "unavailable";

interface ImportStatus {
  connected: boolean;
  requiresLink: boolean;
  canLinkAnother?: boolean;
  liabilitiesAvailable?: boolean;
  provider: string;
  institutionName?: string | null;
  institutions?: Array<{ institutionName: string | null; status: string; lastSyncAt: string | null }>;
}

function parseErrorMessage(err: unknown): string {
  const fallback = "Something went wrong while importing your debts. Please try again.";
  if (!(err instanceof Error)) return fallback;
  const raw = err.message.replace(/^\d+:\s*/, "");
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.message === "string") return parsed.message;
  } catch {
  }
  return raw || fallback;
}

/** Extract the machine-readable error code (e.g. PLAID_LIABILITIES_NOT_ENABLED) from an API error. */
function parseErrorCode(err: unknown): string | null {
  if (!(err instanceof Error)) return null;
  const raw = err.message.replace(/^\d+:\s*/, "");
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.code === "string") return parsed.code;
  } catch {
  }
  return null;
}

interface ImportResult {
  imported: number;
  updated: number;
  institutionName?: string | null;
}

function PlaidLinkLauncher({
  token,
  onSuccess,
  onExit,
}: {
  token: string;
  onSuccess: (publicToken: string, metadata: any) => void;
  onExit: () => void;
}) {
  const { open, ready } = usePlaidLink({
    token,
    onSuccess: (publicToken, metadata) => onSuccess(publicToken, metadata),
    onExit: () => onExit(),
  });

  // Guard against duplicate open() calls: react-plaid-link's `open` is not
  // referentially stable across re-renders, so an unguarded [ready, open]
  // effect can stack a second Link iframe on top of the first (frozen inputs).
  const openedRef = useRef(false);
  useEffect(() => {
    if (ready && !openedRef.current) {
      openedRef.current = true;
      open();
    }
  }, [ready, open]);

  return null;
}

export function ImportDebtsModal({ open, onOpenChange }: ImportDebtsModalProps) {
  const [phase, setPhase] = useState<Phase>("consent");
  const [consented, setConsented] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const [linkToken, setLinkToken] = useState<string | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: status, isLoading: statusLoading } = useQuery<ImportStatus>({
    queryKey: ["/api/debts/import/status"],
    enabled: open,
  });

  const reset = () => {
    setPhase("consent");
    setConsented(false);
    setResult(null);
    setErrorMessage("");
    setLinkToken(null);
  };

  const handleOpenChange = (next: boolean) => {
    if (!next && phase === "importing") return;
    if (!next) reset();
    onOpenChange(next);
  };

  const finishSuccess = (data: any, fallbackInstitution?: string | null) => {
    setResult({
      imported: data.imported ?? 0,
      updated: data.updated ?? 0,
      institutionName: data.institutionName ?? fallbackInstitution ?? null,
    });
    setPhase("complete");
    queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
    queryClient.invalidateQueries({ queryKey: ["/api/dashboard-summary"] });
    queryClient.invalidateQueries({ queryKey: ["/api/debts/import/status"] });
    toast({
      title: "Debts imported",
      description: `${data.imported ?? 0} added, ${data.updated ?? 0} updated.`,
    });
  };

  const handleFailure = (err: unknown) => {
    if (parseErrorCode(err) === "PLAID_LIABILITIES_NOT_ENABLED") {
      setPhase("unavailable");
      return;
    }
    setErrorMessage(parseErrorMessage(err));
    setPhase("error");
  };

  const runImportDirect = async () => {
    setPhase("importing");
    try {
      const res = await apiRequest("POST", "/api/debts/import", { consent: true });
      const data = await res.json();
      finishSuccess(data);
    } catch (err) {
      handleFailure(err);
    }
  };

  const startLinkFlow = async () => {
    setPhase("linking");
    try {
      const res = await apiRequest("POST", "/api/debts/import/link-token", {});
      const data = await res.json();
      if (!data.linkToken) throw new Error("No link token returned");
      // Persist for OAuth banks: /plaid/oauth resumes Link with this token
      // after the bank redirects back.
      savePlaidOauthState(data.linkToken, "debt_import");
      setLinkToken(data.linkToken); 
    } catch (err) {
      handleFailure(err);
    }
  };

  const handleStart = () => {
    if (status?.requiresLink) {
      startLinkFlow();
    } else {
      runImportDirect();
    }
  };

  const onPlaidSuccess = async (publicToken: string, metadata: any) => {
    clearPlaidOauthState();
    setLinkToken(null);
    setPhase("importing");
    try {
      const res = await apiRequest("POST", "/api/debts/import/exchange", {
        publicToken,
        institutionName: metadata?.institution?.name,
        consent: true,
      });
      const data = await res.json();
      finishSuccess(data, metadata?.institution?.name);
    } catch (err) {
      handleFailure(err);
    }
  };

  const onPlaidExit = () => {
    clearPlaidOauthState();
    setLinkToken(null);
    setPhase("consent");
  };

  // While Plaid Link's own window is on screen, our Radix dialog must be fully
  // closed: its focus trap steals keyboard focus from Plaid's iframe (inputs
  // freeze) and clicks on Plaid's overlay register as outside-clicks that
  // dismiss the dialog. The launcher renders nothing, so it lives OUTSIDE the
  // dialog and stays mounted while the dialog is hidden. (This supersedes an
  // earlier modal={false} approach on main — fully closing the dialog is the
  // variant verified end-to-end in production.)
  const plaidLinkActive = phase === "linking" && linkToken !== null;

  return (
    <>
      {open && plaidLinkActive && (
        <PlaidLinkLauncher token={linkToken!} onSuccess={onPlaidSuccess} onExit={onPlaidExit} />
      )}
    <Dialog open={open && !plaidLinkActive} onOpenChange={handleOpenChange}>
      <DialogContent
        className="sm:max-w-md border-0 shadow-xl rounded-2xl overflow-hidden p-0"
        data-testid="modal-import-debts"
        onInteractOutside={(e) => {
          if (phase === "importing") e.preventDefault();
        }}
        onEscapeKeyDown={(e) => {
          if (phase === "importing") e.preventDefault();
        }}
      >
        <div className="h-2 w-full bg-dime-purple"></div>
        <div className="p-6">
          {(phase === "unavailable" || (phase === "consent" && status?.liabilitiesAvailable === false)) && (
            <div className="space-y-6" data-testid="state-import-unavailable">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-dime-purple/10 rounded-full flex items-center justify-center mb-4">
                  <Clock className="w-8 h-8 text-dime-purple" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Coming soon</h3>
                <p className="text-slate-600 mt-2 font-medium px-4">
                  Automatic debt import is coming soon. You can add your debts manually for now — everything else works the same.
                </p>
              </div>
              <Button
                className="w-full bg-dime-purple hover:bg-dime-purple/90 text-white font-bold h-12 text-lg shadow-sm press-scale rounded-xl"
                onClick={() => handleOpenChange(false)}
                data-testid="button-import-unavailable-close"
              >
                Got it
              </Button>
            </div>
          )}

          {phase === "consent" && status?.liabilitiesAvailable !== false && (
            <div className="space-y-6">
              <DialogHeader>
                <DialogTitle className="flex items-center gap-2 text-2xl font-bold tracking-tight text-slate-900">
                  <Landmark className="w-6 h-6 text-dime-purple" />
                  Import your debts
                </DialogTitle>
                <DialogDescription className="text-base text-slate-600 mt-2 font-medium">
                  Securely connect your accounts to bring in balances, rates, and minimums automatically.
                </DialogDescription>
              </DialogHeader>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-4">
                <div className="flex items-start gap-3">
                  <ShieldCheck className="w-5 h-5 text-dime-purple mt-0.5 shrink-0" />
                  <p className="text-sm font-medium text-slate-600 leading-relaxed">
                    Credentials are handled by a secure provider and never stored by Dime Time. We only access balances and terms.
                  </p>
                </div>
              </div>

              <label className="flex items-start gap-3 cursor-pointer p-4 rounded-xl border border-slate-200 hover:bg-slate-50 transition-colors" data-testid="checkbox-import-consent-wrap">
                <Checkbox
                  checked={consented}
                  onCheckedChange={(v) => setConsented(v === true)}
                  className="mt-1"
                  data-testid="checkbox-import-consent"
                />
                <span className="text-sm font-semibold text-slate-700 select-none">
                  I authorize Dime Time to securely import my debt accounts.
                </span>
              </label>

              {status?.connected && (status.institutions?.length ?? 0) > 0 && (
                <div className="rounded-xl border border-slate-200 p-3 space-y-1" data-testid="list-connected-banks">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Connected banks</p>
                  {status.institutions!.map((inst, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm font-medium text-slate-700">
                      <Landmark className="w-4 h-4 text-dime-purple shrink-0" />
                      <span>{inst.institutionName ?? "Linked bank"}</span>
                      {inst.status !== "active" && (
                        <span className="text-xs text-amber-600 font-semibold">needs reconnect</span>
                      )}
                    </div>
                  ))}
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1 font-semibold text-slate-700 shadow-sm"
                  onClick={() => handleOpenChange(false)}
                  data-testid="button-import-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="button"
                  className="flex-1 bg-dime-purple hover:bg-dime-purple/90 text-white font-bold shadow-sm press-scale"
                  disabled={!consented || statusLoading}
                  onClick={handleStart}
                  data-testid="button-import-start"
                >
                  {statusLoading ? "Loading…" : status?.requiresLink ? "Connect & Import" : "Import Now"}
                </Button>
              </div>
              {status?.connected && status?.canLinkAnother && (
                <Button
                  type="button"
                  variant="ghost"
                  className="w-full font-semibold text-dime-purple hover:text-dime-purple/90"
                  disabled={!consented || statusLoading}
                  onClick={startLinkFlow}
                  data-testid="button-import-add-bank"
                >
                  + Add another bank
                </Button>
              )}
            </div>
          )}

          {phase === "linking" && (
            <div className="py-12 flex flex-col items-center text-center space-y-4" data-testid="state-import-linking">
              <Loader2 className="w-12 h-12 text-dime-purple animate-spin" />
              <div>
                <p className="text-xl font-bold text-slate-900">Opening connection…</p>
                <p className="text-slate-500 font-medium mt-1">Choose your bank in the window.</p>
              </div>
              <Button variant="ghost" className="mt-4 text-slate-500 font-semibold hover:bg-slate-100" onClick={onPlaidExit} data-testid="button-import-cancel-linking">Cancel</Button>
            </div>
          )}

          {phase === "importing" && (
            <div className="py-12 flex flex-col items-center text-center space-y-4" data-testid="state-import-loading">
              <Loader2 className="w-12 h-12 text-dime-purple animate-spin" />
              <div>
                <p className="text-xl font-bold text-slate-900">Importing debts…</p>
                <p className="text-slate-500 font-medium mt-1">This only takes a moment.</p>
              </div>
            </div>
          )}

          {phase === "complete" && result && (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Import complete</h3>
                <p className="text-slate-600 mt-2 font-medium">
                  {result.institutionName ? `Connected to ${result.institutionName}.` : "Your debts are up to date."}
                </p>
              </div>

              <div className="rounded-xl bg-slate-50 border border-slate-100 p-6 flex justify-around text-center">
                <div>
                  <p className="text-4xl font-bold text-dime-purple tabular-nums mb-1" data-testid="text-import-added">{result.imported}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Added</p>
                </div>
                <div className="w-px bg-slate-200"></div>
                <div>
                  <p className="text-4xl font-bold text-slate-900 tabular-nums mb-1" data-testid="text-import-updated">{result.updated}</p>
                  <p className="text-xs font-bold text-slate-400 uppercase tracking-wider">Updated</p>
                </div>
              </div>
              <Button className="w-full bg-dime-purple hover:bg-dime-purple/90 text-white font-bold h-12 text-lg shadow-sm press-scale rounded-xl" onClick={() => handleOpenChange(false)} data-testid="button-import-done">
                Done
              </Button>
            </div>
          )}

          {phase === "error" && (
            <div className="space-y-6">
              <div className="flex flex-col items-center text-center">
                <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
                  <AlertCircle className="w-8 h-8 text-red-600" />
                </div>
                <h3 className="text-2xl font-bold text-slate-900 tracking-tight">Import failed</h3>
                <p className="text-slate-600 mt-2 font-medium px-4">{errorMessage}</p>
              </div>
              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1 font-semibold text-slate-700" onClick={() => handleOpenChange(false)} data-testid="button-import-error-close">Close</Button>
                <Button className="flex-1 bg-dime-purple hover:bg-dime-purple/90 text-white font-bold shadow-sm press-scale" onClick={handleStart} data-testid="button-import-retry">Try Again</Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
    </>
  );
}