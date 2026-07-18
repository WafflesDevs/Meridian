import { createContext, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import {
  clearToken,
  fetchMe,
  getToken,
  login as apiLogin,
  signup as apiSignup,
} from "../api";
import type { CurrentUser } from "../api";

type AuthContextValue = {
  user: CurrentUser | null;
  loading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  signup: (email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    if (!getToken()) {
      setLoading(false);
      return;
    }
    fetchMe()
      .then((me) => {
        if (!cancelled) setUser(me);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function login(email: string, password: string) {
    await apiLogin(email, password);
    const me = await fetchMe();
    setUser(me);
  }

  async function signup(email: string, password: string) {
    await apiSignup(email, password);
    // Auto-login right after account creation.
    await apiLogin(email, password);
    const me = await fetchMe();
    setUser(me);
  }

  function logout() {
    clearToken();
    setUser(null);
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        isAuthenticated: Boolean(user),
        login,
        signup,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
