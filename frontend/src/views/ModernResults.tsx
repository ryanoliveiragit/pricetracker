"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Loader2,
  TriangleAlert,
  Search,
  SlidersHorizontal,
  Tag,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Clock,
  X,
  Store as StoreIcon,
  Grid3X3,
  List,
  Package,
  Zap,
  ArrowLeft,
  ShoppingBag,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { SupplierSearchSelection } from "../types/search";
import { useSearchResults } from "../hooks/useSearchResults";
import type { Offer } from "../types/search";
import { ProductCard } from "../components/catalog/ProductCard";
import { CartIcon } from "../components/catalog/CartIcon";
import { CartModal } from "../components/catalog/CartModal";
import { ImageModal, useImageModal } from "../components/catalog/ImageModal";
import { cn } from "@/lib/utils";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const ITEMS_PER_PAGE = 24;

function formatBRL(value: number) {
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function formatAge(minutes: number | null): string {
  if (minutes === null || minutes === undefined) return "";
  if (minutes === 0) return "agora";
  if (minutes < 60) return `${minutes}min`;
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return m > 0 ? `${h}h${m}min` : `${h}h`;
}

export default function ModernResults() {
  const router = useRouter();

  function readItemsFromStorage(): string[] {
    if (typeof window === "undefined") return [];
    const raw = localStorage.getItem("construprice-last-search-items");
    return raw ? ((JSON.parse(raw) as string[]) ?? []) : [];
  }

  function readSelectedSuppliersFromStorage():
    | SupplierSearchSelection[]
    | undefined {
    if (typeof window === "undefined") return undefined;
    const raw = localStorage.getItem("construprice-last-search-suppliers");
    if (!raw) return undefined;

    try {
      const parsed = JSON.parse(raw) as string[];
      const normalized = parsed
        .map((supplier) => supplier.trim())
        .filter(Boolean)
        .map((supplier) => ({
          store_name: supplier,
          is_active: true,
        }));

      return normalized.length > 0 ? normalized : undefined;
    } catch {
      return undefined;
    }
  }

  const [items, setItems] = useState<string[]>(readItemsFromStorage);
  const [selectedSuppliersFromAgent, setSelectedSuppliersFromAgent] = useState<
    SupplierSearchSelection[] | undefined
  >(readSelectedSuppliersFromStorage);

  const {
    loading,
    refreshing,
    error,
    cacheAgeMinutes,
    catalogAgeMinutes,
    isFromCatalog,
    sortBy,
    setSortBy,
    filteredItems,
    search,
    refreshPrices,
    storeStates,
  } = useSearchResults();

  const [elapsed, setElapsed] = useState(0);
  const [showErrorModal, setShowErrorModal] = useState(false);

  const failedStores = storeStates.filter(
    (s) => s.status === "error" || s.status === "login_error",
  );

  useEffect(() => {
    if (!loading && failedStores.length > 0) setShowErrorModal(true);
  }, [loading]);

  useEffect(() => {
    function handleHeaderSearch(e: Event) {
      const detail = (e as CustomEvent<string[]>).detail;
      if (detail && detail.length > 0) {
        const suppliers = readSelectedSuppliersFromStorage();
        setItems(detail);
        setSelectedSuppliersFromAgent(suppliers);
        void search(detail, true, suppliers);
      }
    }
    window.addEventListener("construprice-header-search", handleHeaderSearch);
    return () =>
      window.removeEventListener(
        "construprice-header-search",
        handleHeaderSearch,
      );
  }, [search]);

  useEffect(() => {
    if (!loading) {
      setElapsed(0);
      return;
    }
    const t0 = Date.now();
    const interval = setInterval(
      () => setElapsed(Math.floor((Date.now() - t0) / 1000)),
      1000,
    );
    return () => clearInterval(interval);
  }, [loading]);

  useEffect(() => {
    if (items.length > 0) void search(items, false, selectedSuppliersFromAgent);
  }, []);

  /* ── filter state ── */
  const [cardSearch, setCardSearch] = useState("");
  const [onlyInStock, setOnlyInStock] = useState(false);
  const [onlyBestPrice, setOnlyBestPrice] = useState(false);
  const [priceMin, setPriceMin] = useState(0);
  const [priceMax, setPriceMax] = useState(99999);
  const [activeSuppliers, setActiveSuppliers] = useState<Set<string>>(
    new Set(),
  );
  const [activeBrands, setActiveBrands] = useState<Set<string>>(new Set());
  const [activeQuery, setActiveQuery] = useState<string | null>(null);
  const [activeUnits, setActiveUnits] = useState<Set<string>>(new Set());
  const [page, setPage] = useState(1);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [cartOpen, setCartOpen] = useState(false);
  const {
    state: imgModal,
    openModal,
    close: closeImg,
    navigate: navigateImg,
  } = useImageModal();

  /* ── derived: flatten all offers ── */
  const allOffers: (Offer & { rawQuery: string })[] = useMemo(() => {
    if (!filteredItems) return [];
    return filteredItems.flatMap((item) =>
      item.offers.map((offer) => ({ ...offer, rawQuery: item.rawQuery })),
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
    allOffers.forEach((o) => {
      if (o.brand) s.add(o.brand);
    });
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
    allOffers.forEach((o) => {
      const u = extractUnit(o.productName);
      if (u) s.add(u);
    });
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
      if (o.price > 0 && (o.price < priceMin || o.price > priceMax))
        return false;
      if (activeSuppliers.size > 0 && !activeSuppliers.has(o.store))
        return false;
      if (activeBrands.size > 0 && !(o.brand && activeBrands.has(o.brand)))
        return false;
      if (activeQuery !== null && o.rawQuery !== activeQuery) return false;
      if (
        activeUnits.size > 0 &&
        !activeUnits.has(extractUnit(o.productName) ?? "")
      )
        return false;
      return true;
    });
  }, [
    allOffers,
    cardSearch,
    onlyInStock,
    priceMin,
    priceMax,
    activeSuppliers,
    activeBrands,
    activeQuery,
    activeUnits,
  ]);

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
  const paginated = filtered.slice(
    (page - 1) * ITEMS_PER_PAGE,
    page * ITEMS_PER_PAGE,
  );

  useEffect(() => {
    setPage(1);
  }, [
    cardSearch,
    onlyInStock,
    onlyBestPrice,
    priceMin,
    priceMax,
    activeSuppliers,
    activeBrands,
    activeQuery,
    activeUnits,
    sortBy,
  ]);

  function toggleSupplier(name: string) {
    setActiveSuppliers((prev) => {
      const n = new Set(prev);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });
  }
  function toggleBrand(name: string) {
    setActiveBrands((prev) => {
      const n = new Set(prev);
      n.has(name) ? n.delete(name) : n.add(name);
      return n;
    });
  }
  function selectQuery(name: string) {
    setActiveQuery((prev) => (prev === name ? null : name));
  }
  function toggleUnit(u: string) {
    setActiveUnits((prev) => {
      const n = new Set(prev);
      n.has(u) ? n.delete(u) : n.add(u);
      return n;
    });
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
    !!cardSearch ||
    onlyInStock ||
    onlyBestPrice ||
    activeSuppliers.size > 0 ||
    activeBrands.size > 0 ||
    activeQuery !== null ||
    activeUnits.size > 0;

  const activeFilterCount = [
    !!cardSearch,
    onlyInStock,
    onlyBestPrice,
    activeSuppliers.size > 0,
    activeBrands.size > 0,
    activeQuery !== null,
    activeUnits.size > 0,
    priceMin !== priceStats.min || priceMax !== priceStats.max,
  ].filter(Boolean).length;

  /* ── empty state ── */
  if (items.length === 0) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="text-center px-4">
          <ShoppingBag className="mx-auto mb-4 h-12 w-12 text-muted-foreground/50" />
          <h2 className="mb-2 text-xl font-semibold text-foreground">
            Nenhuma busca encontrada
          </h2>
          <p className="mb-6 text-sm text-muted-foreground max-w-xs mx-auto">
            Volte para a tela de busca e selecione os produtos para cotação
          </p>
          <Link
            href="/search"
            className="inline-flex items-center gap-2 rounded-xl bg-[rgb(var(--primary-500))] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:bg-[rgb(var(--primary-600))] shadow-sm"
          >
            <Search className="h-4 w-4" />
            Iniciar Nova Busca
          </Link>
        </div>
      </div>
    );
  }

  const totalOffers = allOffers.length;
  const uniqueStores = new Set(allOffers.map((o) => o.store)).size;
  const bestPriceInFiltered =
    lowestPriceInFiltered.size > 0
      ? Math.min(...Array.from(lowestPriceInFiltered.values()))
      : null;

  const progress = Math.round(
    (storeStates.filter((s) => s.status === "done" || s.status === "error")
      .length /
      Math.max(storeStates.length, 1)) *
      100,
  );

  const dataAge = isFromCatalog ? catalogAgeMinutes : cacheAgeMinutes;

  /* ── Filter sidebar ── */
  const filterContent = (
    <div className="space-y-5">
      {/* Header + clear */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">
          Filtros
        </span>
        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="text-[11px] font-medium text-[rgb(var(--primary-500))] hover:underline"
          >
            Limpar
          </button>
        )}
      </div>

      {/* Active chips */}
      {hasActiveFilters && (
        <div className="flex flex-wrap gap-1.5">
          {onlyInStock && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/10 border border-[rgb(var(--primary-500))]/25 px-2.5 py-1 text-[10px] font-medium text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))]">
              Em estoque{" "}
              <button onClick={() => setOnlyInStock(false)}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {onlyBestPrice && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/10 border border-[rgb(var(--primary-500))]/25 px-2.5 py-1 text-[10px] font-medium text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))]">
              Melhor preco{" "}
              <button onClick={() => setOnlyBestPrice(false)}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {cardSearch && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/10 border border-[rgb(var(--primary-500))]/25 px-2.5 py-1 text-[10px] font-medium text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))]">
              &ldquo;{cardSearch}&rdquo;{" "}
              <button onClick={() => setCardSearch("")}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {activeQuery && (
            <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/10 border border-[rgb(var(--primary-500))]/25 px-2.5 py-1 text-[10px] font-medium text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))]">
              {activeQuery}{" "}
              <button onClick={() => setActiveQuery(null)}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}
          {Array.from(activeUnits).map((u) => (
            <span
              key={u}
              className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/10 border border-[rgb(var(--primary-500))]/25 px-2.5 py-1 text-[10px] font-medium text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))]"
            >
              {u}{" "}
              <button onClick={() => toggleUnit(u)}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
          {Array.from(activeSuppliers).map((s) => (
            <span
              key={s}
              className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/10 border border-[rgb(var(--primary-500))]/25 px-2.5 py-1 text-[10px] font-medium text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-500))]"
            >
              {s}{" "}
              <button onClick={() => toggleSupplier(s)}>
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Search within results */}
      <div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={cardSearch}
            onChange={(e) => setCardSearch(e.target.value)}
            placeholder="Filtrar resultados..."
            className="w-full rounded-lg border border-border bg-muted py-2 pl-9 pr-8 text-xs text-foreground placeholder:text-muted-foreground focus:border-[rgb(var(--primary-500))] focus:outline-none focus:bg-card transition-colors"
          />
          {cardSearch && (
            <button
              onClick={() => setCardSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* Quick toggles */}
      <div className="space-y-1">
        {(
          [
            { label: "Em estoque", value: onlyInStock, set: setOnlyInStock },
            {
              label: "Melhor preco",
              value: onlyBestPrice,
              set: setOnlyBestPrice,
            },
          ] as { label: string; value: boolean; set: (v: boolean) => void }[]
        ).map(({ label, value, set }) => (
          <button
            key={label}
            onClick={() => set(!value)}
            className={cn(
              "w-full flex items-center justify-between rounded-lg px-3 py-2 text-xs transition-colors",
              value
                ? "bg-[rgb(var(--primary-500))]/10 text-foreground font-medium"
                : "text-muted-foreground hover:bg-muted",
            )}
          >
            <span>{label}</span>
            <div
              className={cn(
                "h-4 w-7 rounded-full transition-colors relative flex-shrink-0",
                value ? "bg-[rgb(var(--primary-500))]" : "bg-muted-foreground/25",
              )}
            >
              <div
                className={cn(
                  "absolute top-0.5 h-3 w-3 rounded-full bg-white shadow transition-transform",
                  value ? "translate-x-3.5" : "translate-x-0.5",
                )}
              />
            </div>
          </button>
        ))}
      </div>

      {/* Price range */}
      <div className="space-y-2">
        <p className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
          Preco
        </p>
        <div className="grid grid-cols-2 gap-2">
          <input
            type="number"
            value={priceMin}
            onChange={(e) => setPriceMin(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground focus:border-[rgb(var(--primary-500))] focus:outline-none"
            placeholder="Min"
          />
          <input
            type="number"
            value={priceMax}
            onChange={(e) => setPriceMax(Number(e.target.value))}
            className="w-full rounded-lg border border-border bg-muted px-3 py-1.5 text-xs text-foreground focus:border-[rgb(var(--primary-500))] focus:outline-none"
            placeholder="Max"
          />
        </div>
      </div>

      {/* Product filter (multiple items) */}
      {items.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
            Produto
          </p>
          <div className="space-y-0.5">
            <button
              onClick={() => setActiveQuery(null)}
              className={cn(
                "w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors",
                activeQuery === null
                  ? "bg-foreground text-background"
                  : "text-muted-foreground hover:bg-muted",
              )}
            >
              <span>Todos</span>
              <span className="text-[10px] opacity-60">{allOffers.length}</span>
            </button>
            {items.map((q) => {
              const count = allOffers.filter((o) => o.rawQuery === q).length;
              return (
                <button
                  key={q}
                  onClick={() => selectQuery(q)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors text-left",
                    activeQuery === q
                      ? "bg-[rgb(var(--primary-500))] text-white font-medium"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className="truncate">{q}</span>
                  <span className="flex-shrink-0 ml-2 text-[10px] opacity-60">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Units */}
      {allUnits.length > 1 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
            Embalagem
          </p>
          <div className="flex flex-wrap gap-1">
            {allUnits.map((u) => (
              <button
                key={u}
                onClick={() => toggleUnit(u)}
                className={cn(
                  "rounded-md px-2.5 py-1 text-[10px] font-medium transition-colors",
                  activeUnits.has(u)
                    ? "bg-[rgb(var(--primary-500))] text-white"
                    : "bg-background text-muted-foreground border border-border hover:bg-muted",
                )}
              >
                {u}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Brands */}
      {allBrands.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
            Marcas
          </p>
          <div className="space-y-0.5 max-h-36 overflow-y-auto">
            {allBrands.map((brand) => {
              const count = allOffers.filter((o) => o.brand === brand).length;
              const active = activeBrands.has(brand);
              return (
                <button
                  key={brand}
                  onClick={() => toggleBrand(brand)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors text-left",
                    active
                      ? "bg-[rgb(var(--primary-500))]/10 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className="truncate">{brand}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Stores */}
      {allSuppliers.length > 0 && (
        <div className="space-y-1.5">
          <p className="text-[10px] font-bold uppercase tracking-[0.10em] text-muted-foreground">
            Lojas
          </p>
          <div className="space-y-0.5">
            {allSuppliers.map((supplier) => {
              const count = allOffers.filter(
                (o) => o.store === supplier,
              ).length;
              const active = activeSuppliers.has(supplier);
              return (
                <button
                  key={supplier}
                  onClick={() => toggleSupplier(supplier)}
                  className={cn(
                    "w-full flex items-center justify-between rounded-lg px-3 py-1.5 text-xs transition-colors text-left",
                    active
                      ? "bg-[rgb(var(--primary-500))]/10 text-foreground font-medium"
                      : "text-muted-foreground hover:bg-muted",
                  )}
                >
                  <span className="truncate">{supplier}</span>
                  <span className="text-[10px] text-muted-foreground">
                    {count}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* ══════ TOP BAR ══════ */}
      <div className="sticky top-0 z-30 bg-card/95 backdrop-blur-xl border-b border-border/50">
        <div className="h-[54px] px-4 md:px-5 flex items-center gap-3">
          {/* Back */}
          <Link
            href="/search"
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted/80 transition-colors flex-shrink-0"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* Title + inline badge */}
          <div className="flex-1 flex items-center gap-2.5 min-w-0">
            <h1 className="text-[15px] font-bold text-foreground truncate tracking-tight">
              {items.length === 1 ? items[0] : `${items.length} produtos`}
            </h1>
            {!loading && totalOffers > 0 && (
              isFromCatalog ? (
                <div className="hidden sm:flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/10 border border-[rgb(var(--primary-500))]/20 px-2 py-0.5 flex-shrink-0">
                  <Zap className="h-2.5 w-2.5 text-[rgb(var(--primary-500))]" />
                  <span className="text-[10px] font-semibold text-[rgb(var(--primary-500))]">Instantâneo</span>
                  {dataAge !== null && dataAge > 0 && (
                    <span className="text-[10px] text-muted-foreground">· {formatAge(dataAge)}</span>
                  )}
                </div>
              ) : (
                <div className="hidden sm:flex items-center gap-1 rounded-full bg-blue-50 dark:bg-blue-900/20 border border-blue-100 dark:border-blue-800/30 px-2 py-0.5 flex-shrink-0">
                  <CheckCircle2 className="h-2.5 w-2.5 text-blue-500" />
                  <span className="text-[10px] font-semibold text-blue-600 dark:text-blue-400">Tempo real</span>
                </div>
              )
            )}
          </div>

          {/* Right actions */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            {/* Mobile filter */}
            <button
              onClick={() => setMobileFiltersOpen(true)}
              className="xl:hidden relative flex h-8 items-center gap-1.5 rounded-lg border border-border bg-card px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" />
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[rgb(var(--primary-500))] text-[9px] font-bold text-white">
                  {activeFilterCount}
                </span>
              )}
            </button>

            {/* Refresh */}
            {!loading && totalOffers > 0 && (
              <button
                onClick={() => void search(items, true, selectedSuppliersFromAgent)}
                disabled={refreshing || loading}
                className={cn(
                  "flex h-8 items-center gap-1.5 rounded-lg px-3 text-[12px] font-semibold transition-all shadow-sm active:scale-[0.97]",
                  "bg-[rgb(var(--primary-500))] text-white hover:bg-[rgb(var(--primary-600))] active:scale-[0.97]",
                  (refreshing || loading) && "opacity-60 cursor-not-allowed",
                )}
              >
                <RefreshCw className={cn("h-3.5 w-3.5 flex-shrink-0", (refreshing || loading) && "animate-spin")} />
                <span className="hidden sm:inline">
                  {refreshing || loading ? "Buscando..." : "Atualizar Preços"}
                </span>
              </button>
            )}

            {/* Error indicator */}
            {!loading && failedStores.length > 0 && (
              <button
                onClick={() => setShowErrorModal(true)}
                className="relative flex h-8 w-8 items-center justify-center rounded-lg border border-amber-200 dark:border-amber-800/50 bg-amber-50 dark:bg-amber-900/20 text-amber-500 dark:text-amber-400 hover:bg-amber-100 dark:hover:bg-amber-900/30 transition-colors"
              >
                <TriangleAlert className="h-3.5 w-3.5" />
                <span className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-amber-500 text-[8px] font-bold text-white">
                  {failedStores.length}
                </span>
              </button>
            )}

            <CartIcon onClick={() => setCartOpen(true)} />
          </div>
        </div>

        {/* Store progress bar (when streaming) */}
        {loading && storeStates.length > 0 && (
          <div className="px-4 md:px-5 pb-2.5 flex items-center gap-2 border-t border-border/40 pt-2">
            <div className="flex items-center gap-1.5 overflow-x-auto flex-1">
              {storeStates.map((s) => {
                const isDone = s.status === "done";
                const isError = s.status === "error" || s.status === "login_error";
                const isSearching = s.status === "searching";
                return (
                  <span
                    key={s.name}
                    className={cn(
                      "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium whitespace-nowrap flex-shrink-0",
                      isDone && "bg-[rgb(var(--primary-500))]/10 text-[rgb(var(--primary-500))]",
                      isSearching && "bg-amber-50 dark:bg-amber-900/20 text-amber-600",
                      isError && "bg-red-50 dark:bg-red-900/20 text-red-500",
                      !isDone && !isSearching && !isError && "bg-muted text-muted-foreground",
                    )}
                  >
                    {isSearching && <Loader2 className="h-2.5 w-2.5 animate-spin" />}
                    {isDone && <CheckCircle2 className="h-2.5 w-2.5" />}
                    {isError && <AlertCircle className="h-2.5 w-2.5" />}
                    {s.name}
                  </span>
                );
              })}
            </div>
            <span className="text-[10px] text-muted-foreground tabular-nums flex-shrink-0">{elapsed}s</span>
            <div className="w-14 h-1 rounded-full bg-muted overflow-hidden flex-shrink-0">
              <motion.div
                className="h-full bg-[rgb(var(--primary-500))] rounded-full"
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.4 }}
              />
            </div>
          </div>
        )}
      </div>

      {/* ══════ CONTENT ══════ */}
      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="w-60 shrink-0 border-r border-border/50 bg-card hidden xl:flex flex-col h-[calc(100dvh-114px)] sticky top-[54px] overflow-y-auto">
          <div className="px-4 pt-5 pb-8">{filterContent}</div>
        </aside>

        {/* Mobile Filter Drawer */}
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
                initial={{ x: -280 }}
                animate={{ x: 0 }}
                exit={{ x: -280 }}
                transition={{ type: "spring", damping: 25, stiffness: 200 }}
                className="fixed left-0 top-0 bottom-0 z-50 w-[272px] bg-card shadow-2xl overflow-y-auto xl:hidden"
              >
                <div className="px-4 py-4 flex items-center justify-between border-b border-border">
                  <span className="text-sm font-semibold text-foreground">
                    Filtros
                  </span>
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <div className="px-4 py-4">{filterContent}</div>
                <div className="px-4 pb-4">
                  <button
                    onClick={() => setMobileFiltersOpen(false)}
                    className="w-full rounded-xl bg-[rgb(var(--primary-500))] py-2.5 text-sm font-semibold text-white hover:bg-[rgb(var(--primary-600))] transition-colors"
                  >
                    Ver {filtered.length} resultado
                    {filtered.length !== 1 ? "s" : ""}
                  </button>
                </div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          <div className="px-4 md:px-5 py-5">
            {/* ── Stats strip ── */}
            {!loading && totalOffers > 0 && (
              <div className="flex items-center gap-2 mb-5 flex-wrap">
                <div className="flex items-baseline gap-1.5 rounded-xl bg-muted/70 border border-border/60 px-3.5 py-2">
                  <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">{totalOffers}</span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">ofertas</span>
                </div>
                <div className="flex items-baseline gap-1.5 rounded-xl bg-muted/70 border border-border/60 px-3.5 py-2">
                  <span className="text-[22px] font-bold text-foreground tabular-nums leading-none">{uniqueStores}</span>
                  <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">loja{uniqueStores !== 1 ? "s" : ""}</span>
                </div>
                {bestPriceInFiltered && (
                  <div className="flex items-baseline gap-1.5 rounded-xl bg-[rgb(var(--primary-500))]/8 dark:bg-[rgb(var(--primary-500))]/10 border border-[rgb(var(--primary-500))]/15 dark:border-[rgb(var(--primary-500))]/20 px-3.5 py-2">
                    <span className="text-[22px] font-bold text-[rgb(var(--primary-500))] tabular-nums leading-none">{formatBRL(bestPriceInFiltered)}</span>
                    <span className="text-[11px] font-medium text-[rgb(var(--primary-500))]/70 uppercase tracking-wide">melhor preço</span>
                  </div>
                )}
              </div>
            )}

            {/* ── Toolbar ── */}
            {totalOffers > 0 && (
              <div className="flex items-center justify-between gap-3 mb-4">
                <span className="text-[12px] text-muted-foreground tabular-nums">
                  {filtered.length} resultado{filtered.length !== 1 ? "s" : ""}
                  {totalPages > 1 && <span className="ml-1 opacity-70">· pág. {page}/{totalPages}</span>}
                </span>
                <div className="flex items-center gap-1.5">
                  {/* View mode */}
                  <div className="hidden sm:flex items-center rounded-lg border border-border bg-card p-0.5 gap-0.5">
                    {([["grid", Grid3X3], ["list", List]] as const).map(([mode, Icon]) => (
                      <button
                        key={mode}
                        onClick={() => setViewMode(mode)}
                        className={cn(
                          "rounded-md p-1.5 transition-colors",
                          viewMode === mode
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:text-foreground",
                        )}
                      >
                        <Icon className="h-3.5 w-3.5" />
                      </button>
                    ))}
                  </div>
                  {/* Sort */}
                  <div className="flex items-center rounded-lg border border-border bg-card p-0.5 gap-0.5">
                    {(["best_price", "alphabetical"] as const).map((opt) => (
                      <button
                        key={opt}
                        onClick={() => setSortBy(opt)}
                        className={cn(
                          "rounded-md px-2.5 py-1.5 text-[11px] font-medium transition-colors",
                          sortBy === opt
                            ? "bg-foreground text-background"
                            : "text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {opt === "best_price" ? "Menor Preço" : "A-Z"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* ── Loading: initial spinner ── */}
            {loading && allOffers.length === 0 && storeStates.length === 0 && (
              <div className="flex flex-col items-center justify-center py-24 gap-4">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[rgb(var(--primary-500))]/10">
                  <Loader2 className="h-7 w-7 animate-spin text-[rgb(var(--primary-500))]" />
                </div>
                <div className="text-center">
                  <p className="text-sm font-semibold text-foreground">
                    Conectando as lojas
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Isso pode levar alguns segundos...
                  </p>
                </div>
              </div>
            )}

            {/* ── Loading: per-store panel (no results yet) ── */}
            {loading && storeStates.length > 0 && allOffers.length === 0 && (
              <div className="bg-card border border-border rounded-2xl p-6 mb-6 max-w-lg mx-auto">
                <div className="flex items-center gap-3 mb-5">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[rgb(var(--primary-500))]/10">
                    <Loader2 className="h-5 w-5 animate-spin text-[rgb(var(--primary-500))]" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-foreground">
                      Buscando resultados
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Consultando {storeStates.length} fornecedores... (
                      {elapsed}s)
                    </p>
                  </div>
                </div>

                <div className="space-y-2.5 mb-5">
                  {storeStates.map((s) => {
                    const isDone = s.status === "done";
                    const isError =
                      s.status === "error" || s.status === "login_error";
                    const isLoginError = s.status === "login_error";
                    const isSearching = s.status === "searching";
                    const isPending = s.status === "pending";
                    return (
                      <div
                        key={s.name}
                        className="flex items-center justify-between py-1"
                      >
                        <div className="flex items-center gap-2.5">
                          <div className="w-5 flex justify-center">
                            {isSearching && (
                              <Loader2 className="h-4 w-4 animate-spin text-[rgb(var(--primary-500))]" />
                            )}
                            {isDone && (
                              <CheckCircle2 className="h-4 w-4 text-[rgb(var(--primary-500))]" />
                            )}
                            {isError && (
                              <AlertCircle className="h-4 w-4 text-red-500" />
                            )}
                            {isPending && (
                              <div className="h-1.5 w-1.5 rounded-full bg-muted-foreground/25" />
                            )}
                          </div>
                          <span
                            className={cn(
                              "text-sm",
                              (isSearching || isDone) &&
                                "text-foreground font-medium",
                              isError && "text-red-600 dark:text-red-400",
                              isPending &&
                                "text-muted-foreground",
                            )}
                          >
                            {s.name}
                          </span>
                        </div>
                        <span
                          className={cn(
                            "text-xs",
                            isSearching &&
                              "text-[rgb(var(--primary-500))] animate-pulse font-medium",
                            isDone && "text-muted-foreground",
                            isError && "text-red-500",
                            isPending && "text-muted-foreground/50",
                          )}
                        >
                          {isSearching && "Buscando..."}
                          {isDone &&
                            `${s.offerCount} resultado${s.offerCount !== 1 ? "s" : ""}`}
                          {isLoginError && "Login falhou"}
                          {!isLoginError && isError && "Erro"}
                          {isPending && "Aguardando"}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                  <motion.div
                    className="h-full rounded-full bg-[rgb(var(--primary-500))]"
                    initial={{ width: "0%" }}
                    animate={{ width: `${progress}%` }}
                    transition={{ duration: 0.4 }}
                  />
                </div>
                <p className="text-[10px] text-muted-foreground text-right mt-1.5">
                  {
                    storeStates.filter(
                      (s) => s.status === "done" || s.status === "error",
                    ).length
                  }{" "}
                  / {storeStates.length} lojas
                </p>
              </div>
            )}

            {/* ── Error ── */}
            {error && (
              <div className="rounded-xl border border-red-200 dark:border-red-900/50 bg-red-50 dark:bg-red-900/20 p-4 mb-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold text-red-700 text-sm">
                      Erro ao buscar resultados
                    </p>
                    <p className="text-xs text-red-600 dark:text-red-400 mt-0.5">
                      {error}
                    </p>
                  </div>
                </div>
              </div>
            )}

            {/* ── Empty after filters ── */}
            {!error && filtered.length === 0 && allOffers.length > 0 && (
              <div className="bg-card border border-border rounded-2xl p-12 text-center">
                <Search className="mx-auto mb-4 h-10 w-10 text-muted-foreground/50" />
                <h3 className="mb-2 text-base font-semibold text-foreground">
                  Nenhum resultado com esses filtros
                </h3>
                <p className="mb-5 text-sm text-muted-foreground max-w-sm mx-auto">
                  {cardSearch
                    ? `Nenhum produto para "${cardSearch}"`
                    : "Tente ajustar os filtros"}
                </p>
                <button
                  onClick={clearFilters}
                  className="rounded-xl bg-[rgb(var(--primary-500))] px-5 py-2 text-sm font-semibold text-white hover:bg-[rgb(var(--primary-600))] transition-colors"
                >
                  Limpar filtros
                </button>
              </div>
            )}

            {/* ── Product Grid ── */}
            {!error && paginated.length > 0 && (
              <>
                <div
                  className={cn(
                    viewMode === "grid"
                      ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-3 2xl:grid-cols-4 3xl:grid-cols-5 gap-3"
                      : "flex flex-col gap-3",
                  )}
                >
                  {paginated.map((offer, i) => {
                    const lowestForQuery =
                      lowestPriceInFiltered.get(offer.rawQuery) ?? 0;
                    const isBest =
                      offer.price > 0 && offer.price === lowestForQuery;
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
                  <div className="mt-8 flex items-center justify-center gap-1">
                    <button
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-30"
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </button>
                    {Array.from({ length: totalPages }, (_, i) => i + 1)
                      .filter(
                        (p) =>
                          p === 1 ||
                          p === totalPages ||
                          Math.abs(p - page) <= 2,
                      )
                      .reduce<(number | "...")[]>((acc, p, idx, arr) => {
                        if (idx > 0 && p - (arr[idx - 1] as number) > 1)
                          acc.push("...");
                        acc.push(p);
                        return acc;
                      }, [])
                      .map((p, idx) =>
                        p === "..." ? (
                          <span
                            key={`e-${idx}`}
                            className="px-1 text-muted-foreground"
                          >
                            ...
                          </span>
                        ) : (
                          <button
                            key={p}
                            onClick={() => setPage(p as number)}
                            className={cn(
                              "flex h-8 w-8 items-center justify-center rounded-lg text-xs font-medium transition-colors",
                              page === p
                                ? "bg-foreground text-background"
                                : "border border-border bg-card text-muted-foreground hover:bg-muted",
                            )}
                          >
                            {p}
                          </button>
                        ),
                      )}
                    <button
                      onClick={() =>
                        setPage((p) => Math.min(totalPages, p + 1))
                      }
                      disabled={page === totalPages}
                      className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-card text-muted-foreground hover:bg-muted disabled:opacity-30"
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
              className="w-full max-w-md rounded-2xl bg-card border border-border shadow-2xl p-6"
            >
              <div className="flex items-start gap-3 mb-4">
                <TriangleAlert className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground">
                    {failedStores.length === 1
                      ? "1 loja com problema"
                      : `${failedStores.length} lojas com problema`}
                  </h3>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    A busca foi concluida, mas algumas lojas nao responderam.
                  </p>
                </div>
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="flex-shrink-0 rounded-lg p-1 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="space-y-2 mb-5">
                {failedStores.map((s) => (
                  <div
                    key={s.name}
                    className="flex items-center gap-3 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-100 px-3 py-2.5"
                  >
                    <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-red-700">
                        {s.name}
                      </p>
                      <p className="text-[11px] text-red-500 mt-0.5">
                        {s.status === "login_error"
                          ? (s.error ??
                            "Login falhou — verifique as credenciais")
                          : (s.error ??
                            "Erro ao buscar — instabilidade ou bloqueio")}
                      </p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex gap-2">
                <button
                  onClick={() => setShowErrorModal(false)}
                  className="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-muted-foreground hover:bg-muted transition-colors"
                >
                  Fechar
                </button>
                <button
                  onClick={() => {
                    setShowErrorModal(false);
                    void search(items, true, selectedSuppliersFromAgent);
                  }}
                  className="flex-1 rounded-xl bg-[rgb(var(--primary-500))] px-4 py-2.5 text-sm font-semibold text-white hover:bg-[rgb(var(--primary-600))] transition-colors"
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
