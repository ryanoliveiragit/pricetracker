"use client";

import { createContext, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { authApi } from "../services/api";
import { usersApi } from "../services/usersApi";

interface UserSession {
  email: string;
  displayName: string;
  role: string;
  token: string;
  avatar?: string;
  tenantSlug?: string;
  tenantId?: string;
}

interface AuthContextValue {
  user: UserSession | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  updateUser: (updates: Partial<Pick<UserSession, "displayName" | "avatar">>) => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

const AUTH_STORAGE_KEY = "construprice-auth";

function readStoredUser(): UserSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  const raw = localStorage.getItem(AUTH_STORAGE_KEY);

  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as UserSession;
    if (!parsed.role) {
      parsed.role = "admin";
    }
    if (!parsed.token) {
      localStorage.removeItem(AUTH_STORAGE_KEY);
      return null;
    }
    return parsed;
  } catch {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    return null;
  }
}

function decodeJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(base64)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

const REFRESH_INTERVAL_MS = 30 * 60 * 1000; // 30 min
const REFRESH_THRESHOLD_S = 60 * 60; // refresh se restar < 1h

function tokenExpiresInSeconds(token: string): number {
  const payload = decodeJwtPayload(token);
  const exp = payload?.exp as number | undefined;
  if (!exp) return 0;
  return exp - Math.floor(Date.now() / 1000);
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(() => readStoredUser());
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function tryRefresh(currentUser: UserSession): Promise<boolean> {
    if (tokenExpiresInSeconds(currentUser.token) > REFRESH_THRESHOLD_S) return true;
    const newToken = await authApi.refresh(currentUser.token);
    if (!newToken) return false;
    const updated = { ...currentUser, token: newToken };
    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
    setUser(updated);
    return true;
  }

  useEffect(() => {
    if (!user) return;

    // Ao carregar: verifica se o token precisa ser renovado (inclui já expirados)
    void tryRefresh(user).then(ok => {
      if (!ok) {
        // Refresh falhou (token expirado há mais de 7 dias) → força novo login
        localStorage.removeItem(AUTH_STORAGE_KEY);
        setUser(null);
      }
    });

    intervalRef.current = setInterval(() => {
      setUser(prev => {
        if (prev) void tryRefresh(prev);
        return prev;
      });
    }, REFRESH_INTERVAL_MS);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user?.token]);

  async function login(email: string, password: string): Promise<void> {
    const validEmail = email.trim().length > 3;
    const validPassword = password.trim().length >= 4;

    if (!validEmail || !validPassword) {
      throw new Error("Informe credenciais válidas para acessar o painel");
    }

    const authResult = await authApi.login(email.trim(), password.trim());
    if (!authResult.success || !authResult.user) {
      throw new Error("Credenciais inválidas");
    }

    const jwtPayload = decodeJwtPayload(authResult.token ?? "");

    const session: UserSession = {
      email: authResult.user.email,
      displayName: authResult.user.name ?? authResult.user.email.split("@")[0],
      role: authResult.user.role ?? "funcionario",
      token: authResult.token ?? "",
      tenantSlug: (jwtPayload?.tenant_slug as string) ?? undefined,
      tenantId: (jwtPayload?.tenant_id as string) ?? undefined,
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));

    // Fetch avatar from user profile
    try {
      const profile = await usersApi.getMe();
      const updated = { ...session, avatar: profile.avatar || undefined, displayName: profile.nome || session.displayName };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      setUser(updated);
    } catch {
      setUser(session);
    }
  }

  function logout(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  }

  function updateUser(updates: Partial<Pick<UserSession, "displayName" | "avatar">>): void {
    setUser(prev => {
      if (!prev) return null;
      const updated = { ...prev, ...updates };
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(updated));
      return updated;
    });
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout,
      updateUser
    }),
    [user]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error("useAuth deve ser usado dentro de AuthProvider");
  }

  return context;
}
