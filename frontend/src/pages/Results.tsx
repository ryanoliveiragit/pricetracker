"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import FilterPanel from "../components/FilterPanel";
import ResultsTable from "../components/ResultsTable";
import { useSearchResults } from "../hooks/useSearchResults";

export default function Results() {
  const cachedItemsRaw = typeof window !== "undefined" ? localStorage.getItem("construprice-last-search-items") : null;
  const items = cachedItemsRaw ? ((JSON.parse(cachedItemsRaw) as string[]) ?? []) : [];

  const {
    result,
    loading,
    error,
    selectedStore,
    setSelectedStore,
    sortBy,
    setSortBy,
    filteredItems,
    search
  } = useSearchResults();

  const [priceRange, setPriceRange] = useState<[number, number]>([0, 10000]);
  const [availabilityFilter, setAvailabilityFilter] = useState<string>("all");

  const priceStats = useMemo(() => {
    if (!filteredItems || filteredItems.length === 0) return { min: 0, max: 10000 };
    const allPrices = filteredItems.flatMap(item => item.offers.map(o => o.price));
    if (allPrices.length === 0) return { min: 0, max: 10000 };
    return {
      min: Math.floor(Math.min(...allPrices)),
      max: Math.ceil(Math.max(...allPrices))
    };
  }, [filteredItems]);

  const doubleFilteredItems = useMemo(() => {
    if (!filteredItems) return [];
    return filteredItems.map(item => ({
      ...item,
      offers: item.offers.filter(offer => {
        const priceMatch = offer.price >= priceRange[0] && offer.price <= priceRange[1];
        const availMatch = availabilityFilter === "all" || 
          (availabilityFilter === "em_estoque" && offer.availability === "em_estoque") ||
          (availabilityFilter === "por_encomenda" && offer.availability !== "em_estoque");
        return priceMatch && availMatch;
      })
    })).filter(item => item.offers.length > 0);
  }, [filteredItems, priceRange, availabilityFilter]);

  useEffect(() => {
    if (items.length > 0) {
      void search(items);
    }
  }, []);

  useEffect(() => {
    if (priceStats.min !== 0 || priceStats.max !== 10000) {
      setPriceRange([priceStats.min, priceStats.max]);
    }
  }, [priceStats]);

  if (items.length === 0) {
    return (
      <main className="space-y-4">
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm text-amber-100">
          Nenhuma lista foi enviada. Volte para a tela inicial e adicione seus itens.
        </div>
        <Link href="/search" className="inline-block rounded-xl bg-brand-700 px-4 py-2 text-sm font-semibold text-white">
          Voltar para busca
        </Link>
      </main>
    );
  }

  return (
    <main className="space-y-5">
      <header className="mb-6 flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-brand-700">Resultado da comparação</p>
          <h1 className="mt-2 text-2xl font-bold text-white">{result?.totalItems ?? items.length} itens consultados</h1>
        </div>

        <Link href="/search" className="rounded-xl border border-[#2e2250] bg-[#191029] px-4 py-2 text-sm font-medium text-violet-100 hover:bg-brand-500/20">
          Nova busca
        </Link>
      </header>

      <div className="space-y-5">
        <FilterPanel
          stores={result?.stores ?? []}
          selectedStore={selectedStore}
          sortBy={sortBy}
          onStoreChange={setSelectedStore}
          onSortChange={setSortBy}
          priceRange={priceRange}
          onPriceRangeChange={setPriceRange}
          availabilityFilter={availabilityFilter}
          onAvailabilityChange={setAvailabilityFilter}
          minPrice={priceStats.min}
          maxPrice={priceStats.max}
        />

        {loading ? (
          <div className="rounded-2xl border border-[#2e2250] bg-[#191029] p-6 text-sm text-violet-100">
            <div className="flex items-center gap-3">
              <div className="h-5 w-5 animate-spin rounded-full border-2 border-brand-500 border-t-transparent" />
              Buscando preços nas lojas...
            </div>
          </div>
        ) : null}

        {error ? <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-6 text-sm text-red-100">{error}</div> : null}

        {!loading && !error ? <ResultsTable items={doubleFilteredItems} /> : null}
      </div>
    </main>
  );
}
