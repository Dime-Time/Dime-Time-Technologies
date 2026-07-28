/**
 * Automatic debt-import routes (BETA — gated by `ENABLE_DEBT_IMPORT`).
 *
 * Mounted ONLY when the flag is ON (see server/routes.ts), mirroring the Stripe
 * pattern: when OFF these endpoints don't exist (404, not 401), so there is no
 * surface to probe. The active liability provider is chosen by the
 * `DEBT_IMPORT_PROVIDER` env var (default "sandbox") — the routes never import a
 * concrete provider, only the `getLiabilityProvider()` factory.
 *
 * Every import / refresh / disconnect is:
 *   - auth-gated via `getUserIdFromRequest`
 *   - written to the `debt_import_audit_logs` table (success AND error)
 *   - structured-logged with a `correlationId`
 * POST /api/debts/import additionally requires explicit `{ consent: true }`.
 */

import type { Express, Request, Response } from "express";
import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import { randomUUID } from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { getUserIdFromRequest } from "../middleware/authHelper";
import {
  getLiabilityProvider,
  LinkRequiredError,
  LiabilitiesNotEnabledError,
  type LiabilityProvider,
} from "../services/debtImport";

function debtImportLog(correlationId: string, event: string, data?: Record<string, unknown>): void {
  console.log(
    JSON.stringify({
      ts: new Date().toISOString(),
      service: "DebtImport",
      correlationId,
      event,
      ...(data ?? {}),
    }),
  );
}

const consentSchema = z.object({ consent: z.literal(true) });

const exchangeSchema = z.object({
  publicToken: z.string().min(1),
  institutionName: z.string().max(200).optional(),
  consent: z.literal(true),
});

/**
 * Per-user rate limiters for the debt-import surface. Keyed by the authenticated
 * user id (IP fallback, IPv6-safe) so one user can't exhaust another's budget.
 * These guard against accidental repeated taps and — once a real liability
 * provider is wired — runaway provider-API cost. Windows are 15 minutes.
 */
