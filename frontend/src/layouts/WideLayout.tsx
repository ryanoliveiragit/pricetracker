"use client";

import { motion } from "framer-motion";
import {
  Home,
  Search,
  Package,
  BarChart3,
  Store,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/search", label: "Buscar Preços", icon: Search },
  { href: "/products", label: "Produtos", icon: Package },
  { href: "/suppliers", label: "Fornecedores", icon: Store },
  { href: "/results", label: "Resultados", icon: BarChart3 },
  { href: "/settings", label: "Configurações", icon: Settings },
];

export default function WideLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

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
    <div className="flex min-h-screen flex-col bg-neutral-50 dark:bg-neutral-950">
      <header className="border-b border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900/50">
        <div className="mx-auto flex h-20 max-w-[2000px] items-center justify-between px-6 md:px-12">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg dark:shadow-purple-500/20">
              <Package className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-neutral-900 dark:text-neutral-100">
                ConstruPrice
              </h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Comparador de Preços
              </p>
            </div>
          </Link>

          <nav className="hidden lg:flex items-center gap-2">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`relative flex items-center gap-3 rounded-xl px-6 py-3 text-sm font-medium transition-all ${
                    active
                      ? "bg-purple-100 text-purple-600 shadow-sm dark:bg-purple-500/10 dark:text-purple-400"
                      : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="activeWideItem"
                      className="absolute inset-0 rounded-xl bg-purple-100 dark:bg-purple-500/10"
                      transition={{
                        type: "spring",
                        bounce: 0.2,
                        duration: 0.6,
                      }}
                    />
                  )}
                  <Icon className="relative h-5 w-5" />
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-3 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 dark:border-neutral-800 dark:bg-neutral-950/50">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
              <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white">
                {user?.displayName?.charAt(0).toUpperCase()}
              </div>
              )}
              <div>
                <p className="text-sm font-medium text-neutral-900 dark:text-neutral-100">
                  {user?.displayName}
                </p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {user?.email}
                </p>
              </div>
            </div>
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 rounded-xl border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-400"
            >
              {mobileMenuOpen ? (
                <X className="h-5 w-5" />
              ) : (
                <Menu className="h-5 w-5" />
              )}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 lg:hidden"
          >
            <nav className="flex flex-col p-4 space-y-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                      active
                        ? "bg-purple-100 text-purple-600 dark:bg-purple-500/10 dark:text-purple-400"
                        : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
                    }`}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </motion.div>
        )}
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-[2000px] px-6 py-8 md:px-12 md:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
