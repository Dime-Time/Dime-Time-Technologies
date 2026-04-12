import {
  createContext,
  useContext,
  useEffect,
  ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clearAuthToken } from "@/lib/authToken";
import { getApiUrl } from "@/lib/queryClient";
import { getCachedUser, cacheUser, clearDashboardCache } from "@/lib/dashboardCache";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
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

  // Load cached user so the app can render immediately on warm starts.
  // initialDataUpdatedAt: 0 ensures the query always runs in the background
  // to validate the session, even when cached data is present.
  const cachedUser = getCachedUser<User>();

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      const res = await fetch(getApiUrl("/api/user"), {
        credentials: "include",
      });

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
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    // Seed the query with cached data so isLoading is false on warm starts.
    // initialDataUpdatedAt: 0 means React Query treats it as stale and
    // immediately fires a background fetch to confirm the session is still valid.
    initialData: cachedUser ?? undefined,
    initialDataUpdatedAt: 0,
  });

  // Persist fresh user data to cache whenever it arrives
  useEffect(() => {
    if (user) {
      cacheUser(user);
    }
  }, [user]);

  // If the background /api/user fetch returns null (401), the cached user
  // data is replaced with null, making isAuthenticated false and sending
  // the user to the login screen.
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

  const authValue: AuthContextType = {
    user: user || null,
    isLoading,
    isAuthenticated,
    login,
    logout,
  };

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export { AuthContext };
