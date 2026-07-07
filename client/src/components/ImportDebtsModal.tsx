import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { apiRequest } from "@/lib/queryClient";
import { ShieldCheck, Loader2, CheckCircle2, AlertCircle, Landmark } from "lucide-react";

interface ImportDebtsModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

type Phase = "consent" | "importing" | "complete" | "error";

/**
 * apiRequest throws `Error("<status>: <rawBody>")`. Pull the server's JSON
 * `message` out of the raw body so the user sees a clean sentence, not a blob.
 */
function parseErrorMessage(err: unknown): string {
  const fallback = "Something went wrong while importing your debts. Please try again.";
  if (!(err instanceof Error)) return fallback;
  const raw = err.message.replace(/^\d+:\s*/, "");
  try {
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.message === "string") return parsed.message;
  } catch {
    // Not JSON — fall through to the raw (already status-stripped) text.
  }
  return raw || fallback;
}

interface ImportResult {
  imported: number;
  updated: number;
  institutionName?: string | null;
}

export function ImportDebtsModal({ open, onOpenChange }: ImportDebtsModalProps) {
  const [phase, setPhase] = useState<Phase>("consent");
  const [consented, setConsented] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string>("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const reset = () => {
    setPhase("consent");
    setConsented(false);
    setResult(null);
    setErrorMessage("");
  };

  const handleOpenChange = (next: boolean) => {
    // Don't allow closing mid-import.
    if (!next && phase === "importing") return;
    if (!next) reset();
    onOpenChange(next);
  };

  const runImport = async () => {
    setPhase("importing");
    try {
      const res = await apiRequest("POST", "/api/debts/import", { consent: true });
      const data = await res.json();
      setResult({
        imported: data.imported ?? 0,
        updated: data.updated ?? 0,
        institutionName: data.institutionName ?? null,
      });
      setPhase("complete");
      queryClient.invalidateQueries({ queryKey: ["/api/debts"] });
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard-summary"] });
      toast({
        title: "Debts imported",
        description: `${data.imported ?? 0} added, ${data.updated ?? 0} updated.`,
      });
    } catch (err) {
      setErrorMessage(parseErrorMessage(err));
      setPhase("error");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="modal-import-debts">
        {phase === "consent" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Landmark className="w-5 h-5 text-dime-purple" />
                Import your debts
              </DialogTitle>
              <DialogDescription>
                Securely connect your accounts to bring in your balances, interest rates, and
                minimum payments automatically — no manual entry.
              </DialogDescription>
            </DialogHeader>

            <div className="rounded-lg bg-dime-purple/5 border border-dime-purple/20 p-4 space-y-2">
              <div className="flex items-start gap-2">
                <ShieldCheck className="w-5 h-5 text-dime-purple mt-0.5 shrink-0" />
                <p className="text-sm text-slate-600">
                  Your credentials are handled by a secure provider and are never stored by Dime
                  Time. We only receive your debt balances and terms.
                </p>
              </div>
            </div>

            <label className="flex items-start gap-3 cursor-pointer" data-testid="checkbox-import-consent-wrap">
              <Checkbox
                checked={consented}
                onCheckedChange={(v) => setConsented(v === true)}
                data-testid="checkbox-import-consent"
                className="mt-0.5"
              />
              <span className="text-sm text-slate-600">
                I authorize Dime Time to securely import my debt accounts and their balances.
              </span>
            </label>

            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
                data-testid="button-import-cancel"
              >
                Cancel
              </Button>
              <Button
                type="button"
                className="flex-1 bg-dime-purple hover:bg-dime-purple/90"
                disabled={!consented}
                onClick={runImport}
                data-testid="button-import-start"
              >
                Import Debts
              </Button>
            </div>
          </>
        )}

        {phase === "importing" && (
          <div className="py-8 flex flex-col items-center text-center gap-3" data-testid="state-import-loading">
            <Loader2 className="w-10 h-10 text-dime-purple animate-spin" />
            <p className="text-slate-900 font-medium">Importing your debts…</p>
            <p className="text-sm text-slate-500">This only takes a moment.</p>
          </div>
        )}

        {phase === "complete" && result && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5 text-dime-green" />
                Import complete
              </DialogTitle>
              <DialogDescription>
                {result.institutionName
                  ? `Connected to ${result.institutionName}.`
                  : "Your debts are now up to date."}
              </DialogDescription>
            </DialogHeader>
            <div className="rounded-lg border border-slate-200 p-4 flex justify-around text-center">
              <div>
                <p className="text-2xl font-bold text-dime-purple" data-testid="text-import-added">
                  {result.imported}
                </p>
                <p className="text-xs text-slate-500">Added</p>
              </div>
              <div>
                <p className="text-2xl font-bold text-dime-accent" data-testid="text-import-updated">
                  {result.updated}
                </p>
                <p className="text-xs text-slate-500">Updated</p>
              </div>
            </div>
            <Button
              type="button"
              className="w-full bg-dime-purple hover:bg-dime-purple/90"
              onClick={() => handleOpenChange(false)}
              data-testid="button-import-done"
            >
              Done
            </Button>
          </>
        )}

        {phase === "error" && (
          <>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-red-600" />
                Import failed
              </DialogTitle>
              <DialogDescription>{errorMessage}</DialogDescription>
            </DialogHeader>
            <div className="flex gap-3 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => handleOpenChange(false)}
                data-testid="button-import-error-close"
              >
                Close
              </Button>
              <Button
                type="button"
                className="flex-1 bg-dime-purple hover:bg-dime-purple/90"
                onClick={runImport}
                data-testid="button-import-retry"
              >
                Try Again
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
