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
        p.brand.toLowerCase().includes(query)
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
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex items-center gap-2 mb-2">
          <Search className="h-5 w-5 text-emerald-500" />
          <span className="text-sm font-medium text-emerald-600 dark:text-emerald-400">Buscar Produtos</span>
        </div>
        <h1 className="text-3xl font-bold text-slate-800 dark:text-neutral-100 mb-2">Nova Cotação</h1>
        <p className="text-slate-500 dark:text-neutral-400">
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
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por nome, categoria ou marca..."
              className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 py-3 pl-12 pr-4 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
            />
          </div>

          {/* Products Grid */}
          <div className="rounded-2xl border border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-card">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-600 dark:text-neutral-300">
                Produtos Disponíveis ({filteredProducts.length})
              </h2>
            </div>

            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2">
              {filteredProducts.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-neutral-800">
                    <Search className="h-6 w-6 text-slate-400 dark:text-neutral-500" />
                  </div>
                  <p className="text-sm text-slate-500 dark:text-neutral-400">Nenhum produto encontrado</p>
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
                            ? "border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10"
                            : "border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 hover:border-slate-300 hover:dark:border-neutral-600 hover:bg-slate-50 hover:dark:bg-neutral-800"
                        }
                      `}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 flex-1 items-start gap-3">
                          {product.logo ? (
                            <img
                              src={product.logo}
                              alt={`Logo ${product.name}`}
                              className="h-10 w-10 flex-shrink-0 rounded-lg border border-slate-200 dark:border-neutral-700 object-cover"
                            />
                          ) : (
                            <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500">
                              <Package className="h-4 w-4" />
                            </div>
                          )}
                          <div className="min-w-0">
                            <h3 className="mb-1 truncate font-medium text-slate-800 dark:text-neutral-100">
                              {product.name}
                            </h3>
                            <div className="flex flex-wrap gap-2 text-xs">
                              <span className="rounded-md bg-slate-100 dark:bg-neutral-800 px-2 py-1 text-slate-500 dark:text-neutral-400">
                                {product.category}
                              </span>
                              <span className="rounded-md bg-slate-100 dark:bg-neutral-800 px-2 py-1 text-slate-500 dark:text-neutral-400">
                                {product.brand}
                              </span>
                              <span className="rounded-md bg-slate-100 dark:bg-neutral-800 px-2 py-1 text-slate-500 dark:text-neutral-400">
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
                                ? "border-emerald-500 bg-emerald-500"
                                : "border-slate-300 dark:border-neutral-600 group-hover:border-slate-400 group-hover:dark:border-neutral-500"
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
          <div className="rounded-2xl border border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-card sticky top-4">
            <div className="mb-4 flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-emerald-500" />
              <h2 className="text-lg font-semibold text-slate-800 dark:text-neutral-100">
                Produtos Selecionados
              </h2>
            </div>

            {selectedProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-neutral-800">
                  <Plus className="h-6 w-6 text-slate-400 dark:text-neutral-500" />
                </div>
                <p className="text-sm text-slate-500 dark:text-neutral-400">
                  Selecione produtos para iniciar a cotação
                </p>
              </div>
            ) : (
              <>
                <div className="mb-4 space-y-2 max-h-[400px] overflow-y-auto pr-2">
                  {selectedProducts.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 p-3"
                    >
                      <div className="flex min-w-0 flex-1 items-center gap-2">
                        {product.logo ? (
                          <img
                            src={product.logo}
                            alt={`Logo ${product.name}`}
                            className="h-8 w-8 flex-shrink-0 rounded-md border border-slate-200 dark:border-neutral-700 object-cover"
                          />
                        ) : (
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-400 dark:text-neutral-500">
                            <Package className="h-3.5 w-3.5" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-slate-800 dark:text-neutral-100 truncate">
                            {product.name}
                          </p>
                          <p className="text-xs text-slate-500 dark:text-neutral-400">{product.category}</p>
                        </div>
                      </div>
                      <button
                        onClick={() => toggleProduct(product.id)}
                        className="ml-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-md border border-slate-300 dark:border-neutral-600 bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 transition-colors hover:border-error hover:bg-error/10 hover:text-error"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>

                <div className="space-y-3 pt-4 border-t border-slate-200 dark:border-neutral-700">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-slate-500 dark:text-neutral-400">Total de produtos</span>
                    <span className="font-semibold text-slate-800 dark:text-neutral-100">
                      {selectedProducts.length}
                    </span>
                  </div>

                  <button
                    onClick={handleSearch}
                    className="group relative w-full overflow-hidden rounded-lg bg-emerald-500 px-4 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-600 hover:shadow-md"
                  >
                    <span className="relative z-10 flex items-center justify-center gap-2">
                      Iniciar Cotação
                      <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </span>
                    <div className="absolute inset-0 bg-emerald-600 opacity-0 transition-opacity group-hover:opacity-100" />
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
