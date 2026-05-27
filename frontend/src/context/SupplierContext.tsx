"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { suppliersApi } from "../services/api";
import { getStoredToken } from "../services/headers";
import type { Supplier, SupplierInput } from "../types/supplier";

export class LoginError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "LoginError";
  }
}

interface SupplierContextValue {
  suppliers: Supplier[];
  loading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
  createSupplier: (input: SupplierInput) => Promise<void>;
  updateSupplier: (id: string, input: Partial<SupplierInput>) => Promise<void>;
  removeSupplier: (id: string) => Promise<void>;
  toggleSupplierStatus: (id: string) => Promise<void>;
}

const SupplierContext = createContext<SupplierContextValue | undefined>(undefined);



export function SupplierProvider({ children }: { children: ReactNode }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function loadSuppliers(): Promise<void> {
    setLoading(true);
    setError(null);
    try {
      const fromApi = await suppliersApi.getAll();
      setSuppliers(fromApi);
    } catch (err) {
      console.error("Erro ao carregar fornecedores:", err);
      setError(err instanceof Error ? err.message : "Erro ao carregar fornecedores");
      setSuppliers([]);
    } finally {
      setLoading(false);
    }
  }

  const token = getStoredToken();

  useEffect(() => {
    void loadSuppliers();
  }, [token]);

  async function createSupplier(input: SupplierInput): Promise<void> {
    const payload = {
      name: input.name.trim(),
      url: input.url.trim(),
      logo: input.logo?.trim() || "",
      requiresLogin: Boolean(input.requiresLogin),
      username: input.username?.trim() || "",
      password: input.password?.trim() || "",
      isActive: true,
      region: input.region?.trim() || "",
      notes: input.notes?.trim() || "",
    };

    // Pode lançar LoginError — deixa propagar para o form tratar
    const created = await suppliersApi.create(payload);
    setSuppliers((prev) => [created, ...prev]);
    toast.success("Fornecedor cadastrado e login verificado!");
  }

  async function updateSupplier(id: string, input: Partial<SupplierInput>): Promise<void> {
    const payload = {
      name: input.name?.trim(),
      url: input.url?.trim(),
      logo: input.logo?.trim(),
      requiresLogin: input.requiresLogin,
      username: input.username?.trim(),
      password: input.password?.trim(),
      region: input.region?.trim(),
      notes: input.notes?.trim(),
    };

    // Pode lançar LoginError — deixa propagar para o form tratar
    const updated = await suppliersApi.update(id, payload);
    setSuppliers((prev) =>
      prev.map((s) => (s.id === id ? updated : s))
    );
    toast.success("Fornecedor atualizado");
  }

  async function removeSupplier(id: string): Promise<void> {
    const previous = suppliers;
    setSuppliers((prev) => prev.filter((supplier) => supplier.id !== id));

    try {
      await suppliersApi.delete(id);
      toast.success("Fornecedor excluído");
    } catch {
      setSuppliers(previous);
      toast.error("Erro ao excluir fornecedor");
    }
  }

  async function toggleSupplierStatus(id: string): Promise<void> {
    const supplier = suppliers.find((item) => item.id === id);
    if (!supplier) return;

    const nextStatus = !supplier.isActive;

    setSuppliers((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, isActive: nextStatus } : item
      )
    );

    try {
      await suppliersApi.update(id, { isActive: nextStatus });
    } catch {
      setSuppliers((prev) =>
        prev.map((item) =>
          item.id === id ? { ...item, isActive: supplier.isActive } : item
        )
      );
    }
  }

  return (
    <SupplierContext.Provider
      value={{
        suppliers,
        loading,
        error,
        refetch: loadSuppliers,
        createSupplier,
        updateSupplier,
        removeSupplier,
        toggleSupplierStatus,
      }}
    >
      {children}
    </SupplierContext.Provider>
  );
}

export function useSuppliers(): SupplierContextValue {
  const context = useContext(SupplierContext);
  if (!context) {
    throw new Error("useSuppliers must be used within SupplierProvider");
  }
  return context;
}
