import type { LucideIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  ctaLabel?: string;
  onCtaClick?: () => void;
  className?: string;
  testIdPrefix?: string;
  /**
   * Ignored in Phase 2 light theme, kept for backward compatibility.
   */
  tone?: "onLight" | "onPurple";
}

/**
 * Friendly, consistent empty-state block for list-style surfaces
 * (transactions, debts, roundups, crypto, feedback). One CTA only.
 *
 * Theme-safe: Restyled for the premium light theme.
 * CTA height is ≥44px to satisfy mobile tap-target guidance.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
  className,
  testIdPrefix = "empty-state",
  tone = "onLight",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center py-10 px-6 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 animate-fade-in",
        className
      )}
      data-testid={testIdPrefix}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-full flex items-center justify-center mb-4 bg-dime-purple/10 border border-dime-purple/20 shadow-sm">
          <Icon className="w-6 h-6 text-dime-purple" />
        </div>
      )}
      <p
        className="font-semibold text-slate-900 text-base"
        data-testid={`${testIdPrefix}-title`}
      >
        {title}
      </p>
      {description && (
        <p className="text-sm mt-1.5 max-w-sm text-slate-500 leading-relaxed">
          {description}
        </p>
      )}
      {ctaLabel && onCtaClick && (
        <Button
          variant="outline"
          className="mt-6 min-h-[44px] min-w-[140px] font-medium border-slate-200 text-slate-700 hover:bg-slate-100 hover:text-slate-900 shadow-sm transition-all press-scale"
          onClick={onCtaClick}
          data-testid={`${testIdPrefix}-cta`}
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
