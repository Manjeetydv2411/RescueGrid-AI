import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";

import { authApi, tokenStore } from "../services/api";
import type { User, UserRole } from "../types/api";

interface AuthContextValue {
  user: User | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<User>;
  register: (data: {
    name: string;
    email: string;
    password: string;
    phone?: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  hasRole: (...roles: UserRole[]) => boolean;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  /**
   * Restore the session on mount.
   *
   * The stored access token is only trusted to *attempt* a request; the
   * authoritative profile comes from GET /api/v1/auth/me. If that call fails
   * (expired or revoked token) the session is cleared.
   */
  useEffect(() => {
    let cancelled = false;

    const restore = async () => {
      const token = tokenStore.getAccessToken();
      if (!token) {
        if (!cancelled) setIsLoading(false);
        return;
      }

      try {
        const profile = await authApi.getMe();
        if (!cancelled) setUser(profile);
      } catch {
        tokenStore.clear();
        if (!cancelled) setUser(null);
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    };

    void restore();
    return () => {
      cancelled = true;
    };
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<User> => {
    const result = await authApi.login({ email, password });
    tokenStore.set(result.accessToken, result.refreshToken);
    setUser(result.user);
    return result.user;
  }, []);

  const register = useCallback(
    async (data: {
      name: string;
      email: string;
      password: string;
      phone?: string;
    }) => {
      await authApi.register(data);
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Always clear local credentials, even if the server call fails.
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  const refreshProfile = useCallback(async () => {
    try {
      const profile = await authApi.getMe();
      setUser(profile);
    } catch {
      tokenStore.clear();
      setUser(null);
    }
  }, []);

  const hasRole = useCallback(
    (...roles: UserRole[]) => (user ? roles.includes(user.role) : false),
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: !!user,
      isLoading,
      login,
      register,
      logout,
      refreshProfile,
      hasRole,
    }),
    [user, isLoading, login, register, logout, refreshProfile, hasRole]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = (): AuthContextValue => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
};

export default AuthProvider;
