import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import { searchMaterials } from "../services/searchApi";
import {
  getCachedSearch,
  setCachedSearch,
  getCacheAgeMinutes,
  invalidateCachedSearch,
} from "../utils/searchCache";
import type { SearchResponse, SortOption } from "../types/search";

export function useSearchResults() {
  const [result, setResult] = useState<SearchResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheAgeMinutes, setCacheAgeMinutes] = useState<number | null>(null);
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("best_price");

  const search = useCallback(
    async (items: string[], forceRefresh = false) => {
      // Hit cache first (unless forcing a refresh)
      if (!forceRefresh) {
        const cached = getCachedSearch(items);
        if (cached) {
          setResult(cached);
          setCacheAgeMinutes(getCacheAgeMinutes(items));
          return;
        }
      } else {
        invalidateCachedSearch(items);
      }

      setLoading(true);
      setError(null);
      setCacheAgeMinutes(null);

      try {
        const data = await searchMaterials({ items });
        setResult(data);
        const totalOffers = data.items.reduce((sum, item) => sum + item.offers.length, 0);
        if (totalOffers > 0) {
          setCachedSearch(items, data);
          setCacheAgeMinutes(0);
          toast.success(`${totalOffers} oferta${totalOffers !== 1 ? "s" : ""} encontrada${totalOffers !== 1 ? "s" : ""}`);
        } else {
          toast.warning("Nenhuma oferta encontrada");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro inesperado na busca";
        setError(msg);
        toast.error(msg);
      } finally {
        setLoading(false);
      }
    },
    []
  );

  const filteredItems = useMemo(() => {
    if (!result) return [];

    return result.items.map((entry) => {
      const offers = entry.offers.filter((offer) => {
        if (selectedStore === "all") return true;
        return offer.store === selectedStore;
      });

      const sortedOffers = [...offers].sort((a, b) => {
        if (sortBy === "best_price") return a.price - b.price;
        return a.productName.localeCompare(b.productName);
      });

      return { ...entry, offers: sortedOffers };
    });
  }, [result, selectedStore, sortBy]);

  return {
    result,
    loading,
    error,
    cacheAgeMinutes,
    selectedStore,
    setSelectedStore,
    sortBy,
    setSortBy,
    filteredItems,
    search,
  };
}
