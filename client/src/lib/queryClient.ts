import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { getAuthToken, hasStoredToken } from "./authToken";
import { setCorrelationTag } from "./sentry";

/**
 * Normalize a path so it always starts with "/".
 *
 * Examples:
 *   "api/user"   -> "/api/user"
 *   "/api/user"  -> "/api/user"
 */
function normalizePath(path: string): string {
  return path.startsWith("/") ? path : `/${path}`;
}

/**
 * Compute the base API URL.
 *
 * Priority:
 *   1) VITE_API_URL (for future staging / alternative backends)
 *   2) Native Capacitor (iOS/Android) -> https://dime-time.com
 *   3) Web -> same origin (empty base)
 */
function computeApiBaseUrl(): string {
  const rawEnv =
    (import.meta as any).env?.VITE_API_URL &&
    (import.meta as any).env.VITE_API_URL.trim();

  if (rawEnv) {
    return rawEnv.replace(/\/+$/, ""); // remove trailing slash
  }

  if (Capacitor.isNativePlatform()) {
    return "https://dime-time.com";
  }

  // Web browser – same origin backend, use relative URLs
  return "";
}

const API_BASE_URL = computeApiBaseUrl();

/**
 * Build a full API URL.
 *
 * Examples:
 *   getApiUrl("/api/user")
 *   getApiUrl("api/user")
 */
export function getApiUrl(path: string): string {
  const normalized = normalizePath(path);

  if (!API_BASE_URL) {
    // Same-origin mode (web): "/api/..." goes to current domain
    return normalized;
  }

  // Native / explicit base URL mode
  return `${API_BASE_URL}${normalized}`;
}

/**
 * Get headers for API calls (async for encrypted token retrieval).
 *
 * For native platforms:
 *   - If an auth token exists, send it as Authorization: Bearer <token>
 * For web:
 *   - Rely primarily on cookies (credentials: "include" in fetch)
 */
async function getAuthHeaders(): Promise<Record<string, string>> {
  const headers: Record<string, string> = {};

  if (Capacitor.isNativePlatform() && hasStoredToken()) {
    try {
      const token = await getAuthToken();
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
    } catch (err) {
      console.warn("Failed to retrieve auth token", err);
    }
  }

  return headers;
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // If the server returned a JSON error with a correlationId (transfer /
    // ACH paths do this — see server/routes/mercuryRoutes.ts), tag the
    // current Sentry scope so client-captured exceptions can be cross-
    // referenced with the server-side log + Sentry event for the same call.
    try {
      const parsed = JSON.parse(text);
      if (parsed && typeof parsed.correlationId === "string") {
        setCorrelationTag(parsed.correlationId);
      }
    } catch {
      // non-JSON body — nothing to correlate, fall through
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

/**
 * Generic API request helper for mutations / non-query calls.
 */
export async function apiRequest(
  method: string,
  url: string,
  data?: unknown,
  extraHeaders?: Record<string, string>
): Promise<Response> {
  const fullUrl = getApiUrl(url);
  const authHeaders = await getAuthHeaders();
  const headers: Record<string, string> = {
    ...authHeaders,
    ...(extraHeaders ?? {}),
  };

  if (data !== undefined) {
    headers["Content-Type"] = "application/json";
  }

  const res = await fetch(fullUrl, {
    method,
    headers,
    body: data !== undefined ? JSON.stringify(data) : undefined,
    credentials: "include", // send cookies for session-based auth
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";

/**
 * Shared queryFn factory – used by TanStack Query.
 *
 * For most queries we use on401="throw" so 401 behaves like an error.
 * For auth-specific hooks, you can use on401="returnNull" if needed.
 */
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  <T>({ on401: unauthorizedBehavior }: { on401: UnauthorizedBehavior }) =>
  async ({ queryKey }): Promise<T> => {
    const path = queryKey[0] as string;
    const url = getApiUrl(path);
    const authHeaders = await getAuthHeaders();

    const res = await fetch(url, {
      credentials: "include",
      headers: authHeaders,
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      // For things like /api/user when logged out
      return null as T;
    }

    await throwIfResNotOk(res);
    return (await res.json()) as T;
  };

/**
 * Global QueryClient used by the app.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
