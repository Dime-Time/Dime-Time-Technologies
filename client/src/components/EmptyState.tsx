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
}

/**
 * Friendly, consistent empty-state block for list-style surfaces
 * (transactions, debts, roundups, crypto, feedback). One CTA only.
 */
export function EmptyState({
  icon: Icon,
  title,
  description,
  ctaLabel,
  onCtaClick,
  className,
  testIdPrefix = "empty-state",
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center text-center py-8 px-4",
        className
      )}
      data-testid={testIdPrefix}
    >
      {Icon && (
        <div className="w-12 h-12 rounded-full bg-white/15 flex items-center justify-center mb-3">
          <Icon className="w-6 h-6 text-white" />
        </div>
      )}
      <p className="font-semibold text-white" data-testid={`${testIdPrefix}-title`}>
        {title}
      </p>
      {description && (
        <p className="text-sm text-white/80 mt-1 max-w-xs">
          {description}
        </p>
      )}
      {ctaLabel && onCtaClick && (
        <Button
          variant="outline"
          size="sm"
          className="mt-4 border-white/40 text-white hover:bg-white/10"
          onClick={onCtaClick}
          data-testid={`${testIdPrefix}-cta`}
        >
          {ctaLabel}
        </Button>
      )}
    </div>
  );
}
