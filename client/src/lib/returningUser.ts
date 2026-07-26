/**
 * Tracks whether this device/browser has ever completed a sign-in or
 * sign-up, so auth screens can greet first-time visitors with "Welcome"
 * instead of "Welcome Back". Cleared storage simply falls back to the
 * neutral first-time greeting — never an error.
 */
const KEY = "dt_returning_user";

export function isReturningUser(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    return false;
  }
}

export function markReturningUser(): void {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // storage unavailable (private mode etc.) — greeting just stays neutral
  }
}
