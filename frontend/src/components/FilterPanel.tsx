import type { SortOption } from "../types/search";
import { Card, CardBody } from "@nextui-org/react";
import { Filter, DollarSign, Package, CheckCircle } from "lucide-react";

interface FilterPanelProps {
  stores: string[];
  selectedStore: string;
  sortBy: SortOption;
  onStoreChange: (value: string) => void;
  onSortChange: (value: SortOption) => void;
  priceRange?: [number, number];
  onPriceRangeChange?: (range: [number, number]) => void;
  availabilityFilter?: string;
  onAvailabilityChange?: (value: string) => void;
  minPrice?: number;
  maxPrice?: number;
}

export default function FilterPanel({ 
  stores, 
  selectedStore, 
  sortBy, 
  onStoreChange, 
  onSortChange,
  priceRange,
  onPriceRangeChange,
  availabilityFilter,
  onAvailabilityChange,
  minPrice = 0,
  maxPrice = 10000
}: FilterPanelProps) {
  return (
    <Card className="border border-[#2e2250] bg-[#191029] text-white shadow-lg">
      <CardBody className="space-y-6">
        <div className="flex items-center gap-2 border-b border-[#2e2250] pb-3">
          <Filter className="h-5 w-5 text-brand-500" />
          <h2 className="text-lg font-semibold text-white">Filtros Dinâmicos</h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          <label className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-100">
              <Package className="h-4 w-4 text-brand-400" />
              Fornecedor
            </div>
            <select
              value={selectedStore}
              onChange={(event) => onStoreChange(event.target.value)}
              className="w-full rounded-xl border border-[#2e2250] bg-[#120c20] px-3 py-2.5 text-sm text-violet-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
            >
              <option value="all">Todas as lojas ({stores.length})</option>
              {stores.map((store) => (
                <option key={store} value={store}>
                  {store}
                </option>
              ))}
            </select>
          </label>

          <label className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-100">
              <CheckCircle className="h-4 w-4 text-brand-400" />
              Disponibilidade
            </div>
            <select
              value={availabilityFilter || "all"}
              onChange={(event) => onAvailabilityChange?.(event.target.value)}
              className="w-full rounded-xl border border-[#2e2250] bg-[#120c20] px-3 py-2.5 text-sm text-violet-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
            >
              <option value="all">Todas</option>
              <option value="em_estoque">Em Estoque</option>
              <option value="por_encomenda">Por Encomenda</option>
            </select>
          </label>

          <label className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium text-violet-100">
              <DollarSign className="h-4 w-4 text-brand-400" />
              Faixa de Preço
            </div>
            <div className="space-y-2">
              <div className="flex gap-2">
                <input
                  type="number"
                  value={priceRange?.[0] ?? minPrice}
                  onChange={(e) => onPriceRangeChange?.([Number(e.target.value), priceRange?.[1] ?? maxPrice])}
                  className="w-full rounded-lg border border-[#2e2250] bg-[#120c20] px-3 py-2 text-sm text-violet-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                  placeholder="Min"
                  min={minPrice}
                  max={maxPrice}
                />
                <input
                  type="number"
                  value={priceRange?.[1] ?? maxPrice}
                  onChange={(e) => onPriceRangeChange?.([priceRange?.[0] ?? minPrice, Number(e.target.value)])}
                  className="w-full rounded-lg border border-[#2e2250] bg-[#120c20] px-3 py-2 text-sm text-violet-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
                  placeholder="Max"
                  min={minPrice}
                  max={maxPrice}
                />
              </div>
              <p className="text-xs text-violet-400">
                R$ {priceRange?.[0] ?? minPrice} - R$ {priceRange?.[1] ?? maxPrice}
              </p>
            </div>
          </label>

          <label className="space-y-2">
            <div className="text-sm font-medium text-violet-100">
              Ordenação
            </div>
            <select
              value={sortBy}
              onChange={(event) => onSortChange(event.target.value as SortOption)}
              className="w-full rounded-xl border border-[#2e2250] bg-[#120c20] px-3 py-2.5 text-sm text-violet-100 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 transition-all"
            >
              <option value="best_price">Menor Preço</option>
              <option value="alphabetical">Nome da Loja A-Z</option>
            </select>
          </label>
        </div>

        {/* Filtros ativos */}
        {(selectedStore !== "all" || (availabilityFilter && availabilityFilter !== "all") || (priceRange && (priceRange[0] !== minPrice || priceRange[1] !== maxPrice))) && (
          <div className="flex flex-wrap gap-2 pt-3 border-t border-[#2e2250]">
            <span className="text-xs font-medium text-violet-400">Filtros ativos:</span>
            {selectedStore !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-medium text-brand-300 border border-brand-500/30">
                {selectedStore}
                <button onClick={() => onStoreChange("all")} className="ml-1 hover:text-brand-100 transition-colors">
                  ×
                </button>
              </span>
            )}
            {availabilityFilter && availabilityFilter !== "all" && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-medium text-brand-300 border border-brand-500/30">
                {availabilityFilter === "em_estoque" ? "Em Estoque" : "Por Encomenda"}
                <button onClick={() => onAvailabilityChange?.("all")} className="ml-1 hover:text-brand-100 transition-colors">
                  ×
                </button>
              </span>
            )}
            {priceRange && (priceRange[0] !== minPrice || priceRange[1] !== maxPrice) && (
              <span className="inline-flex items-center gap-1 rounded-full bg-brand-500/20 px-3 py-1 text-xs font-medium text-brand-300 border border-brand-500/30">
                R$ {priceRange[0]} - R$ {priceRange[1]}
                <button onClick={() => onPriceRangeChange?.([minPrice, maxPrice])} className="ml-1 hover:text-brand-100 transition-colors">
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </CardBody>
    </Card>
  );
}
