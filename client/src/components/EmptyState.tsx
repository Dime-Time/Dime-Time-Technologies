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
   * Visual tone for the surface this is rendered on.
   * - "onLight" (default): dark text + dime-purple accent, for white Card surfaces
   * - "onPurple": white text + white-outline CTA, for the lavender auth/onboarding surfaces
   */
  tone?: "onLight" | "onPurple";
}

/**
 * Friendly, consistent empty-state block for list-style surfaces
 * (transactions, debts, roundups, crypto, feedback). One CTA only.
 *
 * Theme-safe: pick `tone` based on the parent surface so the text stays
 * legible on either a white Card or the lavender #918EF4 brand panel.
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
  const isPurple = tone === "onPurple";

  return (
    <div
      className={cn(
        "flex flex-col items-center text-center py-8 px-4",
        className
      )}
      data-testid={testIdPrefix}
    >
      {Icon && (
        <div
          className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center mb-3",
            isPurple
              ? "bg-white/15"
              : "bg-dime-purple/10 border border-dime-purple/20"
          )}
        >
          <Icon
            className={cn(
              "w-6 h-6",
              isPurple ? "text-white" : "text-dime-purple"
            )}
          />
        </div>
      )}
      <p
        className={cn(
          "font-semibold",
          isPurple ? "text-white" : "text-slate-900"
        )}
        data-testid={`${testIdPrefix}-title`}
      >
        {title}
      </p>
      {description && (
        <p
          className={cn(
            "text-sm mt-1 max-w-xs",
            isPurple ? "text-white/80" : "text-slate-600"
          )}
        >
          {description}
        </p>
      )}
      {ctaLabel && onCtaClick && (
        <Button
          variant="outline"
          size="lg"
          className={cn(
            "mt-4 min-h-[44px]",
            isPurple
              ? "border-white/40 text-white hover:bg-white/10"
              : "border-dime-purple/40 text-dime-purple hover:bg-dime-purple/5"
          )}
          onClick={onCtaClick}
          data-testid={`${testIdPrefix}-cta`}
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
