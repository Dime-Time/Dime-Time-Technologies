import { useFlag } from "@/hooks/useFlag";
import { BetaModeBanner } from "@/components/BetaModeBanner";

/**
 * Flag-gated wrapper around `BetaModeBanner`.
 *
 * Renders nothing unless the `ENABLE_BETA_BANNER` server flag is true.
 * Mounted once at the top of `AuthenticatedLayout` so beta testers see
 * a consistent reminder across every authed screen.
 */
export function BetaBanner() {
  const enabled = useFlag("ENABLE_BETA_BANNER");
  if (!enabled) return null;
  return (
    <div className="px-4 pt-2">
      <BetaModeBanner variant="compact" />
    </div>
  );
}
