"use client";

import { createContext, useContext, useMemo, useState, type ReactNode } from "react";
import { authApi } from "../services/api";

interface UserSession {
  email: string;
  displayName: string;
  role: string;
}

interface AuthContextValue {
  user: UserSession | null;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
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
      parsed.role = "admin"; // Fallback for older sessions without role
    }
    return parsed;
  } catch {
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
      role: authResult.user.role ?? "funcionario"
    };

    localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(session));
    setUser(session);
  }

  function logout(): void {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    setUser(null);
  }

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      isAuthenticated: Boolean(user),
      login,
      logout
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
