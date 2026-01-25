// client/src/lib/authToken.ts
// Secure auth token storage with encryption at rest
// Uses WebCrypto for encryption (works in Capacitor WebView + web)

const STORAGE_KEY = "dime_time_auth_token_encrypted";
const KEY_STORAGE = "dime_time_encryption_key";

/**
 * Generate or retrieve encryption key for token storage.
 * Key is stored separately and regenerated if lost.
 */
async function getEncryptionKey(): Promise<CryptoKey> {
  try {
    const storedKey = localStorage.getItem(KEY_STORAGE);
    if (storedKey) {
      const keyData = JSON.parse(storedKey);
      return await crypto.subtle.importKey(
        "jwk",
        keyData,
        { name: "AES-GCM", length: 256 },
        true,
        ["encrypt", "decrypt"]
      );
    }
  } catch (err) {
    console.warn("Generating new encryption key");
  }

  // Generate new key
  const key = await crypto.subtle.generateKey(
    { name: "AES-GCM", length: 256 },
    true,
    ["encrypt", "decrypt"]
  );
  
  // Export and store
  const exportedKey = await crypto.subtle.exportKey("jwk", key);
  localStorage.setItem(KEY_STORAGE, JSON.stringify(exportedKey));
  
  return key;
}

/**
 * Encrypt data using AES-GCM
 */
async function encryptData(data: string): Promise<string> {
  const key = await getEncryptionKey();
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encoded = new TextEncoder().encode(data);
  
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    encoded
  );
  
  // Combine IV + encrypted data and base64 encode
  const combined = new Uint8Array(iv.length + encrypted.byteLength);
  combined.set(iv);
  combined.set(new Uint8Array(encrypted), iv.length);
  
  return btoa(String.fromCharCode.apply(null, Array.from(combined)));
}

/**
 * Decrypt data using AES-GCM
 */
async function decryptData(encryptedBase64: string): Promise<string> {
  const key = await getEncryptionKey();
  
  // Decode and split IV from data
  const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
  const iv = combined.slice(0, 12);
  const data = combined.slice(12);
  
  const decrypted = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv },
    key,
    data
  );
  
  return new TextDecoder().decode(decrypted);
}

/**
 * Save the auth token with encryption at rest.
 * Uses AES-GCM encryption before storing in persistent storage.
 */
export async function saveAuthToken(token: string): Promise<void> {
  try {
    if (typeof window !== "undefined" && window.localStorage && crypto.subtle) {
      const encrypted = await encryptData(token);
      localStorage.setItem(STORAGE_KEY, encrypted);
    } else {
      // Fallback for environments without WebCrypto
      console.warn("WebCrypto unavailable, using basic storage");
      localStorage.setItem(STORAGE_KEY, token);
    }
  } catch (err) {
    console.warn("Unable to persist auth token", err);
  }
}

/**
 * Read and decrypt the stored auth token.
 * Returns null if no token or decryption fails.
 */
export async function getAuthToken(): Promise<string | null> {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      const encrypted = localStorage.getItem(STORAGE_KEY);
      if (!encrypted) return null;
      
      if (crypto.subtle) {
        return await decryptData(encrypted);
      } else {
        // Fallback
        return encrypted;
      }
    }
  } catch (err) {
    console.warn("Unable to read auth token, clearing corrupted data", err);
    clearAuthToken();
  }
  return null;
}

/**
 * Synchronous check if any token exists (for initial render).
 * Does not decrypt - just checks presence.
 */
export function hasStoredToken(): boolean {
  try {
    return !!localStorage.getItem(STORAGE_KEY);
  } catch {
    return false;
  }
}

/**
 * Clear the token on logout.
 */
export function clearAuthToken(): void {
  try {
    if (typeof window !== "undefined" && window.localStorage) {
      localStorage.removeItem(STORAGE_KEY);
    }
  } catch (err) {
    console.warn("Unable to clear auth token", err);
  }
}

/**
 * Migrate from old unencrypted storage to new encrypted format.
 * Call this once on app startup.
 */
export async function migrateTokenStorage(): Promise<void> {
  const OLD_KEY = "dime_time_auth_token";
  try {
    const oldToken = localStorage.getItem(OLD_KEY);
    if (oldToken && !localStorage.getItem(STORAGE_KEY)) {
      await saveAuthToken(oldToken);
      localStorage.removeItem(OLD_KEY);
      console.log("Migrated auth token to encrypted storage");
    }
  } catch (err) {
    console.warn("Token migration failed", err);
  }
}
