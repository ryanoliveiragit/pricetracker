/** Shared header helpers for all API service files. */

const AUTH_STORAGE_KEY = "construprice-auth";

export function getTenantSlug(): string | null {
  if (typeof window === "undefined") return process.env.NEXT_PUBLIC_DEFAULT_TENANT ?? null;
  const hostname = window.location.hostname; // e.g. "cocacola.localhost" or "cocacola.pricetracker.com.br"
  const parts = hostname.split(".");
  const reserved = new Set(["www", "admin", "api"]);

  // slug.localhost (dev: 2 parts)
  if (parts.length === 2 && parts[1] === "localhost" && !reserved.has(parts[0])) {
    return parts[0];
  }
  // slug.domain.tld or slug.domain.tld2 (prod: 3+ parts)
  if (parts.length >= 3 && !reserved.has(parts[0])) {
    return parts[0];
  }
  return process.env.NEXT_PUBLIC_DEFAULT_TENANT ?? null;
}

/** Returns the base domain for building tenant URLs (self-configuring, no env var needed). */
function getBaseDomain(): string {
  if (typeof window === "undefined") {
    return process.env.NEXT_PUBLIC_BASE_DOMAIN ?? "pricetracker.com.br";
  }
  const { hostname, port } = window.location;
  const portSuffix = port ? `:${port}` : "";
  if (hostname === "localhost") return `localhost${portSuffix}`;
  if (hostname.endsWith(".localhost")) return `localhost${portSuffix}`;
  const parts = hostname.split(".");
  // Strip leading subdomain if present (3+ parts → base is parts[1..])
  return parts.length >= 3 ? parts.slice(1).join(".") : hostname;
}

/** Returns the full access URL for a tenant — works in dev and prod. */
export function getTenantUrl(slug: string): string {
  const base = getBaseDomain();
  const protocol = base.startsWith("localhost") ? "http" : "https";
  return `${protocol}://${slug}.${base}`;
}

export function getStoredToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    return (JSON.parse(raw) as { token?: string }).token ?? null;
  } catch {
    return null;
  }
}

export function baseHeaders(extra: Record<string, string> = {}): Record<string, string> {
  const headers: Record<string, string> = { "Content-Type": "application/json", ...extra };
  const slug = getTenantSlug();
  if (slug) headers["X-Tenant-Slug"] = slug;
  const token = getStoredToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export function formDataHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};
  const slug = getTenantSlug();
  if (slug) headers["X-Tenant-Slug"] = slug;
  const token = getStoredToken();
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}
