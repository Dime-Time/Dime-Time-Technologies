/**
 * One-time migration: rotate PLAID_TOKEN_ENCRYPTION_KEY.
 *
 * Reads every row from `bank_accounts`, decrypts `plaid_access_token` with the
 * OLD key, re-encrypts with the NEW key, and writes the result back in a single
 * database transaction. Legacy plain-text tokens (no "enc:" prefix) are
 * encrypted with the new key in place.
 *
 * The script never prints decrypted tokens to stdout.
 *
 * IMPORTANT — operational ordering to avoid losing tokens to a race:
 *   1. STOP the running app workflow ("Start application") so no new
 *      bank_accounts rows can be inserted under the OLD key while the
 *      migration runs or between migration commit and Secret swap.
 *   2. Run this script (dry run first, then commit run). Inside the
 *      transaction it takes an ACCESS EXCLUSIVE lock on bank_accounts as
 *      defense-in-depth against any stray writer.
 *   3. Swap the `PLAID_TOKEN_ENCRYPTION_KEY` Replit Secret to the NEW key.
 *   4. Restart the workflow and verify a test user end-to-end.
 *
 * Usage (operator runs locally against the prod DB, with both keys exported):
 *
 *   PLAID_TOKEN_ENCRYPTION_KEY_OLD="<old base64 32B key>" \
 *   PLAID_TOKEN_ENCRYPTION_KEY_NEW="<new base64 32B key>" \
 *   DATABASE_URL="$PROD_DATABASE_URL" \
 *   npx tsx scripts/rotate-plaid-encryption-key.ts
 */
import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { eq, sql } from 'drizzle-orm';
import { pool, db } from '../server/db';
import { bankAccounts } from '../shared/schema';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const ENC_PREFIX = 'enc:';

function loadKey(envName: string): Buffer {
  const raw = process.env[envName];
  if (!raw) {
    throw new Error(`${envName} is required. Provide a base64-encoded 32-byte key.`);
  }
  const key = Buffer.from(raw, 'base64');
  if (key.length !== 32) {
    throw new Error(`${envName} must decode to 32 bytes, got ${key.length}.`);
  }
  return key;
}

function decryptWith(key: Buffer, stored: string): string {
  if (!stored.startsWith(ENC_PREFIX)) return stored;
  const combined = Buffer.from(stored.slice(ENC_PREFIX.length), 'base64');
  const iv = combined.subarray(0, IV_LENGTH);
  const tag = combined.subarray(combined.length - TAG_LENGTH);
  const ciphertext = combined.subarray(IV_LENGTH, combined.length - TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return decrypted.toString('utf8');
}

function encryptWith(key: Buffer, plaintext: string): string {
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return ENC_PREFIX + Buffer.concat([iv, encrypted, tag]).toString('base64');
}

async function main() {
  const oldKey = loadKey('PLAID_TOKEN_ENCRYPTION_KEY_OLD');
  const newKey = loadKey('PLAID_TOKEN_ENCRYPTION_KEY_NEW');

  if (oldKey.equals(newKey)) {
    throw new Error('OLD and NEW keys are identical — refusing to run a no-op rotation.');
  }

  const dryRun = process.env.DRY_RUN === '1' || process.env.DRY_RUN === 'true';
  const startedAt = new Date().toISOString();
  console.log(JSON.stringify({ ts: startedAt, event: 'rotation_start', dryRun }));

  let rotated = 0;
  let legacyUpgraded = 0;
  let failed = 0;
  let rowsTotal = 0;

  await db.transaction(async (tx) => {
    // Defense-in-depth: block any concurrent reader/writer of bank_accounts
    // for the duration of the transaction. Operators should also stop the
    // app workflow before running this; the lock just guarantees correctness
    // if they forget. ACCESS EXCLUSIVE conflicts with every other lock mode.
    await tx.execute(sql`LOCK TABLE ${bankAccounts} IN ACCESS EXCLUSIVE MODE`);

    const rows = await tx
      .select({ id: bankAccounts.id, token: bankAccounts.plaidAccessToken })
      .from(bankAccounts);
    rowsTotal = rows.length;
    console.log(JSON.stringify({ event: 'rows_loaded', count: rows.length }));

    for (const row of rows) {
      try {
        const wasLegacy = !row.token.startsWith(ENC_PREFIX);
        const plaintext = decryptWith(oldKey, row.token);
        if (!plaintext || plaintext.length < 8) {
          throw new Error('decrypted token failed sanity check (too short / empty)');
        }
        const reencrypted = encryptWith(newKey, plaintext);

        // Round-trip verify against new key before writing.
        const verify = decryptWith(newKey, reencrypted);
        if (verify !== plaintext) {
          throw new Error('round-trip verification with new key failed');
        }

        if (!dryRun) {
          await tx
            .update(bankAccounts)
            .set({ plaidAccessToken: reencrypted })
            .where(eq(bankAccounts.id, row.id));
        }

        if (wasLegacy) legacyUpgraded++;
        rotated++;
      } catch (err) {
        failed++;
        console.error(JSON.stringify({
          event: 'row_failed',
          bankAccountId: row.id,
          error: err instanceof Error ? err.message : String(err),
        }));
      }
    }

    if (failed > 0) {
      throw new Error(`${failed} row(s) failed to rotate — transaction rolled back, no changes committed.`);
    }
  });

  console.log(JSON.stringify({
    event: 'rotation_complete',
    dryRun,
    rowsTotal,
    rotated,
    legacyUpgraded,
    failed,
    finishedAt: new Date().toISOString(),
  }));

  if (dryRun) {
    console.log('DRY_RUN=1: no rows were written. Re-run without DRY_RUN to commit.');
  } else {
    console.log('Now update the PLAID_TOKEN_ENCRYPTION_KEY Replit Secret to the NEW key value and restart the workflow.');
  }
}

main()
  .then(() => pool.end())
  .catch(async (err) => {
    console.error(JSON.stringify({ event: 'rotation_failed', error: err instanceof Error ? err.message : String(err) }));
    await pool.end().catch(() => {});
    process.exit(1);
  });
