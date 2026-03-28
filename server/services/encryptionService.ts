import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_ENV = 'PLAID_TOKEN_ENCRYPTION_KEY';

function getEncryptionKey(): Buffer {
  const raw = process.env[KEY_ENV];
  if (!raw) {
    if (process.env.NODE_ENV === 'production' || process.env.PLAID_ENV === 'production') {
      throw new Error(
        `[encryptionService] ${KEY_ENV} is not set. This is required in production to encrypt Plaid access tokens at rest. ` +
        `Generate a key with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))" and set it as a secret.`
      );
    }
    // Dev/sandbox fallback — deterministic but clearly marked
    console.warn(`[encryptionService] WARNING: ${KEY_ENV} not set. Using insecure dev-only key. Set this env var before going to production.`);
    return Buffer.alloc(32, 'devkey-dime-time-insecure-do-not-use');
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`[encryptionService] ${KEY_ENV} must be a 32-byte key encoded as base64. Got ${key.length} bytes. Regenerate with: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"`);
  }
  return key;
}

/**
 * Encrypt a Plaid access token for storage.
 * Returns a base64-encoded string containing: iv (12B) + ciphertext + authTag (16B).
 * Prefix "enc:" marks the value as encrypted so plain legacy tokens can be detected.
 */
export function encryptToken(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  const combined = Buffer.concat([iv, encrypted, tag]);
  return `enc:${combined.toString('base64')}`;
}

/**
 * Decrypt a Plaid access token that was encrypted with encryptToken().
 * Handles legacy plain-text tokens transparently (returns as-is if not prefixed with "enc:").
 */
export function decryptToken(stored: string): string {
  if (!stored.startsWith('enc:')) {
    // Legacy plain-text token — return as-is, no decryption needed
    return stored;
  }
  const key = getEncryptionKey();
  const combined = Buffer.from(stored.slice(4), 'base64');
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

/**
 * Check whether a stored token value is already encrypted.
 */
export function isEncrypted(stored: string): boolean {
  return stored.startsWith('enc:');
}
