"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { getTenantSlug } from "../services/headers";

export interface TenantSettings {
  app_name?: string;
  logo_url?: string;
  primary_color?: string;
  accent_color?: string;
}

export interface TenantInfo {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: TenantSettings;
  isActive: boolean;
}

interface TenantContextValue {
  tenant: TenantInfo | null;
  tenantSlug: string | null;
  isLoading: boolean;
}

const TenantContext = createContext<TenantContextValue | undefined>(undefined);

function hexToRgbTriplet(hex: string): string | null {
  const clean = hex.replace("#", "");
  if (clean.length !== 6) return null;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
  return `${r} ${g} ${b}`;
}

function darkenHex(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const r = Math.max(0, parseInt(clean.slice(0, 2), 16) - amount);
  const g = Math.max(0, parseInt(clean.slice(2, 4), 16) - amount);
  const b = Math.max(0, parseInt(clean.slice(4, 6), 16) - amount);
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function applyTenantBranding(settings: TenantSettings) {
  const root = document.documentElement;

  if (settings.primary_color) {
    const rgb500 = hexToRgbTriplet(settings.primary_color);
    const rgb600 = hexToRgbTriplet(darkenHex(settings.primary_color, 25));
    const rgb50 = hexToRgbTriplet(settings.primary_color + "10") ?? "239 246 255";
    if (rgb500) root.style.setProperty("--primary-500", rgb500);
    if (rgb600) root.style.setProperty("--primary-600", rgb600);
    // light tint for backgrounds
    root.style.setProperty("--primary-50", rgb50);
    // also store raw hex for components that use it directly
    root.style.setProperty("--tenant-primary", settings.primary_color);
  }

  if (settings.accent_color) {
    root.style.setProperty("--tenant-accent", settings.accent_color);
  }

  if (settings.app_name) {
    document.title = settings.app_name;
  }
}

export function TenantProvider({ children }: { children: ReactNode }) {
  const [tenant, setTenant] = useState<TenantInfo | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const tenantSlug = useMemo(() => getTenantSlug(), []);

  useEffect(() => {
    if (!tenantSlug) {
      setIsLoading(false);
      return;
    }

    const API_BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/api\/?$/, "");

    fetch(`${API_BASE}/api/tenant/me`, {
      headers: { "X-Tenant-Slug": tenantSlug },
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: TenantInfo | null) => {
        if (data) {
          setTenant(data);
          applyTenantBranding(data.settings);
        }
      })
      .catch(() => null)
      .finally(() => setIsLoading(false));
  }, [tenantSlug]);

  const value = useMemo<TenantContextValue>(
    () => ({ tenant, tenantSlug, isLoading }),
    [tenant, tenantSlug, isLoading]
  );

  return <TenantContext.Provider value={value}>{children}</TenantContext.Provider>;
}

export function useTenant(): TenantContextValue {
  const ctx = useContext(TenantContext);
  if (!ctx) throw new Error("useTenant deve ser usado dentro de TenantProvider");
  return ctx;
}
