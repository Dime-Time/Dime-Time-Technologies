import { Info, ShieldCheck } from "lucide-react";

interface BetaModeBannerProps {
  variant?: "full" | "compact" | "inline-light";
  showCompliance?: boolean;
  className?: string;
}

const BETA_TEXT =
  "Beta Mode: No live transfers are currently being processed. Payment and ACH features may operate in sandbox or testing mode.";

const COMPLIANCE_TEXT =
  "Dime Time is a financial technology platform and is not a bank. Banking services and payment infrastructure are provided through regulated financial partners.";

export function BetaModeBanner({
  variant = "full",
  showCompliance = false,
  className = "",
}: BetaModeBannerProps) {
  if (variant === "inline-light") {
    return (
      <div
        className={`rounded-md border border-white/30 bg-white/10 text-white text-xs px-3 py-2 flex gap-2 items-start ${className}`}
        data-testid="banner-beta-mode"
      >
        <Info className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
        <span>{BETA_TEXT}</span>
      </div>
    );
  }

  if (variant === "compact") {
    return (
      <div
        className={`rounded-md border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 px-3 py-2 flex gap-2 items-start ${className}`}
        data-testid="banner-beta-mode"
      >
        <Info className="h-4 w-4 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-xs text-amber-900 dark:text-amber-200 leading-snug">
          {BETA_TEXT}
        </p>
      </div>
    );
  }

  return (
    <div
      className={`rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-900/50 p-4 space-y-3 ${className}`}
      data-testid="banner-beta-mode"
    >
      <div className="flex gap-3 items-start">
        <Info className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
        <p className="text-sm text-amber-900 dark:text-amber-200 leading-snug">
          <span className="font-semibold">Beta Mode:</span>
          {" "}No live transfers are currently being processed. Payment and ACH features may operate in sandbox or testing mode.
        </p>
      </div>
      {showCompliance && (
        <div className="flex gap-3 items-start border-t border-amber-200 dark:border-amber-900/50 pt-3">
          <ShieldCheck className="h-5 w-5 text-amber-600 dark:text-amber-400 mt-0.5 flex-shrink-0" />
          <p className="text-xs text-amber-800 dark:text-amber-300 leading-snug">
            {COMPLIANCE_TEXT}
          </p>
        </div>
      )}
    </div>
  );
}

export function ComplianceDisclaimer({ className = "" }: { className?: string }) {
  return (
    <div
      className={`rounded-md border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900/50 px-3 py-2 flex gap-2 items-start ${className}`}
      data-testid="text-compliance-disclaimer"
    >
      <ShieldCheck className="h-4 w-4 text-slate-500 dark:text-slate-400 mt-0.5 flex-shrink-0" />
      <p className="text-xs text-slate-600 dark:text-slate-400 leading-snug">
        {COMPLIANCE_TEXT}
      </p>
    </div>
  );
}
