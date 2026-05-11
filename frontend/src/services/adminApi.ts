import { baseHeaders } from "./headers";

const API_BASE_URL = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/api\/?$/, "");

async function parseResponse<T>(response: Response): Promise<T> {
  if (!response.ok) throw new Error(`API error ${response.status}`);
  return (await response.json()) as T;
}

export interface ScraperSession {
  scraper_key: string;
  created_at: string;
  expires_at: string;
  state: "active" | "idle" | "expired";
}

export interface ScraperSessionsResponse {
  sessions: ScraperSession[];
  total: number;
}

export interface SearchStats {
  cache_backend: string;
  cache_ttl_seconds: number;
  scraper_avg_seconds: number;
  total_estimated_seconds: number;
}

export const adminApi = {
  async getScraperSessions(): Promise<ScraperSessionsResponse> {
    const res = await fetch(`${API_BASE_URL}/api/admin/scraper-sessions`, { headers: baseHeaders() });
    return parseResponse<ScraperSessionsResponse>(res);
  },

  async deleteScraperSession(scraperKey: string): Promise<{ deleted: boolean; scraper_key: string }> {
    const res = await fetch(`${API_BASE_URL}/api/admin/scraper-sessions/${encodeURIComponent(scraperKey)}`, {
      method: "DELETE",
      headers: baseHeaders(),
    });
    return parseResponse(res);
  },

  async clearAllSessions(): Promise<{ deleted: number }> {
    const res = await fetch(`${API_BASE_URL}/api/admin/scraper-sessions`, {
      method: "DELETE",
      headers: baseHeaders(),
    });
    return parseResponse(res);
  },

  async reseedSuppliers(): Promise<{ status: string; suppliers_recreated: number }> {
    const res = await fetch(`${API_BASE_URL}/api/admin/reseed-suppliers`, {
      method: "POST",
      headers: baseHeaders(),
    });
    return parseResponse(res);
  },

  async getSearchStats(): Promise<SearchStats> {
    const res = await fetch(`${API_BASE_URL}/api/search/stats`, { headers: baseHeaders() });
    return parseResponse<SearchStats>(res);
  },

  async clearSearchCache(): Promise<{ status: string; entries_removed: number }> {
    const res = await fetch(`${API_BASE_URL}/api/search/cache`, {
      method: "DELETE",
      headers: baseHeaders(),
    });
    return parseResponse(res);
  },
};
