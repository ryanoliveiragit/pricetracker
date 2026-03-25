"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Package, Plus, Edit2, Trash2, X, AlertCircle,
  Tag, Layers, Ruler, Store, FileText, Image as ImageIcon, Upload, Download,
  Search, ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight,
  LayoutGrid, Box,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useProductCatalog } from "../context/ProductCatalogContext";
import type { CatalogProduct } from "../types/catalog";
import { productSchema, type ProductFormData } from "../schemas/validation";
import ImageUploadCrop from "../components/ImageUploadCrop";

const EMPTY_FORM: ProductFormData = {
  name: "",
  category: "",
  brand: "",
  unit: "",
  sku: "",
  logo: "",
  notes: "",
};

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50];

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="block text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
        {label}
      </label>
      {children}
      {error && (
        <p className="flex items-center gap-1 text-xs text-red-500">
          <AlertCircle className="h-3 w-3" />
          {error}
        </p>
      )}
    </div>
  );
}

function inputCls(hasError?: boolean) {
  return `w-full rounded-xl border px-3.5 py-2.5 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:outline-none focus:ring-2 ${
    hasError
      ? "border-red-400 bg-red-50 focus:border-red-500 focus:ring-red-500/20"
      : "border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/20"
  }`;
}

export default function ModernCatalog() {
  const { products, createProduct, updateProduct, removeProduct, importCsv } =
    useProductCatalog();
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [brandFilter, setBrandFilter] = useState<string>("all");
  const [showForm, setShowForm] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [deleteConfirmId, setDeleteConfirmId] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    watch,
    setValue,
  } = useForm<ProductFormData>({
    resolver: zodResolver(productSchema),
    defaultValues: EMPTY_FORM,
  });

  // Pre-fill from offer detail page
  useEffect(() => {
    const raw =
      typeof window !== "undefined"
        ? localStorage.getItem("construprice-prefill-product")
        : null;
    if (!raw) return;
    try {
      const data = JSON.parse(raw) as {
        name?: string;
        brand?: string;
        notes?: string;
        imageUrl?: string;
        sku?: string;
      };
      localStorage.removeItem("construprice-prefill-product");
      reset({
        ...EMPTY_FORM,
        name: data.name ?? "",
        brand: data.brand ?? "",
        notes: data.notes ?? "",
        logo: data.imageUrl ?? "",
        sku: data.sku ?? "",
      });
      setShowForm(true);
    } catch {
      /* ignore */
    }
  }, [reset]);

  const availableCategories = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => s.add(p.category));
    return Array.from(s).sort();
  }, [products]);

  const availableBrands = useMemo(() => {
    const s = new Set<string>();
    products.forEach((p) => s.add(p.brand));
    return Array.from(s).sort();
  }, [products]);

  const filteredProducts = useMemo(() => {
    return products.filter((p) => {
      const match =
        !searchQuery ||
        p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.category.toLowerCase().includes(searchQuery.toLowerCase()) ||
        p.brand.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (p.sku ?? "").toLowerCase().includes(searchQuery.toLowerCase());
      const catMatch = categoryFilter === "all" || p.category === categoryFilter;
      const brandMatch = brandFilter === "all" || p.brand === brandFilter;
      return match && catMatch && brandMatch;
    });
  }, [products, searchQuery, categoryFilter, brandFilter]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, brandFilter, pageSize]);

  // Pagination
  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedProducts = filteredProducts.slice(
    (safePage - 1) * pageSize,
    safePage * pageSize
  );

  const hasActiveFilters = categoryFilter !== "all" || brandFilter !== "all" || searchQuery.length > 0;

  function onSubmit(data: ProductFormData) {
    if (editingId) updateProduct(editingId, data);
    else createProduct(data);
    reset(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function handleEdit(product: CatalogProduct) {
    reset({
      name: product.name,
      category: product.category,
      brand: product.brand,
      unit: product.unit,
      sku: product.sku ?? "",
      logo: product.logo ?? "",
      notes: product.notes ?? "",
    });
    setEditingId(product.id);
    setShowForm(true);
  }

  function handleCancel() {
    reset(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function handleDelete(id: string) {
    removeProduct(id);
    setDeleteConfirmId(null);
  }

  function downloadExampleCsv() {
    const csv = [
      "sep=;",
      "name;category;brand;unit;sku;notes",
      "Cadeado Pado 20mm;Segurança;Pado;Unidade;62251;Cadeado latão com 2 chaves",
      "Cimento CP-II 50kg;Cimento;Votorantim;Saco 50kg;;Uso geral",
      "Argamassa AC-II 20kg;Argamassa;Quartzolit;Saco 20kg;ACII-20;Para pisos e azulejos",
      "Tijolo Cerâmico 6 Furos;Alvenaria;Cerâmica SP;Milheiro;;Tijolo padrão",
      "Vergalhão CA-50 10mm;Ferragens;Gerdau;Barra 12m;CA50-10;Aço estrutural",
      "Tinta Acrílica Branca 18L;Tintas;Suvinil;Lata 18L;;Paredes internas/externas",
      "Tubo PVC 100mm 6m;Hidráulica;Tigre;Barra 6m;T100;Esgoto",
      "Fio Flexível 2.5mm 100m;Elétrica;Prysmian;Rolo 100m;FF25;750V",
    ].join("\n");
    const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "exemplo_importacao.csv";
    a.click();
    URL.revokeObjectURL(url);
  }

  function clearFilters() {
    setSearchQuery("");
    setCategoryFilter("all");
    setBrandFilter("all");
  }

  const logoValue = watch("logo");

  // Stats
  const totalProducts = products.length;
  const totalCategories = availableCategories.length;
  const totalBrands = availableBrands.length;
  const productsWithImage = products.filter((p) => p.logo).length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h1 className="text-xl font-bold text-slate-800 dark:text-neutral-100">
            Gerenciar Produtos
          </h1>
          <p className="mt-0.5 text-sm text-slate-500 dark:text-neutral-400">
            Catálogo de produtos para cotação
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            ref={csvInputRef}
            type="file"
            accept=".csv"
            className="hidden"
            onChange={async (e) => {
              const file = e.target.files?.[0];
              if (file) {
                await importCsv(file);
                e.target.value = "";
              }
            }}
          />
          <button
            onClick={downloadExampleCsv}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2 text-sm text-slate-500 dark:text-neutral-400 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-300"
            title="Baixar modelo CSV de exemplo"
          >
            <Download className="h-4 w-4" />
            Exemplo CSV
          </button>
          <button
            onClick={() => csvInputRef.current?.click()}
            className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-3.5 py-2 text-sm text-slate-500 dark:text-neutral-400 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-300"
          >
            <Upload className="h-4 w-4" />
            Importar CSV
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-3.5 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4" />
            Novo Produto
          </button>
        </div>
      </motion.div>

      {/* Stats */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05, duration: 0.3 }}
        className="grid grid-cols-2 gap-3 sm:grid-cols-4"
      >
        {[
          { label: "Produtos", value: totalProducts, icon: Package, color: "text-emerald-500" },
          { label: "Categorias", value: totalCategories, icon: LayoutGrid, color: "text-blue-500" },
          { label: "Marcas", value: totalBrands, icon: Box, color: "text-emerald-500" },
          { label: "Com Foto", value: productsWithImage, icon: ImageIcon, color: "text-amber-500" },
        ].map((stat) => (
          <div
            key={stat.label}
            className="flex items-center gap-3 rounded-2xl border border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 shadow-sm"
          >
            <stat.icon className={`h-4 w-4 ${stat.color} flex-shrink-0`} />
            <div>
              <p className="text-lg font-semibold text-slate-800 dark:text-neutral-100">{stat.value}</p>
              <p className="text-xs text-slate-500 dark:text-neutral-400">{stat.label}</p>
            </div>
          </div>
        ))}
      </motion.div>

      {/* Search & Filters bar */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.3 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center"
      >
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 py-2 pl-10 pr-4 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
            placeholder="Buscar por nome, categoria, marca ou SKU..."
          />
        </div>

        {/* Category filter */}
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-3 py-2 text-sm text-slate-600 dark:text-neutral-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
        >
          <option value="all">Categoria ({availableCategories.length})</option>
          {availableCategories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>

        {/* Brand filter */}
        <select
          value={brandFilter}
          onChange={(e) => setBrandFilter(e.target.value)}
          className="rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-3 py-2 text-sm text-slate-600 dark:text-neutral-300 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500/20"
        >
          <option value="all">Marca ({availableBrands.length})</option>
          {availableBrands.map((b) => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>

        {hasActiveFilters && (
          <button
            onClick={clearFilters}
            className="rounded-lg border border-slate-200 dark:border-neutral-700 px-3 py-2 text-xs text-slate-500 dark:text-neutral-400 transition-colors hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-300"
          >
            Limpar
          </button>
        )}
      </motion.div>

      {/* Active filter tags */}
      {hasActiveFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs text-slate-400 dark:text-neutral-500">Filtros ativos:</span>
          {searchQuery && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
              &quot;{searchQuery}&quot;
              <button onClick={() => setSearchQuery("")} className="ml-0.5 hover:text-emerald-800">&times;</button>
            </span>
          )}
          {categoryFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-blue-50 dark:bg-blue-500/10 px-2 py-0.5 text-xs text-blue-600 dark:text-blue-400">
              {categoryFilter}
              <button onClick={() => setCategoryFilter("all")} className="ml-0.5 hover:text-blue-800">&times;</button>
            </span>
          )}
          {brandFilter !== "all" && (
            <span className="inline-flex items-center gap-1 rounded-md bg-emerald-50 dark:bg-emerald-500/10 px-2 py-0.5 text-xs text-emerald-600 dark:text-emerald-400">
              {brandFilter}
              <button onClick={() => setBrandFilter("all")} className="ml-0.5 hover:text-emerald-800">&times;</button>
            </span>
          )}
        </div>
      )}

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15, duration: 0.3 }}
        className="overflow-hidden rounded-2xl border border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-sm"
      >
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-100 dark:border-neutral-800">
                {[
                  { label: "Produto", align: "left" },
                  { label: "SKU", align: "left" },
                  { label: "Categoria", align: "left" },
                  { label: "Marca", align: "left" },
                  { label: "Unidade", align: "left" },
                  { label: "", align: "right" },
                ].map((h, i) => (
                  <th
                    key={i}
                    className={`px-4 py-2.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-neutral-500 ${
                      h.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {h.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedProducts.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-16 text-center">
                    <div className="flex flex-col items-center gap-2">
                      <Package className="h-8 w-8 text-slate-300 dark:text-neutral-600" />
                      <p className="text-sm text-slate-500 dark:text-neutral-400">
                        {hasActiveFilters
                          ? "Nenhum produto encontrado com esses filtros"
                          : "Nenhum produto cadastrado"}
                      </p>
                      {hasActiveFilters && (
                        <button
                          onClick={clearFilters}
                          className="mt-1 text-xs text-emerald-500 hover:text-emerald-600"
                        >
                          Limpar filtros
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedProducts.map((product, idx) => (
                  <tr
                    key={product.id}
                    className={`group border-b border-slate-50 dark:border-neutral-800 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800 ${
                      idx % 2 === 0 ? "" : "bg-slate-50/50 dark:bg-neutral-800/50"
                    }`}
                  >
                    {/* Produto */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        {product.logo ? (
                          <img
                            src={product.logo}
                            alt={product.name}
                            className="h-8 w-8 flex-shrink-0 rounded-md border border-slate-200 dark:border-neutral-700 object-contain"
                          />
                        ) : (
                          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-neutral-800">
                            <Package className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500" />
                          </div>
                        )}
                        <div className="min-w-0">
                          <p className="truncate text-sm font-medium text-slate-700 dark:text-neutral-300">
                            {product.name}
                          </p>
                          {product.notes && (
                            <p className="mt-0.5 max-w-[240px] truncate text-[11px] text-slate-400">
                              {product.notes}
                            </p>
                          )}
                        </div>
                      </div>
                    </td>

                    {/* SKU */}
                    <td className="px-4 py-3">
                      {product.sku ? (
                        <span className="font-mono text-xs text-slate-500 dark:text-neutral-400">
                          {product.sku}
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300 dark:text-neutral-600">&mdash;</span>
                      )}
                    </td>

                    {/* Categoria */}
                    <td className="px-4 py-3">
                      <span className="rounded-md bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 text-xs text-slate-600 dark:text-neutral-300">
                        {product.category}
                      </span>
                    </td>

                    {/* Marca */}
                    <td className="px-4 py-3 text-sm text-slate-500 dark:text-neutral-400">
                      {product.brand}
                    </td>

                    {/* Unidade */}
                    <td className="px-4 py-3 text-xs text-slate-500 dark:text-neutral-400">
                      {product.unit}
                    </td>

                    {/* Ações */}
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                        <button
                          onClick={() => handleEdit(product)}
                          className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200"
                          title="Editar"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        {deleteConfirmId === product.id ? (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => handleDelete(product.id)}
                              className="rounded-md bg-red-50 px-2 py-1 text-[11px] font-medium text-red-500 transition-colors hover:bg-red-100"
                            >
                              Confirmar
                            </button>
                            <button
                              onClick={() => setDeleteConfirmId(null)}
                              className="rounded-md px-2 py-1 text-[11px] text-slate-500 transition-colors hover:bg-slate-100"
                            >
                              Não
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => setDeleteConfirmId(product.id)}
                            className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-red-50 hover:text-red-500"
                            title="Excluir"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {filteredProducts.length > 0 && (
          <div className="flex flex-col gap-3 border-t border-slate-100 dark:border-neutral-800 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <p className="text-xs text-slate-400 dark:text-neutral-500">
                {(safePage - 1) * pageSize + 1}&ndash;{Math.min(safePage * pageSize, filteredProducts.length)} de{" "}
                <span className="text-slate-600 dark:text-neutral-300">{filteredProducts.length}</span>
              </p>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="rounded-md border border-slate-200 dark:border-neutral-700 bg-transparent px-2 py-1 text-xs text-slate-500 dark:text-neutral-400 focus:outline-none"
              >
                {PAGE_SIZE_OPTIONS.map((size) => (
                  <option key={size} value={size}>
                    {size} / página
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={safePage <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronsLeft className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>

              {/* Page numbers */}
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter((page) => {
                  if (totalPages <= 7) return true;
                  if (page === 1 || page === totalPages) return true;
                  if (Math.abs(page - safePage) <= 1) return true;
                  return false;
                })
                .reduce<(number | "dots")[]>((acc, page, i, arr) => {
                  if (i > 0 && arr[i - 1] !== page - 1) acc.push("dots");
                  acc.push(page);
                  return acc;
                }, [])
                .map((item, i) =>
                  item === "dots" ? (
                    <span key={`dots-${i}`} className="px-1 text-xs text-slate-300">
                      ...
                    </span>
                  ) : (
                    <button
                      key={item}
                      onClick={() => setCurrentPage(item)}
                      className={`flex h-7 w-7 items-center justify-center rounded-md text-xs transition-colors ${
                        item === safePage
                          ? "bg-emerald-500 font-medium text-white"
                          : "text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200"
                      }`}
                    >
                      {item}
                    </button>
                  )
                )}

              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={safePage >= totalPages}
                className="flex h-7 w-7 items-center justify-center rounded-md text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200 disabled:pointer-events-none disabled:opacity-30"
              >
                <ChevronsRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {/* ── Form Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.96, y: 16 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: 16 }}
              transition={{ type: "spring", duration: 0.35 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-2xl"
            >
              {/* Modal header */}
              <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-50 dark:bg-emerald-500/10">
                    <Package className="h-5 w-5 text-emerald-500" />
                  </div>
                  <div>
                    <h2 className="text-base font-semibold text-slate-800 dark:text-neutral-100">
                      {editingId ? "Editar Produto" : "Novo Produto"}
                    </h2>
                    <p className="text-xs text-slate-500 dark:text-neutral-400">
                      {editingId
                        ? "Atualize as informações do produto"
                        : "Preencha os dados para cadastrar"}
                    </p>
                  </div>
                </div>
                <button
                  onClick={handleCancel}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-700 dark:hover:text-neutral-200"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)}>
                <div className="p-6 space-y-6">

                  {/* ── Section: Identificação ── */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Identificação
                      </span>
                    </div>

                    <Field label="Nome do Produto *" error={errors.name?.message}>
                      <div className="relative">
                        <Package className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          {...register("name")}
                          className={`${inputCls(!!errors.name)} pl-10`}
                          placeholder="Ex: Cadeado Papaiz 20mm"
                        />
                      </div>
                    </Field>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Código / SKU" error={errors.sku?.message}>
                        <div className="relative">
                          <Tag className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            {...register("sku")}
                            className={`${inputCls(!!errors.sku)} pl-10 font-mono`}
                            placeholder="Ex: 62251"
                          />
                        </div>
                      </Field>

                      <Field label="Marca *" error={errors.brand?.message}>
                        <div className="relative">
                          <Store className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            {...register("brand")}
                            className={`${inputCls(!!errors.brand)} pl-10`}
                            placeholder="Ex: Papaiz"
                          />
                        </div>
                      </Field>
                    </div>
                  </div>

                  {/* ── Section: Classificação ── */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Classificação
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <Field label="Categoria *" error={errors.category?.message}>
                        <div className="relative">
                          <Layers className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            {...register("category")}
                            className={`${inputCls(!!errors.category)} pl-10`}
                            placeholder="Ex: Segurança"
                          />
                        </div>
                      </Field>

                      <Field label="Unidade *" error={errors.unit?.message}>
                        <div className="relative">
                          <Ruler className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                          <input
                            type="text"
                            {...register("unit")}
                            className={`${inputCls(!!errors.unit)} pl-10`}
                            placeholder="Ex: Unidade"
                          />
                        </div>
                      </Field>
                    </div>
                  </div>

                  {/* ── Section: Imagem ── */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Imagem
                      </span>
                    </div>

                    <div className="flex gap-4">
                      {/* Preview */}
                      <div className="flex h-24 w-24 flex-shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800">
                        {logoValue ? (
                          <img
                            src={logoValue}
                            alt="preview"
                            className="h-full w-full object-contain p-2"
                          />
                        ) : (
                          <ImageIcon className="h-8 w-8 text-slate-300" />
                        )}
                      </div>

                      <div className="flex-1">
                        <ImageUploadCrop
                          value={logoValue}
                          onChange={(base64) => setValue("logo", base64)}
                          aspect={1}
                        />
                        <p className="mt-2 text-xs text-slate-400">
                          JPG, PNG ou WebP · Máx 5 MB · Será recortado em quadrado
                        </p>
                      </div>
                    </div>
                  </div>

                  {/* ── Section: Observações ── */}
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-1 w-5 rounded-full bg-emerald-500" />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                        Observações
                      </span>
                    </div>

                    <Field label="Descrição / Notas" error={errors.notes?.message}>
                      <div className="relative">
                        <FileText className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                        <textarea
                          {...register("notes")}
                          rows={3}
                          className={`${inputCls()} pl-10 resize-none`}
                          placeholder="Informações adicionais sobre o produto (opcional)"
                        />
                      </div>
                    </Field>
                  </div>
                </div>

                {/* Modal footer */}
                <div className="sticky bottom-0 flex gap-3 border-t border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-6 py-4">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 py-2.5 text-sm font-medium text-slate-600 dark:text-neutral-300 transition-colors hover:bg-slate-100 dark:hover:bg-neutral-700 hover:text-slate-800 dark:hover:text-neutral-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-xl bg-emerald-500 py-2.5 text-sm font-semibold text-white transition-colors hover:bg-emerald-600"
                  >
                    {editingId ? "Salvar Alterações" : "Adicionar Produto"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete confirmation overlay (click outside to cancel) */}
      {deleteConfirmId && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setDeleteConfirmId(null)}
        />
      )}
    </div>
  );
}
