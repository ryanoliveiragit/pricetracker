/**
 * usersApi — CRUD real de funcionários conectado ao backend FastAPI.
 * Base URL vem de NEXT_PUBLIC_API_BASE_URL (ex: http://localhost:8000)
 */

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/api\/?$/, "");

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
  /** Lista todos os usuários/funcionários */
  async getAll(): Promise<ApiUser[]> {
    const res = await fetch(`${BASE}/api/users`);
    return handleResponse<ApiUser[]>(res);
  },

  /** Cria funcionário */
  async create(payload: UserCreatePayload): Promise<ApiUser> {
    const res = await fetch(`${BASE}/api/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<ApiUser>(res);
  },

  /** Edita dados de um usuário */
  async update(id: number, payload: UserUpdatePayload): Promise<ApiUser> {
    const res = await fetch(`${BASE}/api/users/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    return handleResponse<ApiUser>(res);
  },

  /** Alterna is_active (ativo ↔ suspenso) */
  async toggleStatus(id: number): Promise<ApiUser> {
    const res = await fetch(`${BASE}/api/users/${id}/toggle-status`, {
      method: "PATCH",
    });
    return handleResponse<ApiUser>(res);
  },

  /** Remove permanentemente */
  async delete(id: number): Promise<void> {
    const res = await fetch(`${BASE}/api/users/${id}`, { method: "DELETE" });
    return handleResponse<void>(res);
  },
};
