/**
 * Shared auth error messages + mapping logic.
 *
 * The honest rate-limit and network messages must be identical across
 * Login, Signup, ForgotPassword, and ResetPassword. Defining them here
 * (with the 429/network/4xx mapping) prevents individual pages from
 * drifting when they are edited or restyled.
 *
 * Locked by client/src/pages/__tests__/auth-error-messages.test.ts.
 */

export const RATE_LIMIT_MESSAGE =
  "Too many attempts — please wait a few minutes and try again.";

export const NETWORK_MESSAGE =
  "Connection problem — please check your internet and try again.";

/**
 * Wraps a fetch call so a low-level network failure (no HTTP response at
 * all) surfaces as the honest connection message.
 */
export async function authFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  try {
    return await fetch(input, init);
  } catch {
    throw new Error(NETWORK_MESSAGE);
  }
}

/**
 * Maps a non-OK auth response to a user-facing Error:
 *   - 429            → rate-limit message
 *   - other statuses → server-provided `message` field, else `fallback`
 * Call only when `!response.ok`.
 */
export async function authErrorFromResponse(
  response: Response,
  fallback: string,
): Promise<Error> {
  if (response.status === 429) {
    return new Error(RATE_LIMIT_MESSAGE);
  }
  const body = await response.json().catch(() => ({} as Record<string, unknown>));
  const message = typeof (body as { message?: unknown }).message === "string"
    ? (body as { message: string }).message
    : undefined;
  return new Error(message || fallback);
}
