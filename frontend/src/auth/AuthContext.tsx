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

  // Session restore on refresh — still uses /me (OK; not on the login path).
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
    const { user: me } = await apiLogin(email, password);
    setUser(me);
  }

  async function signup(email: string, password: string) {
    // Single round-trip: /createuser now returns a JWT + user session.
    const { user: me } = await apiSignup(email, password);
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
