import { Clock, Loader2, CheckCircle2, XCircle, AlertTriangle } from "lucide-react";
import { cn } from "@/lib/utils";
import {
  TRANSACTION_STATUS_LABELS,
  mapToTransactionStatus,
  type TransactionStatus,
} from "@shared/transactionStatus";

/**
 * Style descriptor for each canonical status. Kept colocated with the
 * badge so swapping the palette is a one-file change.
 */
const STATUS_STYLES: Record<
  TransactionStatus,
  { className: string; Icon: typeof Clock; spin?: boolean }
> = {
  pending: {
    className:
      "bg-amber-50 text-amber-800 border-amber-200 dark:bg-amber-950/40 dark:text-amber-200 dark:border-amber-900/60",
    Icon: Clock,
  },
  processing: {
    className:
      "bg-blue-50 text-blue-800 border-blue-200 dark:bg-blue-950/40 dark:text-blue-200 dark:border-blue-900/60",
    Icon: Loader2,
    spin: true,
  },
  completed: {
    className:
      "bg-green-50 text-green-800 border-green-200 dark:bg-green-950/40 dark:text-green-200 dark:border-green-900/60",
    Icon: CheckCircle2,
  },
  failed: {
    className:
      "bg-red-50 text-red-800 border-red-200 dark:bg-red-950/40 dark:text-red-200 dark:border-red-900/60",
    Icon: XCircle,
  },
  requires_action: {
    className:
      "bg-purple-50 text-purple-800 border-purple-200 dark:bg-purple-950/40 dark:text-purple-200 dark:border-purple-900/60",
    Icon: AlertTriangle,
  },
};

interface StatusBadgeProps {
  /**
   * Accepts either the canonical TransactionStatus enum or any raw status
   * string from the DB — the badge normalises internally so consumers
   * don't have to remember to call the mapper first.
   */
  status: TransactionStatus | string | null | undefined;
  /** Optional timestamp — when provided, renders a relative "2m ago" suffix. */
  timestamp?: Date | string | number | null;
  className?: string;
  /** Compact variant (no icon, tighter padding). Default false. */
  compact?: boolean;
}

/**
 * Render a consistent status pill (color + icon + label, plus an optional
 * relative timestamp). Purely presentational — never fetches data, never
 * receives raw tokens or secrets.
 */
export function StatusBadge({
  status,
  timestamp,
  className,
  compact = false,
}: StatusBadgeProps) {
  const canonical = mapToTransactionStatus(
    typeof status === "string" ? status : status ?? undefined,
  );
  const style = STATUS_STYLES[canonical];
  const Icon = style.Icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border font-medium",
        compact ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-0.5 text-xs",
        style.className,
        className,
      )}
      data-testid={`badge-status-${canonical}`}
      data-status={canonical}
    >
      {!compact && (
        <Icon
          className={cn("h-3 w-3 flex-shrink-0", style.spin && "animate-spin")}
          aria-hidden="true"
        />
      )}
      <span>{TRANSACTION_STATUS_LABELS[canonical]}</span>
      {timestamp != null && (
        <span className="opacity-70 font-normal" aria-hidden="true">
          · {formatRelative(timestamp)}
        </span>
      )}
    </span>
  );
}

/**
 * Compact relative-time formatter — avoids pulling in date-fns just for
 * "2m ago" rendering. Falls back to a localized short date for anything
 * older than a week.
 */
function formatRelative(input: Date | string | number): string {
  const d = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(d.getTime())) return "";
  const seconds = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (seconds < 45) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return d.toLocaleDateString();
}
