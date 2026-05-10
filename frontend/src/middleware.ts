import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const host = request.headers.get("host") ?? "";
  const hostname = host.split(":")[0]; // strip port (e.g. "cocacola.localhost:3000" → "cocacola.localhost")
  const requestHeaders = new Headers(request.headers);

  // Extract subdomain:
  //   slug.localhost           (dev, 2 parts)
  //   slug.pricetracker.com.br (prod, 3+ parts)
  const parts = hostname.split(".");
  const reserved = new Set(["www", "admin", "api"]);
  let tenantSlug: string | null = null;

  if (parts.length === 2 && parts[1] === "localhost" && !reserved.has(parts[0])) {
    tenantSlug = parts[0];
  } else if (parts.length >= 3 && !reserved.has(parts[0])) {
    tenantSlug = parts[0];
  }

  // Dev fallback: use NEXT_PUBLIC_DEFAULT_TENANT env var
  if (!tenantSlug) {
    tenantSlug = process.env.NEXT_PUBLIC_DEFAULT_TENANT ?? null;
  }

  if (tenantSlug) {
    requestHeaders.set("x-tenant-slug", tenantSlug);
  }

  return NextResponse.next({ request: { headers: requestHeaders } });
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
