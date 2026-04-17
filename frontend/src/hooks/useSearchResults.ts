import { useCallback, useMemo, useState } from "react";
import { toast } from "sonner";
import {
  searchInstant,
  searchRefresh,
  searchMaterialsStream,
  type StoreState,
} from "../services/searchApi";
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
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cacheAgeMinutes, setCacheAgeMinutes] = useState<number | null>(null);
  const [catalogAgeMinutes, setCatalogAgeMinutes] = useState<number | null>(null);
  const [isFromCatalog, setIsFromCatalog] = useState(false);
  const [selectedStore, setSelectedStore] = useState<string>("all");
  const [sortBy, setSortBy] = useState<SortOption>("best_price");
  const [storeStates, setStoreStates] = useState<StoreState[]>([]);

  const search = useCallback(
    async (items: string[], forceRefresh = false) => {
      if (!forceRefresh) {
        const cached = getCachedSearch(items);
        if (cached) {
          setResult(cached);
          setCacheAgeMinutes(getCacheAgeMinutes(items));
          setCatalogAgeMinutes(cached.catalogAgeMinutes ?? null);
          setIsFromCatalog(cached.isFromCatalog ?? false);
          return;
        }
      } else {
        invalidateCachedSearch(items);
      }

      setLoading(true);
      setError(null);
      setCacheAgeMinutes(null);
      setStoreStates([]);

      try {
        // Try instant search first (from pre-scraped catalog)
        const instantData = await searchInstant({ items });
        const totalOffers = instantData.items.reduce(
          (sum, item) => sum + item.offers.length, 0,
        );

        if (totalOffers > 0) {
          setResult(instantData);
          setCatalogAgeMinutes(instantData.catalogAgeMinutes ?? null);
          setIsFromCatalog(true);
          setCacheAgeMinutes(0);
          setCachedSearch(items, instantData);
          setLoading(false);
          toast.success(
            `${totalOffers} oferta${totalOffers !== 1 ? "s" : ""} (catálogo local)`,
          );
          return;
        }
      } catch {
        // Instant search failed or no catalog — fall through to streaming
      }

      // Fallback: live streaming search
      try {
        const data = await searchMaterialsStream({ items }, (partial, stores) => {
          setResult(partial);
          setStoreStates(stores);
        });
        setResult(data);
        setIsFromCatalog(false);
        setCatalogAgeMinutes(null);
        const totalOffers = data.items.reduce(
          (sum, item) => sum + item.offers.length, 0,
        );
        if (totalOffers > 0) {
          setCachedSearch(items, data);
          setCacheAgeMinutes(0);
          toast.success(
            `${totalOffers} oferta${totalOffers !== 1 ? "s" : ""} encontrada${totalOffers !== 1 ? "s" : ""}`,
          );
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
    [],
  );

  const refreshPrices = useCallback(
    async (items: string[]) => {
      setRefreshing(true);
      try {
        const data = await searchRefresh({ items });
        const totalOffers = data.items.reduce(
          (sum, item) => sum + item.offers.length, 0,
        );

        if (totalOffers > 0) {
          setResult(data);
          setIsFromCatalog(false);
          setCatalogAgeMinutes(0);
          setCacheAgeMinutes(0);
          invalidateCachedSearch(items);
          setCachedSearch(items, data);
          toast.success(
            `${totalOffers} preço${totalOffers !== 1 ? "s" : ""} atualizado${totalOffers !== 1 ? "s" : ""}`,
          );
        } else {
          toast.warning("Nenhum resultado na atualização");
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Erro ao atualizar preços";
        toast.error(msg);
      } finally {
        setRefreshing(false);
      }
    },
    [],
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
    refreshing,
    error,
    cacheAgeMinutes,
    catalogAgeMinutes,
    isFromCatalog,
    selectedStore,
    setSelectedStore,
    sortBy,
    setSortBy,
    filteredItems,
    search,
    refreshPrices,
    storeStates,
  };
}
