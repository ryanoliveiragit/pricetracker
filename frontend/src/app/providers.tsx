"use client";

import { NextUIProvider } from "@nextui-org/react";
import { useEffect, type ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "../context/AuthContext";
import { ProductCatalogProvider } from "../context/ProductCatalogContext";
import { SupplierProvider } from "../context/SupplierContext";
import { TenantProvider } from "../context/TenantContext";
import { ThemeProvider } from "../context/ThemeContext";

function ThemedToaster() {
  return (
    <>
      <Toaster
        theme="system"
        position="bottom-right"
        toastOptions={{
          className: "!bg-white dark:!bg-neutral-900 !border-slate-200 dark:!border-neutral-800 !text-slate-800 dark:!text-neutral-200 !shadow-lg",
        }}
      />
    </>
  );
}

function ApiWarmup() {
  useEffect(() => {
    const base = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "").replace(/\/api\/?$/, "");
    if (base) fetch(`${base}/health`).catch(() => {});
  }, []);
  return null;
}

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <NextUIProvider>
      <TenantProvider>
      <ThemeProvider>
        <AuthProvider>
          <ProductCatalogProvider>
            <SupplierProvider>
              <ApiWarmup />
              {children}
              <ThemedToaster />
            </SupplierProvider>
          </ProductCatalogProvider>
        </AuthProvider>
      </ThemeProvider>
      </TenantProvider>
    </NextUIProvider>
  );
}
