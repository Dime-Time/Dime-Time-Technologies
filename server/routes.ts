import express, { type Express, type Request, type Response } from "express";
import { createServer, type Server } from "http";
import path from "path";
import fs from "fs";
import { SPA_META_PAGES, applySpaMeta } from "./spaMeta";
import { storage } from "./storage";

declare module 'express-session' {
  interface SessionData {
    userId: string;
  }
}
import { isAuthenticated } from "./replitAuth";
import { dimeTokenService } from "./services/dimeTokenService";
import { createHash, timingSafeEqual } from "crypto";
import bcrypt from "bcrypt";
import rateLimit from "express-rate-limit";

import { insertTransactionSchema, insertPaymentSchema, insertDebtSchema, insertCryptoPurchaseSchema, insertRoundUpSettingsSchema, insertContactSubmissionSchema, type Debt } from "@shared/schema";
import { z } from "zod";
import { plaidService } from "./services/plaidService";
import { coinbaseService } from "./services/coinbaseService";
import { axosService } from "./services/axosService";
import { registerAxosRoutes } from "./routes/axosRoutes";
import { registerMercuryRoutes } from "./routes/mercuryRoutes";
import { registerWebhookRoutes } from "./routes/webhookRoutes";
import { registerStripeRoutes, registerStripeWebhook } from "./routes/stripeRoutes";
import { registerDebtImportRoutes } from "./routes/debtImportRoutes";
import { registerSubscriptionRoutes } from "./routes/subscriptionRoutes";
import { hasRoundUpAutomationAccess, SUBSCRIPTION_REQUIRED_RESPONSE } from "./lib/subscriptionGate";
import { cancelSubscriptionImmediately } from "./services/subscriptionService";
import { isSubscriptionTerminal } from "@shared/subscriptionPlans";
import { findDuplicateDebtPairs, debtDismissalFingerprint } from "@shared/debtDuplicates";
import { assertStripeKeyModeSafeOnBoot } from "./services/stripeService";
import { registerAdminRoutes } from "./routes/adminRoutes";
import { isAdminUserId } from "./lib/admin";
import { isFlagEnabled } from "./lib/flags";
import { getUserIdFromRequest } from "./middleware/authHelper";
import { hashPasswordBcrypt, verifyPassword, CURRENT_PASSWORD_ALGO } from "./lib/passwords";
import { checkAndTouchResendCooldown, clearResendCooldown } from "./lib/verificationCooldown";
import { requireVerifiedEmail, VERIFICATION_PROTECTED_PREFIXES } from "./middleware/requireVerifiedEmail";
import { debtEditSchema, buildDebtEditUpdates, canAccessDebt } from "./lib/debtEdit";
import { notificationRoutes } from "./routes/notificationRoutes";
import { notificationService } from "./services/notificationService";
import { notificationTriggers } from "./services/notificationTriggers";
import { roundUpSplitService } from "./services/roundUpSplitService";
import { calculateRoundUp } from "../client/src/lib/calculations";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail, sendVerificationEmail, sendContactNotificationEmail, isEmailServiceDegraded } from "./services/emailService";
import { decideForgotPasswordResponse } from "./lib/passwordResetContract";
import { getFlags } from "./lib/flags";
import { withCanonicalStatus } from "@shared/transactionStatus";

const PASSWORD_RESET_TOKEN_TTL_MINUTES = 60;
const EMAIL_VERIFICATION_TTL_MINUTES = 60 * 24; // 24 hours

/**
 * Resolve the canonical app origin for emailed links.
 *
 * SECURITY: in production we REQUIRE PUBLIC_APP_URL because an attacker can
 * forge the Host header on the unauthenticated forgot-password / resend-
 * verification endpoints and redirect the emailed link to a domain they
 * control, stealing the token on click. In dev we synthesize from the
 * request because dev hosts aren't reachable publicly.
 *
 * Returns null in production when PUBLIC_APP_URL is missing — callers
 * should bail out (and log) instead of sending a broken link.
 */
function resolveAppBaseUrl(req: Request): string | null {
  const configured = process.env.PUBLIC_APP_URL;
  if (configured) return configured.replace(/\/+$/, "");
  if (process.env.NODE_ENV === "production") return null;
  const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
  const host = req.get("host");
  return `${proto}://${host}`;
}

type IssueVerificationResult =
  | { ok: true; provider: "resend" | "console" }
  | { ok: false; reason: "no_email" | "misconfigured" | "persist_failed" | "send_failed"; error?: string };

/**
 * Issue an email verification token + send the verification email.
 * Returns a structured result so callers can decide whether to surface
 * failure to the user (resend endpoint) or fire-and-forget (signup).
 */
async function issueAndSendVerificationEmail(
  req: Request,
  user: { id: string; email: string | null; firstName: string | null },
): Promise<IssueVerificationResult> {
  if (!user.email) return { ok: false, reason: "no_email" };

  const baseUrl = resolveAppBaseUrl(req);
  if (!baseUrl) {
    console.error(JSON.stringify({
      event: "email_verification_misconfigured",
      message: "PUBLIC_APP_URL must be set in production",
      userId: user.id,
    }));
    return { ok: false, reason: "misconfigured" };
  }

  // Invalidate any outstanding token so the email always contains the
  // freshest link — prevents confusion with multiple live verify links.
  try {
    await storage.invalidateEmailVerificationTokensForUser(user.id);
  } catch (err) {
    console.error("Failed to invalidate prior verification tokens", err instanceof Error ? err.message : "unknown");
  }

  const rawToken = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(rawToken).digest("hex");
  const expiresAt = new Date(Date.now() + EMAIL_VERIFICATION_TTL_MINUTES * 60 * 1000);

  try {
    await storage.createEmailVerificationToken({
      userId: user.id,
      email: user.email,
      tokenHash,
      expiresAt,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "unknown";
    console.error("Failed to persist verification token", message);
    return { ok: false, reason: "persist_failed", error: message };
  }

  const verifyUrl = `${baseUrl}/verify-email?token=${rawToken}`;
  const sendResult = await sendVerificationEmail({
    to: user.email,
    firstName: user.firstName,
    verifyUrl,
    expiresInMinutes: EMAIL_VERIFICATION_TTL_MINUTES,
  });

  console.log(JSON.stringify({
    event: "email_verification_sent",
    userId: user.id,
    provider: sendResult.provider,
    ok: sendResult.ok,
  }));

  if (!sendResult.ok) {
    return { ok: false, reason: "send_failed", error: sendResult.error };
  }
  return { ok: true, provider: sendResult.provider };
}

// Password hashing/verification lives in server/lib/passwords.ts (single
// source of truth — bcrypt for all new/changed passwords, legacy SHA-256
// verify-only with login-time migration below).

function stripSensitiveFields(user: any): any {
  if (!user) return user;
  const { password, passwordAlgo, ...safeUser } = user;
  return safeUser;
}

// Get session secret - required for token generation
function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) {
    throw new Error('SESSION_SECRET environment variable is required');
  }
  return secret;
}

