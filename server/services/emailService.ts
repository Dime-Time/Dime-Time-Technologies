import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Dime Time <onboarding@resend.dev>";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
}

export interface SendEmailResult {
  ok: boolean;
  provider: "resend" | "console";
  id?: string;
  error?: string;
}

// ---------------------------------------------------------------------------
// Provider health gate.
//
// Purpose: lets unauthenticated, non-enumerating routes (forgot-password)
// return the SAME outage response for every request — before any user lookup
// — once the email provider is known to be failing. Without this, a send
// failure could only be surfaced for accounts that exist, turning a provider
// outage into an account-enumeration side channel.
//
// Semantics: any transactional send failure marks the service degraded for
// EMAIL_DEGRADED_WINDOW_MS; any successful send clears it immediately.
// In-process only (resets on restart) — deliberate: it is a UX/privacy gate,
// not a durable circuit breaker.
// ---------------------------------------------------------------------------
export const EMAIL_DEGRADED_WINDOW_MS = 10 * 60 * 1000;
let lastSendFailureAt: number | null = null;

export function isEmailServiceDegraded(now: number = Date.now()): boolean {
  return lastSendFailureAt !== null && now - lastSendFailureAt < EMAIL_DEGRADED_WINDOW_MS;
}

export function recordEmailSendOutcome(ok: boolean, now: number = Date.now()): void {
  lastSendFailureAt = ok ? null : now;
}

/**
 * Send a transactional email.
 *
 * If RESEND_API_KEY is set we send through Resend. Otherwise we log the
 * message body to stdout so dev/test flows still work without provisioning
 * an external email provider.
 *
 * EMAIL_FROM can be overridden once dime-time.com is verified in Resend
 * (e.g. EMAIL_FROM="Dime Time <noreply@dime-time.com>"). Until then the
 * default "Dime Time <onboarding@resend.dev>" uses Resend's shared sender
 * domain, which works without DNS setup.
 */
export async function sendEmail(params: SendEmailParams): Promise<SendEmailResult> {
  const result = await sendEmailInternal(params);
  // Feed the provider health gate on EVERY transactional send so
  // non-enumerating routes can report outages without a user lookup.
  recordEmailSendOutcome(result.ok);
  return result;
}

async function sendEmailInternal(params: SendEmailParams): Promise<SendEmailResult> {
  if (!resend) {
    // Production must never run without a real email provider. Failing
    // closed prevents shipping reset emails to /dev/null and prevents
    // accidentally logging reset URLs (which contain secret tokens) to
    // stdout in a production environment.
    if (process.env.NODE_ENV === "production") {
      console.error(JSON.stringify({
        event: "email_misconfigured",
        message: "RESEND_API_KEY is not set in production",
        to_domain: params.to.split("@")[1] ?? "",
        subject: params.subject,
      }));
      return { ok: false, provider: "console", error: "Email provider not configured" };
    }
    // Dev fallback: log envelope ONLY (no body, no subject — bodies for
    // reset emails contain tokens). The full message can be inspected
    // with a real Resend key in development.
    console.log(JSON.stringify({
      event: "email_dev_log",
      to: params.to,
      from: EMAIL_FROM,
      note: "RESEND_API_KEY not set — email body suppressed. Set RESEND_API_KEY to send real emails.",
    }));
    return { ok: true, provider: "console" };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: EMAIL_FROM,
      to: params.to,
      subject: params.subject,
      html: params.html,
      text: params.text,
      ...(params.replyTo ? { replyTo: params.replyTo } : {}),
    });

    if (error) {
      console.error(JSON.stringify({
        event: "email_send_failed",
        provider: "resend",
        to: params.to,
        subject: params.subject,
        error: error.message,
      }));
      return { ok: false, provider: "resend", error: error.message };
    }

    return { ok: true, provider: "resend", id: data?.id };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(JSON.stringify({
      event: "email_send_exception",
      provider: "resend",
      to: params.to,
      subject: params.subject,
      error: message,
    }));
    return { ok: false, provider: "resend", error: message };
  }
}

