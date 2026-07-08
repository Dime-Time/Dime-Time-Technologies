import { Resend } from "resend";

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const EMAIL_FROM = process.env.EMAIL_FROM || "Dime Time <onboarding@resend.dev>";

const resend = RESEND_API_KEY ? new Resend(RESEND_API_KEY) : null;

export interface SendEmailParams {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export interface SendEmailResult {
  ok: boolean;
  provider: "resend" | "console";
  id?: string;
  error?: string;
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
