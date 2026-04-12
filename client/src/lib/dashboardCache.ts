const CACHE_KEYS = {
  user:    'dt_cache_user',
  summary: 'dt_cache_summary',
  debts:   'dt_cache_debts',
} as const;

const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

interface CacheEntry<T> {
  data: T;
  ts: number;
}

function write<T>(key: string, data: T): void {
  try {
    const entry: CacheEntry<T> = { data, ts: Date.now() };
    localStorage.setItem(key, JSON.stringify(entry));
  } catch {}
}

function read<T>(key: string): T | undefined {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return undefined;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts > CACHE_TTL_MS) {
      localStorage.removeItem(key);
      return undefined;
    }
    return entry.data;
  } catch {
    return undefined;
  }
}

export function cacheUser(user: unknown): void      { write(CACHE_KEYS.user, user); }
export function cacheDebts(debts: unknown): void    { write(CACHE_KEYS.debts, debts); }
export function cacheSummary(summary: unknown): void { write(CACHE_KEYS.summary, summary); }

export function getCachedUser<T>(): T | undefined      { return read<T>(CACHE_KEYS.user); }
export function getCachedDebts<T>(): T | undefined     { return read<T>(CACHE_KEYS.debts); }
export function getCachedSummary<T>(): T | undefined   { return read<T>(CACHE_KEYS.summary); }

export function clearDashboardCache(): void {
  try {
    Object.values(CACHE_KEYS).forEach(k => localStorage.removeItem(k));
  } catch {}
}
