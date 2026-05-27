import { useAuth } from "@/hooks/useAuth";
import { DEFAULT_FLAGS, type FlagName, type FlagMap } from "@shared/flags";

/**
 * Read a single feature flag.
 *
 * Source of truth: the `_flags` envelope returned by `/api/user` on the
 * cold-start bootstrap request (see server/routes.ts and useAuth.tsx).
 * Falls back to the build-time defaults from `shared/flags.ts` when the
 * bootstrap response hasn't arrived yet OR when the user is unauthenticated.
 *
 * NEVER reads `import.meta.env` for flag values — env vars are baked into
 * the client bundle at build time and can't be flipped without a redeploy,
 * which defeats the point of a feature flag for TestFlight rollouts.
 */
export function useFlag(name: FlagName): boolean {
  const { flags } = useAuth();
  return (flags ?? DEFAULT_FLAGS)[name];
}

/** Read the full flag map. Prefer `useFlag(name)` when you only need one. */
export function useFlags(): FlagMap {
  const { flags } = useAuth();
  return flags ?? DEFAULT_FLAGS;
}
