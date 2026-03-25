"use client";

import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { suppliersApi } from "../services/api";
import type { Supplier, SupplierInput } from "../types/supplier";

interface SupplierContextValue {
  suppliers: Supplier[];
  loading: boolean;
  createSupplier: (input: SupplierInput) => Promise<void>;
  updateSupplier: (id: string, input: Partial<SupplierInput>) => Promise<void>;
  removeSupplier: (id: string) => Promise<void>;
  toggleSupplierStatus: (id: string) => Promise<void>;
}

const SupplierContext = createContext<SupplierContextValue | undefined>(undefined);



export function SupplierProvider({ children }: { children: ReactNode }) {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    async function loadSuppliers(): Promise<void> {
      setLoading(true);
      try {
        const fromApi = await suppliersApi.getAll();
        if (!active) return;
        setSuppliers(fromApi);
      } catch (error) {
        if (!active) return;
        console.error("Erro ao carregar fornecedores:", error);
        setSuppliers([]);
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    void loadSuppliers();

    return () => {
      active = false;
    };
  }, []);

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
      notes: input.notes?.trim() || ""
    };

    try {
      const created = await suppliersApi.create(payload);
      setSuppliers((prev) => [created, ...prev]);
      toast.success("Fornecedor cadastrado com sucesso");
    } catch {
      const localFallback: Supplier = {
        id: crypto.randomUUID(),
        ...payload,
        createdAt: new Date().toISOString()
      };
      setSuppliers((prev) => [localFallback, ...prev]);
      toast.success("Fornecedor cadastrado localmente");
    }
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
      notes: input.notes?.trim()
    };

    try {
      const updated = await suppliersApi.update(id, payload);
      setSuppliers((prev) =>
        prev.map((supplier) => (supplier.id === id ? updated : supplier))
      );
      toast.success("Fornecedor atualizado");
    } catch {
      setSuppliers((prev) =>
        prev.map((supplier) =>
          supplier.id === id
            ? {
                ...supplier,
                ...(payload.name !== undefined ? { name: payload.name } : {}),
                ...(payload.url !== undefined ? { url: payload.url } : {}),
                ...(payload.logo !== undefined ? { logo: payload.logo } : {}),
                ...(payload.requiresLogin !== undefined ? { requiresLogin: payload.requiresLogin } : {}),
                ...(payload.username !== undefined ? { username: payload.username } : {}),
                ...(payload.password !== undefined ? { password: payload.password } : {}),
                ...(payload.region !== undefined ? { region: payload.region } : {}),
                ...(payload.notes !== undefined ? { notes: payload.notes } : {})
              }
            : supplier
        )
      );
    }
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
        createSupplier,
        updateSupplier,
        removeSupplier,
        toggleSupplierStatus
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
