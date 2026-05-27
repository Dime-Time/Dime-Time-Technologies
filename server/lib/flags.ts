import { resolveServerFlags, type FlagMap, type FlagName } from "@shared/flags";

/**
 * Server-side flag accessor. Resolved once at module load — flipping a flag
 * requires restarting the workflow, which matches our deployment model
 * (env vars are baked into the running process).
 */
let cached: FlagMap | null = null;

export function getFlags(): FlagMap {
  if (cached) return cached;
  cached = resolveServerFlags(process.env);
  return cached;
}

export function isFlagEnabled(name: FlagName): boolean {
  return getFlags()[name];
}

/**
 * Test-only: clear the cache so a test can re-resolve flags after mutating
 * `process.env`. Not exported from any production code path.
 */
export function __resetFlagCacheForTests(): void {
  cached = null;
}
