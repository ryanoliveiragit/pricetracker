import type { SearchResponse } from "../types/search";

const TTL_MS = 30 * 60 * 1000; // 30 minutes
const CACHE_PREFIX = "construprice-cache-";

interface CacheEntry {
  data: SearchResponse;
  cachedAt: number;
}

function buildKey(items: string[]): string {
  return CACHE_PREFIX + [...items].sort().join("|").toLowerCase();
}

export function getCachedSearch(items: string[]): SearchResponse | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(buildKey(items));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    if (Date.now() - entry.cachedAt > TTL_MS) {
      localStorage.removeItem(buildKey(items));
      return null;
    }
    return entry.data;
  } catch {
    return null;
  }
}

export function setCachedSearch(items: string[], data: SearchResponse): void {
  if (typeof window === "undefined") return;
  try {
    const entry: CacheEntry = { data, cachedAt: Date.now() };
    localStorage.setItem(buildKey(items), JSON.stringify(entry));
  } catch {
    // storage quota exceeded — purge old entries then retry
    purgeCacheEntries();
    try {
      const entry: CacheEntry = { data, cachedAt: Date.now() };
      localStorage.setItem(buildKey(items), JSON.stringify(entry));
    } catch { /* ignore */ }
  }
}

/** Returns age of cached result in minutes, or null if not cached */
export function getCacheAgeMinutes(items: string[]): number | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(buildKey(items));
    if (!raw) return null;
    const entry = JSON.parse(raw) as CacheEntry;
    return Math.round((Date.now() - entry.cachedAt) / 60_000);
  } catch {
    return null;
  }
}

export function invalidateCachedSearch(items: string[]): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(buildKey(items));
}

function purgeCacheEntries(): void {
  const keys = Object.keys(localStorage).filter((k) =>
    k.startsWith(CACHE_PREFIX)
  );
  keys.forEach((k) => localStorage.removeItem(k));
}
