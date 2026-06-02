import type { Express, Request, Response } from "express";
import { createServer, type Server } from "http";
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

import { insertTransactionSchema, insertPaymentSchema, insertDebtSchema, insertCryptoPurchaseSchema, insertRoundUpSettingsSchema, insertContactSubmissionSchema } from "@shared/schema";
import { z } from "zod";
import { plaidService } from "./services/plaidService";
import { coinbaseService } from "./services/coinbaseService";
import { s3Service } from "./services/s3Service";
import { dynamoService } from "./services/dynamoService";
import { axosService } from "./services/axosService";
import { registerAxosRoutes } from "./routes/axosRoutes";
import { registerMercuryRoutes } from "./routes/mercuryRoutes";
import { registerWebhookRoutes } from "./routes/webhookRoutes";
import { registerStripeRoutes, registerStripeWebhook } from "./routes/stripeRoutes";
import { registerAdminRoutes } from "./routes/adminRoutes";
import { isAdminUserId } from "./lib/admin";
import { isFlagEnabled } from "./lib/flags";
import { getUserIdFromRequest } from "./middleware/authHelper";
import { notificationRoutes } from "./routes/notificationRoutes";
import { notificationService } from "./services/notificationService";
import { notificationTriggers } from "./services/notificationTriggers";
import { roundUpSplitService } from "./services/roundUpSplitService";
import { calculateRoundUp } from "../client/src/lib/calculations";
import multer from "multer";
import { randomBytes } from "crypto";
import { sendPasswordResetEmail, sendVerificationEmail } from "./services/emailService";
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

const BCRYPT_COST = 12;

function hashPasswordSha256(password: string): string {
  return createHash('sha256').update(password).digest('hex');
}

async function hashPasswordBcrypt(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_COST);
}

