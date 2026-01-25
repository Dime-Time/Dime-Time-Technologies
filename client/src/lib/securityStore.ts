const PIN_HASH_KEY = "dime_time_pin_hash";
const BIOMETRIC_ENABLED_KEY = "dime_time_biometric_enabled";
const APP_LOCKED_KEY = "dime_time_app_locked";

async function hashPin(pin: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(pin + "dime_time_salt");
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

export async function savePinHash(pin: string): Promise<void> {
  try {
    const hash = await hashPin(pin);
    localStorage.setItem(PIN_HASH_KEY, hash);
    localStorage.setItem(APP_LOCKED_KEY, "true");
  } catch (err) {
    console.error("Failed to save PIN:", err);
    throw err;
  }
}

export async function verifyPin(pin: string): Promise<boolean> {
  try {
    const storedHash = localStorage.getItem(PIN_HASH_KEY);
    if (!storedHash) return false;
    const inputHash = await hashPin(pin);
    return inputHash === storedHash;
  } catch (err) {
    console.error("Failed to verify PIN:", err);
    return false;
  }
}

export function hasPinSet(): boolean {
  return !!localStorage.getItem(PIN_HASH_KEY);
}

export function setBiometricEnabled(enabled: boolean): void {
  localStorage.setItem(BIOMETRIC_ENABLED_KEY, enabled ? "true" : "false");
}

export function isBiometricEnabled(): boolean {
  return localStorage.getItem(BIOMETRIC_ENABLED_KEY) === "true";
}

export function setAppLocked(locked: boolean): void {
  localStorage.setItem(APP_LOCKED_KEY, locked ? "true" : "false");
}

export function isAppLocked(): boolean {
  if (!hasPinSet()) return false;
  return localStorage.getItem(APP_LOCKED_KEY) !== "false";
}

export function clearSecuritySettings(): void {
  localStorage.removeItem(PIN_HASH_KEY);
  localStorage.removeItem(BIOMETRIC_ENABLED_KEY);
  localStorage.removeItem(APP_LOCKED_KEY);
}

export async function checkBiometricAvailable(): Promise<boolean> {
  if (typeof window === "undefined") return false;
  
  try {
    if ("PublicKeyCredential" in window) {
      const available = await (window as any).PublicKeyCredential?.isUserVerifyingPlatformAuthenticatorAvailable?.();
      return !!available;
    }
  } catch {
    return false;
  }
  return false;
}