// Escape user-derived values before interpolating into HTML email templates.
function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface PasswordResetEmailParams {
  to: string;
  firstName?: string | null;
  resetUrl: string;
  expiresInMinutes: number;
}

export async function sendPasswordResetEmail(params: PasswordResetEmailParams): Promise<SendEmailResult> {
  const greeting = params.firstName ? `Hi ${params.firstName},` : "Hi,";

  const text = [
    greeting,
    "",
    "We received a request to reset the password for your Dime Time account.",
    "",
    `Reset your password using this link (expires in ${params.expiresInMinutes} minutes):`,
    params.resetUrl,
    "",
    "If you didn't request this, you can safely ignore this email — your password won't change.",
    "",
    "— The Dime Time team",
    "",
    "Dime Time is a financial technology platform and is not a bank. Banking services and payment infrastructure are provided through regulated financial partners.",
  ].join("\n");

  const html = `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f7fb; padding: 24px; color: #111;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px;">
      <tr><td>
        <h1 style="color: #918EF4; margin: 0 0 8px; font-size: 22px;">Reset your Dime Time password</h1>
        <p style="margin: 16px 0; font-size: 15px; line-height: 1.5;">${escapeHtml(greeting)}</p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">We received a request to reset the password for your Dime Time account.</p>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5;">Click the button below to choose a new password. This link expires in <strong>${params.expiresInMinutes} minutes</strong>.</p>
        <p style="text-align: center; margin: 0 0 24px;">
          <a href="${params.resetUrl}" style="display: inline-block; background: #918EF4; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: 600;">Reset password</a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #666; line-height: 1.5;">Or paste this link into your browser:</p>
        <p style="margin: 0 0 24px; font-size: 13px; color: #918EF4; word-break: break-all;">${params.resetUrl}</p>
        <p style="margin: 24px 0 0; font-size: 13px; color: #666; line-height: 1.5;">If you didn't request this, you can safely ignore this email — your password won't change.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="margin: 0; font-size: 11px; color: #888; line-height: 1.5;">Dime Time is a financial technology platform and is not a bank. Banking services and payment infrastructure are provided through regulated financial partners.</p>
      </td></tr>
    </table>
  </body>
</html>`.trim();

  return sendEmail({
    to: params.to,
    subject: "Reset your Dime Time password",
    html,
    text,
  });
}

export interface ContactNotificationEmailParams {
  name: string;
  email: string;
  message: string;
  source: string;
  submittedAt: Date;
}

/**
 * Notify the founder inbox that a new contact/feedback submission arrived.
 * Sent to tim@dime-time.com — the Resend account owner's address — so this
 * delivers even before the dime-time.com domain is verified in Resend.
 * Reply-To is set to the submitter so replies go straight to them.
 */
export async function sendContactNotificationEmail(params: ContactNotificationEmailParams): Promise<SendEmailResult> {
  const sourceLabel = params.source === "in_app" ? "In-app feedback" : "Marketing site contact form";
  const when = params.submittedAt.toISOString();
  // Defense-in-depth: never allow CR/LF or oversized values into the
  // subject line, and only set Reply-To when the address looks like a
  // plain email (Resend also validates server-side; this avoids relying
  // on it exclusively).
  const safeName = params.name.replace(/[\r\n]+/g, " ").trim().slice(0, 80) || "Unknown";
  const replyTo = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email) && params.email.length <= 254
    ? params.email
    : undefined;

  const text = [
    `New ${sourceLabel.toLowerCase()} submission`,
    "",
    `From: ${params.name} <${params.email}>`,
    `Source: ${sourceLabel}`,
    `Received: ${when}`,
    "",
    "Message:",
    params.message,
    "",
    "Reply to this email to respond directly.",
  ].join("\n");

  const html = `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f7fb; padding: 24px; color: #111;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px;">
      <tr><td>
        <h1 style="color: #918EF4; margin: 0 0 8px; font-size: 22px;">New message from ${escapeHtml(params.name)}</h1>
        <p style="margin: 0 0 4px; font-size: 14px; color: #666;">${escapeHtml(sourceLabel)} &middot; ${escapeHtml(when)}</p>
        <p style="margin: 0 0 16px; font-size: 14px; color: #666;">From: <strong style="color: #111;">${escapeHtml(params.name)}</strong> &lt;${escapeHtml(params.email)}&gt;</p>
        <div style="margin: 0 0 24px; padding: 16px; background: #f7f7fb; border-radius: 12px; font-size: 15px; line-height: 1.5; white-space: pre-wrap;">${escapeHtml(params.message)}</div>
        <p style="margin: 0; font-size: 13px; color: #888;">Reply to this email to respond directly to ${escapeHtml(params.name)}.</p>
      </td></tr>
    </table>
  </body>
</html>`.trim();

  return sendEmail({
    to: "tim@dime-time.com",
    subject: `Dime Time contact: ${safeName}`,
    html,
    text,
    ...(replyTo ? { replyTo } : {}),
  });
}

