"use client";

import { motion } from "framer-motion";
import { Home, Search, Package, BarChart3, Store, Settings, DoorOpen, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/search", label: "Buscar", icon: Search },
  { href: "/products", label: "Produtos", icon: Package },
  { href: "/suppliers", label: "Fornecedores", icon: Store },
  { href: "/results", label: "Resultados", icon: BarChart3 },
  { href: "/settings", label: "Configurações", icon: Settings }
];

export default function TopbarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

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
      <header className="sticky top-0 z-50 border-b border-neutral-200 bg-white/80 backdrop-blur-xl dark:border-neutral-800 dark:bg-neutral-900/80">
        <div className="mx-auto flex h-16 max-w-[1600px] items-center justify-between px-4 md:px-6">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-lg dark:shadow-purple-500/20">
                <Package className="h-4 w-4 text-white" />
              </div>
              <span className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">ConstruPrice</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                      active
                        ? "text-purple-600 dark:text-purple-400"
                        : "text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="activeTopbarItem"
                        className="absolute inset-0 rounded-lg bg-purple-100 dark:bg-purple-500/10"
                        transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                      />
                    )}
                    <Icon className="relative h-4 w-4" />
                    <span className="relative">{item.label}</span>
                  </Link>
                );
              })}
            </nav>
          </div>

          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3">
              <div className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 dark:border-neutral-800 dark:bg-neutral-950/50 relative">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                ) : (
                <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-xs font-semibold text-white">
                  {user?.displayName?.charAt(0).toUpperCase()}
                </div>
                )}
                <button className="text-sm font-medium text-neutral-900 dark:text-neutral-100" onClick={() => setDropdownOpen(!dropdownOpen)}>{user?.displayName}</button>
                {dropdownOpen && (
                  <div className="absolute right-0 top-full z-10 mt-2 w-48 rounded-md bg-white py-1 shadow-lg ring-1 ring-black/5 dark:bg-neutral-900">
                    <Link href="/settings" onClick={() => setDropdownOpen(false)} className="block px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800">Configurações</Link>
                    <button onClick={handleLogout} className="block w-full text-left px-4 py-2 text-sm text-neutral-700 hover:bg-neutral-100 dark:text-neutral-200 dark:hover:bg-neutral-800">Sair</button>
                  </div>
                )}
              </div>
              <button
                onClick={handleLogout}
                className="flex items-center gap-2 rounded-lg border border-neutral-200 bg-neutral-50 px-3 py-1.5 text-sm font-medium text-neutral-600 transition-colors hover:bg-neutral-100 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <DoorOpen className="h-4 w-4 text-neutral-600 dark:text-neutral-400" />
              </button>
            </div>

            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex h-9 w-9 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-600 dark:border-neutral-800 dark:bg-neutral-950/50 dark:text-neutral-400"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900 md:hidden"
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
              <button
                onClick={handleLogout}
                className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
              >
                <DoorOpen className="h-5 w-5 text-neutral-600 dark:text-neutral-400" />
                Sair
              </button>
            </nav>
          </motion.div>
        )}
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-[1600px] px-4 py-8 md:px-6 md:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
