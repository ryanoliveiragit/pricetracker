"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, Search, SlidersHorizontal, Tag,
  ChevronLeft, ChevronRight, X, Star, Store as StoreIcon, Grid3X3, List, Package, Heart,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ProductCard } from "../components/catalog/ProductCard";
import { CartIcon } from "../components/catalog/CartIcon";
import { CartModal } from "../components/catalog/CartModal";
import { ImageModal, useImageModal } from "../components/catalog/ImageModal";
import { cn } from "@/lib/utils";
import { useSavedOffers } from "@/context/SavedOffersContext";
import type { Offer } from "../types/search";

const ITEMS_PER_PAGE = 24;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ModernSavedOffers() {
  const { savedOffers, loading, removeSave, pendingUrls } = useSavedOffers();
  
  /* ── Filter state ── */
  const [cardSearch, setCardSearch] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(99999);
  const [activeSuppliers, setActiveSuppliers] = useState<Set<string>>(new Set());
  const [activeBrands, setActiveBrands] = useState<Set<string>>(new Set());
  const [activeUnits, setActiveUnits] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"best_price" | "alphabetical">("best_price");
  const [cartOpen, setCartOpen] = useState(false);
  
  const { state: imgModal, openModal, close: closeImg, navigate: navigateImg } = useImageModal();

  /* ── Map SavedOffer to standard Offer type ── */
  const allOffers: (Offer & { id: number })[] = useMemo(() => {
    return savedOffers.map(o => ({
      store: o.store,
      productName: o.product_name,
      price: o.price,
      currency: o.currency || "BRL",
      productUrl: o.product_url,
      imageUrl: o.image_url,
      availability: (o.availability as any) || ("em_estoque" as const),
      sku: o.sku,
      brand: o.brand,
      isBestPrice: false, // Will calculate this in filtered memo
      id: o.id
    }));
  }, [savedOffers]);

  const priceStats = useMemo(() => {
    if (!allOffers.length) return { min: 0, max: 99999 };
    const prices = allOffers.filter((o) => o.price > 0).map((o) => o.price);
    if (!prices.length) return { min: 0, max: 99999 };
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [allOffers]);

  useEffect(() => {
    if (priceStats.min !== 0 || priceStats.max !== 99999) {
      setPriceMin(prev => prev === 0 ? priceStats.min : prev);
      setPriceMax(prev => prev === 99999 ? priceStats.max : prev);
    }
  }, [priceStats]);

  const allSuppliers = useMemo(() => {
    const s = new Set<string>();
    allOffers.forEach((o) => s.add(o.store));
    return Array.from(s).sort();
  }, [allOffers]);

  const allBrands = useMemo(() => {
    const s = new Set<string>();
    allOffers.forEach((o) => { if (o.brand) s.add(o.brand); });
    return Array.from(s).sort();
  }, [allOffers]);

  function extractUnit(name: string): string | null {
    const n = name.toLowerCase();
    if (/\d+\s*kg/.test(n)) return "KG";
    if (/\d+\s*(litro|lt\b|l\b)/.test(n)) return "L";
    if (/\d+\s*ml/.test(n)) return "ML";
    if (/\d+\s*m²/.test(n)) return "M²";
    if (/\d+\s*m\b/.test(n)) return "M";
    if (/\b(cx|caixa)\b/.test(n)) return "CX";
    if (/\b(sc|saco)\b/.test(n)) return "SC";
    if (/\b(pc|peça|peca)\b/.test(n)) return "PC";
    return null;
  }

  const allUnits = useMemo(() => {
    const s = new Set<string>();
    allOffers.forEach((o) => { const u = extractUnit(o.productName); if (u) s.add(u); });
    return Array.from(s).sort();
  }, [allOffers]);

  /* ── Filtered + paginated ── */
  const filtered = useMemo(() => {
    let result = allOffers.filter((o) => {
      if (cardSearch) {
        const q = cardSearch.toLowerCase();
        const hit =
          o.productName.toLowerCase().includes(q) ||
          o.store.toLowerCase().includes(q) ||
          (o.brand ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (onlyInStock && o.availability !== "em_estoque") return false;
      if (o.price > 0 && (o.price < priceMin || o.price > priceMax)) return false;
      if (activeSuppliers.size > 0 && !activeSuppliers.has(o.store)) return false;
      if (activeBrands.size > 0 && !(o.brand && activeBrands.has(o.brand))) return false;
      if (activeUnits.size > 0 && !activeUnits.has(extractUnit(o.productName) ?? "")) return false;
      return true;
    });

    // Sort
    if (sortBy === "best_price") {
      result.sort((a, b) => (a.price || 99999) - (b.price || 99999));
    } else {
      result.sort((a, b) => a.productName.localeCompare(b.productName));
    }

    return result;
  }, [allOffers, cardSearch, onlyInStock, priceMin, priceMax, activeSuppliers, activeBrands, activeUnits, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [cardSearch, onlyInStock, priceMin, priceMax, activeSuppliers, activeBrands, activeUnits, sortBy]);

  function toggleSupplier(name: string) {
    setActiveSuppliers((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleBrand(name: string) {
    setActiveBrands((prev) => {
      const next = new Set(prev);
      next.has(name) ? next.delete(name) : next.add(name);
      return next;
    });
  }

  function toggleUnit(u: string) {
    setActiveUnits((prev) => { const n = new Set(prev); n.has(u) ? n.delete(u) : n.add(u); return n; });
  }

  function clearFilters() {
    setCardSearch("");
    setOnlyInStock(false);
    setActiveSuppliers(new Set());
    setActiveBrands(new Set());
    setActiveUnits(new Set());
    setPriceMin(priceStats.min);
    setPriceMax(priceStats.max);
  }

  const hasActiveFilters =
    !!cardSearch || onlyInStock ||
    activeSuppliers.size > 0 || activeBrands.size > 0 ||
    activeUnits.size > 0;

  const activeFilterCount = [
    !!cardSearch, onlyInStock,
    activeSuppliers.size > 0, activeBrands.size > 0,
    activeUnits.size > 0,
    priceMin !== priceStats.min || priceMax !== priceStats.max,
  ].filter(Boolean).length;

  /* ── Sidebar content (identical to Results) ── */
  const filterContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#A0A09A]">Filtros</span>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-[11px] font-medium text-[rgb(var(--primary-500))] hover:underline">
            Limpar tudo
          </button>
        )}
      </div>

      {/* Active chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {onlyInStock && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/15 border border-[rgb(var(--primary-500))]/30 px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--primary-600))]">
              Em estoque
              <button onClick={() => setOnlyInStock(false)}><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {cardSearch && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/15 border border-[rgb(var(--primary-500))]/30 px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--primary-600))]">
              &ldquo;{cardSearch}&rdquo;
              <button onClick={() => setCardSearch("")}><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {Array.from(activeUnits).map(u => (
            <span key={u} className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/15 border border-[rgb(var(--primary-500))]/30 px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--primary-600))]">
              {u}
              <button onClick={() => toggleUnit(u)}><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          {Array.from(activeSuppliers).map(s => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/15 border border-[rgb(var(--primary-500))]/30 px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--primary-600))]">
              {s}
              <button onClick={() => toggleSupplier(s)}><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Busca local</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#C0C0BA]" />
          <input
            value={cardSearch}
            onChange={(e) => setCardSearch(e.target.value)}
            placeholder="Nome, marca..."
            className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] py-2.5 pl-9 pr-8 text-sm text-[#1A1A18] placeholder-[#C0C0BA] focus:border-[rgb(var(--primary-500))] focus:outline-none focus:bg-white transition-colors"
          />
        </div>
      </div>

      {/* Toggles */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Exibir</p>
        <button
          onClick={() => setOnlyInStock(!onlyInStock)}
          className={cn(
            "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors border",
            onlyInStock
              ? "border-[rgb(var(--primary-500))]/40 bg-[rgb(var(--primary-500))]/10 text-[#1A1A18]"
              : "border-transparent bg-[#F7F7F5] text-[#6B6B63] hover:bg-[#EFEFEB]"
          )}
        >
          <span className="font-medium text-xs">Apenas em estoque</span>
          <div className={cn("h-4 w-7 rounded-full transition-colors relative flex-shrink-0", onlyInStock ? "bg-[rgb(var(--primary-500))]" : "bg-[#D0D0CA]")}>
            <div className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform", onlyInStock ? "translate-x-3.5" : "translate-x-0.5")} />
          </div>
        </button>
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Faixa de preço</p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={priceMin}
            onChange={(e) => setPriceMin(Number(e.target.value))}
            className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2 text-sm text-[#1A1A18] focus:border-[rgb(var(--primary-500))] focus:outline-none"
          />
          <input
            type="number"
            value={priceMax}
            onChange={(e) => setPriceMax(Number(e.target.value))}
            className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2 text-sm text-[#1A1A18] focus:border-[rgb(var(--primary-500))] focus:outline-none"
          />
        </div>
      </div>

      {/* Suppliers */}
      {allSuppliers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Lojas</p>
          <div className="space-y-0.5">
            {allSuppliers.map((s) => (
              <label key={s} className={cn("flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors", activeSuppliers.has(s) ? "bg-[rgb(var(--primary-500))]/10" : "hover:bg-[#F7F7F5]")}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <input type="checkbox" checked={activeSuppliers.has(s)} onChange={() => toggleSupplier(s)} className="sr-only" />
                  <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center", activeSuppliers.has(s) ? "bg-[rgb(var(--primary-500))] border-[rgb(var(--primary-500))]" : "border-[#D0D0CA]")}>
                    {activeSuppliers.has(s) && <span className="h-2 w-2 bg-[#1A1A18] rounded-[1px]" />}
                  </div>
                  <span className="truncate text-xs">{s}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Brands */}
      {allBrands.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Marcas</p>
          <div className="space-y-0.5 max-h-40 overflow-y-auto pr-2 custom-scrollbar">
            {allBrands.map((b) => (
              <label key={b} className={cn("flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors", activeBrands.has(b) ? "bg-[rgb(var(--primary-500))]/10" : "hover:bg-[#F7F7F5]")}>
                <div className="flex items-center gap-2.5 min-w-0">
                  <input type="checkbox" checked={activeBrands.has(b)} onChange={() => toggleBrand(b)} className="sr-only" />
                  <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center", activeBrands.has(b) ? "bg-[rgb(var(--primary-500))] border-[rgb(var(--primary-500))]" : "border-[#D0D0CA]")}>
                    {activeBrands.has(b) && <span className="h-2 w-2 bg-[#1A1A18] rounded-[1px]" />}
                  </div>
                  <span className="truncate text-xs">{b}</span>
                </div>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );

  /* ── Empty state ── */
  if (!loading && allOffers.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
        <div className="text-center px-4 max-w-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-white border border-[#E8E8E4] shadow-sm">
            <Heart className="h-10 w-10 text-[#D0D0CA]" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-[#1A1A18]">Nenhuma oferta salva</h2>
          <p className="mb-8 text-sm text-[#6B6B63]">Salve produtos durante suas buscas para compará-los e acessá-los facilmente aqui.</p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--primary-500))] px-8 py-3 text-sm font-bold text-[#1A1A18] transition-all hover:bg-[rgb(var(--primary-600))] shadow-sm"
          >
            Começar Cotação
          </Link>
        </div>
      </div>
    );
  }

  const uniqueStores = new Set(allOffers.map((o) => o.store)).size;
  const bestPrice = filtered.length > 0 ? Math.min(...filtered.map(o => o.price).filter(p => p > 0)) : null;

  return (
    <div className="min-h-screen bg-[#F7F7F5]">
      
      {/* ── Top bar (identical to Results) ── */}
      <div className="sticky top-0 md:top-16 z-30 h-14 bg-white border-b border-[#E8E8E4] px-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-[#A0A09A]">
            Dashboard&nbsp;/&nbsp;
            <span className="text-[#6B6B63] font-medium">Ofertas Salvas</span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button onClick={() => setMobileFiltersOpen(true)} className="xl:hidden flex items-center gap-1.5 rounded-lg border border-[#E8E8E4] bg-white px-3 py-1.5 text-xs font-medium text-[#6B6B63]">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFilterCount > 0 && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[rgb(var(--primary-500))] text-[9px] font-bold text-[#1A1A18]">{activeFilterCount}</span>}
            <span className="hidden sm:inline">Filtros</span>
          </button>
          
          <Link
            href="/search"
            className="rounded-lg border border-[#E8E8E4] bg-white px-3 py-1.5 text-xs font-medium text-[#6B6B63] transition-colors hover:bg-[#F7F7F5] hover:text-[#1A1A18]"
          >
            Nova Busca
          </Link>
          <CartIcon onClick={() => setCartOpen(true)} />
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex">
        
        {/* Desktop Sidebar */}
        <aside className="w-72 shrink-0 border-r border-[#E8E8E4] bg-white hidden xl:flex flex-col h-[calc(100vh-120px)] sticky top-[120px] overflow-y-auto">
          <div className="px-5 py-6">
            {filterContent}
          </div>
        </aside>

        {/* Mobile Sidebar */}
        <AnimatePresence>
          {mobileFiltersOpen && (
            <>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm xl:hidden" onClick={() => setMobileFiltersOpen(false)} />
              <motion.div initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }} className="fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-white border-r border-[#E8E8E4] px-5 py-6 overflow-y-auto xl:hidden">
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm font-semibold text-[#1A1A18]">Filtros</span>
                  <button onClick={() => setMobileFiltersOpen(false)}><X className="h-5 w-5 text-[#A0A09A]" /></button>
                </div>
                {filterContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main */}
        <div className="flex-1 min-w-0">
          <div className="max-w-full px-4 py-6">
            
            {/* Stat cards */}
            <div id="tour-saves-stats" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {[
                { label: "Favoritos", value: allOffers.length, sub: "itens salvos", icon: Heart },
                { label: "Lojas", value: uniqueStores, sub: "fornecedores diferentes", icon: StoreIcon },
                { label: "Melhor Preço", value: bestPrice ? formatBRL(bestPrice) : "—", sub: "entre os favoritados", icon: Tag, accent: true },
              ].map(({ label, value, sub, icon: Icon, accent }) => (
                <div key={label} className="bg-white border border-[#E8E8E4] rounded-xl px-5 py-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3 text-[#A0A09A]">
                    <p className="text-[11px] font-semibold uppercase tracking-widest">{label}</p>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className={cn("text-2xl font-bold", accent ? "text-[rgb(var(--primary-500))]" : "text-[#1A1A18]")}>{value}</p>
                  <p className="text-xs text-[#A0A09A] mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div id="tour-saves-toolbar" className="sticky top-14 z-20 bg-[#F7F7F5] py-3 border-b border-[#E8E8E4] mb-4 -mx-4 px-4 flex items-center justify-between gap-3">
              <span className="text-xs text-[#6B6B63]">
                <span className="font-semibold text-[#1A1A18]">{filtered.length}</span> favorito{filtered.length !== 1 ? "s" : ""}
                {totalPages > 1 && <span className="ml-1 text-[#A0A09A]">· pág. {page}/{totalPages}</span>}
              </span>

              <div className="flex items-center gap-2">
                <div className="hidden sm:flex items-center gap-0.5 rounded-lg border border-[#E8E8E4] bg-white p-0.5">
                  <button onClick={() => setViewMode("grid")} className={cn("rounded-md p-1.5", viewMode === "grid" ? "bg-[rgb(var(--primary-500))] text-white" : "text-[#A0A09A]")}><Grid3X3 className="h-3.5 w-3.5" /></button>
                  <button onClick={() => setViewMode("list")} className={cn("rounded-md p-1.5", viewMode === "list" ? "bg-[rgb(var(--primary-500))] text-[#1A1A18]" : "text-[#A0A09A]")}><List className="h-3.5 w-3.5" /></button>
                </div>
                <div className="flex items-center gap-0.5 rounded-lg border border-[#E8E8E4] bg-white p-0.5">
                  {[["best_price", "Menor Preço"], ["alphabetical", "A-Z"]].map(([val, label]) => (
                    <button key={val} onClick={() => setSortBy(val as any)} className={cn("rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors", sortBy === val ? "bg-[rgb(var(--primary-500))] text-white" : "text-[#6B6B63]")}>{label}</button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-[#A0A09A]">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-[rgb(var(--primary-500))] border-t-transparent" />
                <p className="text-sm">Sincronizando favoritos...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-white border border-[#E8E8E4] rounded-xl p-12 text-center shadow-sm">
                <Search className="mx-auto mb-4 h-10 w-10 text-[#D0D0CA]" />
                <h3 className="mb-2 text-base font-semibold text-[#1A1A18]">Nenhum favorito encontrado</h3>
                <p className="mb-5 text-sm text-[#6B6B63]">Tente ajustar os filtros ou pesquisar por outro termo.</p>
                <button onClick={clearFilters} className="text-[rgb(var(--primary-500))] font-bold text-sm hover:underline">Limpar filtros</button>
              </div>
            ) : (
              <>
                <div
                  id="tour-saves-grid"
                  className={cn(viewMode === "grid" ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4" : "flex flex-col gap-4")}>
                  {paginated.map((offer, i) => {
                    const url = offer.productUrl;
                    const isPending = pendingUrls.has(url) || pendingUrls.has(String(offer.id));
                    return (
                      <div key={offer.id} className="relative">
                        <ProductCard
                          offer={offer}
                          index={i}
                          onImageClick={openModal}
                          onRemove={isPending ? undefined : () => removeSave(offer.id)}
                        />
                        {isPending && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-white/70 z-20">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-[rgb(var(--primary-500))] border-t-transparent" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-1.5">
                    <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} className="h-9 w-9 rounded-lg border border-[#E8E8E4] flex items-center justify-center bg-white disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button key={p} onClick={() => setPage(p)} className={cn("h-9 w-9 rounded-lg text-sm font-bold", page === p ? "bg-[rgb(var(--primary-500))] text-[#1A1A18]" : "bg-white border border-[#E8E8E4] text-[#6B6B63]")}>{p}</button>
                    ))}
                    <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} className="h-9 w-9 rounded-lg border border-[#E8E8E4] flex items-center justify-center bg-white disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Modals */}
      <ImageModal images={imgModal.images} currentIndex={imgModal.index} productName={imgModal.name} open={imgModal.open} onClose={closeImg} onNavigate={navigateImg} />
      <CartModal open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
