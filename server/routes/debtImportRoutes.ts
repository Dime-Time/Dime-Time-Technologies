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
import { randomUUID } from "crypto";
import { z } from "zod";
import { storage } from "../storage";
import { getUserIdFromRequest } from "../middleware/authHelper";
import { getLiabilityProvider } from "../services/debtImport";

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

function errMessage(err: unknown): string {
  return (err instanceof Error ? err.message : String(err)).slice(0, 500);
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
    await storage.upsertDebtProviderConnection({
      userId,
      provider: provider.name,
      institutionName: conn.institutionName ?? null,
      status: "active",
      consentAt: new Date(),
      lastSyncAt: new Date(),
    });
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
  app.post("/api/debts/import", async (req: Request, res: Response) => {
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

  // Re-sync balances from the provider (upsert; skips user-edited fields).
  app.post("/api/debts/refresh", async (req: Request, res: Response) => {
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
    const conn = await storage.getDebtProviderConnection(userId, provider.name);
    res.json({
      connected: !!conn && conn.status === "active",
      provider: provider.name,
      institutionName: conn?.institutionName ?? null,
      lastSyncAt: conn?.lastSyncAt ?? null,
    });
  });

  // Disconnect the provider. Imported debts are KEPT (marked no longer synced);
  // the connection row is flipped to "disconnected".
  app.delete("/api/debts/provider", async (req: Request, res: Response) => {
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
