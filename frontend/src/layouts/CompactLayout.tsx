"use client";

import { motion } from "framer-motion";
import { Home, Search, Package, BarChart3, Store, Settings, LogOut, User } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import type { ReactNode } from "react";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { href: "/", icon: Home, label: "Dashboard" },
  { href: "/search", icon: Search, label: "Buscar" },
  { href: "/products", icon: Package, label: "Produtos" },
  { href: "/suppliers", icon: Store, label: "Fornecedores" },
  { href: "/results", icon: BarChart3, label: "Resultados" },
  { href: "/settings", icon: Settings, label: "Configurações" },
  { href: "/saves", icon: Package, label: "Salvos" },
];

export default function CompactLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();
  const [showDropdown, setShowDropdown] = useState(false);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  function isActive(path: string): boolean {
    if (!pathname) return false;
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  }

  return (
    <div className="flex min-h-screen bg-neutral-50 dark:bg-neutral-950">
      <aside className="fixed left-0 top-0 bottom-0 z-40 w-16 border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="flex h-full flex-col items-center py-4">
          <Link href="/" className="mb-6 flex h-10 w-10 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg dark:shadow-purple-500/20">
            <Package className="h-5 w-5 text-white" />
          </Link>

          <nav className="flex flex-1 flex-col gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex h-10 w-10 items-center justify-center rounded-lg transition-colors ${
                    active
                      ? "bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  }`}
                  title={item.label}
                >
                  {active && (
                    <motion.div
                      layoutId="activeCompactItem"
                      className="absolute inset-0 rounded-lg bg-purple-100 dark:bg-purple-500/10"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon className="relative h-5 w-5" />
                </Link>
              );
            })}
          </nav>

          <div className="relative">
            <button
              onClick={() => setShowDropdown(!showDropdown)}
              className="flex h-10 w-10 items-center justify-center rounded-lg text-neutral-600 transition-colors hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800 relative"
              title="Perfil"
            >
              <User className="h-5 w-5" />
            </button>

            {showDropdown && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setShowDropdown(false)} />
                <div className="absolute bottom-0 left-12 z-20 mb-1 w-48 rounded-xl border border-neutral-200 bg-white shadow-lg dark:border-neutral-700 dark:bg-neutral-900">
                  <Link
                    href="/settings"
                    onClick={() => setShowDropdown(false)}
                    className="flex w-full items-center gap-2.5 rounded-t-xl px-4 py-3 text-sm text-neutral-700 hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                  >
                    <Settings className="h-4 w-4" />
                    Configurações
                  </Link>
                  <div className="border-t border-neutral-100 dark:border-neutral-800" />
                  <button
                    onClick={handleLogout}
                    className="flex w-full items-center gap-2.5 rounded-b-xl px-4 py-3 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20"
                  >
                    <LogOut className="h-4 w-4" />
                    Sair
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </aside>

      <main className="ml-16 flex-1">
        <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 md:py-8">
          {children}
        </div>
      </main>
    </div>
  );
}
