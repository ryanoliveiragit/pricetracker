const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/api\/?$/, "");

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

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return (await response.json()) as T;
}

// Suppliers API
export const suppliersApi = {
  async getAll(): Promise<ApiSupplier[]> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers`);
    return parseResponse<ApiSupplier[]>(response);
  },

  async getById(id: string): Promise<ApiSupplier> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`);
    return parseResponse<ApiSupplier>(response);
  },

  async create(supplier: Omit<ApiSupplier, "id" | "createdAt">): Promise<ApiSupplier> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...supplier,
        createdAt: new Date().toISOString()
      })
    });
    return parseResponse<ApiSupplier>(response);
  },

  async update(id: string, supplier: Partial<ApiSupplier>): Promise<ApiSupplier> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(supplier)
    });
    return parseResponse<ApiSupplier>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/suppliers/${id}`, {
      method: "DELETE"
    });
    if (!response.ok && response.status !== 404) {
      throw new Error(`API error ${response.status}`);
    }
  }
};

// Products API
export const productsApi = {
  async getAll(): Promise<ApiProduct[]> {
    const response = await fetch(`${API_BASE_URL}/api/products`);
    return parseResponse<ApiProduct[]>(response);
  },

  async getById(id: string): Promise<ApiProduct> {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`);
    return parseResponse<ApiProduct>(response);
  },

  async create(product: Omit<ApiProduct, "id" | "createdAt">): Promise<ApiProduct> {
    const response = await fetch(`${API_BASE_URL}/api/products`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...product,
        createdAt: new Date().toISOString()
      })
    });
    return parseResponse<ApiProduct>(response);
  },

  async update(id: string, product: Partial<ApiProduct>): Promise<ApiProduct> {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(product)
    });
    return parseResponse<ApiProduct>(response);
  },

  async delete(id: string): Promise<void> {
    const response = await fetch(`${API_BASE_URL}/api/products/${id}`, {
      method: "DELETE"
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
      body: formData,
    });
    if (!response.ok) {
      const err = await response.json().catch(() => ({ detail: "Erro ao importar CSV" }));
      throw new Error(err.detail || `API error ${response.status}`);
    }
    return response.json();
  }
};

// Busca de produtos agora é feita via searchApi.ts (chama o backend Python diretamente)

// Auth API
export const authApi = {
  async login(email: string, password: string): Promise<{ success: boolean; message?: string; user?: { email: string; name?: string; role?: string }; token?: string }> {
    console.log('🔐 Login mockado - sem requisições de rede');
    
    // Validação básica
    const validEmail = email.trim().length > 3;
    const validPassword = password.trim().length >= 4;
    
    if (!validEmail || !validPassword) {
      console.log('❌ Validação falhou');
      return { success: false, message: 'Email ou senha inválidos' };
    }
    
    // Login mockado - aceita qualquer email/senha válidos para desenvolvimento
    let inferredRole = "funcionario";
    if (email.toLowerCase().includes("admin")) inferredRole = "admin";
    else if (email.toLowerCase().includes("gestor")) inferredRole = "gestor";
    else if (email.toLowerCase().includes("user") || email.toLowerCase().includes("usuario")) inferredRole = "usuario";

    console.log('✅ Login mockado aceito:', inferredRole);
    return {
      success: true,
      message: 'Login realizado com sucesso',
      user: {
        email: email.trim(),
        name: email.trim().split('@')[0],
        role: inferredRole
      },
      token: `mock-token-${Date.now()}`
    };
  }
};
