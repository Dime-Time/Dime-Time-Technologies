import {
  createContext,
  useContext,
  ReactNode,
} from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { clearAuthToken } from "@/lib/authToken";
import { getApiUrl } from "@/lib/queryClient";

interface User {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  profileImageUrl: string | null;
  createdAt: string | null;  // usually returned as ISO string from API
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

  const {
    data: user,
    isLoading,
    isError,
  } = useQuery<User | null>({
    queryKey: ["/api/user"],
    queryFn: async () => {
      // Always call the correct backend base URL and include cookies
      const res = await fetch(getApiUrl("/api/user"), {
        credentials: "include",
      });

      // Not authenticated – treat as a normal "no user" state
      if (res.status === 401) {
        return null;
      }

      if (!res.ok) {
        throw new Error(`Failed to load user: ${res.status}`);
      }

      const json = await res.json();

      // Support APIs that return { user: {...} } or just the user object directly
      if (json && typeof json === "object" && "user" in json) {
        return json.user as User;
      }

      return json as User;
    },
    retry: false,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // You are authenticated iff we have a user object.
  // Network errors (isError) no longer automatically force "logged out".
  const isAuthenticated = !!user && !isError;

  const login = () => {
    // Use backend login route – backend should set the auth cookie.
    // In native (Capacitor) this will hit the same domain that served the web app.
    window.location.href = getApiUrl("/api/login");
  };

  const logout = () => {
    // Clear any client-side token storage we might be using
    clearAuthToken();
    // Clear cached queries so we don't keep stale user data around
    queryClient.clear();
    // Hit backend logout endpoint to clear cookie/session
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
