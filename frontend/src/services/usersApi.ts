/**
 * usersApi — CRUD real de funcionários conectado ao backend FastAPI.
 * Base URL vem de NEXT_PUBLIC_API_BASE_URL (ex: http://localhost:8000)
 */

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/api\/?$/, "");
const AUTH_STORAGE_KEY = "construprice-auth";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(AUTH_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    return parsed.token ?? null;
  } catch {
    return null;
  }
}

function authHeaders(): HeadersInit {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
  };
}

export interface ApiUser {
  id: number;
  nome: string;
  email: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  avatar?: string;
  role: string;
  is_active: boolean;
  parent_id?: number | null;
  created_at?: string | null;
}

export interface UserCreatePayload {
  nome: string;
  email: string;
  password: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  avatar?: string;
  role?: string;
  parent_id?: number | null;
}

export interface UserUpdatePayload {
  nome?: string;
  telefone?: string;
  empresa?: string;
  cargo?: string;
  avatar?: string;
  role?: string;
  is_active?: boolean;
  password?: string;
}

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

export const usersApi = {
  /** Retorna dados do usuário logado */
  async getMe(): Promise<ApiUser> {
    const res = await fetch(`${BASE}/api/users/me`, {
      headers: authHeaders(),
    });
    return handleResponse<ApiUser>(res);
  },

  /** Edita dados do usuário logado */
  async updateMe(payload: UserUpdatePayload): Promise<ApiUser> {
    const res = await fetch(`${BASE}/api/users/me`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<ApiUser>(res);
  },

  /** Lista todos os usuários/funcionários */
  async getAll(): Promise<ApiUser[]> {
    const res = await fetch(`${BASE}/api/users`, {
      headers: authHeaders(),
    });
    return handleResponse<ApiUser[]>(res);
  },

  /** Cria funcionário */
  async create(payload: UserCreatePayload): Promise<ApiUser> {
    const res = await fetch(`${BASE}/api/users`, {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<ApiUser>(res);
  },

  /** Edita dados de um usuário */
  async update(id: number, payload: UserUpdatePayload): Promise<ApiUser> {
    const res = await fetch(`${BASE}/api/users/${id}`, {
      method: "PATCH",
      headers: authHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<ApiUser>(res);
  },

  /** Alterna is_active (ativo ↔ suspenso) */
  async toggleStatus(id: number): Promise<ApiUser> {
    const res = await fetch(`${BASE}/api/users/${id}/toggle-status`, {
      method: "PATCH",
      headers: authHeaders(),
    });
    return handleResponse<ApiUser>(res);
  },

  /** Remove permanentemente */
  async delete(id: number): Promise<void> {
    const res = await fetch(`${BASE}/api/users/${id}`, {
      method: "DELETE",
      headers: authHeaders(),
    });
    return handleResponse<void>(res);
  },
};
