/**
 * Per-user cooldown for resend-verification-email requests.
 *
 * Complements the shared `authLimiter` (IP-window rate limit) with a
 * per-account cooldown so a user tapping "Resend" repeatedly cannot fan out
 * duplicate emails or burn provider quota. In-memory by design: a restart
 * clearing cooldowns is harmless (the authLimiter still applies), and no
 * schema change is needed.
 *
 * Injectable clock for deterministic tests.
 */
export const RESEND_COOLDOWN_SECONDS = 60;

const lastSendByUser = new Map<string, number>();

export function checkAndTouchResendCooldown(
  userId: string,
  now: number = Date.now(),
): { allowed: boolean; retryAfterSeconds: number } {
  const last = lastSendByUser.get(userId);
  if (last !== undefined) {
    const elapsed = (now - last) / 1000;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      return {
        allowed: false,
        retryAfterSeconds: Math.ceil(RESEND_COOLDOWN_SECONDS - elapsed),
      };
    }
  }
  lastSendByUser.set(userId, now);
  return { allowed: true, retryAfterSeconds: 0 };
}

/** Roll back the cooldown when the send itself failed, so the user may retry immediately. */
export function clearResendCooldown(userId: string): void {
  lastSendByUser.delete(userId);
}

/** Test helper. */
export function _resetAllResendCooldowns(): void {
  lastSendByUser.clear();
}
