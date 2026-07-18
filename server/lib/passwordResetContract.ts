/**
 * Response contract for POST /api/auth/forgot-password.
 *
 * NON-ENUMERATION INVARIANT: the response status and body are decided
 * ENTIRELY from pre-lookup state (input validity + email-service health).
 * This function deliberately takes NO input about whether the account
 * exists or whether an individual send succeeded — the type signature
 * itself guarantees the response can never leak account existence.
 *
 * Individual send failures still surface to users: every send outcome
 * feeds the provider health gate (see emailService.recordEmailSendOutcome),
 * so once the provider is failing, ALL subsequent requests — known or
 * unknown email alike — receive the same 503 below.
 */

export const FORGOT_PASSWORD_GENERIC_SUCCESS = {
  success: true,
  message: "If an account exists for that email, a reset link has been sent.",
} as const;

export const EMAIL_OUTAGE_MESSAGE =
  "We couldn't send the reset email right now. Please try again in a few minutes.";

export interface ForgotPasswordDecision {
  status: 200 | 400 | 503;
  body: { message: string; success?: boolean };
}

export function decideForgotPasswordResponse(input: {
  emailProvided: boolean;
  /** Production is missing RESEND_API_KEY or PUBLIC_APP_URL. */
  misconfigured: boolean;
  /** Provider health gate reports a recent transactional send failure. */
  degraded: boolean;
}): ForgotPasswordDecision {
  if (!input.emailProvided) {
    return { status: 400, body: { message: "Email is required" } };
  }
  if (input.misconfigured || input.degraded) {
    return { status: 503, body: { message: EMAIL_OUTAGE_MESSAGE } };
  }
  return { status: 200, body: { ...FORGOT_PASSWORD_GENERIC_SUCCESS } };
}
