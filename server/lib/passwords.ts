/**
 * Password hashing — single source of truth.
 *
 * Standard: bcrypt (adaptive, cost 12) for every NEW or CHANGED password
 * (signup, password reset, login-time migration). Legacy unsalted SHA-256
 * hashes are only ever *verified* here — never produced — and are replaced
 * with bcrypt the moment a legacy user logs in successfully (see the login
 * route). `password_algo` on the users row records which verifier applies.
 *
 * Security invariants (tested in server/lib/__tests__/passwords.test.ts):
 *   - verifyPassword never throws on malformed stored hashes — it returns
 *     false, so a corrupt row degrades to "invalid credentials", not a 500.
 *   - Legacy SHA-256 comparison is constant-time (timingSafeEqual).
 *   - No plaintext or hash is logged by this module.
 */
import bcrypt from "bcrypt";
import { createHash, timingSafeEqual } from "crypto";

export const BCRYPT_COST = 12;

/** The algorithm every new/changed password is stored with. */
export const CURRENT_PASSWORD_ALGO = "bcrypt";

export function hashPasswordSha256(password: string): string {
  return createHash("sha256").update(password).digest("hex");
}

export async function hashPasswordBcrypt(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

export function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

/**
 * Verify a candidate password against a stored hash.
 * `algo` comes from the user's `password_algo` column; anything other than
 * "bcrypt" is treated as legacy SHA-256. Never throws.
 */
export async function verifyPassword(
  password: string,
  hash: string,
  algo: string | null,
): Promise<boolean> {
  try {
    if (algo === "bcrypt") {
      return await bcrypt.compare(password, hash);
    }
    const sha256Hash = hashPasswordSha256(password);
    return constantTimeCompare(sha256Hash, hash);
  } catch {
    // Malformed stored hash (or non-utf8 garbage): fail closed as an
    // ordinary invalid-credentials result, never a thrown 500.
    return false;
  }
}