// Verify a Cloudflare Turnstile token against Cloudflare's siteverify endpoint.
// Behavior:
//   - If TURNSTILE_SECRET_KEY is unset and NODE_ENV !== 'production', we skip
//     verification (developer convenience). In production this MUST be set; if
//     it is missing the token is rejected so the contact form fails closed.
//   - If a secret is configured we always require a token and a valid response
//     from Cloudflare's siteverify.
async function verifyTurnstileToken(
  token: string | undefined,
  req: Request
): Promise<boolean> {
  const secret = process.env.TURNSTILE_SECRET_KEY;

  if (!secret) {
    if (process.env.NODE_ENV === "production") {
      console.error(JSON.stringify({
        event: "turnstile_misconfigured",
        message: "TURNSTILE_SECRET_KEY is not set in production",
      }));
      return false;
    }
    return true;
  }

  if (!token) return false;

  try {
    const form = new URLSearchParams();
    form.append("secret", secret);
    form.append("response", token);
    const ip =
      (req.headers["cf-connecting-ip"] as string) ||
      (req.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim() ||
      req.ip ||
      "";
    if (ip) form.append("remoteip", ip);

    const resp = await fetch(
      "https://challenges.cloudflare.com/turnstile/v0/siteverify",
      { method: "POST", body: form }
    );
    if (!resp.ok) {
      console.error(JSON.stringify({
        event: "turnstile_siteverify_http_error",
        status: resp.status,
      }));
      return false;
    }
    const data = (await resp.json()) as { success?: boolean; ["error-codes"]?: string[] };
    if (!data.success) {
      console.warn(JSON.stringify({
        event: "turnstile_verification_failed",
        errorCodes: data["error-codes"] ?? [],
      }));
      return false;
    }
    return true;
  } catch (err) {
    console.error(JSON.stringify({
      event: "turnstile_siteverify_exception",
      error: err instanceof Error ? err.message : String(err),
    }));
    return false;
  }
}

// Generate auth token for native apps (userId + timestamp signed with hash)
function generateAuthToken(userId: string): string {
  const timestamp = Date.now();
  const payload = `${userId}:${timestamp}`;
  const signature = createHash('sha256').update(payload + getSessionSecret()).digest('hex').substring(0, 16);
  return Buffer.from(`${payload}:${signature}`).toString('base64');
}


export async function registerRoutes(app: Express): Promise<Server> {

  // ── Public marketing static assets (robots.txt, sitemap.xml, icons) ──
  // Root /public holds crawler files. Served explicitly here so crawlers get
  // the real files — otherwise the Vite dev middleware / prod SPA catch-all
  // swallows these paths and returns index.html instead.
  const publicDir = path.resolve(process.cwd(), "public");

  // ── Apple App Site Association (Plaid OAuth universal links) ────────
  // Lets iOS open the Dime Time app for https://dime-time.com/plaid/oauth
  // after a bank's OAuth flow. Registered BEFORE the static mount because
  // the file has no extension, so express.static would serve it as
  // application/octet-stream — Apple requires application/json with no
  // redirects. Also served at the legacy root path for older CDN behavior.
  const aasaPath = path.join(publicDir, ".well-known", "apple-app-site-association");
  const serveAasa = (_req: Request, res: Response) => {
    res.type("application/json");
    res.sendFile(aasaPath);
  };
  app.get("/.well-known/apple-app-site-association", serveAasa);
  app.get("/apple-app-site-association", serveAasa);

  // ── Android App Links (Plaid OAuth deep links) ──────────────────────
  // Android equivalent of the AASA file: proves dime-time.com and the
  // com.dimetime.app package belong together so Android opens the app for
  // https://dime-time.com/plaid/oauth. Contains BOTH the Play app-signing
  // certificate (what installed devices see — Google re-signs uploads) and
  // the upload-key certificate (sideloaded release builds). Served
  // explicitly for a guaranteed application/json content type, no redirects.
  const assetlinksPath = path.join(publicDir, ".well-known", "assetlinks.json");
  app.get("/.well-known/assetlinks.json", (_req: Request, res: Response) => {
    res.type("application/json");
    res.sendFile(assetlinksPath);
  });

  app.use(express.static(publicDir, { index: false }));

  // ── Email-verification enforcement (flag: REQUIRE_EMAIL_VERIFICATION) ──
  // Centralized: one middleware, one prefix list (see
  // server/middleware/requireVerifiedEmail.ts). Mounted before every API
  // route so no sensitive handler can be reached by an unverified session
  // while the flag is ON. Flag OFF (default) → pure pass-through.
  app.use(requireVerifiedEmail);

  // ── GEO guide pages: pre-rendered, crawler-readable static HTML ──────
  // AI crawlers (GPTBot, ClaudeBot, PerplexityBot) do not execute the SPA's
  // JavaScript, so these guides are served as complete static HTML.
  const guidesDir = path.resolve(process.cwd(), "server", "guides");
  const guideFiles: Record<string, string> = {
    "_style.css": "_style.css",
    "round-up-apps-for-debt": "round-up-apps-for-debt.html",
    "how-to-pay-off-credit-card-debt": "how-to-pay-off-credit-card-debt.html",
    "spare-change-debt-or-savings": "spare-change-debt-or-savings.html",
  };
  // ── App Store "App Support" / support links ─────────────────────────
  // App Store Connect points users at dime-time.com/support; there is no
  // dedicated SPA route, so send them to the landing page contact form.
  app.get(["/support", "/contact", "/help"], (_req: Request, res: Response) => {
    res.redirect(301, "/#contact");
  });

  app.get("/guides", (_req: Request, res: Response) => {
    res.sendFile(path.join(guidesDir, "index.html"));
  });
  app.get("/guides/:slug", (req: Request, res: Response, next) => {
    const file = guideFiles[req.params.slug.replace(/\.html$/, "")];
    if (!file) return next();
    res.sendFile(path.join(guidesDir, file));
  });

  // ── SPA public pages: crawler-correct metadata (production only) ────
  // /privacy, /terms and /delete-account are SPA routes, so crawlers see
  // only the shell's <head> — which carries the HOMEPAGE's title and
  // canonical. In production, serve the built index.html with each page's
  // own metadata swapped in (see server/spaMeta.ts); the SPA boots
  // unchanged. In development the Vite catch-all serves the default shell,
  // which only crawlers care about — and they never see dev.
  if (process.env.NODE_ENV === "production") {
    const spaShellPath = path.resolve(import.meta.dirname, "public", "index.html");
    for (const [route, meta] of Object.entries(SPA_META_PAGES)) {
      app.get(route, async (_req: Request, res: Response, next) => {
        try {
          const html = await fs.promises.readFile(spaShellPath, "utf-8");
          res.status(200).type("html").send(applySpaMeta(html, meta));
        } catch {
          next(); // shell unreadable — fall through to the normal SPA catch-all
        }
      });
    }
  }

  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    message: { message: "Too many attempts. Please try again in 15 minutes." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
  });

  // Public contact form: 5 submissions per IP per minute.
  // Defense-in-depth: rate limiter + Cloudflare Turnstile (see verifyTurnstileToken).
  const contactLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 5,
    message: { message: "Too many messages. Please try again in a minute." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
  });

  async function checkIdempotency(key: string, userId: string, endpoint: string): Promise<{ status: number; body: any } | null> {
    const existing = await storage.getIdempotencyKey(key, userId, endpoint);
    if (existing) {
      return { status: existing.responseStatus, body: JSON.parse(existing.responseBody) };
    }
    return null;
  }

  async function saveIdempotency(key: string, userId: string, endpoint: string, status: number, body: any): Promise<void> {
    await storage.createIdempotencyKey({
      idempotencyKey: key,
      userId,
      endpoint,
      responseStatus: status,
      responseBody: JSON.stringify(body),
    });
  }

  // Signup endpoint
  app.post("/api/signup", authLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password, firstName, lastName } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const existingUser = await storage.getUserByEmail(email);
      if (existingUser) {
        return res.status(400).json({ message: "Email already registered" });
      }

      const hashedPassword = await hashPasswordBcrypt(password);
      let user;
      try {
        user = await storage.createUser({
          email,
          password: hashedPassword,
          passwordAlgo: "bcrypt",
          firstName: firstName || email.split("@")[0],
          lastName: lastName || "",
        });
      } catch (createError: any) {
        console.error("Error creating user");
        throw createError;
      }

      req.session.userId = user.id;
      
      const authToken = generateAuthToken(user.id);

      // Send the verification email and WAIT for the provider result so the
      // response can tell the truth. A failed send never blocks account
      // creation — but the client must never claim "email sent" when the
      // provider actually failed (verificationEmailSent: false lets the UI
      // route the user to the Resend button instead).
      let verificationEmailSent = false;
      try {
        // Bounded wait: cap signup tail latency at 10s. On timeout we report
        // sent=false (truthful "we couldn't confirm") — the in-flight send may
        // still land, and the Resend banner covers the retry path.
        const sendOutcome = await Promise.race([
          issueAndSendVerificationEmail(req, {
            id: user.id,
            email: user.email,
            firstName: user.firstName,
          }),
          new Promise<{ ok: false }>((resolve) =>
            setTimeout(() => resolve({ ok: false }), 10_000).unref?.(),
          ),
        ]);
        verificationEmailSent = sendOutcome.ok;
      } catch (sendErr) {
        console.error(
          "Signup verification email failed:",
          sendErr instanceof Error ? sendErr.message : "unknown",
        );
      }
      
      req.session.save((err) => {
        if (err) {
          console.error("Session save error");
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.status(201).json({ 
          success: true, 
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
          authToken,
          verificationEmailSent
        });
      });
    } catch (error) {
      console.error("Signup error");
      res.status(500).json({ message: "Failed to create account" });
    }
  });

  // Login endpoint
  app.post("/api/login", authLimiter, async (req: Request, res: Response) => {
    try {
      const { email, password } = req.body;
      
      if (!email || !password) {
        return res.status(400).json({ message: "Email and password are required" });
      }

      const user = await storage.getUserByEmail(email);
      if (!user || !user.password) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      const algo = (user as any).passwordAlgo || 'sha256';
      const isValid = await verifyPassword(password, user.password, algo);
      if (!isValid) {
        return res.status(401).json({ message: "Invalid credentials" });
      }

      if (algo !== 'bcrypt') {
        const bcryptHash = await hashPasswordBcrypt(password);
        await storage.updateUserPassword(user.id, bcryptHash, 'bcrypt');
      }

      req.session.userId = user.id;
      const authToken = generateAuthToken(user.id);
      
      req.session.save((err) => {
        if (err) {
          console.error("Session save error");
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.json({ 
          success: true, 
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
          authToken
        });
      });
    } catch (error) {
      console.error("Login error");
      res.status(500).json({ message: "Login failed" });
    }
  });

  // Password reset — request link
  // Non-enumerating contract: success is a generic 200 and email-service
  // outages are a generic 503 — neither response ever depends on whether the
  // account exists. Rate-limited via authLimiter.
  app.post("/api/auth/forgot-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }

      // SECURITY (non-enumeration): the response is decided ENTIRELY here,
      // BEFORE the user lookup, from input validity + email-service health.
      // See decideForgotPasswordResponse — it cannot observe account
      // existence by construction. Individual send failures below feed the
      // provider health gate, so subsequent requests (any email) get the
      // same 503; no response ever depends on whether the account exists.
      const misconfigured =
        process.env.NODE_ENV === "production" &&
        (!process.env.RESEND_API_KEY || !process.env.PUBLIC_APP_URL);
      if (misconfigured) {
        console.error(JSON.stringify({
          event: "password_reset_misconfigured",
          message: "RESEND_API_KEY and PUBLIC_APP_URL must be set in production",
        }));
      }
      const decision = decideForgotPasswordResponse({
        emailProvided: true,
        misconfigured,
        degraded: isEmailServiceDegraded(),
      });
      if (decision.status !== 200) {
        return res.status(decision.status).json(decision.body);
      }

      const user = await storage.getUserByEmail(email);

      if (user) {
        // Resolve the canonical app origin for the reset link.
        // SECURITY: never derive this from request headers in production —
        // an attacker could forge a Host header to redirect the emailed
        // reset link to a domain they control and steal the token. In
        // production we REQUIRE PUBLIC_APP_URL to be configured.
        let baseUrl: string | undefined = process.env.PUBLIC_APP_URL;
        if (!baseUrl) {
          // Production missing PUBLIC_APP_URL is already handled by the
          // upfront non-enumerating 503 above — this branch is dev-only.
          // Dev: synthesize from the request. Safe because dev hosts
          // aren't reachable from the public internet.
          const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol;
          const host = req.get("host");
          baseUrl = `${proto}://${host}`;
        }

        // Generate a 32-byte URL-safe token. The plaintext goes in the email
        // link; only the SHA-256 hash is stored at rest.
        const rawToken = randomBytes(32).toString("base64url");
        const tokenHash = createHash("sha256").update(rawToken).digest("hex");
        const expiresAt = new Date(Date.now() + PASSWORD_RESET_TOKEN_TTL_MINUTES * 60 * 1000);

        await storage.createPasswordResetToken({
          userId: user.id,
          tokenHash,
          expiresAt,
        });

        const resetUrl = `${baseUrl}/reset-password?token=${rawToken}`;

        const sendResult = await sendPasswordResetEmail({
          to: user.email!,
          firstName: user.firstName,
          resetUrl,
          expiresInMinutes: PASSWORD_RESET_TOKEN_TTL_MINUTES,
        });

        // A failed send is NOT surfaced on THIS response — doing so would
        // 503 only for accounts that exist (enumeration side channel). The
        // failure was recorded by the provider health gate inside sendEmail,
        // so every subsequent request — known or unknown email — receives
        // the generic 503 until the provider recovers.
        console.log(JSON.stringify({
          event: "password_reset_requested",
          userId: user.id,
          provider: sendResult.provider,
          ok: sendResult.ok,
        }));
      } else {
        console.log(JSON.stringify({
          event: "password_reset_requested_unknown_email",
        }));
      }

      // Identical generic success regardless of whether the email exists.
      res.status(decision.status).json(decision.body);
    } catch (error) {
      console.error("Forgot password error:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ message: "Unable to process request" });
    }
  });

  // Password reset — consume token + set new password
  app.post("/api/auth/reset-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const { token, password } = req.body ?? {};
      if (typeof token !== "string" || typeof password !== "string") {
        return res.status(400).json({ message: "Token and password are required" });
      }
      if (password.length < 8) {
        return res.status(400).json({ message: "Password must be at least 8 characters" });
      }

      const tokenHash = createHash("sha256").update(token).digest("hex");

      // Atomic consume: returns the row ONLY if it was unused AND not
      // expired at the moment of the UPDATE. Eliminates the
      // SELECT-then-UPDATE race where two concurrent requests could both
      // see "not used" before either marks it used.
      const record = await storage.consumePasswordResetToken(tokenHash);
      if (!record) {
        return res.status(400).json({ message: "Invalid, expired, or already-used reset link" });
      }

      const newHash = await hashPasswordBcrypt(password);
      await storage.updateUserPassword(record.userId, newHash, "bcrypt");
      // Invalidate any sibling outstanding tokens for this user.
      await storage.invalidatePasswordResetTokensForUser(record.userId);
      // SECURITY: kill every active session/token for this user so any
      // attacker who currently holds a stolen cookie or auth token is
      // logged out as soon as the legitimate user resets their password.
      await storage.invalidateAllUserSessions(record.userId);

      console.log(JSON.stringify({
        event: "password_reset_completed",
        userId: record.userId,
      }));

      res.json({ success: true, message: "Password updated. You can now sign in." });
    } catch (error) {
      console.error("Reset password error:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ message: "Unable to reset password" });
    }
  });

  // Email verification — re-send link for the currently signed-in user.
  // Authenticated to prevent abuse (only the account owner can request a
  // new link to their own email). Also rate-limited.
  app.post("/api/auth/send-verification", authLimiter, async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      if (user.emailVerifiedAt) {
        return res.json({ success: true, alreadyVerified: true, message: "Email already verified" });
      }
      if (!user.email) {
        return res.status(400).json({ message: "No email on file for this account" });
      }

      // Per-account cooldown on top of the IP-window authLimiter, so one
      // user can't fan out duplicate provider sends by tapping repeatedly.
      const cooldown = checkAndTouchResendCooldown(user.id);
      if (!cooldown.allowed) {
        res.setHeader("Retry-After", String(cooldown.retryAfterSeconds));
        return res.status(429).json({
          message: `Please wait ${cooldown.retryAfterSeconds}s before requesting another verification email.`,
        });
      }

      const result = await issueAndSendVerificationEmail(req, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
      });

      if (!result.ok) {
        // Roll the cooldown back — a failed send must not lock the user out
        // of retrying once the provider recovers.
        clearResendCooldown(user.id);
        // Surface a generic but truthful 503 so the client doesn't show a
        // false "sent" toast when persistence or the provider actually
        // failed. We don't leak which failure mode occurred.
        return res.status(503).json({
          message: "We couldn't send the verification email right now. Please try again in a moment.",
        });
      }

      res.json({ success: true, message: "Verification email sent" });
    } catch (error) {
      console.error("Send verification error:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ message: "Unable to send verification email" });
    }
  });

  // Email verification — consume token. Unauthenticated (link is the proof).
  app.post("/api/auth/verify-email", authLimiter, async (req: Request, res: Response) => {
    try {
      const token = typeof req.body?.token === "string" ? req.body.token : "";
      if (!token) {
        return res.status(400).json({ message: "Verification token is required" });
      }

      const tokenHash = createHash("sha256").update(token).digest("hex");
      // Atomic consume — same single-update pattern as password reset.
      const record = await storage.consumeEmailVerificationToken(tokenHash);
      if (!record) {
        return res.status(400).json({ message: "Invalid, expired, or already-used verification link" });
      }

      // Only mark verified if the token's captured email still matches the
      // user's current email — defends against the case where the user
      // changed their email after the link was generated.
      const user = await storage.getUser(record.userId);
      if (!user || user.email !== record.email) {
        return res.status(400).json({ message: "This link is no longer valid for the current email on your account" });
      }

      if (!user.emailVerifiedAt) {
        await storage.markUserEmailVerified(user.id);
      }

      console.log(JSON.stringify({
        event: "email_verification_completed",
        userId: user.id,
      }));

      res.json({ success: true, message: "Email verified" });
    } catch (error) {
      console.error("Verify email error:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ message: "Unable to verify email" });
    }
  });

  // Get current user 
  app.get("/api/user", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }
      
      // Piggyback the resolved feature flag map onto the auth bootstrap
      // response so the client receives flags in the same cold-start round
      // trip (critical on iOS WebView where every extra request hurts
      // perceived launch time). `_flags` is additive — other consumers
      // of /api/user safely ignore it.
      res.json({ ...stripSensitiveFields(user), _flags: getFlags(), _isAdmin: isAdminUserId(userId) });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Logout endpoint — browsers full-navigate here, so redirect home instead
  // of rendering raw JSON. (In dev, replitAuth's own /api/logout handler wins;
  // this one is what runs in production deployments.)
  app.get("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.redirect("/");
    });
  });

  // Account deletion (Apple requires this)
  app.delete("/api/account", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Best-effort: cancel any live Stripe subscription BEFORE wiping local
      // state, so a deleted user is never billed again. A Stripe failure must
      // not block deletion (Apple requirement) — but log it loudly for
      // operator follow-up in the Stripe dashboard.
      if (isFlagEnabled("ENABLE_SUBSCRIPTIONS")) {
        try {
          const sub = await storage.getLatestSubscriptionByUserId(userId);
          if (sub && !isSubscriptionTerminal(sub.status)) {
            await cancelSubscriptionImmediately(sub.stripeSubscriptionId);
          }
        } catch (cancelErr) {
          console.error(JSON.stringify({
            service: "Server",
            event: "account_delete_subscription_cancel_failed",
            severity: "ERROR",
            userId,
            error: cancelErr instanceof Error ? cancelErr.message : String(cancelErr),
          }));
        }
      }

      await storage.deleteUserAccount(userId);
      
      req.session.destroy((err) => {
        if (err) console.error("Session destroy error during account deletion");
        res.clearCookie("connect.sid");
        res.json({ success: true, message: "Account deleted successfully" });
      });
    } catch (error) {
      console.error("Account deletion error");
      res.status(500).json({ message: "Failed to delete account" });
    }
  });

  // Contact form submission (public endpoint)
  app.post("/api/contact", contactLimiter, async (req: Request, res: Response) => {
    try {
      // If the request is authenticated, treat it as an in-app feedback
      // submission: server prefills name/email/userId from the session and
      // skips Turnstile (rate limiter still applies). Otherwise it's a
      // marketing-site submission and Turnstile is required (same as before).
      const sessionUserId = getUserIdFromRequest(req);
      const authedUser = sessionUserId ? await storage.getUser(sessionUserId) : null;

      let toInsert: any;

      if (authedUser) {
        // In-app feedback: identity is fully server-authoritative.
        // Client may only supply `message` (and we ignore everything else).
        if (!authedUser.email) {
          return res.status(400).json({ message: "Your account is missing an email address. Please add one before sending feedback." });
        }
        const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";
        if (!message) {
          return res.status(400).json({ message: "Message is required" });
        }
        if (message.length > 5000) {
          return res.status(400).json({ message: "Message is too long (5,000 character limit)." });
        }
        const displayName =
          [authedUser.firstName, authedUser.lastName].filter(Boolean).join(" ").trim() ||
          authedUser.email;
        toInsert = {
          name: displayName,
          email: authedUser.email,
          message,
          source: "in_app" as const,
          userId: authedUser.id,
        };
      } else {
        // Public marketing-site submission: Turnstile required + Zod-validated name/email/message.
        const turnstileToken: string | undefined =
          typeof req.body?.turnstileToken === "string" ? req.body.turnstileToken : undefined;
        const turnstileOk = await verifyTurnstileToken(turnstileToken, req);
        if (!turnstileOk) {
          return res.status(400).json({ message: "Captcha verification failed. Please try again." });
        }
        const { turnstileToken: _omit, source: _clientSource, userId: _clientUserId, ...payload } = req.body ?? {};
        const validatedData = insertContactSubmissionSchema
          .extend({
            name: z.string().trim().min(1).max(100),
            email: z.string().trim().email().max(254),
            message: z.string().trim().min(1).max(5000),
          })
          .parse(payload);
        toInsert = { ...validatedData, source: "marketing" as const };
      }

      const submission = await storage.createContactSubmission(toInsert);

      // Fire-and-forget founder notification: the submission is already
      // saved, so a failed notification email must never fail the request.
      sendContactNotificationEmail({
        name: toInsert.name,
        email: toInsert.email,
        message: toInsert.message,
        source: toInsert.source,
        submittedAt: new Date(),
      })
        .then((result) => {
          console.log(JSON.stringify({
            event: "contact_notification_sent",
            submissionId: submission.id,
            provider: result.provider,
            ok: result.ok,
          }));
        })
        .catch((err) => {
          console.error(JSON.stringify({
            event: "contact_notification_failed",
            submissionId: submission.id,
            error: err instanceof Error ? err.message : String(err),
          }));
        });

      res.json({ success: true, submission });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid form data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's debts
  app.get("/api/debts", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const debts = await storage.getDebtsByUserId(userId);
      res.json(debts);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create a new debt for the authenticated user
  app.post("/api/debts", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const currentBalance = req.body.currentBalance;
      const accountNumber =
        req.body.accountNumber && String(req.body.accountNumber).trim() !== ""
          ? String(req.body.accountNumber).trim()
          : "—";

      const validatedData = insertDebtSchema
        .refine((d) => Number.isInteger(d.dueDate) && d.dueDate >= 1 && d.dueDate <= 31, {
          message: "Due date must be a day between 1 and 31",
          path: ["dueDate"],
        })
        .refine((d) => parseFloat(d.currentBalance) > 0, {
          message: "Current balance must be greater than 0",
          path: ["currentBalance"],
        })
        .refine((d) => parseFloat(d.interestRate) >= 0, {
          message: "Interest rate must be 0 or greater",
          path: ["interestRate"],
        })
        .refine((d) => parseFloat(d.minimumPayment) >= 0, {
          message: "Minimum payment must be 0 or greater",
          path: ["minimumPayment"],
        })
        .parse({
          ...req.body,
          userId,
          accountNumber,
          // Server hard-sets original === current so payoff progress always
          // starts at 0%. Any client-supplied originalBalance is ignored.
          originalBalance: currentBalance,
          isActive: true,
        });

      const debt = await storage.createDebt(validatedData);
      res.status(201).json(debt);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid debt data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update (edit) an existing debt — owner only
  app.patch("/api/debts/:id", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const debt = await storage.getDebt(req.params.id);
      if (!canAccessDebt(debt, userId)) {
        return res.status(404).json({ message: "Debt not found" });
      }

      const parsed = debtEditSchema.parse(req.body);
      const updates = buildDebtEditUpdates(debt, parsed);

      const updated = await storage.updateDebt(req.params.id, updates);
      res.json(updated);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid debt data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Delete a debt — owner only. Soft delete (isActive=false) so payment history
  // and FK integrity are preserved; getDebtsByUserId hides inactive debts.
  app.delete("/api/debts/:id", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const debt = await storage.getDebt(req.params.id);
      if (!canAccessDebt(debt, userId)) {
        return res.status(404).json({ message: "Debt not found" });
      }

      await storage.updateDebt(req.params.id, { isActive: false });
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Permanently delete an ARCHIVED debt — owner only, irreversible. Hard
  // deletes the debt row plus its orphaned payment history. Active debts are
  // rejected: they must be archived first (DELETE /api/debts/:id), which
  // keeps the destructive path a deliberate two-step action.
  app.delete("/api/debts/:id/permanent", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const debt = await storage.getDebt(req.params.id);
      if (!canAccessDebt(debt, userId)) {
        return res.status(404).json({ message: "Debt not found" });
      }
      if (debt.isActive) {
        return res.status(400).json({ message: "Debt must be archived before it can be permanently deleted" });
      }

      await storage.deleteDebtPermanently(req.params.id);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Likely duplicate pairs between MANUAL and IMPORTED debts — owner only.
  // Pure detection over the user's active debts (see shared/debtDuplicates.ts);
  // returns pairs plus a human-readable reason. Powers the merge prompt on
  // the Debts page after an import.
  app.get("/api/debts/duplicates", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const debts = await storage.getDebtsByUserId(userId);
      res.json(findDuplicateDebtPairs(debts));
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Merge a MANUAL debt into an IMPORTED duplicate — owner only. The manual
  // entry is ARCHIVED (soft-deleted, never hard-deleted) so its payment
  // history survives; mergedIntoDebtId records where it went. If the user's
  // round-up target pointed at the manual debt, it is repointed to the
  // imported one so round-ups keep flowing to the same real card.
  app.post("/api/debts/:id/merge", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const importedDebtId = typeof req.body?.importedDebtId === "string" ? req.body.importedDebtId : null;
      if (!importedDebtId) {
        return res.status(400).json({ message: "importedDebtId is required" });
      }

      const manual = await storage.getDebt(req.params.id);
      if (!canAccessDebt(manual, userId)) {
        return res.status(404).json({ message: "Debt not found" });
      }
      const imported = await storage.getDebt(importedDebtId);
      if (!canAccessDebt(imported, userId)) {
        return res.status(404).json({ message: "Imported debt not found" });
      }
      if (manual.source !== "manual" || imported.source !== "imported") {
        return res.status(400).json({ message: "Merge must archive a manual debt into an imported one" });
      }
      if (!manual.isActive || !imported.isActive) {
        return res.status(400).json({ message: "Both debts must be active to merge" });
      }

      // Repoint the round-up target BEFORE archiving so there is never a
      // window where round-ups aim at an archived debt.
      const roundUp = await storage.getRoundUpSettings(userId);
      if (roundUp?.targetDebtId === manual.id) {
        await storage.createOrUpdateRoundUpSettings({ ...roundUp, targetDebtId: imported.id });
      }

      const archived = await storage.updateDebt(manual.id, {
        isActive: false,
        mergedIntoDebtId: imported.id,
      });
      res.json({ success: true, archivedDebt: archived, importedDebtId: imported.id });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // "Keep both" — owner only. Records that an imported debt is NOT a
  // duplicate of this manual debt so the detector stops flagging the pair.
  app.post("/api/debts/:id/dismiss-duplicate", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const importedDebtId = typeof req.body?.importedDebtId === "string" ? req.body.importedDebtId : null;
      if (!importedDebtId) {
        return res.status(400).json({ message: "importedDebtId is required" });
      }

      const manual = await storage.getDebt(req.params.id);
      if (!canAccessDebt(manual, userId)) {
        return res.status(404).json({ message: "Debt not found" });
      }

      // Store BOTH the row id and a stable fingerprint of the imported card:
      // the id alone breaks when a bank is disconnected and relinked (the
      // re-import creates new rows with new ids), which would re-prompt the
      // user about pairs they already answered.
      const imported = await storage.getDebt(importedDebtId);
      const fingerprint = canAccessDebt(imported, userId) ? debtDismissalFingerprint(imported!) : null;

      const existing = manual.notDuplicateOf ?? [];
      const additions = [importedDebtId, ...(fingerprint ? [fingerprint] : [])].filter(
        (k) => !existing.includes(k),
      );
      if (additions.length > 0) {
        await storage.updateDebt(manual.id, { notDuplicateOf: [...existing, ...additions] });
      }
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // List archived (soft-deleted) debts — owner only. Powers the "Archived
  // Debts" section on /debts and lifetime paid-off wins on Insights.
  app.get("/api/debts/archived", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const archived = await storage.getArchivedDebtsByUserId(userId);
      res.json(archived);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Restore an archived debt — owner only. Flips isActive back to true so the
  // debt reappears in lists and totals; payment history was never touched.
  app.post("/api/debts/:id/restore", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const debt = await storage.getDebt(req.params.id);
      if (!debt || debt.userId !== userId) {
        return res.status(404).json({ message: "Debt not found" });
      }
      if (debt.isActive) {
        return res.status(400).json({ message: "Debt is not archived" });
      }

      // Restoring un-merges: clear the merge marker so the debt comes back
      // as a normal manual entry (the duplicate prompt may reappear).
      const restored = await storage.updateDebt(req.params.id, { isActive: true, mergedIntoDebtId: null });
      res.json(restored);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's transactions
  app.get("/api/transactions", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const limit = req.query.limit ? parseInt(req.query.limit as string) : undefined;
      const transactions = await storage.getTransactionsByUserId(userId, limit);
      res.json(transactions);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new transaction
  app.post("/api/transactions", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const idempotencyKey = req.headers['idempotency-key'] as string;
      if (idempotencyKey) {
        const cached = await checkIdempotency(idempotencyKey, userId, '/api/transactions');
        if (cached) return res.status(cached.status).json(cached.body);
      }
      
      const roundUpSettingsData = await storage.getRoundUpSettings(userId);
      
      const amount = parseFloat(req.body.amount);
      const multiplier = roundUpSettingsData ? parseFloat(roundUpSettingsData.multiplier) : 1.0;
      const totalRoundUp = calculateRoundUp(amount, multiplier);
      
      const validatedData = insertTransactionSchema.parse({
        ...req.body,
        userId,
        roundUpAmount: totalRoundUp.toFixed(2)
      });
      
      const transaction = await storage.createTransaction(validatedData);
      
      // Process round-up split (crypto immediate + debt accumulation) if
      // round-up > 0. Round-up AUTOMATION is the premium feature: when
      // subscriptions are live, non-subscribers still get the transaction
      // recorded (with its computed round-up amount) but no automated split.
      // Flag OFF → hasRoundUpAutomationAccess is always true (no change).
      if (totalRoundUp > 0 && roundUpSettingsData?.isEnabled && (await hasRoundUpAutomationAccess(userId))) {
        try {
          console.log(`🔄 Processing split round-up: $${totalRoundUp.toFixed(2)}`);
          
          const splitResult = await roundUpSplitService.processRoundUpSplit(
            userId,
            transaction.id,
            totalRoundUp,
            roundUpSettingsData
          );
          
          console.log(`✅ Split processing complete:`, splitResult);
          
          // Trigger round-up notification with split details
          await notificationTriggers.onRoundUpCollected(
            userId, 
            transaction.id, 
            totalRoundUp, 
            transaction.merchant
          );
          
        } catch (splitError) {
          console.error('Error processing round-up split:', splitError);
          // Transaction still succeeds even if split processing fails
        }
      }

      if (idempotencyKey) {
        await saveIdempotency(idempotencyKey, userId, '/api/transactions', 201, transaction);
      }
      
      res.status(201).json(transaction);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid transaction data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's transfers (canonical ledger across roundup + debt payment rails)
  app.get("/api/transfers", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const transfers = await storage.getTransfersByUserId(userId);
      // Resolve each transfer's funding account into a MASKED label
      // (institution + last4 only) — never account/routing numbers. Older
      // rows predate the `stripeAccountId` column; fall back to the id
      // recorded in rawRequest at debit time. Lookups are restricted to
      // THIS user's accounts, so a foreign id can never resolve to a label.
      const stripeAccounts = await storage.getStripeAccountsByUserId(userId);
      const accountLabelById = new Map(
        stripeAccounts.map((a) => [
          a.id,
          { institutionName: a.institutionName, last4: a.last4 },
        ]),
      );
      const fundingAccountFor = (t: typeof transfers[number]) => {
        let accountId: string | null = t.stripeAccountId ?? null;
        if (!accountId && t.rawRequest) {
          try {
            const raw = JSON.parse(t.rawRequest);
            if (typeof raw?.stripeAccountId === "string") accountId = raw.stripeAccountId;
          } catch {
            /* legacy rows may have non-JSON rawRequest — no label */
          }
        }
        return (accountId && accountLabelById.get(accountId)) || null;
      };
      // Strip provider IDs / raw payloads — those are operational logs,
      // not user-facing data. Only expose the fields a status surface
      // actually needs.
      // `errorCode` / `errorMessage` are short operator strings written
      // by our adapters (Stripe `code`, Plaid `error_code`, our own
      // synthetic codes). They never contain tokens, customer IDs, or
      // raw provider payloads — those live in `rawResponse`, which we
      // deliberately strip here. The client uses `errorCode` to look up
      // friendly recovery copy via `describeTransferError`.
      const safe = transfers.map((t) => ({
        id: t.id,
        type: t.type,
        amount: t.amount,
        status: t.status,
        debtId: t.debtId,
        fundingAccount: fundingAccountFor(t),
        errorCode: t.errorCode ?? null,
        errorMessage: t.errorMessage ?? null,
        createdAt: t.createdAt,
        updatedAt: t.updatedAt,
      }));
      res.json(safe.map(withCanonicalStatus));
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's payments
  app.get("/api/payments", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const payments = await storage.getPaymentsByUserId(userId);
      // Normalise legacy status strings into the canonical TransactionStatus
      // enum so the client can render a single shared <StatusBadge/>.
      res.json(payments.map(withCanonicalStatus));
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new payment
  app.post("/api/payments", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const idempotencyKey = req.headers['idempotency-key'] as string;
      if (idempotencyKey) {
        const cached = await checkIdempotency(idempotencyKey, userId, '/api/payments');
        if (cached) return res.status(cached.status).json(cached.body);
      }

      const validatedData = insertPaymentSchema.parse({
        ...req.body,
        userId,
      });

      // Amount sanity: positive, finite, and within the decimal(10,2) column
      // so a bad value can't inflate a balance or trigger a raw DB overflow.
      const paymentAmount = parseFloat(validatedData.amount);
      if (!Number.isFinite(paymentAmount) || paymentAmount <= 0 || paymentAmount > 99999999.99) {
        return res.status(400).json({ message: "Payment amount must be between 0.01 and 99,999,999.99" });
      }

      // Ownership check BEFORE any write: the debt being paid must exist,
      // belong to the authenticated user, and still be active (not soft-deleted).
      const debt = await storage.getDebt(validatedData.debtId);
      if (!debt || debt.userId !== userId || debt.isActive === false) {
        return res.status(404).json({ message: "Debt not found" });
      }

      const payment = await storage.createPayment(validatedData);

      // Update debt balance
      // Clamp at 0 so an overpayment can't drive the balance negative
      // (progress > 100%) — matches makeAcceleratedPayment in both storages.
      const newBalance = Math.max(0, parseFloat(debt.currentBalance) - paymentAmount).toFixed(2);
      await storage.updateDebt(validatedData.debtId, {
        currentBalance: newBalance,
      });

      // Trigger debt payment notification
      await notificationTriggers.onDebtPaymentProcessed(
        userId,
        validatedData.debtId,
        paymentAmount
      );

      if (idempotencyKey) {
        await saveIdempotency(idempotencyKey, userId, '/api/payments', 201, payment);
      }
      
      res.status(201).json(payment);
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid payment data", errors: error.errors });
      }
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // One-tap accelerated payment
  app.post("/api/accelerated-payment", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const idempotencyKey = req.headers['idempotency-key'] as string;
      if (idempotencyKey) {
        const cached = await checkIdempotency(idempotencyKey, userId, '/api/accelerated-payment');
        if (cached) return res.status(cached.status).json(cached.body);
      }

      const { debtId, amount } = req.body;
      
      if (!debtId || !amount) {
        return res.status(400).json({ message: "debtId and amount are required" });
      }

      const acceleratedAmount = parseFloat(String(amount));
      if (!Number.isFinite(acceleratedAmount) || acceleratedAmount <= 0 || acceleratedAmount > 99999999.99) {
        return res.status(400).json({ message: "Payment amount must be between 0.01 and 99,999,999.99" });
      }

      const result = await storage.makeAcceleratedPayment(userId, debtId, acceleratedAmount.toFixed(2));
      
      const responseBody = {
        success: true,
        payment: result.payment,
        updatedDebt: result.updatedDebt,
        message: `Successfully paid $${amount} toward ${result.updatedDebt.name}`
      };

      if (idempotencyKey) {
        await saveIdempotency(idempotencyKey, userId, '/api/accelerated-payment', 200, responseBody);
      }

      res.json(responseBody);
    } catch (error) {
      console.error('Error processing accelerated payment:', error);
      if (error instanceof Error && /not found|unauthorized/i.test(error.message)) {
        return res.status(404).json({ message: "Debt not found" });
      }
      res.status(500).json({ message: "Failed to process payment" });
    }
  });

  // Get round-up settings
  app.get("/api/round-up-settings", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const settings = await storage.getRoundUpSettings(userId);
      res.json(settings || {
        id: null,
        userId,
        isEnabled: false,
        sourceAccountId: null,
        targetDebtId: null,
        fundingStripeAccountId: null,
        multiplier: "1.00",
        autoApplyThreshold: "25.00",
        cryptoEnabled: false,
        cryptoPercentage: "0.00",
        preferredCrypto: "BTC",
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Update round-up settings
  app.put("/api/round-up-settings", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      // Premium gate: only block when the request would ENABLE automation.
      // Disabling or tweaking other settings stays free.
      if (req.body?.isEnabled === true && !(await hasRoundUpAutomationAccess(userId))) {
        return res.status(402).json(SUBSCRIPTION_REQUIRED_RESPONSE);
      }
      // The funding account may ONLY be set via PUT /api/stripe/funding-account,
      // which validates ownership + eligibility. Strip it here so this generic
      // route can never smuggle in an unvalidated account id.
      const { fundingStripeAccountId: _ignoredFundingAccount, ...settingsBody } = req.body ?? {};
      const settings = await storage.createOrUpdateRoundUpSettings({
        ...settingsBody,
        userId,
      });
      res.json(settings);
    } catch (error) {
      console.error("PUT /api/round-up-settings failed:", error instanceof Error ? error.message : "unknown");
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create/update round-up settings with bank and debt selection
  app.post("/api/round-up-settings", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // This route always writes isEnabled:true (it's the automation setup
      // flow), so it is premium-gated as a whole when subscriptions are live.
      if (!(await hasRoundUpAutomationAccess(userId))) {
        return res.status(402).json(SUBSCRIPTION_REQUIRED_RESPONSE);
      }
      
      const { sourceAccountId, targetDebtId, cryptoEnabled, cryptoPercentage } = req.body;
      
      // Validate cryptoPercentage is within valid range (0-100)
      let validatedCryptoPercentage = "0.00";
      if (cryptoPercentage) {
        const percentValue = parseFloat(cryptoPercentage);
        if (!isNaN(percentValue) && percentValue >= 0 && percentValue <= 100) {
          validatedCryptoPercentage = percentValue.toFixed(2);
        }
      }
      
      const settings = await storage.createOrUpdateRoundUpSettings({
        userId,
        isEnabled: true,
        sourceAccountId: sourceAccountId || null,
        targetDebtId: targetDebtId || null,
        multiplier: "1.00",
        autoApplyThreshold: "25.00",
        cryptoEnabled: cryptoEnabled === true,
        cryptoPercentage: validatedCryptoPercentage,
        preferredCrypto: "BTC",
      });
      
      res.json({ success: true, settings });
    } catch (error) {
      console.error("Error saving round-up settings:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Apply round-ups to debt
  app.post("/api/apply-round-ups", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      // Applying accumulated round-ups to a debt is part of round-up
      // automation — premium when subscriptions are live.
      if (!(await hasRoundUpAutomationAccess(userId))) {
        return res.status(402).json(SUBSCRIPTION_REQUIRED_RESPONSE);
      }
      
      const { debtId, amount } = req.body;
      
      if (!debtId || !amount) {
        return res.status(400).json({ message: "debtId and amount are required" });
      }

      const roundUpAmount = parseFloat(String(amount));
      if (!Number.isFinite(roundUpAmount) || roundUpAmount <= 0 || roundUpAmount > 99999999.99) {
        return res.status(400).json({ message: "Payment amount must be between 0.01 and 99,999,999.99" });
      }

      // Ownership check BEFORE any write: the debt must exist, belong to the
      // authenticated user, and still be active (not soft-deleted).
      const debt = await storage.getDebt(String(debtId));
      if (!debt || debt.userId !== userId || debt.isActive === false) {
        return res.status(404).json({ message: "Debt not found" });
      }

      // Create payment record
      const payment = await storage.createPayment({
        userId,
        debtId,
        amount: roundUpAmount.toFixed(2),
        source: "round_up",
      });

      // Update debt balance
      // Clamp at 0 — a round-up larger than the remaining balance must not
      // drive currentBalance negative (progress > 100%).
      const newBalance = Math.max(0, parseFloat(debt.currentBalance) - roundUpAmount).toFixed(2);
      await storage.updateDebt(debtId, {
        currentBalance: newBalance,
      });

      res.json({ success: true, payment });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get dashboard summary
  app.get("/api/dashboard-summary", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const [debts, transactions, payments] = await Promise.all([
        storage.getDebtsByUserId(userId),
        storage.getTransactionsByUserId(userId),
        storage.getPaymentsByUserId(userId),
      ]);

      const totalDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.currentBalance), 0);
      const totalRoundUps = transactions.reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount), 0);
      
      // Calculate this month's round-ups
      const thisMonth = new Date();
      thisMonth.setDate(1);
      thisMonth.setHours(0, 0, 0, 0);
      
      const thisMonthRoundUps = transactions
        .filter(trans => trans.date >= thisMonth)
        .reduce((sum, trans) => sum + parseFloat(trans.roundUpAmount), 0);

      // Calculate this month's debt payments
      const thisMonthPayments = payments
        .filter(payment => payment.date >= thisMonth)
        .reduce((sum, payment) => sum + parseFloat(payment.amount), 0);

      // Calculate progress (simplified)
      const totalOriginalDebt = debts.reduce((sum, debt) => sum + parseFloat(debt.originalBalance), 0);
      const progressPercentage = totalOriginalDebt > 0 
        ? Math.round(((totalOriginalDebt - totalDebt) / totalOriginalDebt) * 100)
        : 0;

      // Estimate debt-free date (simplified calculation)
      const averageMonthlyPayment = thisMonthPayments || 500; // fallback
      const monthsToPayOff = Math.ceil(totalDebt / averageMonthlyPayment);
      const debtFreeDate = new Date();
      debtFreeDate.setMonth(debtFreeDate.getMonth() + monthsToPayOff);

      const summary = {
        totalDebt: totalDebt.toFixed(2),
        totalRoundUps: totalRoundUps.toFixed(2),
        thisMonthRoundUps: thisMonthRoundUps.toFixed(2),
        thisMonthPayments: thisMonthPayments.toFixed(2),
        progressPercentage,
        debtFreeDate: debtFreeDate.toLocaleDateString('en-US', { month: 'short', year: 'numeric' }),
        debtsCount: debts.length,
        paidOffCount: debts.filter(d => parseFloat(d.currentBalance) <= 0).length,
      };

      res.json(summary);
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get user's crypto purchases
  app.get("/api/crypto-purchases", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const purchases = await storage.getCryptoPurchasesByUserId(userId);
      // Same canonical-status normalisation as /api/payments.
      res.json(purchases.map(withCanonicalStatus));
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Create new crypto purchase (Preview: always simulated — no real money moves)
  app.post("/api/crypto-purchases", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }

      const idempotencyKey = req.headers['idempotency-key'] as string;
      if (idempotencyKey) {
        const cached = await checkIdempotency(idempotencyKey, userId, '/api/crypto-purchases');
        if (cached) return res.status(cached.status).json(cached.body);
      }

      const { amount, cryptoSymbol = "BTC" } = req.body;

      if (!amount || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: "Valid amount is required" });
      }

      let purchase;
      
      if (coinbaseService.isServiceConfigured()) {
        try {
          // Get Coinbase accounts to find the primary account
          const accounts = await coinbaseService.getAccounts();
          const primaryAccount = (accounts as any).find((acc: any) => acc.primary) || (accounts as any)[0];
          
          if (primaryAccount) {
            // Execute real crypto purchase through Coinbase
            const coinbaseTransaction = await coinbaseService.buyCrypto(primaryAccount.id, amount, 'USD');
            
            // Store the real purchase in database
            purchase = await storage.createCryptoPurchase({
              userId,
              cryptoSymbol,
              amountUsd: amount,
              cryptoAmount: (coinbaseTransaction as any).amount?.amount || '0',
              purchasePrice: amount,
              coinbaseOrderId: (coinbaseTransaction as any).id || '',
            });

            const cryptoResponse = {
              ...purchase,
              coinbaseTransaction,
              message: "Preview purchase recorded — simulated, no real money moved"
            };
            if (idempotencyKey) {
              await saveIdempotency(idempotencyKey, userId, '/api/crypto-purchases', 201, cryptoResponse);
            }
            res.status(201).json(cryptoResponse);
          } else {
            throw new Error("No Coinbase account found");
          }
        } catch (coinbaseError) {
          console.error("Coinbase purchase failed:", coinbaseError);
          
          // Store failed attempt for tracking
          purchase = await storage.createCryptoPurchase({
            userId,
            cryptoSymbol,
            amountUsd: amount,
            cryptoAmount: '0',
            purchasePrice: amount,
          });

          res.status(503).json({
            ...purchase,
            error: coinbaseError,
            message: "Crypto Preview simulation failed"
          });
        }
      } else {
        // Demo mode when Coinbase not configured
        const cryptoAmount = (parseFloat(amount) / 50000).toFixed(8);
        purchase = await storage.createCryptoPurchase({
          userId,
          cryptoSymbol,
          amountUsd: amount,
          cryptoAmount,
          purchasePrice: amount,
        });

        const demoResponse = {
          ...purchase,
          message: "Preview purchase recorded — simulated, no real money moved"
        };
        if (idempotencyKey) {
          await saveIdempotency(idempotencyKey, userId, '/api/crypto-purchases', 201, demoResponse);
        }
        res.status(201).json(demoResponse);
      }
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid crypto purchase data", errors: error.errors });
      }
      console.error("Error creating crypto purchase:", error);
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Get crypto portfolio summary
  app.get("/api/crypto-summary", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      const purchases = await storage.getCryptoPurchasesByUserId(userId);
      // Use canonical status so legacy / provider strings like 'succeeded',
      // 'settled', 'posted' all aggregate into the portfolio (matches the
      // <StatusBadge/> rendering the user sees).
      const completedPurchases = purchases
        .map(withCanonicalStatus)
        .filter(p => p.status === 'completed');
      
      // Group by crypto symbol
      const portfolio = completedPurchases.reduce((acc, purchase) => {
        const symbol = purchase.cryptoSymbol;
        if (!acc[symbol]) {
          acc[symbol] = {
            symbol,
            totalInvested: 0,
            totalCrypto: 0,
            averagePrice: 0,
            purchaseCount: 0
          };
        }
        
        acc[symbol].totalInvested += parseFloat(purchase.amountUsd);
        acc[symbol].totalCrypto += parseFloat(purchase.cryptoAmount);
        acc[symbol].purchaseCount += 1;
        
        return acc;
      }, {} as Record<string, any>);

      // Calculate average prices
      Object.values(portfolio).forEach((coin: any) => {
        coin.averagePrice = coin.totalInvested / coin.totalCrypto;
      });

      const totalInvested = completedPurchases.reduce((sum, p) => sum + parseFloat(p.amountUsd), 0);
      
      res.json({
        portfolio: Object.values(portfolio),
        totalInvested: totalInvested.toFixed(2),
        totalPurchases: completedPurchases.length,
        lastPurchase: completedPurchases[0]?.createdAt || null
      });
    } catch (error) {
      res.status(500).json({ message: "Internal server error" });
    }
  });

  // Client-side Plaid Link telemetry: 20 events per IP per minute.
  const plaidEventLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    message: { message: "Too many events." },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
  });

  // Structured log of Plaid Link client-side outcomes (esp. OAuth resume
  // failures, which never reach the server otherwise). Log-only — no DB
  // writes, no PII beyond Plaid's own error/session identifiers. Auth is
  // optional on purpose: the OAuth resume page can land in a browser where
  // the session is gone, and that failure is exactly what we need to see.
  app.post("/api/plaid/link-event", plaidEventLimiter, (req: Request, res: Response) => {
    const userId = getUserIdFromRequest(req) ?? "anonymous";
    const b = (req.body ?? {}) as Record<string, unknown>;
    const clip = (v: unknown, max = 200) =>
      typeof v === "string" ? v.slice(0, max) : undefined;
    console.log(JSON.stringify({
      service: "PlaidLinkClient",
      event: "link_client_event",
      userId,
      stage: clip(b.stage, 40),
      errorType: clip(b.errorType, 60),
      errorCode: clip(b.errorCode, 60),
      errorMessage: clip(b.errorMessage),
      requestId: clip(b.requestId, 60),
      linkSessionId: clip(b.linkSessionId, 60),
      platform: clip(b.platform, 20),
    }));
    res.status(204).end();
  });

  // Plaid banking integration routes
  app.post("/api/plaid/create-link-token", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "Plaid service not configured. Sandbox requires PLAID_CLIENT_ID and PLAID_SECRET; production (PLAID_ENV=production) requires PLAID_CLIENT_ID and PLAID_SECRET_PRODUCTION.",
          configured: false
        });
      }

      const linkToken = await plaidService.createLinkToken(userId);
      res.json({ linkToken, configured: true });
    } catch (error) {
      console.error('Error creating Plaid link token:', error);
      res.status(500).json({ message: "Failed to create link token" });
    }
  });

  app.post("/api/plaid/exchange-token", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { publicToken } = req.body;

      if (!publicToken) {
        return res.status(400).json({ message: "Public token is required" });
      }

      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }

      const { accessToken, itemId } = await plaidService.exchangePublicToken(publicToken);
      
      // Get account information
      const accounts = await plaidService.getAccounts(accessToken);

      // One stored connection per Plaid item (plaid_item_id is unique).
      // A single bank login often returns multiple accounts (checking + loans);
      // we store the primary depository account and return the full list.
      const primary = accounts.find(a => a.type === 'depository') ?? accounts[0];
      if (!primary) {
        return res.status(502).json({ message: "No accounts returned by the bank" });
      }

      const details = {
        plaidAccessToken: accessToken,
        accountId: primary.account_id,
        accountName: primary.name,
        accountType: primary.type,
        institutionName: primary.name,
        mask: primary.mask || '',
      };

      // Re-linking the same bank login (e.g. it was already connected for
      // debt import) must refresh the existing row, not insert a duplicate.
      const existing = await storage.getBankAccountByPlaidItemId(itemId);
      if (existing) {
        if (existing.userId !== userId) {
          return res.status(409).json({ message: "This bank connection belongs to a different account" });
        }
        await storage.refreshBankAccount(existing.id, details);
      } else {
        try {
          await storage.createBankAccount({ userId, plaidItemId: itemId, ...details });
        } catch (err) {
          // Narrow race: two concurrent exchanges for the same brand-new item.
          // Re-read and refresh instead of surfacing a duplicate-key 500.
          const raced = await storage.getBankAccountByPlaidItemId(itemId);
          if (!raced) throw err;
          if (raced.userId !== userId) {
            return res.status(409).json({ message: "This bank connection belongs to a different account" });
          }
          await storage.refreshBankAccount(raced.id, details);
        }
      }

      res.json({ 
        success: true, 
        accounts: accounts.map(acc => ({
          id: acc.account_id,
          name: acc.name,
          type: acc.type,
          subtype: acc.subtype,
          mask: acc.mask
        }))
      });
    } catch (error) {
      console.error('Error exchanging Plaid token:', error);
      res.status(500).json({ message: "Failed to exchange token" });
    }
  });

  app.get("/api/plaid/accounts", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts = await storage.getBankAccountsByUserId(userId);
      res.json(bankAccounts);
    } catch (error) {
      console.error('Error fetching bank accounts:', error);
      res.status(500).json({ message: "Failed to fetch bank accounts" });
    }
  });

  /**
   * Per-account Plaid failure surfaced to the client instead of being
   * swallowed. `needsRelink` means the stored token can no longer reach the
   * bank and the fix is Plaid update mode (Reconnect), not a retry.
   */
  interface PlaidAccountError {
    bankAccountId: string;
    accountId: string;
    errorCode: string;
    needsRelink: boolean;
  }

  const PLAID_RELINK_ERROR_CODES = new Set([
    'ITEM_LOGIN_REQUIRED',
    'PENDING_EXPIRATION',
    'PENDING_DISCONNECT',
    'ITEM_NOT_FOUND',
    'ACCESS_NOT_GRANTED',
    'INVALID_ACCESS_TOKEN',
  ]);

  function toPlaidAccountError(account: { id: string; accountId: string }, error: unknown): PlaidAccountError {
    const errorCode: string =
      (error as any)?.response?.data?.error_code || 'UNKNOWN_ERROR';
    return {
      bankAccountId: account.id,
      accountId: account.accountId,
      errorCode,
      needsRelink: PLAID_RELINK_ERROR_CODES.has(errorCode),
    };
  }

  // Plaid update mode: repairs an existing item whose login stopped working.
  app.post("/api/plaid/create-update-link-token", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { bankAccountId } = req.body || {};
      if (!bankAccountId || typeof bankAccountId !== 'string') {
        return res.status(400).json({ message: "bankAccountId is required" });
      }
      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }

      // Ownership check: the account must belong to the requesting user.
      const bankAccounts = await storage.getBankAccountsByUserId(userId);
      const account = bankAccounts.find((a) => a.id === bankAccountId);
      if (!account) {
        return res.status(404).json({ message: "Bank account not found" });
      }

      const accessToken = await storage.getPlaidAccessToken(account.id);
      if (!accessToken) {
        return res.status(409).json({
          message: "No usable bank credentials for this account. Please remove it and connect the bank again.",
        });
      }

      const linkToken = await plaidService.createUpdateLinkToken(userId, accessToken);
      res.json({ linkToken });
    } catch (error) {
      console.error('Error creating Plaid update link token:', error);
      res.status(500).json({ message: "Failed to create update link token" });
    }
  });

  app.get("/api/plaid/transactions", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts = await storage.getBankAccountsByUserId(userId);
      
      if (bankAccounts.length === 0) {
        return res.json({ transactions: [], accountErrors: [] });
      }

      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }

      // Get transactions from the last 30 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const allTransactions = [];
      const accountErrors: PlaidAccountError[] = [];
      for (const account of bankAccounts) {
        try {
          const token = await storage.getPlaidAccessToken(account.id);
          if (!token) {
            accountErrors.push({
              bankAccountId: account.id,
              accountId: account.accountId,
              errorCode: 'TOKEN_MISSING',
              needsRelink: true,
            });
            continue;
          }
          const transactions = await plaidService.getTransactions(token, startDate, endDate);
          allTransactions.push(...transactions);
        } catch (error) {
          console.error(`Error fetching transactions for account ${account.accountId}:`, error);
          accountErrors.push(toPlaidAccountError(account, error));
        }
      }

      res.json({ transactions: allTransactions, accountErrors });
    } catch (error) {
      console.error('Error fetching Plaid transactions:', error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/plaid/balances", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts = await storage.getBankAccountsByUserId(userId);
      
      if (bankAccounts.length === 0) {
        return res.json({ balances: [], accountErrors: [] });
      }

      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }

      const allBalances = [];
      const accountErrors: PlaidAccountError[] = [];
      for (const account of bankAccounts) {
        try {
          const token = await storage.getPlaidAccessToken(account.id);
          if (!token) {
            accountErrors.push({
              bankAccountId: account.id,
              accountId: account.accountId,
              errorCode: 'TOKEN_MISSING',
              needsRelink: true,
            });
            continue;
          }
          const balances = await plaidService.getBalance(token);
          allBalances.push(...balances);
        } catch (error) {
          console.error(`Error fetching balance for account ${account.accountId}:`, error);
          accountErrors.push(toPlaidAccountError(account, error));
        }
      }

      res.json({ balances: allBalances, accountErrors });
    } catch (error) {
      console.error('Error fetching account balances:', error);
      res.status(500).json({ message: "Failed to fetch balances" });
    }
  });

  // Coinbase cryptocurrency integration routes
  app.get("/api/coinbase/accounts", async (req: Request, res: Response) => {
    try {
      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "Crypto Preview service unavailable",
          configured: false
        });
      }

      const accounts = await coinbaseService.getAccounts();
      res.json({ accounts, configured: true });
    } catch (error) {
      console.error('Error fetching Coinbase accounts:', error);
      res.status(500).json({ message: "Failed to fetch Coinbase accounts" });
    }
  });

  app.get("/api/coinbase/prices/:currency?", async (req: Request, res: Response) => {
    try {
      const currency = req.params.currency || 'BTC';
      
      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "Coinbase service not configured",
          configured: false
        });
      }

      const [spotPrice, exchangeRates] = await Promise.all([
        coinbaseService.getSpotPrice(`${currency}-USD`),
        coinbaseService.getExchangeRates(currency)
      ]);

      res.json({ spotPrice, exchangeRates, configured: true });
    } catch (error) {
      console.error('Error fetching crypto prices:', error);
      res.status(500).json({ message: "Failed to fetch crypto prices" });
    }
  });

  app.post("/api/coinbase/buy", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { accountId, amount, currency = 'USD' } = req.body;

      if (!accountId || !amount) {
        return res.status(400).json({ message: "Account ID and amount are required" });
      }

      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({ message: "Coinbase service not configured" });
      }

      const transaction = await coinbaseService.buyCrypto(accountId, amount, currency);
      
      // Store crypto purchase in our database
      await storage.createCryptoPurchase({
        userId,
        cryptoSymbol: 'BTC', // You might want to make this dynamic
        amountUsd: amount,
        cryptoAmount: '0', // Will be updated when transaction completes
        purchasePrice: amount,
        coinbaseOrderId: (transaction as any).id || ''
      });

      res.json({
        success: true,
        simulated: true,
        message: "Preview purchase — simulated, no real money moved",
        transaction
      });
    } catch (error) {
      console.error('Error buying crypto:', error);
      res.status(500).json({ message: "Failed to purchase cryptocurrency" });
    }
  });

  app.get("/api/coinbase/transactions/:accountId", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { accountId } = req.params;

      if (!coinbaseService.isServiceConfigured()) {
        return res.status(503).json({ message: "Coinbase service not configured" });
      }

      const transactions = await coinbaseService.getTransactions(accountId);
      res.json(transactions);
    } catch (error) {
      console.error('Error fetching Coinbase transactions:', error);
      res.status(500).json({ message: "Failed to fetch transactions" });
    }
  });

  app.get("/api/service-status", async (req: Request, res: Response) => {
    try {
      const status = {
        plaid: {
          configured: plaidService.isServiceConfigured(),
          status: plaidService.isServiceConfigured() ? 'ready' : 'missing_credentials'
        },
        coinbase: {
          configured: coinbaseService.isServiceConfigured(),
          status: coinbaseService.isServiceConfigured() ? 'ready' : 'missing_credentials',
          demoMode: coinbaseService.isDemoMode()
        }
      };
      res.json(status);
    } catch (error) {
      console.error('Error checking service status:', error);
      res.status(500).json({ message: "Failed to check service status" });
    }
  });

  // Dime Time Token (DTT) API Routes
  app.get('/api/dime-token/info', async (req: Request, res: Response) => {
    try {
      const tokenInfo = await storage.getDttTokenInfo();
      if (!tokenInfo) {
        return res.status(404).json({ message: 'Token information not found' });
      }
      res.json(tokenInfo);
    } catch (error) {
      console.error('Error fetching token info:', error);
      res.status(500).json({ message: 'Failed to fetch token information' });
    }
  });

  app.get('/api/dime-token/balance', async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const holdings = await storage.getDttHoldings(userId);
      
      if (!holdings) {
        // Return default empty balance if user has no holdings yet
        return res.json({
          balance: '0.00000000',
          stakedAmount: '0.00000000',
          totalEarned: '0.00000000'
        });
      }
      
      res.json({
        balance: holdings.balance,
        stakedAmount: holdings.stakedAmount,
        totalEarned: holdings.totalEarned
      });
    } catch (error) {
      console.error('Error fetching token balance:', error);
      res.status(500).json({ message: 'Failed to fetch token balance' });
    }
  });

  app.get('/api/dime-token/rewards', async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const rewards = await storage.getDttRewardsByUserId(userId);
      
      // Transform to match frontend interface
      const formattedRewards = rewards.map(reward => ({
        id: reward.id,
        action: reward.action,
        amount: reward.amount,
        transactionHash: reward.transactionHash || '',
        createdAt: reward.createdAt.toISOString()
      }));
      
      res.json(formattedRewards);
    } catch (error) {
      console.error('Error fetching rewards:', error);
      res.status(500).json({ message: 'Failed to fetch token rewards' });
    }
  });

  app.post('/api/dime-token/stake', async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { amount, duration } = req.body;

      if (!amount || !duration || parseFloat(amount) <= 0) {
        return res.status(400).json({ message: 'Valid amount and duration required' });
      }

      // Check if user has sufficient balance
      const holdings = await storage.getDttHoldings(userId);
      if (!holdings || parseFloat(holdings.balance) < parseFloat(amount)) {
        return res.status(400).json({ message: 'Insufficient DTT balance for staking' });
      }

      // Calculate APY based on duration
      let apy = "5.00000000"; // Base 5% APY
      if (parseInt(duration) >= 90) apy = "15.50000000"; // 90+ days = 15.5% APY
      else if (parseInt(duration) >= 30) apy = "10.00000000"; // 30+ days = 10% APY

      // Create staking record
      const endDate = new Date(Date.now() + parseInt(duration) * 24 * 60 * 60 * 1000);
      const staking = await storage.createDttStaking({
        userId,
        amount: amount,
        duration: parseInt(duration),
        apy: apy,
        endDate: endDate,
        rewardsEarned: "0.00000000",
        status: "active",
      });

      res.json({
        ...staking,
        message: `Successfully staked ${amount} DTT for ${duration} days at ${parseFloat(apy).toFixed(1)}% APY`
      });
    } catch (error) {
      console.error('Error staking tokens:', error);
      res.status(500).json({ message: 'Failed to stake tokens' });
    }
  });

  app.get('/api/dime-token/trading-pairs', async (req: Request, res: Response) => {
    try {
      const tradingPairs = dimeTokenService.getTradingPairs();
      res.json(tradingPairs);
    } catch (error) {
      console.error('Error fetching trading pairs:', error);
      res.status(500).json({ message: 'Failed to fetch trading pairs' });
    }
  });

  // Award DTT tokens for user actions (authenticated; always targets the caller's own account)
  app.post('/api/dime-token/award', async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const { action, amount } = req.body;

      const reward = await dimeTokenService.awardTokens(userId, action, amount);
      res.json(reward);
    } catch (error) {
      console.error('Error awarding tokens:', error);
      res.status(500).json({ message: 'Failed to award tokens' });
    }
  });

  // Register Axos Bank integration routes
  registerAxosRoutes(app);

  // Register Mercury banking integration routes
  registerMercuryRoutes(app);

  // Register Plaid webhook routes (no user auth — signature-verified)
  registerWebhookRoutes(app);

  // Register Stripe ACH routes ONLY when the flag is ON. When OFF, the
  // `stripe` SDK is never loaded (the service uses dynamic import gated on
  // the same flag) and none of these endpoints are mounted — the surface
  // simply doesn't exist for unauthenticated probes.
  if (isFlagEnabled("ENABLE_STRIPE_ACH")) {
    // Fail the boot loudly if this environment's Stripe key has the wrong mode
    // (a live key in dev / a test key in prod). A simply-missing key leaves
    // Stripe fail-closed (routes mounted but `isStripeAchEnabled()` is false).
    assertStripeKeyModeSafeOnBoot();
    registerStripeRoutes(app);
    registerStripeWebhook(app);
    console.log(JSON.stringify({
      service: "Server",
      event: "stripe_routes_mounted",
      flag: "ENABLE_STRIPE_ACH",
    }));
  }

  // Register automatic debt-import routes ONLY when the flag is ON. When OFF,
  // none of these endpoints are mounted (404, not 401) — same fail-closed
  // pattern as Stripe. The active provider is chosen by DEBT_IMPORT_PROVIDER
  // (default "sandbox") until a real liability provider is approved.
  if (isFlagEnabled("ENABLE_DEBT_IMPORT")) {
    registerDebtImportRoutes(app);
    console.log(JSON.stringify({
      service: "Server",
      event: "debt_import_routes_mounted",
      flag: "ENABLE_DEBT_IMPORT",
      provider: (process.env.DEBT_IMPORT_PROVIDER || "sandbox").trim().toLowerCase(),
    }));
  }

  // Register subscription billing routes ONLY when the flag is ON (404 when
  // OFF — same fail-closed pattern as Stripe/debt-import). Subscriptions bill
  // via ACH against the Stripe-linked bank account, so ENABLE_STRIPE_ACH is a
  // hard dependency: fail the boot loudly rather than mount a half-working
  // billing surface.
  if (isFlagEnabled("ENABLE_SUBSCRIPTIONS")) {
    if (!isFlagEnabled("ENABLE_STRIPE_ACH")) {
      throw new Error(
        "ENABLE_SUBSCRIPTIONS requires ENABLE_STRIPE_ACH: subscriptions bill via " +
        "Stripe ACH and cannot function without the Stripe code paths. " +
        "Enable ENABLE_STRIPE_ACH or disable ENABLE_SUBSCRIPTIONS.",
      );
    }
    registerSubscriptionRoutes(app);
    console.log(JSON.stringify({
      service: "Server",
      event: "subscription_routes_mounted",
      flag: "ENABLE_SUBSCRIPTIONS",
    }));
  }

  // Register internal admin (read-only) routes — always mounted; every
  // endpoint requires `requireAdmin`, which fails closed when ADMIN_USER_IDS
  // is unset/empty.
  registerAdminRoutes(app);

  // Register notification routes
  app.use(notificationRoutes);

  const httpServer = createServer(app);
  return httpServer;
}
