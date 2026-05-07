"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Search, SlidersHorizontal, Tag,
  ChevronLeft, ChevronRight, X, Star, Store as StoreIcon,
  Grid3X3, List, Heart,
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
import { formatBRL, extractUnit } from "../utils/format";

const ITEMS_PER_PAGE = 24;

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

  /* ── Map SavedOffer → Offer ── */
  const allOffers: (Offer & { id: number })[] = useMemo(() =>
    savedOffers.map(o => ({
      store: o.store,
      productName: o.product_name,
      price: o.price,
      currency: o.currency || "BRL",
      productUrl: o.product_url,
      imageUrl: o.image_url,
      availability: (o.availability as any) || ("em_estoque" as const),
      sku: o.sku,
      brand: o.brand,
      isBestPrice: false,
      id: o.id,
    })),
  [savedOffers]);

  const priceStats = useMemo(() => {
    if (!allOffers.length) return { min: 0, max: 99999 };
    const prices = allOffers.filter(o => o.price > 0).map(o => o.price);
    if (!prices.length) return { min: 0, max: 99999 };
    return { min: Math.floor(Math.min(...prices)), max: Math.ceil(Math.max(...prices)) };
  }, [allOffers]);

  useEffect(() => {
    if (priceStats.min !== 0 || priceStats.max !== 99999) {
      setPriceMin(prev => prev === 0 ? priceStats.min : prev);
      setPriceMax(prev => prev === 99999 ? priceStats.max : prev);
    }
  }, [priceStats]);

  const allSuppliers = useMemo(() => {
    const s = new Set<string>();
    allOffers.forEach(o => s.add(o.store));
    return Array.from(s).sort();
  }, [allOffers]);

  const allBrands = useMemo(() => {
    const s = new Set<string>();
    allOffers.forEach(o => { if (o.brand) s.add(o.brand); });
    return Array.from(s).sort();
  }, [allOffers]);

  const allUnits = useMemo(() => {
    const s = new Set<string>();
    allOffers.forEach(o => { const u = extractUnit(o.productName); if (u) s.add(u); });
    return Array.from(s).sort();
  }, [allOffers]);

  /* ── Filtered + sorted + paginated ── */
  const filtered = useMemo(() => {
    let result = allOffers.filter(o => {
      if (cardSearch) {
        const q = cardSearch.toLowerCase();
        if (
          !o.productName.toLowerCase().includes(q) &&
          !o.store.toLowerCase().includes(q) &&
          !(o.brand ?? "").toLowerCase().includes(q)
        ) return false;
      }
      if (onlyInStock && o.availability !== "em_estoque") return false;
      if (o.price > 0 && (o.price < priceMin || o.price > priceMax)) return false;
      if (activeSuppliers.size > 0 && !activeSuppliers.has(o.store)) return false;
      if (activeBrands.size > 0 && !(o.brand && activeBrands.has(o.brand))) return false;
      if (activeUnits.size > 0 && !activeUnits.has(extractUnit(o.productName) ?? "")) return false;
      return true;
    });

    if (sortBy === "best_price") result.sort((a, b) => (a.price || 99999) - (b.price || 99999));
    else result.sort((a, b) => a.productName.localeCompare(b.productName));

    return result;
  }, [allOffers, cardSearch, onlyInStock, priceMin, priceMax, activeSuppliers, activeBrands, activeUnits, sortBy]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [cardSearch, onlyInStock, priceMin, priceMax, activeSuppliers, activeBrands, activeUnits, sortBy]);

  function toggleSupplier(name: string) {
    setActiveSuppliers(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }
  function toggleBrand(name: string) {
    setActiveBrands(prev => { const n = new Set(prev); n.has(name) ? n.delete(name) : n.add(name); return n; });
  }
  function toggleUnit(u: string) {
    setActiveUnits(prev => { const n = new Set(prev); n.has(u) ? n.delete(u) : n.add(u); return n; });
  }
  function clearFilters() {
    setCardSearch(""); setOnlyInStock(false);
    setActiveSuppliers(new Set()); setActiveBrands(new Set()); setActiveUnits(new Set());
    setPriceMin(priceStats.min); setPriceMax(priceStats.max);
  }

  const hasActiveFilters = !!cardSearch || onlyInStock || activeSuppliers.size > 0 || activeBrands.size > 0 || activeUnits.size > 0;
  const activeFilterCount = [
    !!cardSearch, onlyInStock,
    activeSuppliers.size > 0, activeBrands.size > 0, activeUnits.size > 0,
    priceMin !== priceStats.min || priceMax !== priceStats.max,
  ].filter(Boolean).length;

  /* ── Filter sidebar content ── */
  const filterContent = (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-muted-foreground">Filtros</span>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-[11px] font-medium text-primary hover:underline">
            Limpar tudo
          </button>
        )}
      </div>

      {/* Active chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {onlyInStock && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              Em estoque
              <button onClick={() => setOnlyInStock(false)} aria-label="Remover filtro em estoque"><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {cardSearch && (
            <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              &ldquo;{cardSearch}&rdquo;
              <button onClick={() => setCardSearch("")} aria-label="Remover filtro de busca"><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {Array.from(activeUnits).map(u => (
            <span key={u} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              {u}
              <button onClick={() => toggleUnit(u)} aria-label={`Remover filtro ${u}`}><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          {Array.from(activeSuppliers).map(s => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary">
              {s}
              <button onClick={() => toggleSupplier(s)} aria-label={`Remover filtro ${s}`}><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="space-y-1.5">
        <label htmlFor="saves-search" className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">
          Busca local
        </label>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground/50" />
          <input
            id="saves-search"
            value={cardSearch}
            onChange={e => setCardSearch(e.target.value)}
            placeholder="Nome, marca..."
            className="w-full rounded-lg border border-border bg-muted py-2.5 pl-9 pr-8 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:bg-background focus:outline-none transition-colors"
          />
        </div>
      </div>

      {/* Em estoque toggle */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Exibir</p>
        <button
          onClick={() => setOnlyInStock(!onlyInStock)}
          aria-pressed={onlyInStock}
          className={cn(
            "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors border",
            onlyInStock
              ? "border-primary/40 bg-primary/10 text-foreground"
              : "border-transparent bg-muted text-muted-foreground hover:bg-muted/80"
          )}
        >
          <span className="font-medium text-xs">Apenas em estoque</span>
          <div className={cn("h-4 w-7 rounded-full transition-colors relative flex-shrink-0", onlyInStock ? "bg-primary" : "bg-border")}>
            <div className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform", onlyInStock ? "translate-x-3.5" : "translate-x-0.5")} />
          </div>
        </button>
      </div>

      {/* Faixa de preço */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Faixa de preço</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label htmlFor="price-min" className="sr-only">Preço mínimo</label>
            <input
              id="price-min"
              type="number"
              value={priceMin}
              onChange={e => setPriceMin(Number(e.target.value))}
              placeholder="Mín"
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <div>
            <label htmlFor="price-max" className="sr-only">Preço máximo</label>
            <input
              id="price-max"
              type="number"
              value={priceMax}
              onChange={e => setPriceMax(Number(e.target.value))}
              placeholder="Máx"
              className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-foreground focus:border-primary focus:outline-none"
            />
          </div>
        </div>
      </div>

      {/* Lojas */}
      {allSuppliers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Lojas</p>
          <div className="space-y-0.5">
            {allSuppliers.map(s => (
              <label key={s} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 transition-colors", activeSuppliers.has(s) ? "bg-primary/10" : "hover:bg-muted")}>
                <input type="checkbox" checked={activeSuppliers.has(s)} onChange={() => toggleSupplier(s)} className="sr-only" />
                <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0", activeSuppliers.has(s) ? "bg-primary border-primary" : "border-border")}>
                  {activeSuppliers.has(s) && <span className="h-2 w-2 bg-primary-foreground rounded-[1px]" />}
                </div>
                <span className="truncate text-xs text-foreground">{s}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Marcas */}
      {allBrands.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground">Marcas</p>
          <div className="space-y-0.5 max-h-40 overflow-y-auto pr-2">
            {allBrands.map(b => (
              <label key={b} className={cn("flex cursor-pointer items-center gap-2.5 rounded-lg px-3 py-2 transition-colors", activeBrands.has(b) ? "bg-primary/10" : "hover:bg-muted")}>
                <input type="checkbox" checked={activeBrands.has(b)} onChange={() => toggleBrand(b)} className="sr-only" />
                <div className={cn("h-3.5 w-3.5 rounded border flex items-center justify-center flex-shrink-0", activeBrands.has(b) ? "bg-primary border-primary" : "border-border")}>
                  {activeBrands.has(b) && <span className="h-2 w-2 bg-primary-foreground rounded-[1px]" />}
                </div>
                <span className="truncate text-xs text-foreground">{b}</span>
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
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center px-4 max-w-sm">
          <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-card border border-border shadow-sm">
            <Heart className="h-10 w-10 text-muted-foreground/40" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-foreground">Nenhuma oferta salva</h2>
          <p className="mb-8 text-sm text-muted-foreground">Salve produtos durante suas buscas para compará-los e acessá-los facilmente aqui.</p>
          <Link
            href="/agent"
            className="inline-flex items-center gap-2 rounded-xl bg-primary px-8 py-3 text-sm font-bold text-primary-foreground transition-all hover:bg-primary/90 shadow-sm"
          >
            Iniciar Busca
          </Link>
        </div>
      </div>
    );
  }

  const uniqueStores = new Set(allOffers.map(o => o.store)).size;
  const bestPrice = filtered.length > 0 ? Math.min(...filtered.map(o => o.price).filter(p => p > 0)) : null;

  return (
    <div className="min-h-screen bg-background">

      {/* ── Top bar ── */}
      <div className="sticky top-0 z-30 h-14 bg-card border-b border-border px-4 flex items-center gap-4">
        <div className="flex-1 min-w-0">
          <span className="text-xs text-muted-foreground">
            Dashboard&nbsp;/&nbsp;
            <span className="text-foreground font-medium">Ofertas Salvas</span>
          </span>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => setMobileFiltersOpen(true)}
            aria-label="Abrir filtros"
            className="xl:hidden flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFilterCount > 0 && (
              <span className="flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">
                {activeFilterCount}
              </span>
            )}
            <span className="hidden sm:inline">Filtros</span>
          </button>

          <Link
            href="/agent"
            className="rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            Nova Busca
          </Link>
          <CartIcon onClick={() => setCartOpen(true)} />
        </div>
      </div>

      {/* ── Layout ── */}
      <div className="flex">

        {/* Desktop sidebar */}
        <aside className="w-72 shrink-0 border-r border-border bg-card hidden xl:flex flex-col h-[calc(100vh-56px)] sticky top-14 overflow-y-auto">
          <div className="px-5 py-6">
            {filterContent}
          </div>
        </aside>

        {/* Mobile sidebar */}
        <AnimatePresence>
          {mobileFiltersOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm xl:hidden"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <motion.div
                initial={{ x: -300 }} animate={{ x: 0 }} exit={{ x: -300 }}
                role="dialog"
                aria-modal="true"
                aria-label="Filtros"
                className="fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-card border-r border-border px-5 py-6 overflow-y-auto xl:hidden"
              >
                <div className="flex items-center justify-between mb-6">
                  <span className="text-sm font-semibold text-foreground">Filtros</span>
                  <button onClick={() => setMobileFiltersOpen(false)} aria-label="Fechar filtros">
                    <X className="h-5 w-5 text-muted-foreground" />
                  </button>
                </div>
                {filterContent}
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main content */}
        <div className="flex-1 min-w-0">
          <div className="max-w-full px-4 py-6">

            {/* Stat cards */}
            <div id="tour-saves-stats" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
              {[
                { label: "Favoritos",    value: allOffers.length,                            sub: "itens salvos",            icon: Heart,      accent: false },
                { label: "Lojas",        value: uniqueStores,                                sub: "fornecedores diferentes", icon: StoreIcon,  accent: false },
                { label: "Melhor Preço", value: bestPrice ? formatBRL(bestPrice) : "—",      sub: "entre os favoritados",    icon: Tag,        accent: true  },
              ].map(({ label, value, sub, icon: Icon, accent }) => (
                <div key={label} className="bg-card border border-border rounded-xl px-5 py-4 shadow-sm">
                  <div className="flex items-start justify-between mb-3 text-muted-foreground">
                    <p className="text-[11px] font-semibold uppercase tracking-widest">{label}</p>
                    <Icon className="h-4 w-4" />
                  </div>
                  <p className={cn("text-2xl font-bold", accent ? "text-primary" : "text-foreground")}>{value}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>
                </div>
              ))}
            </div>

            {/* Toolbar */}
            <div
              id="tour-saves-toolbar"
              className="sticky top-14 z-20 bg-background py-3 border-b border-border mb-4 -mx-4 px-4 flex items-center justify-between gap-3"
            >
              <span className="text-xs text-muted-foreground">
                <span className="font-semibold text-foreground">{filtered.length}</span>{" "}
                favorito{filtered.length !== 1 ? "s" : ""}
                {totalPages > 1 && <span className="ml-1 text-muted-foreground/60">· pág. {page}/{totalPages}</span>}
              </span>

              <div className="flex items-center gap-2">
                {/* View mode */}
                <div className="hidden sm:flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
                  <button
                    onClick={() => setViewMode("grid")}
                    aria-label="Visualização em grade"
                    aria-pressed={viewMode === "grid"}
                    className={cn("rounded-md p-1.5 transition-colors", viewMode === "grid" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    <Grid3X3 className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => setViewMode("list")}
                    aria-label="Visualização em lista"
                    aria-pressed={viewMode === "list"}
                    className={cn("rounded-md p-1.5 transition-colors", viewMode === "list" ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}
                  >
                    <List className="h-3.5 w-3.5" />
                  </button>
                </div>

                {/* Sort */}
                <div className="flex items-center gap-0.5 rounded-lg border border-border bg-card p-0.5">
                  {(["best_price", "alphabetical"] as const).map(val => (
                    <button
                      key={val}
                      onClick={() => setSortBy(val)}
                      aria-pressed={sortBy === val}
                      className={cn(
                        "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                        sortBy === val ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                      )}
                    >
                      {val === "best_price" ? "Menor Preço" : "A-Z"}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
                <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <p className="text-sm">Sincronizando favoritos...</p>
              </div>
            ) : filtered.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-12 text-center shadow-sm">
                <Search className="mx-auto mb-4 h-10 w-10 text-muted-foreground/30" />
                <h3 className="mb-2 text-base font-semibold text-foreground">Nenhum favorito encontrado</h3>
                <p className="mb-5 text-sm text-muted-foreground">Tente ajustar os filtros ou pesquisar por outro termo.</p>
                <button onClick={clearFilters} className="text-primary font-bold text-sm hover:underline">
                  Limpar filtros
                </button>
              </div>
            ) : (
              <>
                <div
                  id="tour-saves-grid"
                  className={cn(
                    viewMode === "grid"
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-4"
                      : "flex flex-col gap-4"
                  )}
                >
                  {paginated.map((offer, i) => {
                    const isPending = pendingUrls.has(offer.productUrl) || pendingUrls.has(String(offer.id));
                    return (
                      <div key={offer.id} className="relative">
                        <ProductCard
                          offer={offer}
                          index={i}
                          onImageClick={openModal}
                          onRemove={isPending ? undefined : () => removeSave(offer.id)}
                        />
                        {isPending && (
                          <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-background/70 z-20">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => setPage(p => Math.max(1, p - 1))}
                      disabled={page === 1}
                      aria-label="Página anterior"
                      className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1).map(p => (
                      <button
                        key={p}
                        onClick={() => setPage(p)}
                        aria-label={`Página ${p}`}
                        aria-current={page === p ? "page" : undefined}
                        className={cn(
                          "h-9 w-9 rounded-lg text-sm font-bold transition-colors",
                          page === p
                            ? "bg-primary text-primary-foreground"
                            : "bg-card border border-border text-muted-foreground hover:text-foreground"
                        )}
                      >
                        {p}
                      </button>
                    ))}
                    <button
                      onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      aria-label="Próxima página"
                      className="h-9 w-9 rounded-lg border border-border bg-card flex items-center justify-center text-muted-foreground hover:text-foreground disabled:opacity-30 transition-colors"
                    >
                      <ChevronRight className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      <ImageModal images={imgModal.images} currentIndex={imgModal.index} productName={imgModal.name} open={imgModal.open} onClose={closeImg} onNavigate={navigateImg} />
      <CartModal open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
