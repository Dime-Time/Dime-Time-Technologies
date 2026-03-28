import type { Express, Request, Response } from "express";
import { createHmac, timingSafeEqual } from "crypto";
import { storage } from "../storage";

/**
 * Plaid Transfer webhook event types that affect transfer status.
 * Reference: https://plaid.com/docs/transfer/webhooks/
 */
const PLAID_TRANSFER_STATUS_MAP: Record<string, string> = {
  'pending': 'pending',
  'posted': 'posted',
  'settled': 'settled',
  'cancelled': 'cancelled',
  'failed': 'failed',
  'returned': 'returned',
};

function webhookLog(event: string, data?: Record<string, unknown>): void {
  console.log(JSON.stringify({
    ts: new Date().toISOString(),
    service: 'PlaidWebhook',
    event,
    ...data,
  }));
}

/**
 * Verify Plaid webhook signature using PLAID_WEBHOOK_SECRET.
 * If the secret is not configured, signature verification is skipped with a warning.
 * Returns true if verification passes or is skipped; false if it fails.
 */
function verifyPlaidSignature(req: Request): boolean {
  const secret = process.env.PLAID_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('[PlaidWebhook] PLAID_WEBHOOK_SECRET not set — skipping signature verification. Set this env var for production webhook security.');
    return true;
  }
  const plaidSignature = req.headers['plaid-verification'] as string | undefined;
  if (!plaidSignature) {
    webhookLog('signature_missing', { severity: 'WARN' });
    return false;
  }
  try {
    const body = (req as any).rawBody || JSON.stringify(req.body);
    const expected = createHmac('sha256', secret).update(body).digest('hex');
    const expectedBuf = Buffer.from(expected, 'utf8');
    const receivedBuf = Buffer.from(plaidSignature, 'utf8');
    if (expectedBuf.length !== receivedBuf.length) return false;
    return timingSafeEqual(expectedBuf, receivedBuf);
  } catch {
    return false;
  }
}

export function registerWebhookRoutes(app: Express) {

  /**
   * POST /webhooks/plaid
   * Receives Plaid Transfer webhook events and updates the transfer ledger.
   * No user authentication — secured by signature verification instead.
   * Processing is idempotent: re-delivered events for the same transfer+status are no-ops.
   */
  app.post("/webhooks/plaid", async (req: Request, res: Response) => {
    const payload = req.body;
    const webhookType: string = payload?.webhook_type || 'UNKNOWN';
    const webhookCode: string = payload?.webhook_code || 'UNKNOWN';
    const transferId: string | undefined = payload?.transfer_id;
    const eventId: string | undefined = payload?.transfer_event_id || payload?.event_id;

    webhookLog('webhook_received', {
      webhookType,
      webhookCode,
      transferId,
      eventId,
      payloadKeys: Object.keys(payload || {}),
    });

    // Acknowledge immediately — Plaid will retry if we don't respond quickly
    res.status(200).json({ received: true });

    // Signature verification
    if (!verifyPlaidSignature(req)) {
      webhookLog('signature_invalid', { severity: 'ERROR', webhookType, webhookCode });
      return;
    }

    // Only process Transfer-related webhooks
    if (webhookType !== 'TRANSFER') {
      webhookLog('webhook_ignored', { reason: 'not_transfer_type', webhookType, webhookCode });
      return;
    }

    if (!transferId) {
      webhookLog('webhook_no_transfer_id', { severity: 'WARN', webhookCode });
      return;
    }

    try {
      // Look up our internal transfer record by Plaid transfer ID
      const ledgerEntry = await storage.getTransferByPlaidTransferId(transferId);

      if (!ledgerEntry) {
        webhookLog('transfer_not_found', {
          severity: 'WARN',
          plaidTransferId: transferId,
          message: 'Received webhook for a Plaid transfer not in our ledger. May be a test event or a transfer not initiated through this system.',
        });
        return;
      }

      // Determine new status from webhook code
      const newPlaidStatus: string | undefined = payload?.new_transfer_status || payload?.transfer_status;
      const mappedStatus: string | undefined = newPlaidStatus ? PLAID_TRANSFER_STATUS_MAP[newPlaidStatus] : undefined;

      webhookLog('transfer_status_update', {
        internalTransferId: ledgerEntry.id,
        plaidTransferId: transferId,
        currentStatus: ledgerEntry.status,
        webhookCode,
        newPlaidStatus,
        mappedStatus,
      });

      // Idempotency: skip update if status already matches
      if (mappedStatus && ledgerEntry.status === mappedStatus) {
        webhookLog('webhook_status_already_set', {
          internalTransferId: ledgerEntry.id,
          status: mappedStatus,
        });
        return;
      }

      if (mappedStatus) {
        await storage.updateTransferStatus(ledgerEntry.id, mappedStatus, {
          rawResponse: JSON.stringify({
            webhook_type: webhookType,
            webhook_code: webhookCode,
            transfer_id: transferId,
            new_transfer_status: newPlaidStatus,
            event_id: eventId,
          }),
        });

        webhookLog('transfer_ledger_updated', {
          internalTransferId: ledgerEntry.id,
          plaidTransferId: transferId,
          previousStatus: ledgerEntry.status,
          newStatus: mappedStatus,
        });
      } else {
        webhookLog('webhook_unhandled_code', {
          webhookCode,
          newPlaidStatus,
          message: 'Webhook code did not map to a known transfer status — logged only.',
        });
      }

    } catch (err: any) {
      webhookLog('webhook_processing_error', {
        severity: 'ERROR',
        plaidTransferId: transferId,
        error: err?.message,
      });
    }
  });
}
