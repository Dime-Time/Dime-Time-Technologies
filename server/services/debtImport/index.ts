import type { LiabilityProvider } from "./types";
import { sandboxProvider } from "./sandboxProvider";
import { plaidLiabilityProvider } from "./plaidLiabilityProvider";

export * from "./types";

/**
 * Select the active liability-data provider.
 *
 * Provider-agnostic by design: the rest of the app never imports a concrete
 * provider, only this factory. Swap providers with the `DEBT_IMPORT_PROVIDER`
 * env var (default "sandbox") — no code change required beyond implementing the
 * `LiabilityProvider` interface for a new provider.
 */
export function getLiabilityProvider(): LiabilityProvider {
  const name = (process.env.DEBT_IMPORT_PROVIDER || "sandbox").trim().toLowerCase();
  switch (name) {
    case "plaid":
      return plaidLiabilityProvider;
    case "sandbox":
    default:
      return sandboxProvider;
  }
}
