/**
 * savesApi — Gerenciamento de ofertas salvas (favoritos).
 */

import { baseHeaders } from "./headers";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/api\/?$/, "");

export interface SavedOffer {
  id: number;
  store: string;
  product_name: string;
  price: number;
  currency: string;
  product_url: string;
  image_url?: string;
  availability: string;
  sku?: string;
  brand?: string;
  created_at: string;
}

export interface SaveOfferPayload {
  store: string;
  product_name: string;
  price: number;
  currency?: string;
  product_url: string;
  image_url?: string;
  availability?: string;
  sku?: string;
  brand?: string;
}

const getHeaders = () => baseHeaders();

async function handleResponse<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
    throw new Error(body.detail ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

export const savesApi = {
  async getAll(): Promise<SavedOffer[]> {
    const res = await fetch(`${BASE}/api/saves`, {
      headers: getHeaders(),
    });
    return handleResponse<SavedOffer[]>(res);
  },

  async save(payload: SaveOfferPayload): Promise<SavedOffer> {
    const res = await fetch(`${BASE}/api/saves`, {
      method: "POST",
      headers: getHeaders(),
      body: JSON.stringify(payload),
    });
    return handleResponse<SavedOffer>(res);
  },

  async delete(id: number): Promise<void> {
    const res = await fetch(`${BASE}/api/saves/${id}`, {
      method: "DELETE",
      headers: getHeaders(),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }));
      throw new Error(body.detail ?? `HTTP ${res.status}`);
    }
  },
};
