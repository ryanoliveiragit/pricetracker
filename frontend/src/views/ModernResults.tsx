"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle, CheckCircle2, Loader2, TriangleAlert,
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

  const { loading, error, cacheAgeMinutes, sortBy, setSortBy, filteredItems, search, storeStates } =
    useSearchResults();

  const [estimatedWait, setEstimatedWait] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const failedStores = storeStates.filter((s) => s.status === "error");

  // Abre modal de erros automaticamente ao terminar a busca com falhas
  useEffect(() => {
    if (!loading && failedStores.length > 0) setShowErrorModal(true);
  }, [loading]);

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
      <div className="flex min-h-screen items-center justify-center bg-[#F7F7F5]">
        <div className="text-center px-4">
          <AlertCircle className="mx-auto mb-4 h-10 w-10 text-[#A0A09A]" />
          <h2 className="mb-2 text-xl font-semibold text-[#1A1A18]">Nenhuma busca encontrada</h2>
          <p className="mb-6 text-sm text-[#6B6B63]">Volte para a tela de busca e selecione os produtos para cotação</p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-lg bg-[#84CC16] px-4 py-2.5 text-sm font-semibold text-[#1A1A18] transition-all hover:bg-[#78b814]"
          >
            Iniciar Nova Busca
          </Link>
        </div>
      </div>
    );
  }

  const totalOffers = allOffers.length;
  const uniqueStores = new Set(allOffers.map((o) => o.store)).size;
  const bestPriceInFiltered = lowestPriceInFiltered.size > 0
    ? Math.min(...Array.from(lowestPriceInFiltered.values()))
    : null;

  const progress = Math.round(
    (storeStates.filter((s) => s.status === "done" || s.status === "error").length /
      Math.max(storeStates.length, 1)) * 100
  );

  /* ── Filter sidebar content ── */
  const filterContent = (
    <div className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-widest text-[#A0A09A]">Filtros</span>
        {hasActiveFilters && (
          <button onClick={clearFilters} className="text-[11px] font-medium text-[#84CC16] hover:underline">
            Limpar tudo
          </button>
        )}
      </div>

      {/* Active filter chips — show when filters active */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {onlyInStock && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#84CC16]/15 border border-[#84CC16]/30 px-2.5 py-1 text-[11px] font-medium text-[#3d6600]">
              Em estoque
              <button onClick={() => setOnlyInStock(false)}><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {onlyBestPrice && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#84CC16]/15 border border-[#84CC16]/30 px-2.5 py-1 text-[11px] font-medium text-[#3d6600]">
              Melhor preço
              <button onClick={() => setOnlyBestPrice(false)}><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {cardSearch && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#84CC16]/15 border border-[#84CC16]/30 px-2.5 py-1 text-[11px] font-medium text-[#3d6600]">
              &ldquo;{cardSearch}&rdquo;
              <button onClick={() => setCardSearch("")}><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {activeQuery && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[#84CC16]/15 border border-[#84CC16]/30 px-2.5 py-1 text-[11px] font-medium text-[#3d6600]">
              {activeQuery}
              <button onClick={() => setActiveQuery(null)}><X className="h-2.5 w-2.5" /></button>
            </span>
          )}
          {Array.from(activeUnits).map(u => (
            <span key={u} className="inline-flex items-center gap-1 rounded-full bg-[#84CC16]/15 border border-[#84CC16]/30 px-2.5 py-1 text-[11px] font-medium text-[#3d6600]">
              {u}
              <button onClick={() => toggleUnit(u)}><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
          {Array.from(activeSuppliers).map(s => (
            <span key={s} className="inline-flex items-center gap-1 rounded-full bg-[#84CC16]/15 border border-[#84CC16]/30 px-2.5 py-1 text-[11px] font-medium text-[#3d6600]">
              {s}
              <button onClick={() => toggleSupplier(s)}><X className="h-2.5 w-2.5" /></button>
            </span>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Busca</p>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#C0C0BA]" />
          <input
            value={cardSearch}
            onChange={(e) => setCardSearch(e.target.value)}
            placeholder="Nome, SKU..."
            className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] py-2.5 pl-9 pr-8 text-sm text-[#1A1A18] placeholder-[#C0C0BA] focus:border-[#84CC16] focus:outline-none focus:bg-white transition-colors"
          />
          {cardSearch && (
            <button onClick={() => setCardSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#C0C0BA] hover:text-[#6B6B63]">
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Quick toggles - as toggle rows */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Exibir</p>
        {(
          [
            { label: "Apenas em estoque", value: onlyInStock, set: setOnlyInStock },
            { label: "Melhor preço por produto", value: onlyBestPrice, set: setOnlyBestPrice },
          ] as { label: string; value: boolean; set: (v: boolean) => void }[]
        ).map(({ label, value, set }) => (
          <button
            key={label}
            onClick={() => set(!value)}
            className={cn(
              "w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors border",
              value
                ? "border-[#84CC16]/40 bg-[#84CC16]/10 text-[#1A1A18]"
                : "border-transparent bg-[#F7F7F5] text-[#6B6B63] hover:bg-[#EFEFEB]"
            )}
          >
            <span className="font-medium text-xs">{label}</span>
            <div className={cn(
              "h-4 w-7 rounded-full transition-colors relative flex-shrink-0",
              value ? "bg-[#84CC16]" : "bg-[#D0D0CA]"
            )}>
              <div className={cn(
                "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform",
                value ? "translate-x-3.5" : "translate-x-0.5"
              )} />
            </div>
          </button>
        ))}
      </div>

      {/* Price */}
      <div className="space-y-1.5">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Faixa de preço</p>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="text-[10px] text-[#A0A09A] mb-1 block">Mínimo</label>
            <input
              type="number"
              value={priceMin}
              onChange={(e) => setPriceMin(Number(e.target.value))}
              className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2 text-sm text-[#1A1A18] focus:border-[#84CC16] focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] text-[#A0A09A] mb-1 block">Máximo</label>
            <input
              type="number"
              value={priceMax}
              onChange={(e) => setPriceMax(Number(e.target.value))}
              className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2 text-sm text-[#1A1A18] focus:border-[#84CC16] focus:outline-none"
            />
          </div>
        </div>
        <p className="text-[10px] text-[#A0A09A]">{formatBRL(priceMin)} — {formatBRL(priceMax)}</p>
      </div>

      {/* Produto filter (only when multiple items) */}
      {items.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Produto</p>
          <div className="space-y-0.5">
            <button
              onClick={() => setActiveQuery(null)}
              className={cn(
                "w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors",
                activeQuery === null ? "bg-[#1A1A18] text-white" : "text-[#6B6B63] hover:bg-[#F7F7F5]"
              )}
            >
              <span className="font-medium">Todos</span>
              <span className={cn("text-[10px]", activeQuery === null ? "opacity-50" : "text-[#A0A09A]")}>{allOffers.length}</span>
            </button>
            {items.map((q) => {
              const count = allOffers.filter((o) => o.rawQuery === q).length;
              const isActive = activeQuery === q;
              return (
                <button
                  key={q}
                  onClick={() => selectQuery(q)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors text-left",
                    isActive ? "bg-[#84CC16] text-[#1A1A18] font-medium" : "text-[#6B6B63] hover:bg-[#F7F7F5]"
                  )}
                >
                  <span className="truncate">{q}</span>
                  <span className={cn("flex-shrink-0 ml-2 text-[10px]", isActive ? "opacity-60" : "text-[#A0A09A]")}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Embalagem */}
      {allUnits.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Embalagem</p>
          <div className="flex flex-wrap gap-1.5">
            {allUnits.map((u) => {
              const count = allOffers.filter((o) => extractUnit(o.productName) === u).length;
              return (
                <button key={u} onClick={() => toggleUnit(u)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-medium transition-colors",
                    activeUnits.has(u)
                      ? "bg-[#84CC16] text-[#1A1A18]"
                      : "bg-[#F7F7F5] text-[#6B6B63] hover:bg-[#EFEFEB] border border-[#E8E8E4]"
                  )}
                >
                  {u} <span className="opacity-50 font-normal">{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Marcas */}
      {allBrands.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">
            Marcas <span className="font-normal normal-case">({allBrands.length})</span>
          </p>
          <div className="space-y-0.5 max-h-40 overflow-y-auto">
            {allBrands.map((brand) => {
              const count = allOffers.filter((o) => o.brand === brand).length;
              const active = activeBrands.has(brand);
              return (
                <label key={brand} className={cn(
                  "flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors",
                  active ? "bg-[#84CC16]/10" : "hover:bg-[#F7F7F5]"
                )}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "flex-shrink-0 h-3.5 w-3.5 rounded border transition-colors flex items-center justify-center",
                      active ? "bg-[#84CC16] border-[#84CC16]" : "border-[#D0D0CA] bg-white"
                    )}>
                      {active && <svg viewBox="0 0 10 8" className="h-2 w-2 fill-[#1A1A18]"><path d="M1 4l3 3 5-6" stroke="currentColor" strokeWidth="1.5" fill="none"/></svg>}
                      <input type="checkbox" checked={active} onChange={() => toggleBrand(brand)} className="sr-only" />
                    </div>
                    <span className={cn("truncate text-xs", active ? "text-[#1A1A18] font-medium" : "text-[#6B6B63]")}>{brand}</span>
                  </div>
                  <span className="flex-shrink-0 ml-2 text-[10px] text-[#A0A09A]">{count}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}

      {/* Lojas */}
      {allSuppliers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">
            Lojas <span className="font-normal normal-case">({allSuppliers.length})</span>
          </p>
          <div className="space-y-0.5">
            {allSuppliers.map((supplier) => {
              const count = allOffers.filter((o) => o.store === supplier).length;
              const active = activeSuppliers.has(supplier);
              return (
                <label key={supplier} className={cn(
                  "flex cursor-pointer items-center justify-between rounded-lg px-3 py-2 transition-colors",
                  active ? "bg-[#84CC16]/10" : "hover:bg-[#F7F7F5]"
                )}>
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className={cn(
                      "flex-shrink-0 h-3.5 w-3.5 rounded border transition-colors flex items-center justify-center",
                      active ? "bg-[#84CC16] border-[#84CC16]" : "border-[#D0D0CA] bg-white"
                    )}>
                      {active && <svg viewBox="0 0 10 8" className="h-2 w-2 fill-none stroke-[#1A1A18] stroke-[1.5]"><path d="M1 4l3 3 5-6"/></svg>}
                      <input type="checkbox" checked={active} onChange={() => toggleSupplier(supplier)} className="sr-only" />
                    </div>
                    <span className={cn("truncate text-xs", active ? "text-[#1A1A18] font-medium" : "text-[#6B6B63]")}>{supplier}</span>
                  </div>
                  <span className="flex-shrink-0 ml-2 text-[10px] text-[#A0A09A]">{count}</span>
                </label>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-[#F7F7F5]">

      {/* ── Top bar ── */}
      <div className="sticky top-0 md:top-16 z-30 h-14 bg-white border-b border-[#E8E8E4] px-4 flex items-center gap-4">
        {/* Left: breadcrumb */}
        <div className="flex-1 min-w-0">
          <span className="text-xs text-[#A0A09A]">
            Busca&nbsp;/&nbsp;
            <span className="text-[#6B6B63] font-medium truncate">
              {items.length === 1 ? items[0] : `${items.length} produtos`}
            </span>
          </span>
        </div>

        {/* Center: store status pills (md+) */}
        {storeStates.length > 0 && (
          <div className="hidden md:flex items-center gap-1.5 overflow-x-auto max-w-md">
            {storeStates.map((s) => {
              const isDone = s.status === "done";
              const isError = s.status === "error";
              const isSearching = s.status === "searching";
              return (
                <span
                  key={s.name}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border whitespace-nowrap",
                    isDone && "border-[#E8E8E4] bg-white text-[#6B6B63]",
                    isSearching && "border-amber-200 bg-amber-50 text-amber-700",
                    isError && "border-red-200 bg-red-50 text-red-600",
                    !isDone && !isSearching && !isError && "border-[#E8E8E4] bg-[#F7F7F5] text-[#A0A09A]"
                  )}
                >
                  {isSearching && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
                  {isDone && <span className="h-1.5 w-1.5 rounded-full bg-[#84CC16]" />}
                  {isError && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                  {!isDone && !isSearching && !isError && <span className="h-1.5 w-1.5 rounded-full bg-[#D0D0CA]" />}
                  {s.name}
                  {isDone && s.offerCount > 0 && (
                    <span className="text-[#84CC16] font-semibold">{s.offerCount}</span>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {/* Right actions */}
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Mobile filter button (below xl) */}
          <button onClick={() => setMobileFiltersOpen(true)} className="xl:hidden flex items-center gap-1.5 rounded-lg border border-[#E8E8E4] bg-white px-3 py-1.5 text-xs font-medium text-[#6B6B63]">
            <SlidersHorizontal className="h-3.5 w-3.5" />
            {activeFilterCount > 0 && <span className="flex h-4 w-4 items-center justify-center rounded-full bg-[#84CC16] text-[9px] font-bold text-[#1A1A18]">{activeFilterCount}</span>}
            <span className="hidden sm:inline">Filtros</span>
          </button>

          {cacheAgeMinutes !== null && !loading && (
            <span className="hidden sm:flex items-center gap-1 text-[10px] text-[#A0A09A]">
              <Clock className="h-3 w-3" />
              {cacheAgeMinutes === 0 ? "Agora" : `${cacheAgeMinutes}min`}
            </span>
          )}

          {cacheAgeMinutes !== null && (
            <button
              onClick={() => void search(items, true)}
              className="flex items-center gap-1.5 rounded-lg border border-[#E8E8E4] bg-white px-3 py-1.5 text-xs font-medium text-[#6B6B63] transition-colors hover:bg-[#F7F7F5] hover:text-[#1A1A18]"
              title="Atualizar resultados"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Atualizar</span>
            </button>
          )}

          {!loading && failedStores.length > 0 && (
            <button
              onClick={() => setShowErrorModal(true)}
              title={`${failedStores.length} loja(s) com erro`}
              className="relative flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-100 transition-colors"
            >
              <TriangleAlert className="h-3.5 w-3.5" />
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-amber-500 text-[9px] font-bold text-white">
                {failedStores.length}
              </span>
            </button>
          )}

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
      <div className="flex pt-14" style={{ marginTop: "-56px", paddingTop: "56px" }}>

        {/* ── Desktop Sidebar (xl+) ── */}
        <aside id="tour-results-filters" className="w-72 shrink-0 border-r border-[#E8E8E4] bg-white hidden xl:flex flex-col h-[calc(100vh-120px)] sticky top-[120px] overflow-y-auto">
          <div className="px-5 py-6">
            {filterContent}
          </div>
        </aside>

        {/* ── Mobile Filter Drawer ── */}
        <AnimatePresence>
          {mobileFiltersOpen && (
            <>
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm xl:hidden"
                onClick={() => setMobileFiltersOpen(false)}
              />
              <motion.div
                initial={{ x: -300 }}
                animate={{ x: 0 }}
                exit={{ x: -300 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-[280px] bg-white border-r border-[#E8E8E4] shadow-2xl px-5 py-6 overflow-y-auto xl:hidden"
              >
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-semibold text-[#1A1A18]">Filtros</span>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-[#A0A09A] hover:bg-[#F7F7F5]"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                {filterContent}
                <button
                  onClick={() => setMobileFiltersOpen(false)}
                  className="mt-6 w-full rounded-lg bg-[#84CC16] py-2.5 text-sm font-semibold text-[#1A1A18] hover:bg-[#78b814] transition-colors"
                >
                  Ver {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                </button>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* ── Main area ── */}
        <div className="flex-1 min-w-0">
          <div className="max-w-full px-4 py-6">

            {/* Stat cards */}
            {totalOffers > 0 && (
              <div id="tour-results-stats" className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
                {(
                  [
                    { label: "Ofertas", value: totalOffers, sub: `em ${uniqueStores} loja${uniqueStores !== 1 ? "s" : ""}`, icon: Package, accent: false },
                    { label: "Lojas ativas", value: uniqueStores, sub: "consultadas agora", icon: StoreIcon, accent: false },
                    { label: "Menor preço", value: bestPriceInFiltered ? formatBRL(bestPriceInFiltered) : "—", sub: "a partir de", icon: Tag, accent: !!bestPriceInFiltered },
                  ] as { label: string; value: string | number; sub: string; icon: React.ElementType; accent: boolean }[]
                ).map(({ label, value, sub, icon: Icon, accent }) => (
                  <div key={label} className="bg-white border border-[#E8E8E4] rounded-xl px-5 py-4 shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <p className="text-[11px] font-medium uppercase tracking-widest text-[#A0A09A]">{label}</p>
                      <Icon className="h-4 w-4 text-[#D0D0CA]" />
                    </div>
                    <p className={cn("text-2xl font-bold", accent ? "text-[#84CC16]" : "text-[#1A1A18]")}>{value}</p>
                    <p className="text-xs text-[#A0A09A] mt-0.5">{sub}</p>
                  </div>
                ))}
              </div>
            )}

            {/* Toolbar — sticky below top bar */}
              <div id="tour-results-toolbar" className="sticky top-14 md:top-[calc(64px+56px)] z-20 bg-[#F7F7F5] py-3 border-b border-[#E8E8E4] mb-4 -mx-4 px-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-[#6B6B63]">
                    <span className="font-semibold text-[#1A1A18]">{filtered.length}</span> resultado{filtered.length !== 1 ? "s" : ""}
                    {totalPages > 1 && (
                      <span className="ml-1 text-[#A0A09A]">· pág. {page}/{totalPages}</span>
                    )}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {/* View mode toggle */}
                  <div className="hidden sm:flex items-center gap-0.5 rounded-lg border border-[#E8E8E4] bg-white p-0.5">
                    <button
                      onClick={() => setViewMode("grid")}
                      className={cn(
                        "rounded-md p-1.5 transition-colors",
                        viewMode === "grid" ? "bg-[#84CC16] text-white" : "text-[#A0A09A] hover:text-[#6B6B63]"
                      )}
                    >
                      <Grid3X3 className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setViewMode("list")}
                      className={cn(
                        "rounded-md p-1.5 transition-colors",
                        viewMode === "list" ? "bg-[#84CC16] text-[#1A1A18]" : "text-[#A0A09A] hover:text-[#6B6B63]"
                      )}
                    >
                      <List className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {/* Sort */}
                  <div className="flex items-center gap-0.5 rounded-lg border border-[#E8E8E4] bg-white p-0.5">
                    {(["best_price", "alphabetical"] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setSortBy(opt)}
                        className={cn(
                          "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                          sortBy === opt
                            ? "bg-[#84CC16] text-white"
                            : "text-[#6B6B63] hover:bg-[#F7F7F5]"
                        )}
                      >
                        {opt === "best_price" ? "Menor Preço" : "A-Z"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Loading — spinner inicial sem resultados */}
            {loading && allOffers.length === 0 && storeStates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-3">
                <Loader2 className="h-8 w-8 animate-spin text-[#84CC16]" />
                <p className="text-sm text-[#6B6B63]">Conectando às lojas...</p>
              </div>
            )}

            {/* Loading por loja — compact bar when we have results */}
            {loading && storeStates.length > 0 && allOffers.length > 0 && (
              <div className="bg-white border border-[#E8E8E4] rounded-xl px-4 py-3 mb-4 flex items-center gap-4 shadow-sm overflow-x-auto">
                <div className="flex items-center gap-2 flex-shrink-0">
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-[#84CC16]" />
                  <span className="text-xs font-medium text-[#1A1A18]">Buscando</span>
                  <span className="text-xs text-[#A0A09A]">{elapsed}s</span>
                </div>
                <div className="h-4 w-px bg-[#E8E8E4] flex-shrink-0" />
                <div className="flex items-center gap-2 flex-1 min-w-0 overflow-x-auto">
                  {storeStates.map((s) => {
                    const isDone = s.status === "done";
                    const isError = s.status === "error";
                    const isSearching = s.status === "searching";
                    return (
                      <span
                        key={s.name}
                        className={cn(
                          "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border whitespace-nowrap flex-shrink-0",
                          isDone && "border-[#E8E8E4] bg-white text-[#6B6B63]",
                          isSearching && "border-amber-200 bg-amber-50 text-amber-700",
                          isError && "border-red-200 bg-red-50 text-red-600",
                          !isDone && !isSearching && !isError && "border-[#E8E8E4] bg-[#F7F7F5] text-[#A0A09A]"
                        )}
                      >
                        {isSearching && <span className="h-1.5 w-1.5 rounded-full bg-amber-500 animate-pulse" />}
                        {isDone && <span className="h-1.5 w-1.5 rounded-full bg-[#84CC16]" />}
                        {isError && <span className="h-1.5 w-1.5 rounded-full bg-red-500" />}
                        {!isDone && !isSearching && !isError && <span className="h-1.5 w-1.5 rounded-full bg-[#D0D0CA]" />}
                        {s.name}
                      </span>
                    );
                  })}
                </div>
                <div className="flex-shrink-0 w-24 h-1 rounded-full bg-[#E8E8E4] overflow-hidden">
                  <motion.div className="h-full bg-[#84CC16] rounded-full" animate={{ width: `${progress}%` }} transition={{ duration: 0.4 }} />
                </div>
              </div>
            )}

            {/* Loading por loja — full panel when no results yet */}
            {loading && storeStates.length > 0 && allOffers.length === 0 && (
              <div className="bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded-2xl p-6 shadow-[0_8px_30px_rgb(0,0,0,0.04)] dark:shadow-[0_8px_30px_rgb(0,0,0,0.1)] mb-6 max-w-md mx-auto relative overflow-hidden">
                {/* Subtle top gradient line */}
                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-lime-400 to-transparent opacity-40" />

                <div className="flex items-center gap-4 mb-6">
                  <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-lime-50 dark:bg-lime-500/10 border border-lime-100 dark:border-lime-500/20 shadow-sm">
                    <Loader2 className="h-6 w-6 animate-spin text-lime-500" />
                  </div>
                  <div>
                    <h3 className="text-base font-semibold text-slate-900 dark:text-neutral-100 tracking-tight">Buscando resultados</h3>
                    <p className="text-xs font-medium text-slate-500 dark:text-neutral-400 mt-0.5">
                      Consultando fornecedores... <span className="text-slate-400">({elapsed}s)</span>
                    </p>
                  </div>
                </div>

                <div className="space-y-3.5 mb-6">
                  {storeStates.map((s) => {
                    const isDone = s.status === "done";
                    const isError = s.status === "error";
                    const isSearching = s.status === "searching";
                    const isPending = s.status === "pending";
                    return (
                      <div
                        key={s.name}
                        className="flex items-center justify-between group"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex-shrink-0 flex items-center justify-center w-5">
                            {isSearching && <Loader2 className="h-4 w-4 animate-spin text-lime-500" />}
                            {isDone && <CheckCircle2 className="h-4.5 w-4.5 text-lime-500" />}
                            {isError && <AlertCircle className="h-4.5 w-4.5 text-red-500" />}
                            {isPending && <div className="h-1.5 w-1.5 rounded-full bg-slate-200 dark:bg-neutral-700" />}
                          </div>
                          <span className={cn(
                            "text-sm font-medium transition-colors",
                            isSearching && "text-slate-900 dark:text-neutral-100",
                            isDone && "text-slate-700 dark:text-neutral-300",
                            isError && "text-red-600 dark:text-red-400",
                            isPending && "text-slate-400 dark:text-neutral-500"
                          )}>{s.name}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={cn(
                            "text-xs font-medium",
                            isSearching && "text-lime-600 dark:text-lime-400 animate-pulse",
                            isDone && "text-slate-500 dark:text-neutral-400",
                            isError && "text-red-500",
                            isPending && "text-slate-400 dark:text-neutral-600"
                          )}>
                            {isSearching && "Buscando..."}
                            {isDone && `${s.offerCount} resultado${s.offerCount !== 1 ? "s" : ""}`}
                            {isError && "Erro na busca"}
                            {isPending && "Aguardando"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Progress bar */}
                <div>
                  <div className="flex flex-row items-center justify-between text-xs font-medium text-slate-500 dark:text-neutral-400 mb-2.5">
                    <span>Progresso total</span>
                    <span>{storeStates.filter((s) => s.status === "done" || s.status === "error").length} / {storeStates.length} lojas</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-neutral-800 overflow-hidden">
                    <motion.div
                      className="h-full rounded-full bg-lime-500"
                      initial={{ width: "0%" }}
                      animate={{ width: `${progress}%` }}
                      transition={{ duration: 0.4 }}
                    />
                  </div>
                </div>
              </div>
            )}

            {/* Error */}
            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-5 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-medium text-red-700 mb-1">Erro ao buscar resultados</p>
                    <p className="text-sm text-red-600">{error}</p>
                  </div>
                </div>
              </div>
            )}

            {/* No results after filter */}
            {!error && filtered.length === 0 && allOffers.length > 0 && (
              <div className="bg-white border border-[#E8E8E4] rounded-xl p-12 text-center shadow-sm">
                <Search className="mx-auto mb-4 h-10 w-10 text-[#D0D0CA]" />
                <h3 className="mb-2 text-base font-semibold text-[#1A1A18]">Nenhum resultado para os filtros aplicados</h3>
                <p className="mb-5 text-sm text-[#6B6B63]">
                  {cardSearch ? `Nenhum produto encontrado para "${cardSearch}"` : "Tente ajustar os filtros para ver mais resultados"}
                </p>
                <button
                  onClick={clearFilters}
                  className="rounded-lg bg-[#84CC16] px-4 py-2 text-sm font-medium text-[#1A1A18] hover:bg-[#78b814] transition-colors"
                >
                  Limpar filtros
                </button>
              </div>
            )}

            {/* Cards */}
            {!error && paginated.length > 0 && (
              <>
                <div
                  id="tour-results-grid"
                  className={cn(
                    viewMode === "grid"
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 3xl:grid-cols-6 4xl:grid-cols-8 gap-4"
                      : "flex flex-col gap-4"
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
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="mt-8 flex items-center justify-center gap-1.5">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8E8E4] bg-white text-[#6B6B63] transition-colors hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-30"
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
                          <span key={`ellipsis-${idx}`} className="px-1 text-[#A0A09A]">…</span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p as number)}
                            className={cn(
                              "flex h-9 w-9 items-center justify-center rounded-lg text-sm font-medium transition-colors",
                              page === p
                                ? "bg-[#84CC16] text-[#1A1A18] shadow-sm"
                                : "border border-[#E8E8E4] bg-white text-[#6B6B63] hover:bg-[#F7F7F5]"
                            )}
                          >
                            {p}
                          </button>
                        )
                      )}

                    <button
                      onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                      disabled={page === totalPages}
                      className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E8E8E4] bg-white text-[#6B6B63] transition-colors hover:bg-[#F7F7F5] disabled:cursor-not-allowed disabled:opacity-30"
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

      {/* Error modal */}
      <AnimatePresence>
        {showErrorModal && failedStores.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm px-4"
            onClick={() => setShowErrorModal(false)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-md rounded-2xl bg-white border border-[#E8E8E4] shadow-2xl p-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <TriangleAlert className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-[#1A1A18]">
                    {failedStores.length === 1 ? "1 loja com problema" : `${failedStores.length} lojas com problema`}
                  </h3>
                  <p className="mt-0.5 text-sm text-[#6B6B63]">
                    A busca foi concluída, mas algumas lojas não responderam.
                  </p>
                </div>
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="flex-shrink-0 rounded-lg p-1 text-[#A0A09A] hover:text-[#6B6B63] transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 mb-5">
                {failedStores.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-3 rounded-lg border border-[#FECACA] bg-[#FEF2F2] px-3 py-2.5"
                  >
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-700">{s.name}</p>
                      <p className="text-xs text-red-500/80 mt-0.5">
                        Possível causa: IP bloqueado ou credenciais inválidas
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="flex-1 rounded-xl border border-[#E8E8E4] px-4 py-2 text-sm font-medium text-[#6B6B63] hover:bg-[#F7F7F5] transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={() => { setShowErrorModal(false); void search(items, true); }}
                  className="flex-1 rounded-xl bg-[#84CC16] px-4 py-2 text-sm font-medium text-[#1A1A18] hover:bg-[#78b814] transition-colors"
                >
                  Tentar novamente
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
