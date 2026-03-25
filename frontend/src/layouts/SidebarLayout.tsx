"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  Home, Search, Package, BarChart3, Store, Settings,
  LogOut, ChevronLeft, ChevronRight, Bell, Menu,
  Sun, Moon, SearchIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/search", label: "Buscar Precos", icon: Search },
  { href: "/products", label: "Produtos", icon: Package },
  { href: "/suppliers", label: "Fornecedores", icon: Store },
  { href: "/results", label: "Resultados", icon: BarChart3 },
];

const bottomItems = [
  { href: "/settings", label: "Configuracoes", icon: Settings },
];

export default function SidebarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isDark = mode === "dark";

  function handleLogout() {
    logout();
    router.push("/login");
  }

  function isActive(path: string): boolean {
    if (!pathname) return false;
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  }

  const sidebarWidth = collapsed ? 76 : 256;

  const sidebarContent = (
    <div className="flex h-full flex-col">
      {/* Logo */}
      <div className="flex h-[60px] items-center gap-2.5 px-4 border-b border-slate-200 dark:border-neutral-800">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-emerald-600 flex-shrink-0 shadow-sm shadow-emerald-500/20">
          <Package className="h-5 w-5 text-white" />
        </div>
        {!collapsed && (
          <div className="flex flex-col">
            <span className="text-base font-bold text-slate-800 dark:text-neutral-100 whitespace-nowrap leading-tight">
              ConstruPrice
            </span>
            <span className="text-[10px] text-slate-400 dark:text-neutral-500 leading-tight">Comparador de preços</span>
          </div>
        )}
      </div>

      {/* Nav label */}
      {!collapsed && (
        <div className="px-5 pt-4 pb-1.5">
          <span className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-neutral-500">
            Menu
          </span>
        </div>
      )}

      {/* Navigation */}
      <nav className="flex-1 space-y-0.5 px-3 overflow-y-auto pt-1">
        {navItems.map((navItem) => {
          const Icon = navItem.icon;
          const active = isActive(navItem.href);

          return (
            <Link
              key={navItem.href}
              href={navItem.href}
              onClick={() => setMobileOpen(false)}
              className={`
                group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200
                ${active
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800/50 hover:text-slate-900 dark:hover:text-neutral-200"
                }
              `}
              title={collapsed ? navItem.label : undefined}
            >
              {active && (
                <motion.div
                  layoutId="activeSidebarItem"
                  className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-r-full bg-emerald-500"
                  transition={{ type: "spring", bounce: 0.15, duration: 0.5 }}
                />
              )}
              <Icon
                className={`relative h-[18px] w-[18px] flex-shrink-0 ${collapsed ? "mx-auto" : ""} ${
                  active ? "text-emerald-600 dark:text-emerald-400" : "text-slate-500 dark:text-neutral-500"
                }`}
              />
              {!collapsed && (
                <span className="relative whitespace-nowrap">{navItem.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-slate-200 dark:border-neutral-800 px-3 py-3 space-y-0.5">
        {/* Dark mode toggle */}
        <button
          onClick={toggleMode}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200 text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800/50 hover:text-slate-900 dark:hover:text-neutral-200"
          title={collapsed ? (isDark ? "Modo claro" : "Modo escuro") : undefined}
        >
          {isDark ? (
            <Sun className={`h-[18px] w-[18px] flex-shrink-0 text-amber-500 ${collapsed ? "mx-auto" : ""}`} />
          ) : (
            <Moon className={`h-[18px] w-[18px] flex-shrink-0 text-slate-500 ${collapsed ? "mx-auto" : ""}`} />
          )}
          {!collapsed && <span>{isDark ? "Modo Claro" : "Modo Escuro"}</span>}
        </button>

        {bottomItems.map((navItem) => {
          const Icon = navItem.icon;
          const active = isActive(navItem.href);

          return (
            <Link
              key={navItem.href}
              href={navItem.href}
              onClick={() => setMobileOpen(false)}
              className={`
                flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-all duration-200
                ${active
                  ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400"
                  : "text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800/50 hover:text-slate-900 dark:hover:text-neutral-200"
                }
              `}
              title={collapsed ? navItem.label : undefined}
            >
              <Icon className={`h-[18px] w-[18px] flex-shrink-0 text-slate-500 dark:text-neutral-500 ${collapsed ? "mx-auto" : ""}`} />
              {!collapsed && <span className="whitespace-nowrap">{navItem.label}</span>}
            </Link>
          );
        })}

        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium text-slate-600 dark:text-neutral-400 transition-all duration-200 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          title={collapsed ? "Sair" : undefined}
        >
          <LogOut className={`h-[18px] w-[18px] flex-shrink-0 text-slate-500 dark:text-neutral-500 ${collapsed ? "mx-auto" : ""}`} />
          {!collapsed && <span>Sair</span>}
        </button>
      </div>
    </div>
  );

  const currentPage = navItems.find((i) => isActive(i.href)) ?? bottomItems.find((i) => isActive(i.href));

  return (
    <div className="flex min-h-screen bg-slate-50 dark:bg-neutral-950">
      {/* Desktop Sidebar */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="fixed left-0 top-0 bottom-0 z-40 hidden md:block bg-white dark:bg-neutral-900 border-r border-slate-200 dark:border-neutral-800"
      >
        {sidebarContent}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[72px] flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 shadow-sm transition-colors hover:text-slate-600 dark:hover:text-neutral-300 hover:border-slate-300 dark:hover:border-neutral-600"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </motion.aside>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[256px] bg-white dark:bg-neutral-900 shadow-2xl md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Main content - desktop */}
      <motion.div
        initial={false}
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex-1 hidden md:flex md:flex-col min-h-screen"
      >
        {/* Header */}
        <header className="sticky top-0 z-30 h-16 border-b border-slate-200 dark:border-neutral-800 bg-white/90 dark:bg-neutral-900/80 backdrop-blur-xl">
          <div className="flex h-full items-center justify-between px-6">
            {/* Left: Page info */}
            <div className="flex items-center gap-4">
              <div>
                <h1 className="text-[15px] font-semibold text-slate-900 dark:text-neutral-100">
                  {currentPage?.label ?? "ConstruPrice"}
                </h1>
                <p className="text-[11px] text-slate-500 dark:text-neutral-500">
                  Comparador de precos de materiais
                </p>
              </div>
            </div>

            {/* Right: Actions */}
            <div className="flex items-center gap-2">
              {/* Search */}
              <div className="hidden lg:flex items-center gap-2 rounded-xl border border-slate-300 dark:border-neutral-700 bg-slate-100 dark:bg-neutral-800 px-3 py-2 w-72 focus-within:border-emerald-500 focus-within:bg-white dark:focus-within:bg-neutral-800 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
                <SearchIcon className="h-4 w-4 text-slate-500 dark:text-neutral-500 flex-shrink-0" />
                <input
                  type="text"
                  placeholder="Buscar produto em todas as lojas..."
                  className="flex-1 bg-transparent text-sm text-slate-800 dark:text-neutral-200 placeholder-slate-500 dark:placeholder-neutral-500 outline-none border-none focus:ring-0"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      const val = (e.target as HTMLInputElement).value.trim();
                      if (val) {
                        localStorage.setItem("construprice-last-search-items", JSON.stringify([val]));
                        window.dispatchEvent(new CustomEvent("construprice-header-search", { detail: [val] }));
                        router.push("/results");
                        (e.target as HTMLInputElement).value = "";
                      }
                    }
                  }}
                />
                <kbd className="hidden xl:inline text-[10px] text-slate-500 dark:text-neutral-600 bg-white dark:bg-neutral-700 border border-slate-300 dark:border-neutral-600 rounded px-1.5 py-0.5 font-mono">
                  Enter
                </kbd>
              </div>

              {/* Dark mode toggle */}
              <button
                onClick={toggleMode}
                className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 transition-all hover:bg-slate-100 dark:hover:bg-neutral-700 hover:text-slate-900 dark:hover:text-neutral-200"
                title={isDark ? "Modo claro" : "Modo escuro"}
              >
                {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4 text-slate-600" />}
              </button>

              {/* Notifications */}
              <button className="relative flex h-9 w-9 items-center justify-center rounded-xl border border-slate-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-slate-600 dark:text-neutral-400 transition-all hover:bg-slate-100 dark:hover:bg-neutral-700 hover:text-slate-900 dark:hover:text-neutral-200">
                <Bell className="h-4 w-4" />
                <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-emerald-500 ring-2 ring-white dark:ring-neutral-800" />
              </button>

              <div className="h-8 w-px bg-slate-200 dark:bg-neutral-700 mx-1" />

              {/* User avatar */}
              <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-default">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-semibold text-white shadow-sm">
                  {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <div className="hidden xl:block">
                  <p className="text-[13px] font-medium text-slate-800 dark:text-neutral-200 leading-tight">
                    {user?.displayName ?? "Usuario"}
                  </p>
                  <p className="text-[10px] text-slate-500 dark:text-neutral-500 leading-tight">
                    {user?.email ?? ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="flex-1 mx-auto w-full max-w-[1400px] px-6 py-6">
          {children}
        </main>
      </motion.div>

      {/* Mobile layout */}
      <div className="flex-1 flex flex-col md:hidden min-h-screen">
        <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-neutral-800 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl">
          <div className="flex h-14 items-center justify-between px-4">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl text-slate-600 dark:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500">
                <Package className="h-4 w-4 text-white" />
              </div>
              <span className="text-sm font-bold text-slate-800 dark:text-neutral-100">ConstruPrice</span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={toggleMode}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 dark:text-neutral-400"
              >
                {isDark ? <Sun className="h-4 w-4 text-amber-500" /> : <Moon className="h-4 w-4" />}
              </button>
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-400 to-emerald-600 text-xs font-semibold text-white">
                {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
              </div>
            </div>
          </div>
          {/* Mobile search bar */}
          <div className="px-4 pb-3">
            <div className="flex items-center gap-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-3 py-2 focus-within:border-emerald-500 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all">
              <SearchIcon className="h-4 w-4 text-slate-400 dark:text-neutral-500 flex-shrink-0" />
              <input
                type="text"
                placeholder="Buscar produto..."
                className="flex-1 bg-transparent text-sm text-slate-700 dark:text-neutral-200 placeholder-slate-400 dark:placeholder-neutral-500 outline-none border-none focus:ring-0"
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    const val = (e.target as HTMLInputElement).value.trim();
                    if (val) {
                      localStorage.setItem("construprice-last-search-items", JSON.stringify([val]));
                      window.dispatchEvent(new CustomEvent("construprice-header-search", { detail: [val] }));
                      router.push("/results");
                      (e.target as HTMLInputElement).value = "";
                      setMobileOpen(false);
                    }
                  }
                }}
              />
            </div>
          </div>
        </header>

        <main className="flex-1 px-4 py-4">
          {children}
        </main>
      </div>
    </div>
  );
}
