import {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { clearAuthToken, getAuthToken, hasStoredToken } from "@/lib/authToken";
import { getApiUrl } from "@/lib/queryClient";
import { getCachedUser, cacheUser, clearDashboardCache } from "@/lib/dashboardCache";
import { DEFAULT_FLAGS, type FlagMap } from "@shared/flags";

const USER_FETCH_TIMEOUT_MS = 8000;

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  emailVerifiedAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  isAdmin?: boolean;
}

interface AuthContextType {
  user: User | null;
  /**
   * Feature flag map resolved server-side and piggybacked onto the
   * /api/user bootstrap response. Falls back to compile-time defaults
   * before the bootstrap arrives or when the user is unauthenticated.
   */
  flags: FlagMap;
  isLoading: boolean;
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const cachedUser = getCachedUser<User>();
  // Flags live in local state instead of in the React Query cache so they
  // can survive a 401 (when the user query data becomes null but the
  // server still sent a flag map). Seeded with compile-time defaults so
  // useFlag never returns undefined.
  const [flags, setFlags] = useState<FlagMap>(DEFAULT_FLAGS);

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const t0 = performance.now();
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        controller.abort();
        console.error(`[DimeTime] /api/user timed out after ${USER_FETCH_TIMEOUT_MS}ms — weak network or server issue`);
      }, USER_FETCH_TIMEOUT_MS);

      try {
        // On native (Capacitor) the WebView origin is capacitor://localhost,
        // so cross-origin cookies to dime-time.com won't be sent. Attach the
        // Bearer token instead — same pattern queryClient.ts uses for all
        // other API calls.
        const headers: Record<string, string> = {};
        if (Capacitor.isNativePlatform() && hasStoredToken()) {
          try {
            const token = await getAuthToken();
            if (token) {
              headers["Authorization"] = `Bearer ${token}`;
            }
          } catch (err) {
            console.warn("[DimeTime] failed to attach bearer token to /api/user", err);
          }
        }

        const res = await fetch(getApiUrl("/api/user"), {
          credentials: "include",
          signal: controller.signal,
          headers,
        });
        clearTimeout(timeoutId);
        console.log(`[DimeTime] /api/user responded in ${(performance.now() - t0).toFixed(0)}ms (status ${res.status})`);

        if (res.status === 401) {
          return null;
        }

        if (!res.ok) {
          throw new Error(`Failed to load user: ${res.status}`);
        }

        const json = await res.json();

        // Extract `_flags` envelope if present. The server piggybacks the
        // resolved feature flag map onto /api/user so we get flags in the
        // same cold-start request (important on iOS WebView). `_flags` is
        // stripped from the User object before it's cached.
        if (json && typeof json === "object" && ("_flags" in json || "_isAdmin" in json)) {
          const { _flags, _isAdmin, ...userOnly } = json as Record<string, unknown> & {
            _flags?: Partial<FlagMap>;
            _isAdmin?: boolean;
          };
          if (_flags && typeof _flags === "object") {
            setFlags({ ...DEFAULT_FLAGS, ..._flags });
          }
          if ("user" in userOnly) {
            const u = (userOnly as { user: User }).user;
            return { ...u, isAdmin: Boolean(_isAdmin) };
          }
          return { ...(userOnly as unknown as User), isAdmin: Boolean(_isAdmin) };
        }

        if (json && typeof json === "object" && "user" in json) {
          return json.user as User;
        }

        return json as User;
      } catch (err: any) {
        clearTimeout(timeoutId);
        if (err.name === "AbortError") {
          console.error(`[DimeTime] /api/user aborted (timeout) after ${(performance.now() - t0).toFixed(0)}ms`);
        } else {
          console.error(`[DimeTime] /api/user fetch error after ${(performance.now() - t0).toFixed(0)}ms:`, err.message);
        }
        throw err;
      }
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    // Seed with cached user so isLoading is false on warm starts.
    // initialDataUpdatedAt: 0 forces an immediate background re-fetch
    // to validate the session even when cached data is present.
    initialData: cachedUser ?? undefined,
    initialDataUpdatedAt: 0,
  });

  // Persist confirmed user to cache
  useEffect(() => {
    if (user) {
      cacheUser(user);
    }
  }, [user]);

  const isAuthenticated = !!user && !isError;

  const login = () => {
    window.location.href = getApiUrl("/api/login");
  };

  const logout = () => {
    clearAuthToken();
    clearDashboardCache();
    queryClient.clear();
    window.location.href = getApiUrl("/api/logout");
  };

  return (
    <AuthContext.Provider value={{ user: user || null, flags, isLoading, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
