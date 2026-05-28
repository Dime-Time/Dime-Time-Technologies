import type { Request, Response, NextFunction } from "express";
import { getUserIdFromRequest } from "../middleware/authHelper";

function parseAdminIds(): Set<string> {
  const raw = process.env.ADMIN_USER_IDS ?? "";
  return new Set(
    raw
      .split(",")
      .map((s) => s.trim())
      .filter((s) => s.length > 0),
  );
}

let cached: Set<string> | null = null;
function adminIds(): Set<string> {
  if (cached === null) cached = parseAdminIds();
  return cached;
}

export function isAdminUserId(userId: string | null | undefined): boolean {
  if (!userId) return false;
  return adminIds().has(userId);
}

export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  const userId = getUserIdFromRequest(req);
  if (!userId) {
    return res.status(401).json({ message: "Not authenticated" });
  }
  if (!isAdminUserId(userId)) {
    return res.status(403).json({ message: "Forbidden" });
  }
  (req as any).adminUserId = userId;
  next();
}