function constantTimeCompare(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

async function verifyPassword(password: string, hash: string, algo: string | null): Promise<boolean> {
  if (algo === 'bcrypt') {
    return bcrypt.compare(password, hash);
  }
  const sha256Hash = hashPasswordSha256(password);
  return constantTimeCompare(sha256Hash, hash);
}

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

      // Best-effort: send verification email. We fire-and-forget so a slow
      // Resend response doesn't delay signup. Failures are logged inside
      // issueAndSendVerificationEmail and never bubble up to the user.
      void issueAndSendVerificationEmail(req, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
      });
      
      req.session.save((err) => {
        if (err) {
          console.error("Session save error");
          return res.status(500).json({ message: "Failed to create session" });
        }
        res.status(201).json({ 
          success: true, 
          user: { id: user.id, email: user.email, firstName: user.firstName, lastName: user.lastName },
          authToken
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
  // Always returns a generic 200 so attackers can't enumerate which emails
  // are registered. Rate-limited via authLimiter.
  app.post("/api/auth/forgot-password", authLimiter, async (req: Request, res: Response) => {
    try {
      const email = typeof req.body?.email === "string" ? req.body.email.trim().toLowerCase() : "";
      if (!email) {
        return res.status(400).json({ message: "Email is required" });
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
          if (process.env.NODE_ENV === "production") {
            console.error(JSON.stringify({
              event: "password_reset_misconfigured",
              message: "PUBLIC_APP_URL must be set in production",
            }));
            return res.json({
              success: true,
              message: "If an account exists for that email, a reset link has been sent.",
            });
          }
          // Dev only: synthesize from the request. Safe because dev hosts
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

      // Always succeed regardless of whether the email exists.
      res.json({
        success: true,
        message: "If an account exists for that email, a reset link has been sent.",
      });
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

      const result = await issueAndSendVerificationEmail(req, {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
      });

      if (!result.ok) {
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

  // Logout endpoint
  app.get("/api/logout", (req: Request, res: Response) => {
    req.session.destroy((err) => {
      if (err) {
        console.error("Logout error:", err);
        return res.status(500).json({ message: "Failed to logout" });
      }
      res.clearCookie("connect.sid");
      res.json({ success: true, message: "Logged out successfully" });
    });
  });

  // Account deletion (Apple requires this)
  app.delete("/api/account", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
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
        const validatedData = insertContactSubmissionSchema.parse(payload);
        toInsert = { ...validatedData, source: "marketing" as const };
      }

      const submission = await storage.createContactSubmission(toInsert);
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
      
      // Process round-up split (crypto immediate + debt accumulation) if round-up > 0
      if (totalRoundUp > 0 && roundUpSettingsData?.isEnabled) {
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
      
      const payment = await storage.createPayment(validatedData);
      
      // Update debt balance
      const debt = await storage.getDebt(validatedData.debtId);
      if (debt) {
        const newBalance = (parseFloat(debt.currentBalance) - parseFloat(validatedData.amount)).toFixed(2);
        await storage.updateDebt(validatedData.debtId, {
          currentBalance: newBalance,
        });

        // Trigger debt payment notification
        await notificationTriggers.onDebtPaymentProcessed(
          userId,
          validatedData.debtId,
          parseFloat(validatedData.amount)
        );
      }

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

      const result = await storage.makeAcceleratedPayment(userId, debtId, amount);
      
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
      if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
      }
      res.status(500).json({ message: "Internal server error" });
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
      const settings = await storage.createOrUpdateRoundUpSettings({
        ...req.body,
        userId,
      });
      res.json(settings);
    } catch (error) {
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
      
      const { debtId, amount } = req.body;
      
      if (!debtId || !amount) {
        return res.status(400).json({ message: "debtId and amount are required" });
      }

      // Create payment record
      const payment = await storage.createPayment({
        userId,
        debtId,
        amount,
        source: "round_up",
      });

      // Update debt balance
      const debt = await storage.getDebt(debtId);
      if (debt) {
        const newBalance = (parseFloat(debt.currentBalance) - parseFloat(amount)).toFixed(2);
        await storage.updateDebt(debtId, {
          currentBalance: newBalance,
        });
      }

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

  // Create new crypto purchase with real Coinbase integration
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
              message: "Real crypto purchase completed via Coinbase"
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
            message: "Coinbase purchase failed - check API credentials"
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
          message: "Demo purchase - Add Coinbase credentials for real trading"
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

  // Plaid banking integration routes
  app.post("/api/plaid/create-link-token", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      
      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "Plaid service not configured. Please provide PLAID_CLIENT_ID and PLAID_SECRET environment variables.",
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
      
      // Store bank account information in storage
      for (const account of accounts) {
        await storage.createBankAccount({
          userId,
          plaidItemId: itemId,
          plaidAccessToken: accessToken,
          accountId: account.account_id,
          accountName: account.name,
          accountType: account.type,
          institutionName: account.name, // You might want to fetch institution details
          mask: account.mask || '',
        });
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

  app.get("/api/plaid/transactions", async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const bankAccounts = await storage.getBankAccountsByUserId(userId);
      
      if (bankAccounts.length === 0) {
        return res.json([]);
      }

      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }

      // Get transactions from the last 30 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
      
      const allTransactions = [];
      for (const account of bankAccounts) {
        try {
          const transactions = await plaidService.getTransactions(account.plaidAccessToken, startDate, endDate);
          allTransactions.push(...transactions);
        } catch (error) {
          console.error(`Error fetching transactions for account ${account.accountId}:`, error);
        }
      }

      res.json(allTransactions);
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
        return res.json([]);
      }

      if (!plaidService.isServiceConfigured()) {
        return res.status(503).json({ message: "Plaid service not configured" });
      }

      const allBalances = [];
      for (const account of bankAccounts) {
        try {
          const balances = await plaidService.getBalance(account.plaidAccessToken);
          allBalances.push(...balances);
        } catch (error) {
          console.error(`Error fetching balance for account ${account.accountId}:`, error);
        }
      }

      res.json(allBalances);
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
          message: "Coinbase service not configured. Please provide COINBASE_API_KEY and COINBASE_API_SECRET environment variables.",
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

      res.json({ success: true, transaction });
    } catch (error) {
      console.error('Error buying crypto:', error);
      res.status(500).json({ message: "Failed to purchase cryptocurrency" });
    }
  });

  app.get("/api/coinbase/transactions/:accountId", async (req: Request, res: Response) => {
    try {
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

  // Award DTT tokens for user actions (called internally)
  app.post('/api/dime-token/award', async (req: Request, res: Response) => {
    try {
      const { userId, action, amount } = req.body;
      
      const reward = await dimeTokenService.awardTokens(userId || "demo-user-1", action, amount);
      res.json(reward);
    } catch (error) {
      console.error('Error awarding tokens:', error);
      res.status(500).json({ message: 'Failed to award tokens' });
    }
  });

  // Configure multer for file uploads (in-memory storage)
  const upload = multer({ 
    storage: multer.memoryStorage(),
    limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
  });

  // AWS S3 File Upload Routes
  app.post("/api/aws/upload", upload.single('file'), async (req: Request, res: Response) => {
    try {
      const userId = getUserIdFromRequest(req);
      if (!userId) {
        return res.status(401).json({ message: "Not authenticated" });
      }
      const documentType = req.body.documentType || 'other';
      
      if (!req.file) {
        return res.status(400).json({ message: "No file provided" });
      }

      if (!s3Service.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "S3 service not configured. Please provide AWS credentials.",
          configured: false
        });
      }

      const fileUrl = await s3Service.uploadUserDocument(
        userId, 
        req.file.originalname, 
        req.file.buffer, 
        documentType as 'receipt' | 'statement' | 'profile' | 'other'
      );

      res.json({
        success: true,
        fileUrl,
        fileName: req.file.originalname,
        documentType,
        message: "File uploaded successfully to S3"
      });
    } catch (error) {
      console.error('Error uploading file to S3:', error);
      res.status(500).json({ message: "Failed to upload file" });
    }
  });

  app.get("/api/aws/files/:userId", async (req: Request, res: Response) => {
    try {
      const { userId } = req.params;
      const documentType = req.query.type as string;

      if (!s3Service.isServiceConfigured()) {
        return res.status(503).json({ message: "S3 service not configured" });
      }

      const files = await s3Service.listUserFiles(userId, documentType);
      res.json({ files });
    } catch (error) {
      console.error('Error listing user files:', error);
      res.status(500).json({ message: "Failed to list files" });
    }
  });

  app.post("/api/aws/backup-user-data", async (req: Request, res: Response) => {
    try {
      const userId = "demo-user-1";
      
      if (!s3Service.isServiceConfigured()) {
        return res.status(503).json({ message: "S3 service not configured" });
      }

      // Gather all user data
      const [debts, transactions, payments, cryptoPurchases] = await Promise.all([
        storage.getDebtsByUserId(userId),
        storage.getTransactionsByUserId(userId),
        storage.getPaymentsByUserId(userId),
        storage.getCryptoPurchasesByUserId(userId),
      ]);

      const userData = {
        userId,
        backupDate: new Date().toISOString(),
        data: {
          debts,
          transactions,
          payments,
          cryptoPurchases,
        }
      };

      const backupUrl = await s3Service.backupUserData(userId, userData);
      
      res.json({
        success: true,
        backupUrl,
        message: "User data backed up successfully to S3"
      });
    } catch (error) {
      console.error('Error backing up user data:', error);
      res.status(500).json({ message: "Failed to backup user data" });
    }
  });

  // AWS DynamoDB Routes (for migration or parallel storage)
  app.post("/api/aws/sync-to-dynamo", async (req: Request, res: Response) => {
    try {
      const userId = "demo-user-1";

      if (!dynamoService.isServiceConfigured()) {
        return res.status(503).json({ 
          message: "DynamoDB service not configured. Please provide AWS credentials.",
          configured: false
        });
      }

      // Sync transactions to DynamoDB
      const transactions = await storage.getTransactionsByUserId(userId);
      const syncResults = await Promise.all(
        transactions.map(transaction => 
          dynamoService.createTransaction(transaction)
        )
      );

      res.json({
        success: true,
        syncedCount: syncResults.length,
        message: "Financial data synced to DynamoDB successfully"
      });
    } catch (error) {
      console.error('Error syncing to DynamoDB:', error);
      res.status(500).json({ message: "Failed to sync data to DynamoDB" });
    }
  });

  app.get("/api/aws/service-status", async (req: Request, res: Response) => {
    try {
      const status = {
        s3: {
          configured: s3Service.isServiceConfigured(),
          status: s3Service.isServiceConfigured() ? 'ready' : 'missing_credentials'
        },
        dynamodb: {
          configured: dynamoService.isServiceConfigured(),
          status: dynamoService.isServiceConfigured() ? 'ready' : 'missing_credentials'
        },
        plaid: {
          configured: plaidService.isServiceConfigured(),
          status: plaidService.isServiceConfigured() ? 'ready' : 'missing_credentials'
        },
        coinbase: {
          configured: coinbaseService.isServiceConfigured(),
          status: coinbaseService.isServiceConfigured() ? 'ready' : 'missing_credentials'
        }
      };
      res.json(status);
    } catch (error) {
      console.error('Error checking AWS service status:', error);
      res.status(500).json({ message: "Failed to check AWS service status" });
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
    registerStripeRoutes(app);
    registerStripeWebhook(app);
    console.log(JSON.stringify({
      service: "Server",
      event: "stripe_routes_mounted",
      flag: "ENABLE_STRIPE_ACH",
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

// ... ADD THESE ENDPOINTS BEFORE THE FINAL RETURN ...

// NO WAIT - I need to properly insert these. Let me use a different approach.
