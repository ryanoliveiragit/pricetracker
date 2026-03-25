"use client";

import { NextUIProvider } from "@nextui-org/react";
import type { ReactNode } from "react";
import { Toaster } from "sonner";
import { AuthProvider } from "../context/AuthContext";
import { ProductCatalogProvider } from "../context/ProductCatalogContext";
import { SupplierProvider } from "../context/SupplierContext";
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

export default function Providers({ children }: { children: ReactNode }) {
  return (
    <NextUIProvider>
      <ThemeProvider>
        <AuthProvider>
          <ProductCatalogProvider>
            <SupplierProvider>
              {children}
              <ThemedToaster />
            </SupplierProvider>
          </ProductCatalogProvider>
        </AuthProvider>
      </ThemeProvider>
    </NextUIProvider>
  );
}
