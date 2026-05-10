import { getTenantSlug, baseHeaders, formDataHeaders as formHeaders } from "./headers";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/api\/?$/, "");

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ApiSupplier {
  id: string;
  name: string;
  url: string;
  logo?: string;
  requiresLogin: boolean;
  username?: string;
  password?: string;
  isActive: boolean;
  region?: string;
  notes?: string;
  createdBy?: string;
  createdAt: string;
}

export interface ApiProduct {
  id: string;
  name: string;
  category: string;
  brand?: string;
  unit?: string;
  logo?: string;
  notes?: string;
  variants?: string[];
  createdAt: string;
}

export interface ApiSearchResult {
  id: string;
  query: string;
  rawQuery: string;
  offers: Array<{
    store: string;
    price: number;
    currency: string;
    availability: string;
    productUrl: string;
  }>;
}

export class LoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginError";
  }
}

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    if (response.status === 422) {
      const body = await response.json().catch(() => null);
      const detail = body?.detail;
      if (detail?.login_error) {
        throw new LoginError(detail.message ?? "Login falhou — verifique as credenciais");
      }
    }
    throw new Error(`API error ${response.status}`);
  }
  return (await response.json()) as T;
}

// ─── Suppliers API ────────────────────────────────────────────────────────────

export const suppliersApi = {
  async getAll(): Promise<ApiSupplier[]> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers`, { headers: baseHeaders() });
    return parseResponse<ApiSupplier[]>(response);
  },

  async getById(id: string): Promise<ApiSupplier> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, { headers: baseHeaders() });
    return parseResponse<ApiSupplier>(response);
  },

  async create(supplier: Omit<ApiSupplier, "id" | "createdAt">): Promise<ApiSupplier> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ ...supplier, createdAt: new Date().toISOString() }),
    });
    return parseResponse<ApiSupplier>(response);
  },

  async update(id: string, supplier: Partial<ApiSupplier>): Promise<ApiSupplier> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
      method: "PATCH",
      headers: baseHeaders(),
      body: JSON.stringify(supplier),
    });
    return parseResponse<ApiSupplier>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
      method: "DELETE",
      headers: baseHeaders(),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`API error ${response.status}`);
    }
  },
};

// ─── Products API ─────────────────────────────────────────────────────────────

export const productsApi = {
  async getAll(): Promise<ApiProduct[]> {
    const response = await fetch(`${API_BASE_URL}/api/products`, { headers: baseHeaders() });
    return parseResponse<ApiProduct[]>(response);
  },

  async getById(id: string): Promise<ApiProduct> {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`, { headers: baseHeaders() });
    return parseResponse<ApiProduct>(response);
  },

  async create(product: Omit<ApiProduct, "id" | "createdAt">): Promise<ApiProduct> {
    const response = await fetch(`${API_BASE_URL}/api/products`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ ...product, createdAt: new Date().toISOString() }),
    });
    return parseResponse<ApiProduct>(response);
  },

  async update(id: string, product: Partial<ApiProduct>): Promise<ApiProduct> {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: "PATCH",
      headers: baseHeaders(),
      body: JSON.stringify(product),
    });
    return parseResponse<ApiProduct>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: "DELETE",
      headers: baseHeaders(),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`API error ${response.status}`);
    }
  },

  async importCsv(file: File): Promise<{ imported: number; skipped: number; products: ApiProduct[] }> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${API_BASE_URL}/api/products/import-csv`, {
      method: "POST",
      headers: formHeaders(),
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Erro ao importar CSV" }));
      throw new Error(err.detail || `API error ${response.status}`);
    }
    return response.json();
  },
};

// ─── Search API ───────────────────────────────────────────────────────────────

export interface SearchSuggestion {
  name: string;
  brand: string;
  category: string;
}

export const searchApi = {
  async suggestions(q: string): Promise<{ products: SearchSuggestion[]; synonyms: string[]; has_match: boolean }> {
    const response = await fetch(
      `${API_BASE_URL}/api/search/suggestions?q=${encodeURIComponent(q)}`,
      { headers: baseHeaders() }
    );
    if (!response.ok) return { products: [], synonyms: [], has_match: false };
    return response.json();
  },
};

// ─── Auth API ─────────────────────────────────────────────────────────────────

export const authApi = {
  async login(
    email: string,
    password: string
  ): Promise<{ success: boolean; message?: string; user?: { email: string; name?: string; role?: string }; token?: string }> {
    const slug = getTenantSlug();

    if (!slug) {
      // No tenant context (root domain / localhost) → try super-admin login
      const response = await fetch(`${API_BASE_URL}/api/auth/super-admin/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      if (!response.ok) {
        throw new Error(`Erro ao conectar com servidor: ${response.status}`);
      }
      const data = await response.json();
      return { success: true, user: data.user, token: data.token };
    }

    // Tenant-scoped login
    const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify({ email, password }),
    });

    if (!response.ok) {
      throw new Error(`Erro ao conectar com servidor: ${response.status}`);
    }

    const data = await response.json();

    if (!data.success || !data.user) {
      return { success: false, message: data.message || "Credenciais inválidas" };
    }

    return { success: true, message: data.message, user: data.user, token: data.token };
  },
};

// ─── Tenants API (super admin) ────────────────────────────────────────────────

export interface ApiTenant {
  id: string;
  name: string;
  slug: string;
  plan: string;
  settings: {
    app_name?: string;
    logo_url?: string;
    primary_color?: string;
    accent_color?: string;
  };
  isActive: boolean;
  userCount: number;
  createdAt: string;
}

export const tenantsApi = {
  async getAll(): Promise<ApiTenant[]> {
    const response = await fetch(`${API_BASE_URL}/api/tenants`, { headers: baseHeaders() });
    return parseResponse<ApiTenant[]>(response);
  },

  async create(data: { name: string; slug: string; plan: string; settings?: Record<string, string> }): Promise<ApiTenant> {
    const response = await fetch(`${API_BASE_URL}/api/tenants`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(data),
    });
    return parseResponse<ApiTenant>(response);
  },

  async update(id: string, data: Partial<ApiTenant>): Promise<ApiTenant> {
    const response = await fetch(`${API_BASE_URL}/api/tenants/${id}`, {
      method: "PATCH",
      headers: baseHeaders(),
      body: JSON.stringify(data),
    });
    return parseResponse<ApiTenant>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/tenants/${id}`, {
      method: "DELETE",
      headers: baseHeaders(),
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`API error ${response.status}`);
    }
  },

  async checkSlug(slug: string): Promise<{ available: boolean; reason: string | null }> {
    const response = await fetch(
      `${API_BASE_URL}/api/tenants/check-slug?slug=${encodeURIComponent(slug)}`
    );
    return parseResponse(response);
  },

  async signup(data: {
    company_name: string;
    app_name?: string;
    slug: string;
    plan?: string;
    admin_nome: string;
    admin_email: string;
    admin_password: string;
    primary_color?: string;
    accent_color?: string;
    logo_url?: string;
  }): Promise<{
    token: string;
    tenant: ApiTenant;
    user: { id: number; nome: string; email: string; role: string };
    loginUrl: string;
  }> {
    const response = await fetch(`${API_BASE_URL}/api/tenants/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    return parseResponse(response);
  },

  async createAdmin(
    tenantId: string,
    data: { nome: string; email: string; password: string }
  ): Promise<{ id: number; email: string; nome: string; role: string }> {
    const response = await fetch(`${API_BASE_URL}/api/tenants/${tenantId}/users`, {
      method: "POST",
      headers: baseHeaders(),
      body: JSON.stringify(data),
    });
    return parseResponse(response);
  },
};
