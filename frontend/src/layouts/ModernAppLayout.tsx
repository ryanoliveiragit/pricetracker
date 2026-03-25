"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Home, Search, Package, BarChart3, LogOut, Menu, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";

const navItems = [
  { href: "/", label: "Dashboard", icon: Home },
  { href: "/search", label: "Buscar", icon: Search },
  { href: "/products", label: "Catálogo", icon: Package },
  { href: "/results", label: "Resultados", icon: BarChart3 }
];

export default function ModernAppLayout({ children }: { children: ReactNode }) {
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
    <div className="min-h-screen bg-neutral-950">
      {/* Top Navigation Bar */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-neutral-800/50 bg-neutral-950/80 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center justify-between px-4 md:px-6">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2 group">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-purple-500 to-purple-600 shadow-glow-sm transition-shadow group-hover:shadow-glow">
              <Package className="h-4 w-4 text-white" />
            </div>
            <span className="text-lg font-semibold text-neutral-100">ConstruPrice</span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`
                    relative flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium transition-colors
                    ${active 
                      ? "text-neutral-100" 
                      : "text-neutral-400 hover:text-neutral-200"
                    }
                  `}
                >
                  {active && (
                    <motion.div
                      layoutId="activeTab"
                      className="absolute inset-0 rounded-lg bg-neutral-800/50"
                      transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                    />
                  )}
                  <Icon className="relative h-4 w-4" />
                  <span className="relative">{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* User Menu */}
          <div className="flex items-center gap-3">
            <div className="hidden md:flex items-center gap-3 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-1.5">
              <div className="h-6 w-6 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-xs font-semibold text-white">
                {user?.displayName?.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-neutral-300">{user?.displayName}</span>
            </div>
            
            <button
              onClick={handleLogout}
              className="hidden md:flex items-center gap-2 rounded-lg border border-neutral-800 bg-neutral-900/50 px-3 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
            >
              <LogOut className="h-4 w-4" />
              Sair
            </button>

            {/* Mobile Menu Button */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="md:hidden flex items-center justify-center h-9 w-9 rounded-lg border border-neutral-800 bg-neutral-900/50 text-neutral-300 hover:bg-neutral-800 hover:text-neutral-100"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile Menu */}
      <AnimatePresence>
        {mobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
            className="fixed top-16 left-0 right-0 z-40 md:hidden border-b border-neutral-800 bg-neutral-950/95 backdrop-blur-xl"
          >
            <nav className="flex flex-col p-4 gap-1">
              {navItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileMenuOpen(false)}
                    className={`
                      flex items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium transition-colors
                      ${active 
                        ? "bg-neutral-800/50 text-neutral-100" 
                        : "text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-200"
                      }
                    `}
                  >
                    <Icon className="h-5 w-5" />
                    {item.label}
                  </Link>
                );
              })}
              
              <div className="mt-4 pt-4 border-t border-neutral-800">
                <div className="flex items-center gap-3 px-4 py-2 mb-2">
                  <div className="h-8 w-8 rounded-full bg-gradient-to-br from-purple-500 to-purple-600 flex items-center justify-center text-sm font-semibold text-white">
                    {user?.displayName?.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm text-neutral-300">{user?.displayName}</span>
                </div>
                
                <button
                  onClick={handleLogout}
                  className="flex w-full items-center gap-3 rounded-lg px-4 py-3 text-sm font-medium text-neutral-400 hover:bg-neutral-900/50 hover:text-neutral-200"
                >
                  <LogOut className="h-5 w-5" />
                  Sair
                </button>
              </div>
            </nav>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main Content */}
      <main className="pt-16">
        <div className="mx-auto max-w-[1400px] px-4 py-8 md:px-6 md:py-12">
          {children}
        </div>
      </main>
    </div>
  );
}
