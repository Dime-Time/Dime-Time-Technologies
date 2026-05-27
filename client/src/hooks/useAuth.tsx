import {
  createContext,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { clearAuthToken, getAuthToken, hasStoredToken } from "@/lib/authToken";
import { getApiUrl } from "@/lib/queryClient";
import { getCachedUser, cacheUser, clearDashboardCache } from "@/lib/dashboardCache";

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
}

interface AuthContextType {
  user: User | null;
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
    <AuthContext.Provider value={{ user: user || null, isLoading, isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
