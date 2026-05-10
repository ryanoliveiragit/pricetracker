"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
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

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(() => readStoredUser());

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

    const session: UserSession = {
      email: authResult.user.email,
      displayName: authResult.user.name ?? authResult.user.email.split("@")[0],
      role: authResult.user.role ?? "funcionario",
      token: authResult.token ?? "",
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
