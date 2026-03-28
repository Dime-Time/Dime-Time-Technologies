import { createHash } from 'crypto';
import type { Request } from 'express';

function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret) throw new Error('SESSION_SECRET environment variable is required');
  return secret;
}

function verifyAuthToken(token: string): string | null {
  try {
    const decoded = Buffer.from(token, 'base64').toString('utf-8');
    const [userId, timestampStr, signature] = decoded.split(':');
    const payload = `${userId}:${timestampStr}`;
    const expectedSignature = createHash('sha256')
      .update(payload + getSessionSecret())
      .digest('hex')
      .substring(0, 16);
    if (signature !== expectedSignature) return null;
    const timestamp = parseInt(timestampStr, 10);
    const thirtyDays = 30 * 24 * 60 * 60 * 1000;
    if (Date.now() - timestamp > thirtyDays) return null;
    return userId;
  } catch {
    return null;
  }
}

export function getUserIdFromRequest(req: Request): string | null {
  const sessionUserId = (req.session as any)?.userId;
  if (sessionUserId) return sessionUserId;
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    return verifyAuthToken(authHeader.substring(7));
  }
  return null;
}
