"use client";

import { motion } from "framer-motion";
import { Search, Plus, X, ArrowRight, Sparkles, Package } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { useProductCatalog } from "../context/ProductCatalogContext";

export default function ModernSearch() {
  const router = useRouter();
  const { products } = useProductCatalog();
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredProducts = useMemo(() => {
    if (!searchQuery) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.category.toLowerCase().includes(query) ||
        (p.brand ?? "").toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  const selectedProducts = useMemo(
    () => products.filter((p) => selectedProductIds.includes(p.id)),
    [products, selectedProductIds]
  );

  function toggleProduct(productId: string) {
    setSelectedProductIds((prev) =>
      prev.includes(productId) ? prev.filter((id) => id !== productId) : [...prev, productId]
    );
  }

  function handleSearch() {
    if (selectedProducts.length === 0) return;

    const items = selectedProducts.map((p) => p.name);
    localStorage.setItem("construprice-last-search-items", JSON.stringify(items));
    router.push("/results");
  }

  return (
    <div className="space-y-8 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-5 w-5 text-[#84CC16]" />
          <span className="text-sm font-medium text-[#3d6600]">Buscar Produtos</span>
        </div>
        <h1 className="text-3xl font-bold text-[#1A1A18] mb-2">Nova Cotação</h1>
        <p className="text-[#A0A09A]">
          Selecione os produtos do catálogo para realizar uma cotação de preços
        </p>
      </motion.div>

      <div className="grid gap-6 lg:grid-cols-[1fr_400px]">
        {/* Product Selection */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
          className="space-y-4"
        >
          {/* Search Input */}
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[#A0A09A]" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, categoria ou marca..."
              className="w-full rounded-xl border border-[#E8E8E4] bg-[#F7F7F5] py-3 pl-12 pr-4 text-sm text-[#1A1A18] placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:border-[#84CC16] focus:outline-none focus:ring-2 focus:ring-lime-500/20"
            />
          </div>

          {/* Products Grid */}
          <div className="rounded-xl border border-[#E8E8E4] bg-white p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-[#6B6B63]">
                Produtos Disponíveis ({filteredProducts.length})
              </h2>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7F5] border border-[#E8E8E4]">
                    <Search className="h-6 w-6 text-[#A0A09A]" />
                  </div>
                  <p className="text-sm text-[#A0A09A]">Nenhum produto encontrado</p>
                </div>
              ) : (
                filteredProducts.map((product) => {
                  const isSelected = selectedProductIds.includes(product.id);

                  return (
                    <button
                      key={product.id}
                      onClick={() => toggleProduct(product.id)}
                      className={`
                        group w-full rounded-lg border p-4 text-left transition-all
                        ${
                          isSelected
                            ? "border-[#84CC16]/50 bg-[#84CC16]/15 border border-[#84CC16]/30"
                            : "border-[#E8E8E4] bg-white hover:border-[#D0D0CA] hover:bg-[#F7F7F5]"
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          {product.logo ? (
                            <img
                              src={product.logo}
                              alt={`Logo ${product.name}`}
                              className="h-10 w-10 flex-shrink-0 rounded-lg border border-[#E8E8E4] object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] text-[#A0A09A]">
                              <Package className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="mb-1 truncate font-medium text-[#1A1A18]">
                              {product.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-md bg-[#F7F7F5] border border-[#E8E8E4] px-2 py-1 text-[#A0A09A]">
                                {product.category}
                              </span>
                              <span className="rounded-md bg-[#F7F7F5] border border-[#E8E8E4] px-2 py-1 text-[#A0A09A]">
                                {product.brand}
                              </span>
                              <span className="rounded-md bg-[#F7F7F5] border border-[#E8E8E4] px-2 py-1 text-[#A0A09A]">
                                {product.unit}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div
                          className={`
                            flex h-5 w-5 flex-shrink-0 items-center justify-center rounded border-2 transition-colors
                            ${
                              isSelected
                                ? "border-[#84CC16] bg-lime-500"
                                : "border-[#D0D0CA] group-hover:border-[#A0A09A] group-hover:dark:border-neutral-500"
                            }
                          `}
                        >
                          {isSelected && <Plus className="h-3 w-3 rotate-45 text-white" />}
                        </div>
                      </div>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </motion.div>

        {/* Selected Products Summary */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2, duration: 0.5 }}
          className="space-y-4"
        >
          <div className="rounded-xl border border-[#E8E8E4] bg-white p-6 shadow-card lg:sticky lg:top-4">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-[#84CC16]" />
              <h2 className="text-lg font-semibold text-[#1A1A18]">
                Produtos Selecionados
              </h2>
            </div>

            {selectedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-[#F7F7F5] border border-[#E8E8E4]">
                  <Plus className="h-6 w-6 text-[#A0A09A]" />
                </div>
                <p className="text-sm text-[#A0A09A]">
                  Selecione produtos para iniciar a cotação
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {selectedProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] p-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {product.logo ? (
                          <img
                            src={product.logo}
                            alt={`Logo ${product.name}`}
                            className="h-8 w-8 flex-shrink-0 rounded-md border border-[#E8E8E4] object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-[#E8E8E4] bg-white text-[#A0A09A]">
                            <Package className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-[#1A1A18] truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-[#A0A09A]">{product.category}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleProduct(product.id)}
                        className="ml-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-[#D0D0CA] bg-[#F7F7F5] border border-[#E8E8E4] text-[#A0A09A] transition-colors hover:border-error hover:bg-error/10 hover:text-error"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t border-[#E8E8E4]">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#A0A09A]">Total de produtos</span>
                    <span className="font-semibold text-[#1A1A18]">
                      {selectedProducts.length}
                    </span>
                  </div>

                  <button
                    onClick={handleSearch}
                    className="group relative w-full overflow-hidden rounded-lg bg-lime-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-lime-600 hover:shadow-md"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Iniciar Cotação
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                    <div className="absolute inset-0 bg-lime-600 opacity-0 transition-opacity group-hover:opacity-100" />
                  </button>
                </div>
              </>
            )}
          </div>
        </motion.div>
      </div>
    </div>
  );
}
