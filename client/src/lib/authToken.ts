// client/src/lib/authToken.ts

const STORAGE_KEY = "dime_time_auth_token";

/**
 * Save the auth token so native apps (and web) can reuse it
 * across app restarts.
 */
export function saveAuthToken(token: string) {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.setItem(STORAGE_KEY, token);
    }
  } catch (err) {
    console.warn("Unable to persist auth token", err);
  }
}

/**
 * Read the stored auth token.
 * On native (Capacitor) this runs in the WebView context, so
 * localStorage is available and persisted per app install.
 */
export function getAuthToken(): string | null {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      return window.localStorage.getItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Unable to read auth token", err);
  }
  return null;
}

/**
 * Clear the token on logout.
 */
export function clearAuthToken() {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Unable to clear auth token", err);
  }
}
