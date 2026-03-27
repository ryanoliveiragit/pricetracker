"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3, AlertCircle,
  Search, SlidersHorizontal, Tag,
  ChevronLeft, ChevronRight, RefreshCw, Clock,
  X, Star, Store as StoreIcon, Grid3X3, List, Package, Layers,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useSearchResults } from "../hooks/useSearchResults";
import type { Offer } from "../types/search";
import { ProductCard } from "../components/catalog/ProductCard";
import { CartIcon } from "../components/catalog/CartIcon";
import { CartModal } from "../components/catalog/CartModal";
import { ImageModal, useImageModal } from "../components/catalog/ImageModal";
import { cn } from "@/lib/utils";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const ITEMS_PER_PAGE = 24;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default function ModernResults() {
  const router = useRouter();

  function readItemsFromStorage(): string[] {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("construprice-last-search-items");
    return raw ? ((JSON.parse(raw) as string[]) ?? []) : [];
  }

  const [items, setItems] = useState<string[]>(readItemsFromStorage);

  const { loading, error, cacheAgeMinutes, sortBy, setSortBy, filteredItems, search } =
    useSearchResults();

  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [scraperAvgs, setScraperAvgs] = useState<Record<string, number>>({});
  const [elapsed, setElapsed] = useState(0);

  // Listen for header search events (when user is already on /results)
  useEffect(() => {
    function handleHeaderSearch(e: Event) {
      const detail = (e as CustomEvent<string[]>).detail;
      if (detail && detail.length > 0) {
        setItems(detail);
        void search(detail, true);
      }
    }
    window.addEventListener("construprice-header-search", handleHeaderSearch);
    return () => window.removeEventListener("construprice-header-search", handleHeaderSearch);
  }, [search]);

  useEffect(() => {
    fetch(`${API_BASE}/api/search/stats`)
      .then((r) => r.json())
      .then((data) => {
        const avgs: Record<string, number> = data.scraper_avg_seconds ?? {};
        setScraperAvgs(avgs);
        const total = data.total_estimated_seconds;
        if (total) setEstimatedWait(Math.round(total));
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!loading) { setElapsed(0); return; }
    const t0 = Date.now();
    const interval = setInterval(() => setElapsed(Math.floor((Date.now() - t0) / 1000)), 1000);
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (items.length > 0) void search(items);
  }, []);

  /* ── filter state ── */
  const [cardSearch, setCardSearch] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyBestPrice, setOnlyBestPrice] = useState(false);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(99999);
  const [activeSuppliers, setActiveSuppliers] = useState<Set<string>>(new Set());
  const [activeBrands, setActiveBrands] = useState<Set<string>>(new Set());
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [activeUnits, setActiveUnits] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [cartOpen, setCartOpen] = useState(false);
  const { state: imgModal, openModal, close: closeImg, navigate: navigateImg } = useImageModal();

  /* ── derived: flatten all offers ── */
  const allOffers: (Offer & { rawQuery: string })[] = useMemo(() => {
    if (!filteredItems) return [];
    return filteredItems.flatMap((item) =>
      item.offers.map((offer) => ({ ...offer, rawQuery: item.rawQuery }))
    );
  }, [filteredItems]);

  const priceStats = useMemo(() => {
    if (!allOffers.length) return { min: 0, max: 99999 };
    const prices = allOffers.filter((o) => o.price > 0).map((o) => o.price);
    return {
      min: Math.floor(Math.min(...prices)),
      max: Math.ceil(Math.max(...prices)),
    };
  }, [allOffers]);

  useEffect(() => {
    if (priceStats.min !== 0 || priceStats.max !== 99999) {
      setPriceMin(priceStats.min);
      setPriceMax(priceStats.max);
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

  /* ── filtered + paginated ── */
  // Pre-filter for text/brand/supplier/stock/price (everything EXCEPT best price)
  const preFiltered = useMemo(() => {
    return allOffers.filter((o) => {
      if (cardSearch) {
        const q = cardSearch.toLowerCase();
        const hit =
          o.productName.toLowerCase().includes(q) ||
          (o.description ?? "").toLowerCase().includes(q) ||
          (o.sku ?? "").toLowerCase().includes(q) ||
          o.store.toLowerCase().includes(q) ||
          (o.brand ?? "").toLowerCase().includes(q);
        if (!hit) return false;
      }
      if (onlyInStock && o.availability !== "em_estoque") return false;
      if (o.price > 0 && (o.price < priceMin || o.price > priceMax)) return false;
      if (activeSuppliers.size > 0 && !activeSuppliers.has(o.store)) return false;
      if (activeBrands.size > 0 && !(o.brand && activeBrands.has(o.brand))) return false;
      if (activeQuery !== null && o.rawQuery !== activeQuery) return false;
      if (activeUnits.size > 0 && !activeUnits.has(extractUnit(o.productName) ?? "")) return false;
      return true;
    });
  }, [allOffers, cardSearch, onlyInStock, priceMin, priceMax, activeSuppliers, activeBrands, activeQuery, activeUnits]);

  // Calculate best price WITHIN the currently visible (pre-filtered) results
  const lowestPriceInFiltered = useMemo(() => {
    const map = new Map<string, number>();
    preFiltered.forEach((o) => {
      if (o.price <= 0) return;
      const key = o.rawQuery;
      const cur = map.get(key);
      if (cur === undefined || o.price < cur) map.set(key, o.price);
    });
    return map;
  }, [preFiltered]);

  // Apply best price filter on top of pre-filtered
  const filtered = useMemo(() => {
    if (!onlyBestPrice) return preFiltered;
    return preFiltered.filter((o) => {
      const lowest = lowestPriceInFiltered.get(o.rawQuery) ?? 0;
      return o.price > 0 && o.price === lowest;
    });
  }, [preFiltered, onlyBestPrice, lowestPriceInFiltered]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / ITEMS_PER_PAGE));
  const paginated = filtered.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  useEffect(() => { setPage(1); }, [cardSearch, onlyInStock, onlyBestPrice, priceMin, priceMax, activeSuppliers, activeBrands, activeQuery, activeUnits, sortBy]);

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

  function selectQuery(name: string) {
    setActiveQuery((prev) => prev === name ? null : name);
  }
  function toggleUnit(u: string) {
    setActiveUnits((prev) => { const n = new Set(prev); n.has(u) ? n.delete(u) : n.add(u); return n; });
  }

  function clearFilters() {
    setCardSearch("");
    setOnlyInStock(false);
    setOnlyBestPrice(false);
    setActiveSuppliers(new Set());
    setActiveBrands(new Set());
    setActiveQuery(null);
    setActiveUnits(new Set());
    setPriceMin(priceStats.min);
    setPriceMax(priceStats.max);
  }

  const hasActiveFilters =
    !!cardSearch || onlyInStock || onlyBestPrice ||
    activeSuppliers.size > 0 || activeBrands.size > 0 ||
    activeQuery !== null || activeUnits.size > 0;

  const activeFilterCount = [
    !!cardSearch, onlyInStock, onlyBestPrice,
    activeSuppliers.size > 0, activeBrands.size > 0,
    activeQuery !== null, activeUnits.size > 0,
    priceMin !== priceStats.min || priceMax !== priceStats.max,
  ].filter(Boolean).length;

  /* ── empty state ── */
  if (items.length === 0) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-slate-100 dark:bg-neutral-800">
            <AlertCircle className="h-8 w-8 text-slate-400 dark:text-neutral-500" />
          </div>
          <h2 className="mb-2 text-xl font-semibold text-slate-800 dark:text-neutral-100">Nenhuma busca encontrada</h2>
          <p className="mb-6 text-sm text-slate-500 dark:text-neutral-400">Volte para a tela de busca e selecione os produtos para cotação</p>
          <Link href="/search" className="inline-flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-emerald-600">
            Iniciar Nova Busca
          </Link>
        </motion.div>
      </div>
    );
  }

  const totalOffers = allOffers.length;
  const uniqueStores = new Set(allOffers.map((o) => o.store)).size;
  const bestPriceInFiltered = lowestPriceInFiltered.size > 0
    ? Math.min(...Array.from(lowestPriceInFiltered.values()))
    : null;

  /* ── Filter sidebar content (reused for desktop and mobile) ── */
  const filterContent = (
    <div className="space-y-5">
      {/* Sidebar header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="h-4 w-4 text-emerald-500" />
          <span className="text-sm font-semibold text-slate-800 dark:text-neutral-100">Filtros</span>
          {activeFilterCount > 0 && (
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-emerald-500 text-[10px] font-bold text-white">
              {activeFilterCount}
            </span>
          )}
        </div>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-xs font-medium text-emerald-500 hover:text-emerald-600">
            Limpar
          </button>
        )}
      </div>

      {/* Quick search */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Busca Rápida</p>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
          <input
            value={cardSearch}
            onChange={(e) => setCardSearch(e.target.value)}
            placeholder="Nome, Marca ou SKU..."
            className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 py-2 pl-8 pr-8 text-xs text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
          />
          {cardSearch && (
            <button
              onClick={() => setCardSearch("")}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-neutral-300"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Quick toggles */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Filtros Rápidos</p>
        <div className="space-y-1">
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors">
            <input type="checkbox" checked={onlyInStock} onChange={(e) => setOnlyInStock(e.target.checked)} className="h-3.5 w-3.5 rounded accent-emerald-500" />
            <span className="flex-1">Apenas em estoque</span>
          </label>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-xs text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors">
            <input type="checkbox" checked={onlyBestPrice} onChange={(e) => setOnlyBestPrice(e.target.checked)} className="h-3.5 w-3.5 rounded accent-emerald-500" />
            <div className="flex items-center gap-1.5 flex-1">
              <Star className="h-3 w-3 text-amber-500" />
              <span>Apenas melhor preço</span>
            </div>
          </label>
        </div>
      </div>

      {/* Price range */}
      <div>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">Faixa de Preço</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <input
              type="number"
              value={priceMin}
              onChange={(e) => setPriceMin(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-neutral-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              placeholder="Mín"
            />
          </div>
          <div>
            <input
              type="number"
              value={priceMax}
              onChange={(e) => setPriceMax(Number(e.target.value))}
              className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-2.5 py-1.5 text-xs text-slate-800 dark:text-neutral-100 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
              placeholder="Máx"
            />
          </div>
        </div>
        <div className="mt-1 flex justify-between text-[10px] text-slate-400 dark:text-neutral-500">
          <span>{formatBRL(priceMin)}</span>
          <span>{formatBRL(priceMax)}</span>
        </div>
      </div>

      {/* Produtos buscados */}
      {items.length > 1 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
            <Layers className="inline h-3 w-3 mr-1" />
            Produto
          </p>
          <div className="space-y-1">
            <button
              onClick={() => setActiveQuery(null)}
              className={cn(
                "w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors",
                activeQuery === null
                  ? "bg-slate-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                  : "text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800"
              )}
            >
              <span>Todos</span>
              <span className="text-[10px] opacity-60">{allOffers.length}</span>
            </button>
            {items.map((q) => {
              const count = allOffers.filter((o) => o.rawQuery === q).length;
              const isActive = activeQuery === q;
              return (
                <button
                  key={q}
                  onClick={() => selectQuery(q)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-2.5 py-2 text-xs font-medium transition-colors text-left",
                    isActive
                      ? "bg-emerald-500 text-white"
                      : "text-slate-600 dark:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800"
                  )}
                >
                  <span className="truncate">{q}</span>
                  <span className={cn("flex-shrink-0 ml-2 text-[10px]", isActive ? "opacity-70" : "text-slate-400 dark:text-neutral-500")}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Unidade/Tamanho */}
      {allUnits.length > 1 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
            <Package className="inline h-3 w-3 mr-1" />
            Embalagem
          </p>
          <div className="flex flex-wrap gap-1.5">
            {allUnits.map((u) => {
              const count = allOffers.filter((o) => extractUnit(o.productName) === u).length;
              return (
                <button key={u} onClick={() => toggleUnit(u)}
                  className={cn(
                    "rounded-lg px-2.5 py-1 text-[11px] font-medium transition-colors border",
                    activeUnits.has(u)
                      ? "bg-emerald-500 border-emerald-500 text-white"
                      : "border-slate-200 dark:border-neutral-700 text-slate-600 dark:text-neutral-300 hover:border-emerald-300 hover:text-emerald-600"
                  )}
                >
                  {u} <span className="opacity-60">({count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Brands */}
      {allBrands.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
            <Tag className="inline h-3 w-3 mr-1" />
            Marcas ({allBrands.length})
          </p>
          <div className="space-y-0.5 max-h-36 overflow-y-auto pr-1">
            {allBrands.map((brand) => {
              const count = allOffers.filter((o) => o.brand === brand).length;
              return (
                <label key={brand} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={activeBrands.has(brand)}
                      onChange={() => toggleBrand(brand)}
                      className="h-3.5 w-3.5 rounded accent-emerald-500"
                    />
                    <span className="truncate text-xs text-slate-600 dark:text-neutral-300">{brand}</span>
                  </div>
                  <span className="flex-shrink-0 ml-1 text-[10px] text-slate-400 dark:text-neutral-500">{count}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Suppliers */}
      {allSuppliers.length > 0 && (
        <div>
          <p className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
            <StoreIcon className="inline h-3 w-3 mr-1" />
            Lojas ({allSuppliers.length})
          </p>
          <div className="space-y-0.5">
            {allSuppliers.map((supplier) => {
              const count = allOffers.filter((o) => o.store === supplier).length;
              return (
                <label key={supplier} className="flex cursor-pointer items-center justify-between rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors">
                  <div className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={activeSuppliers.has(supplier)}
                      onChange={() => toggleSupplier(supplier)}
                      className="h-3.5 w-3.5 rounded accent-emerald-500"
                    />
                    <span className="truncate text-xs text-slate-600 dark:text-neutral-300">{supplier}</span>
                  </div>
                  <span className="flex-shrink-0 ml-1 text-[10px] text-slate-400 dark:text-neutral-500">{count}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div>
      {/* ── Header ── */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        className="mb-5"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <BarChart3 className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-500 uppercase tracking-wider">Resultados</span>
            </div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-800 dark:text-neutral-100">
              {items.length === 1 ? items[0] : `${items.length} produtos`}
            </h1>
            {!loading && totalOffers > 0 && (
              <div className="mt-1 flex flex-wrap items-center gap-3">
                <p className="text-sm text-slate-500 dark:text-neutral-400">
                  <span className="font-semibold text-slate-700 dark:text-neutral-300">{totalOffers}</span> oferta{totalOffers !== 1 ? "s" : ""} em{" "}
                  <span className="font-semibold text-slate-700 dark:text-neutral-300">{uniqueStores}</span> loja{uniqueStores !== 1 ? "s" : ""}
                  {bestPriceInFiltered !== null && (
                    <span className="ml-2 text-emerald-600 dark:text-emerald-400 font-semibold">
                      · a partir de {formatBRL(bestPriceInFiltered)}
                    </span>
                  )}
                </p>
                {cacheAgeMinutes !== null && (
                  <span className="flex items-center gap-1 text-xs text-slate-400 dark:text-neutral-500">
                    <Clock className="h-3 w-3" />
                    {cacheAgeMinutes === 0 ? "Atualizado agora" : `${cacheAgeMinutes} min atrás`}
                  </span>
                )}
              </div>
            )}
          </div>
          <div className="flex flex-shrink-0 flex-wrap items-center gap-2">
            {cacheAgeMinutes !== null && (
              <button
                onClick={() => void search(items, true)}
                className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs font-medium text-slate-500 dark:text-neutral-400 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-300"
                title="Atualizar resultados"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            )}
            <Link
              href="/search"
              className="rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3 py-2 text-xs sm:text-sm font-medium text-slate-600 dark:text-neutral-300 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800 hover:text-slate-800 dark:hover:text-neutral-100"
            >
              Nova Busca
            </Link>
            <CartIcon onClick={() => setCartOpen(true)} />
          </div>
        </div>
      </motion.div>

      {/* ── Active filter tags ── */}
      {hasActiveFilters && !loading && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mb-4 flex flex-wrap items-center gap-2"
        >
          <span className="text-xs text-slate-400 dark:text-neutral-500">Filtros:</span>
          {cardSearch && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              &quot;{cardSearch}&quot;
              <button onClick={() => setCardSearch("")} className="ml-0.5 hover:text-emerald-900 dark:hover:text-emerald-300"><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {onlyBestPrice && (
            <span className="inline-flex items-center gap-1 rounded-full bg-amber-50 dark:bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-400">
              <Star className="h-2.5 w-2.5" /> Melhor preço
              <button onClick={() => setOnlyBestPrice(false)} className="ml-0.5"><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {onlyInStock && (
            <span className="inline-flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-500/10 px-2.5 py-1 text-[11px] font-medium text-blue-700 dark:text-blue-400">
              Em estoque
              <button onClick={() => setOnlyInStock(false)} className="ml-0.5"><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {activeQuery !== null && (
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-900 dark:bg-neutral-100 px-2.5 py-1 text-[11px] font-medium text-white dark:text-neutral-900">
              <Layers className="h-2.5 w-2.5" />{activeQuery}
              <button onClick={() => setActiveQuery(null)} className="ml-0.5"><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {Array.from(activeUnits).map((u) => (
            <span key={u} className="inline-flex items-center gap-1 rounded-full bg-orange-50 dark:bg-orange-500/10 px-2.5 py-1 text-[11px] font-medium text-orange-700 dark:text-orange-400">
              <Package className="h-2.5 w-2.5" />{u}
              <button onClick={() => toggleUnit(u)} className="ml-0.5"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          {Array.from(activeBrands).map((b) => (
            <span key={b} className="inline-flex items-center gap-1 rounded-full bg-violet-50 dark:bg-violet-500/10 px-2.5 py-1 text-[11px] font-medium text-violet-700 dark:text-violet-400">
              {b}
              <button onClick={() => toggleBrand(b)} className="ml-0.5"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          {Array.from(activeSuppliers).map((s) => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-slate-100 dark:bg-neutral-800 px-2.5 py-1 text-[11px] font-medium text-slate-600 dark:text-neutral-300">
              {s}
              <button onClick={() => toggleSupplier(s)} className="ml-0.5"><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          <button onClick={clearFilters} className="text-[11px] font-medium text-red-500 hover:text-red-600 ml-1">
            Limpar tudo
          </button>
        </motion.div>
      )}

      {/* ── Layout ── */}
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start">
        {/* ── Desktop Sidebar ── */}
        <motion.aside
          initial={{ opacity: 0, x: -16 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.35, delay: 0.05 }}
          className="hidden w-60 flex-shrink-0 lg:block"
        >
          <div className="sticky top-6 rounded-2xl border border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-sm">
            {filterContent}
          </div>
        </motion.aside>

        {/* ── Mobile Filter Drawer ── */}
        <AnimatePresence>
          {mobileFiltersOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm lg:hidden"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-white dark:bg-neutral-900 shadow-2xl p-5 overflow-y-auto lg:hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-bold text-slate-800 dark:text-neutral-100">Filtros</span>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-neutral-800"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {filterContent}
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="mt-6 w-full rounded-lg bg-emerald-500 py-2.5 text-sm font-semibold text-white hover:bg-emerald-600 transition-colors"
                >
                  Ver {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Main ── */}
        <div className="min-w-0 flex-1">
          {/* Sort bar */}
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3, delay: 0.1 }}
            className="mb-4 flex items-center justify-between gap-2"
          >
            <div className="flex items-center gap-2">
              <button
                onClick={() => setMobileFiltersOpen(true)}
                className={cn(
                  "flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors lg:hidden",
                  hasActiveFilters
                    ? "border-emerald-300 dark:border-emerald-500/30 bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                    : "border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800"
                )}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" />
                Filtros
                {activeFilterCount > 0 && (
                  <span className="flex h-4 w-4 items-center justify-center rounded-full bg-emerald-500 text-[9px] font-bold text-white">
                    {activeFilterCount}
                  </span>
                )}
              </button>
              <span className="text-xs text-slate-500 dark:text-neutral-400">
                <span className="font-semibold text-slate-700 dark:text-neutral-200">{filtered.length}</span> resultado{filtered.length !== 1 ? "s" : ""}
                {totalPages > 1 && (
                  <span className="ml-1 text-slate-400 dark:text-neutral-500">
                    · pág. {page}/{totalPages}
                  </span>
                )}
              </span>
            </div>
            <div className="flex items-center gap-2">
              {/* View mode toggle */}
              <div className="hidden sm:flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-0.5">
                <button
                  onClick={() => setViewMode("grid")}
                  className={cn("rounded-md p-1.5 transition-colors", viewMode === "grid" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-slate-600")}
                >
                  <Grid3X3 className="h-3.5 w-3.5" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={cn("rounded-md p-1.5 transition-colors", viewMode === "list" ? "bg-emerald-500 text-white" : "text-slate-400 hover:text-slate-600")}
                >
                  <List className="h-3.5 w-3.5" />
                </button>
              </div>
              {/* Sort */}
              <div className="flex items-center gap-0.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-0.5">
                {(["best_price", "alphabetical"] as const).map((opt) => (
                  <button
                    key={opt}
                    onClick={() => setSortBy(opt)}
                    className={cn(
                      "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                      sortBy === opt
                        ? "bg-emerald-500 text-white"
                        : "text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800"
                    )}
                  >
                    {opt === "best_price" ? "Menor Preço" : "A-Z"}
                  </button>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Loading */}
          {loading && (
            <div className="flex flex-col items-center justify-center py-20 gap-4">
              <div className="relative">
                <div className="h-14 w-14 animate-spin rounded-full border-4 border-slate-200 dark:border-neutral-700 border-t-emerald-500" />
                <Search className="absolute inset-0 m-auto h-5 w-5 text-emerald-500" />
              </div>
              <div className="text-center">
                <p className="text-sm font-medium text-slate-700 dark:text-neutral-200">Buscando em todas as lojas...</p>
                <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500">Isso pode levar alguns segundos</p>
              </div>

              <div className="flex flex-col items-center gap-2">
                {estimatedWait !== null && (
                  <div className="flex items-center gap-3 rounded-xl bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 px-4 py-2.5">
                    <Clock className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                    <div className="text-xs">
                      <span className="text-slate-500 dark:text-neutral-400">Estimado: </span>
                      <span className="font-semibold text-slate-700 dark:text-neutral-200">~{estimatedWait}s</span>
                      {elapsed > 0 && (
                        <span className="ml-2 text-slate-400 dark:text-neutral-500">
                          ({elapsed}s decorridos)
                        </span>
                      )}
                    </div>
                  </div>
                )}
                {/* Progress bar */}
                {estimatedWait !== null && elapsed > 0 && (
                  <div className="w-48 h-1.5 rounded-full bg-slate-200 dark:bg-neutral-700 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-emerald-500"
                      initial={{ width: "0%" }}
                      animate={{ width: `${Math.min(95, (elapsed / estimatedWait) * 100)}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                )}
              </div>

              {Object.keys(scraperAvgs).length > 0 && (
                <div className="mt-2 flex flex-wrap justify-center gap-2">
                  {Object.entries(scraperAvgs).map(([key, avg]) => (
                    <span
                      key={key}
                      className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-xs text-slate-500 dark:text-neutral-400"
                    >
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                      {key}: ~{Math.round(avg)}s
                    </span>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="rounded-xl border border-red-200 dark:border-red-500/20 bg-red-50 dark:bg-red-500/10 p-6">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400 flex-shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium text-red-600 dark:text-red-400 mb-1">Erro ao buscar resultados</p>
                  <p className="text-sm text-red-500 dark:text-red-400/80">{error}</p>
                </div>
              </div>
            </div>
          )}

          {/* No results after filter */}
          {!loading && !error && filtered.length === 0 && allOffers.length > 0 && (
            <div className="rounded-2xl border border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-12 text-center shadow-sm">
              <Search className="mx-auto mb-4 h-12 w-12 text-slate-300 dark:text-neutral-600" />
              <h3 className="mb-2 text-lg font-semibold text-slate-600 dark:text-neutral-300">Nenhum resultado para os filtros aplicados</h3>
              <p className="mb-4 text-sm text-slate-400 dark:text-neutral-500">
                {cardSearch && `Nenhum produto encontrado para "${cardSearch}"`}
                {!cardSearch && "Tente ajustar os filtros para ver mais resultados"}
              </p>
              <button onClick={clearFilters} className="rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-4 py-2 text-sm font-medium text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 transition-colors">
                Limpar todos os filtros
              </button>
            </div>
          )}

          {/* Cards grid */}
          {!loading && !error && paginated.length > 0 && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.35, delay: 0.15 }}
                className={cn(
                  viewMode === "grid"
                    ? "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
                    : "flex flex-col gap-3"
                )}
              >
                {paginated.map((offer, i) => {
                  const lowestForQuery = lowestPriceInFiltered.get(offer.rawQuery) ?? 0;
                  const isBest = offer.price > 0 && offer.price === lowestForQuery;
                  return (
                    <ProductCard
                      key={`${offer.rawQuery}-${offer.store}-${offer.sku ?? ""}-${i}`}
                      offer={{ ...offer, isBestPrice: isBest }}
                      index={i}
                      onImageClick={openModal}
                      searchQuery={offer.rawQuery}
                    />
                  );
                })}
              </motion.div>

              {/* ── Pagination ── */}
              {totalPages > 1 && (
                <div className="mt-8 flex items-center justify-center gap-1.5">
                  <button
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    disabled={page === 1}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </button>

                  {Array.from({ length: totalPages }, (_, i) => i + 1)
                    .filter((p) => p === 1 || p === totalPages || Math.abs(p - page) <= 2)
                    .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                      if (idx > 0 && p - (arr[idx - 1] as number) > 1) acc.push("...");
                      acc.push(p);
                      return acc;
                    }, [])
                    .map((p, idx) =>
                      p === "..." ? (
                        <span key={`ellipsis-${idx}`} className="px-1 text-slate-400 dark:text-neutral-600">…</span>
                      ) : (
                        <button
                          key={p}
                          onClick={() => setPage(p as number)}
                          className={cn(
                            "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                            page === p
                              ? "bg-emerald-500 text-white shadow-sm"
                              : "border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800"
                          )}
                        >
                          {p}
                        </button>
                      )
                    )}

                  <button
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    disabled={page === totalPages}
                    className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800 disabled:cursor-not-allowed disabled:opacity-30"
                  >
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Modals */}
      <ImageModal
        images={imgModal.images}
        currentIndex={imgModal.index}
        productName={imgModal.name}
        open={imgModal.open}
        onClose={closeImg}
        onNavigate={navigateImg}
      />
      <CartModal open={cartOpen} onClose={() => setCartOpen(false)} />
    </div>
  );
}
