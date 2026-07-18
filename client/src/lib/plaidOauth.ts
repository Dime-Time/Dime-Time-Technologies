/**
 * Plaid OAuth continuity state.
 *
 * When a user connects an OAuth bank (Chase, Wells Fargo, etc.), Plaid Link
 * redirects the whole page to the bank's site and back to /plaid/oauth. To
 * resume the Link session after that round-trip we must re-initialize Link
 * with the SAME link_token, so we persist it (plus which flow launched Link)
 * in localStorage right before Link opens. Plaid documents localStorage as
 * the recommended storage for this token on web — it is short-lived (~4h),
 * single-user, and useless without the user's session.
 */

const STORAGE_KEY = "dimetime_plaid_oauth";
/** Ignore stored state older than 30 minutes — Link sessions won't resume cleanly. */
const MAX_AGE_MS = 30 * 60 * 1000;

export type PlaidOauthFlow = "bank" | "debt_import";

export interface PlaidOauthState {
  linkToken: string;
  flow: PlaidOauthFlow;
  ts: number;
}

export function savePlaidOauthState(linkToken: string, flow: PlaidOauthFlow): void {
  try {
    const state: PlaidOauthState = { linkToken, flow, ts: Date.now() };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode quota etc.) — OAuth resume will show
    // its friendly retry screen instead.
  }
}

export function loadPlaidOauthState(): PlaidOauthState | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PlaidOauthState;
    if (!parsed || typeof parsed.linkToken !== "string" || !parsed.linkToken) return null;
    if (parsed.flow !== "bank" && parsed.flow !== "debt_import") return null;
    if (typeof parsed.ts !== "number" || Date.now() - parsed.ts > MAX_AGE_MS) {
      clearPlaidOauthState();
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function clearPlaidOauthState(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
}