export interface VerificationEmailParams {
  to: string;
  firstName?: string | null;
  verifyUrl: string;
  expiresInMinutes: number;
}

export async function sendVerificationEmail(params: VerificationEmailParams): Promise<SendEmailResult> {
  const greeting = params.firstName ? `Hi ${params.firstName},` : "Hi,";
  const hours = Math.round(params.expiresInMinutes / 60);
  const expiryLabel = params.expiresInMinutes >= 120
    ? `${hours} hours`
    : `${params.expiresInMinutes} minutes`;

  const text = [
    greeting,
    "",
    "Welcome to Dime Time. Please confirm this is your email address so we can keep your account secure and send you important notifications about your debt payoff progress.",
    "",
    `Verify your email using this link (expires in ${expiryLabel}):`,
    params.verifyUrl,
    "",
    "If you didn't create a Dime Time account, you can safely ignore this email.",
    "",
    "— The Dime Time team",
    "",
    "Dime Time is a financial technology platform and is not a bank. Banking services and payment infrastructure are provided through regulated financial partners.",
  ].join("\n");

  const html = `
<!doctype html>
<html>
  <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #f7f7fb; padding: 24px; color: #111;">
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="max-width: 480px; margin: 0 auto; background: #ffffff; border-radius: 16px; padding: 32px;">
      <tr><td>
        <h1 style="color: #918EF4; margin: 0 0 8px; font-size: 22px;">Confirm your email</h1>
        <p style="margin: 16px 0; font-size: 15px; line-height: 1.5;">${escapeHtml(greeting)}</p>
        <p style="margin: 0 0 16px; font-size: 15px; line-height: 1.5;">Welcome to Dime Time. Please confirm this is your email address so we can keep your account secure and send you important notifications about your debt payoff progress.</p>
        <p style="margin: 0 0 24px; font-size: 15px; line-height: 1.5;">This link expires in <strong>${expiryLabel}</strong>.</p>
        <p style="text-align: center; margin: 0 0 24px;">
          <a href="${params.verifyUrl}" style="display: inline-block; background: #918EF4; color: #ffffff; text-decoration: none; padding: 12px 28px; border-radius: 12px; font-weight: 600;">Verify email</a>
        </p>
        <p style="margin: 0 0 8px; font-size: 13px; color: #666; line-height: 1.5;">Or paste this link into your browser:</p>
        <p style="margin: 0 0 24px; font-size: 13px; color: #918EF4; word-break: break-all;">${params.verifyUrl}</p>
        <p style="margin: 24px 0 0; font-size: 13px; color: #666; line-height: 1.5;">If you didn't create a Dime Time account, you can safely ignore this email.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;" />
        <p style="margin: 0; font-size: 11px; color: #888; line-height: 1.5;">Dime Time is a financial technology platform and is not a bank. Banking services and payment infrastructure are provided through regulated financial partners.</p>
      </td></tr>
    </table>
  </body>
</html>`.trim();

  return sendEmail({
    to: params.to,
    subject: "Confirm your Dime Time email address",
    html,
    text,
  });
}
