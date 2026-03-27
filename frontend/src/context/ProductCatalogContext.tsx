"use client";

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";

import { productsApi } from "../services/api";
import type { CatalogProduct, ProductInput } from "../types/catalog";

interface ProductCatalogContextValue {
  products: CatalogProduct[];
  loading: boolean;
  createProduct: (input: ProductInput) => Promise<void>;
  updateProduct: (id: string, input: ProductInput) => Promise<void>;
  removeProduct: (id: string) => Promise<void>;
  importCsv: (file: File) => Promise<number>;
}

const ProductCatalogContext = createContext<ProductCatalogContextValue | undefined>(undefined);

function normalizeProduct(product: ProductInput & { id?: string | number; createdAt?: string }): CatalogProduct {
  return {
    id: String(product.id ?? crypto.randomUUID()),
    name: product.name?.trim() ?? "",
    category: product.category?.trim() ?? "",
    brand: product.brand?.trim() ?? "",
    unit: product.unit?.trim() ?? "",
    sku: product.sku?.trim() || undefined,
    logo: product.logo?.trim() || undefined,
    notes: product.notes?.trim() || undefined,
    variants: product.variants ?? [],
    createdAt: product.createdAt ?? new Date().toISOString()
  };
}

export function ProductCatalogProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<CatalogProduct[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadProducts(): Promise<void> {
      setLoading(true);
      try {
        const fromApi = await productsApi.getAll();
        if (!active) return;
        setProducts(fromApi.map((product) => normalizeProduct(product)));
      } catch (error) {
        if (!active) return;
        console.error("Erro ao carregar produtos:", error);
        setProducts([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadProducts();

    return () => {
      active = false;
    };
  }, []);

  async function createProduct(input: ProductInput): Promise<void> {
    const payload: ProductInput = {
      name: input.name.trim(),
      category: input.category.trim(),
      brand: input.brand.trim(),
      unit: input.unit.trim(),
      sku: input.sku?.trim() || "",
      logo: input.logo?.trim() || "",
      notes: input.notes?.trim() || "",
      variants: input.variants ?? []
    };

    try {
      const created = await productsApi.create(payload);
      setProducts((prev) => [normalizeProduct(created), ...prev]);
      toast.success("Produto cadastrado com sucesso");
    } catch {
      const localProduct = normalizeProduct(payload);
      setProducts((prev) => [localProduct, ...prev]);
      toast.success("Produto cadastrado localmente");
    }
  }

  async function updateProduct(id: string, input: ProductInput): Promise<void> {
    const payload: ProductInput = {
      name: input.name.trim(),
      category: input.category.trim(),
      brand: input.brand.trim(),
      unit: input.unit.trim(),
      sku: input.sku?.trim() || "",
      logo: input.logo?.trim() || "",
      notes: input.notes?.trim() || "",
      variants: input.variants ?? []
    };

    try {
      const updated = await productsApi.update(id, payload);
      setProducts((prev) =>
        prev.map((product) => (product.id === id ? normalizeProduct(updated) : product))
      );
      toast.success("Produto atualizado");
    } catch {
      setProducts((prev) =>
        prev.map((product) =>
          product.id === id
            ? {
                ...product,
                ...normalizeProduct({ ...product, ...payload, id: product.id, createdAt: product.createdAt })
              }
            : product
        )
      );
    }
  }

  async function removeProduct(id: string): Promise<void> {
    const previous = products;
    setProducts((prev) => prev.filter((product) => product.id !== id));

    try {
      await productsApi.delete(id);
      toast.success("Produto excluído");
    } catch {
      setProducts(previous);
      toast.error("Erro ao excluir produto");
    }
  }

  async function importCsv(file: File): Promise<number> {
    try {
      const result = await productsApi.importCsv(file);
      const imported = result.products.map((p) => normalizeProduct(p));
      setProducts((prev) => [...imported, ...prev]);
      toast.success(`${result.imported} produto${result.imported !== 1 ? "s" : ""} importado${result.imported !== 1 ? "s" : ""}`);
      if (result.skipped > 0) {
        toast.warning(`${result.skipped} linha${result.skipped !== 1 ? "s" : ""} ignorada${result.skipped !== 1 ? "s" : ""}`);
      }
      return result.imported;
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Erro ao importar CSV";
      toast.error(msg);
      throw e;
    }
  }

  const value = useMemo<ProductCatalogContextValue>(
    () => ({
      products,
      loading,
      createProduct,
      updateProduct,
      removeProduct,
      importCsv,
    }),
    [products, loading]
  );

  return <ProductCatalogContext.Provider value={value}>{children}</ProductCatalogContext.Provider>;
}

export function useProductCatalog(): ProductCatalogContextValue {
  const context = useContext(ProductCatalogContext);

  if (!context) {
    throw new Error("useProductCatalog deve ser usado dentro de ProductCatalogProvider");
  }

  return context;
}