function perUserLimiter(max: number, action: string) {
  return rateLimit({
    windowMs: 15 * 60 * 1000,
    max,
    message: { message: `Too many ${action} attempts. Please try again in about 15 minutes.` },
    standardHeaders: true,
    legacyHeaders: false,
    validate: { xForwardedForHeader: false },
    keyGenerator: (req: Request) => {
      const uid = getUserIdFromRequest(req);
      return uid ? `u:${uid}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
    },
  });
}

const importLimiter = perUserLimiter(10, "import");
const refreshLimiter = perUserLimiter(20, "refresh");
const disconnectLimiter = perUserLimiter(20, "disconnect");

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
}

/** Friendly user-facing copy while the Liabilities entitlement is pending. */
const LIABILITIES_COMING_SOON_MESSAGE =
  "Automatic debt import is coming soon. You can add your debts manually for now.";

/**
 * Cached provider capability: does our Plaid account have the Liabilities
 * product yet? Checked by attempting a Liabilities Link-token create (free, no
 * user impact) and cached process-wide — the entitlement is account-level, not
 * user-level. TTL keeps it fresh so the feature lights up automatically (within
 * ~10 minutes) once Plaid grants Liabilities, with NO flag flip or redeploy.
 * Unknown/transient errors never mark the feature unavailable and are not cached.
 */
const LIABILITIES_CAPABILITY_TTL_MS = 10 * 60 * 1000;
let liabilitiesCapability: { available: boolean; checkedAt: number } | null = null;

function markLiabilitiesCapability(available: boolean): void {
  liabilitiesCapability = { available, checkedAt: Date.now() };
}

async function isLiabilitiesAvailable(provider: LiabilityProvider, userId: string): Promise<boolean> {
  // Only the Plaid provider has an upstream entitlement to probe.
  if (provider.name !== "plaid" || !provider.linkFlow) return true;
  const cached = liabilitiesCapability;
  if (cached && Date.now() - cached.checkedAt < LIABILITIES_CAPABILITY_TTL_MS) {
    return cached.available;
  }
  try {
    await provider.linkFlow.createLinkToken(userId);
    markLiabilitiesCapability(true);
    return true;
  } catch (err) {
    if (err instanceof LiabilitiesNotEnabledError) {
      markLiabilitiesCapability(false);
      return false;
    }
    // Transient/unknown failure — don't hide the feature, don't cache.
    return cached?.available ?? true;
  }
}

/**
 * Shared connect -> fetch -> upsert pipeline for import and refresh. Writes an
 * audit row for both success and failure and returns the HTTP payload.
 */
async function runImport(
  userId: string,
  action: "import" | "refresh",
  correlationId: string,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const provider = getLiabilityProvider();
  try {
    const conn = await provider.initializeConnection(userId);
    if (!provider.linkFlow) {
      // Providers without a Link step (sandbox) keep a single connection row.
      // Link-based providers (Plaid) manage their per-bank rows themselves —
      // an unkeyed upsert here would corrupt the first bank's row.
      await storage.upsertDebtProviderConnection({
        userId,
        provider: provider.name,
        institutionName: conn.institutionName ?? null,
        status: "active",
        consentAt: new Date(),
        lastSyncAt: new Date(),
      });
    }
    const liabilities = await provider.fetchLiabilities(userId);
    const result = await storage.importDebtsFromProvider(userId, provider.name, liabilities);
    await storage.createDebtImportAuditLog({
      userId,
      provider: provider.name,
      action,
      status: "success",
      importedCount: result.imported,
      updatedCount: result.updated,
      message: null,
      correlationId,
    });
    debtImportLog(correlationId, `debt_${action}_success`, {
      userId,
      provider: provider.name,
      imported: result.imported,
      updated: result.updated,
    });
    return {
      status: 200,
      body: {
        imported: result.imported,
        updated: result.updated,
        debts: result.debts,
        provider: provider.name,
        institutionName: conn.institutionName ?? null,
        correlationId,
      },
    };
  } catch (err) {
    if (err instanceof LinkRequiredError) {
      // Expected control-flow signal, not a failure — let the client launch Link.
      debtImportLog(correlationId, `debt_${action}_link_required`, { userId, provider: provider.name });
      return {
        status: 409,
        body: {
          code: "link_required",
          message: "Connect your account to import your debts.",
          correlationId,
        },
      };
    }
    if (err instanceof LiabilitiesNotEnabledError) {
      // Expected until Plaid grants the Liabilities entitlement — friendly
      // "coming soon" instead of a generic failure. Still audited.
      markLiabilitiesCapability(false);
      await storage.createDebtImportAuditLog({
        userId,
        provider: provider.name,
        action,
        status: "error",
        importedCount: 0,
        updatedCount: 0,
        message: "PLAID_LIABILITIES_NOT_ENABLED",
        correlationId,
      });
      debtImportLog(correlationId, `debt_${action}_liabilities_not_enabled`, {
        userId,
        provider: provider.name,
      });
      return {
        status: 503,
        body: {
          code: "PLAID_LIABILITIES_NOT_ENABLED",
          message: LIABILITIES_COMING_SOON_MESSAGE,
          correlationId,
        },
      };
    }
    const message = errMessage(err);
    await storage.createDebtImportAuditLog({
      userId,
      provider: provider.name,
      action,
      status: "error",
      importedCount: 0,
      updatedCount: 0,
      message,
      correlationId,
    });
    debtImportLog(correlationId, `debt_${action}_error`, { userId, provider: provider.name, error: message });
    return {
      status: 502,
      body: {
        message: "We couldn't import your debts right now. Please try again in a moment.",
        correlationId,
      },
    };
  }
}

export function registerDebtImportRoutes(app: Express): void {
  // Connect to the liability provider and import debts. Requires explicit consent.
  app.post("/api/debts/import", importLimiter, async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const parsed = consentSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "Explicit consent is required to import your debts.",
        correlationId,
      });
    }
    const { status, body } = await runImport(userId, "import", correlationId);
    res.status(status).json(body);
  });

  // Create a provider Link token so the client SDK (e.g. Plaid Link) can open a
  // connection. 409 for providers that don't need a connect step (e.g. sandbox).
  app.post("/api/debts/import/link-token", importLimiter, async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const provider = getLiabilityProvider();
    if (!provider.linkFlow) {
      return res.status(409).json({
        message: "This provider does not require a connection step.",
        correlationId,
      });
    }
    try {
      const linkToken = await provider.linkFlow.createLinkToken(userId);
      if (provider.name === "plaid") markLiabilitiesCapability(true);
      return res.json({ linkToken, correlationId });
    } catch (err) {
      if (err instanceof LiabilitiesNotEnabledError) {
        markLiabilitiesCapability(false);
        debtImportLog(correlationId, "debt_link_token_liabilities_not_enabled", {
          userId,
          provider: provider.name,
        });
        return res.status(503).json({
          code: "PLAID_LIABILITIES_NOT_ENABLED",
          message: LIABILITIES_COMING_SOON_MESSAGE,
          correlationId,
        });
      }
      debtImportLog(correlationId, "debt_link_token_error", {
        userId,
        provider: provider.name,
        error: errMessage(err),
      });
      return res.status(502).json({
        message: "We couldn't start the secure connection. Please try again.",
        correlationId,
      });
    }
  });

  // Complete the Link flow: exchange the client's public token, persist the
  // (encrypted) connection, then run the import. Requires explicit consent.
  app.post("/api/debts/import/exchange", importLimiter, async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const parsed = exchangeSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        message: "A public token and explicit consent are required.",
        correlationId,
      });
    }
    const provider = getLiabilityProvider();
    if (!provider.linkFlow) {
      return res.status(409).json({
        message: "This provider does not support a connection step.",
        correlationId,
      });
    }
    try {
      await provider.linkFlow.completeLink(userId, parsed.data.publicToken, parsed.data.institutionName);
    } catch (err) {
      const message = errMessage(err);
      await storage.createDebtImportAuditLog({
        userId,
        provider: provider.name,
        action: "import",
        status: "error",
        importedCount: 0,
        updatedCount: 0,
        message,
        correlationId,
      });
      debtImportLog(correlationId, "debt_link_exchange_error", { userId, provider: provider.name, error: message });
      return res.status(502).json({
        message: "We couldn't connect your account. Please try again.",
        correlationId,
      });
    }
    const { status, body } = await runImport(userId, "import", correlationId);
    res.status(status).json(body);
  });

  // Re-sync balances from the provider (upsert; skips user-edited fields).
  app.post("/api/debts/refresh", refreshLimiter, async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const provider = getLiabilityProvider();
    const existing = await storage.getDebtProviderConnection(userId, provider.name);
    if (!existing || existing.status !== "active") {
      return res.status(409).json({
        message: "No active debt-import connection to refresh.",
        correlationId,
      });
    }
    const { status, body } = await runImport(userId, "refresh", correlationId);
    res.status(status).json(body);
  });

  // Connection status for the current provider (drives the client UI).
  app.get("/api/debts/import/status", async (req: Request, res: Response) => {
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const provider = getLiabilityProvider();
    const conns = await storage.getDebtProviderConnections(userId, provider.name);
    const active = conns.filter((c) => c.status === "active");
    const connected = active.length > 0;
    const first = active[0] ?? conns[0];
    res.json({
      connected,
      // True when the provider needs a client-side connect step and the user
      // isn't connected yet — the client uses this to launch the Link flow.
      requiresLink: !!provider.linkFlow && !connected,
      // True when the provider supports linking additional banks on top of the
      // existing connection(s) — drives the "Add another bank" client action.
      canLinkAnother: !!provider.linkFlow,
      // False while the upstream Liabilities entitlement is pending (e.g. Plaid
      // production before approval) — the client shows "coming soon" up front.
      liabilitiesAvailable: await isLiabilitiesAvailable(provider, userId),
      provider: provider.name,
      institutionName: first?.institutionName ?? null,
      lastSyncAt: first?.lastSyncAt ?? null,
      // One entry per linked bank so the client can list them.
      institutions: conns.map((c) => ({
        institutionName: c.institutionName,
        status: c.status,
        lastSyncAt: c.lastSyncAt,
      })),
    });
  });

  // Disconnect the provider. Imported debts are KEPT (marked no longer synced);
  // the connection row is flipped to "disconnected".
  app.delete("/api/debts/provider", disconnectLimiter, async (req: Request, res: Response) => {
    const correlationId = randomUUID();
    const userId = getUserIdFromRequest(req);
    if (!userId) {
      return res.status(401).json({ message: "Not authenticated" });
    }
    const provider = getLiabilityProvider();
    try {
      await provider.disconnect(userId);
    } catch (err) {
      // Best-effort provider teardown — never block the local disconnect.
      debtImportLog(correlationId, "debt_disconnect_provider_warning", {
        userId,
        provider: provider.name,
        error: errMessage(err),
      });
    }
    await storage.disconnectDebtProvider(userId, provider.name);
    await storage.createDebtImportAuditLog({
      userId,
      provider: provider.name,
      action: "disconnect",
      status: "success",
      importedCount: 0,
      updatedCount: 0,
      message: null,
      correlationId,
    });
    debtImportLog(correlationId, "debt_disconnect_success", { userId, provider: provider.name });
    res.json({ ok: true, correlationId });
  });
}
