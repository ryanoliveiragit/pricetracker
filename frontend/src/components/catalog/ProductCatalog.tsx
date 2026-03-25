"use client";

import { useState, useMemo } from "react";
import { Search, SlidersHorizontal, Package, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { Offer } from "@/types/search";
import { ProductCard } from "./ProductCard";
import { CartIcon } from "./CartIcon";
import { CartModal } from "./CartModal";
import { ImageModal, useImageModal } from "./ImageModal";
import { cn } from "@/lib/utils";

interface ProductCatalogProps {
  offers: Offer[];
  title?: string;
  loading?: boolean;
  onRefresh?: () => void;
}

type SortKey = "price_asc" | "price_desc" | "name" | "best";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "best", label: "Melhor preço primeiro" },
  { value: "price_asc", label: "Menor preço" },
  { value: "price_desc", label: "Maior preço" },
  { value: "name", label: "Nome A–Z" },
];

function sortOffers(offers: Offer[], sort: SortKey): Offer[] {
  return [...offers].sort((a, b) => {
    if (sort === "price_asc") return a.price - b.price;
    if (sort === "price_desc") return b.price - a.price;
    if (sort === "name") return a.productName.localeCompare(b.productName);
    // best: melhor preço e disponível primeiro
    if (a.isBestPrice !== b.isBestPrice) return a.isBestPrice ? -1 : 1;
    return a.price - b.price;
  });
}

export function ProductCatalog({
  offers,
  title = "Resultados",
  loading = false,
  onRefresh,
}: ProductCatalogProps) {
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<SortKey>("best");
  const [filterStore, setFilterStore] = useState<string>("all");
  const [cartOpen, setCartOpen] = useState(false);
  const { state: imgModal, openModal, close: closeImg, navigate } = useImageModal();

  const stores = useMemo(
    () => ["all", ...Array.from(new Set(offers.map((o) => o.store)))],
    [offers]
  );

  const filtered = useMemo(() => {
    let result = offers;
    if (filterStore !== "all") result = result.filter((o) => o.store === filterStore);
    if (search.trim()) {
      const q = search.toLowerCase();
      result = result.filter((o) => o.productName.toLowerCase().includes(q));
    }
    return sortOffers(result, sort);
  }, [offers, filterStore, search, sort]);

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-neutral-100">{title}</h2>
          <p className="text-xs text-neutral-500">
            {filtered.length} de {offers.length} produto{offers.length !== 1 ? "s" : ""}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {onRefresh && (
            <button
              onClick={onRefresh}
              disabled={loading}
              className="flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-700/60 bg-neutral-900/80 text-neutral-400 transition hover:border-purple-500/40 hover:text-purple-400 disabled:opacity-50"
              title="Atualizar (force refresh)"
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          )}
          <CartIcon onClick={() => setCartOpen(true)} />
        </div>
      </div>

      {/* Filtros */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Busca */}
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            placeholder="Filtrar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-xl border border-neutral-800 bg-neutral-900/60 py-2 pl-8 pr-3 text-sm text-neutral-200 placeholder-neutral-600 focus:border-purple-500/50 focus:outline-none focus:ring-2 focus:ring-purple-500/20"
          />
        </div>

        {/* Sort */}
        <div className="flex items-center gap-1.5 rounded-xl border border-neutral-800 bg-neutral-900/60 px-3 py-2">
          <SlidersHorizontal className="h-3.5 w-3.5 text-neutral-500" />
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as SortKey)}
            className="bg-transparent text-sm text-neutral-300 focus:outline-none"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value} className="bg-neutral-900">
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {/* Filtro por loja */}
        {stores.length > 2 && (
          <div className="flex flex-wrap gap-1.5">
            {stores.map((store) => (
              <button
                key={store}
                onClick={() => setFilterStore(store)}
                className={cn(
                  "rounded-full border px-3 py-1 text-xs font-medium transition",
                  filterStore === store
                    ? "border-purple-500/60 bg-purple-600/20 text-purple-300"
                    : "border-neutral-700/60 bg-neutral-900/60 text-neutral-400 hover:border-neutral-600 hover:text-neutral-300"
                )}
              >
                {store === "all" ? "Todos" : store}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Grid de produtos */}
      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="h-[380px] animate-pulse rounded-2xl border border-neutral-800/60 bg-neutral-900/50"
            />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex flex-col items-center gap-3 py-20 text-center">
          <Package className="h-12 w-12 text-neutral-700" />
          <p className="text-sm text-neutral-500">
            {search ? `Nenhum produto encontrado para "${search}"` : "Nenhum produto disponível."}
          </p>
          {search && (
            <button
              onClick={() => setSearch("")}
              className="text-xs text-purple-400 hover:underline"
            >
              Limpar filtro
            </button>
          )}
        </div>
      ) : (
        <motion.div
          layout
          className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          <AnimatePresence mode="popLayout">
            {filtered.map((offer, i) => (
              <ProductCard
                key={`${offer.store}-${offer.sku ?? offer.productName}-${i}`}
                offer={offer}
                index={i}
                onImageClick={openModal}
              />
            ))}
          </AnimatePresence>
        </motion.div>
      )}

      {/* Modals */}
      <ImageModal
        images={imgModal.images}
        currentIndex={imgModal.index}
        productName={imgModal.name}
        open={imgModal.open}
        onClose={closeImg}
        onNavigate={navigate}
      />

      <CartModal open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
