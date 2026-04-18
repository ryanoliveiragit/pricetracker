"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Store,
  Settings,
  LogOut,
  Bell,
  Menu,
  Sun,
  Moon,
  SearchIcon,
  Command,
  Star,
  Sparkles,
  Bot,
  ChevronLeft,
  ChevronRight,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import CommandMenu from "../components/CommandMenu";
import { RoleGuard } from "../components/auth/RoleGuard";
import UpdateNotifications from "../components/Notifications";
import AppTour from "../components/AppTour";
import { cn } from "@/lib/utils";
import { DarkModeToggle } from "../components/DarkModeToggle";

const navItems = [
  { href: "/agent",     label: "Agente IA",      icon: Bot,      id: "tour-nav-agent",     badge: "IA" },
  { href: "/suppliers", label: "Fornecedores",    icon: Store,    id: "tour-nav-suppliers",  badge: null },
  { href: "/results",   label: "Resultados",      icon: BarChart3,id: "tour-nav-results",    badge: null },
  { href: "/saves",     label: "Ofertas Salvas",  icon: Star,     id: "tour-nav-saves",      badge: null },
];

const bottomItems = [
  { href: "/settings", label: "Configurações", icon: Settings, id: "tour-nav-settings" },
];

const ACC = "rgb(var(--primary-500))";
const ACC6 = "rgb(var(--primary-600))";

export default function SidebarLayout({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();
  const { isDark, toggleMode } = useTheme();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  function isActive(path: string): boolean {
    if (!pathname) return false;
    if (path === "/") return pathname === "/";
    return pathname.startsWith(path);
  }

  const sidebarWidth = collapsed ? 72 : 240;
  const currentPage = navItems.find((i) => isActive(i.href)) ?? bottomItems.find((i) => isActive(i.href));

  /* ── Sidebar content ─────────────────────────────────────── */
  const sidebarContent = (
    <div className="flex h-full flex-col select-none">

      {/* Logo area */}
      <div
        className="flex h-[60px] shrink-0 items-center border-b border-slate-100 dark:border-neutral-800/80"
        style={{ padding: collapsed ? "0 16px" : "0 20px" }}
      >
        {collapsed ? (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-bold shadow-sm"
            style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})` }}
          >
            C
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-xs font-bold shadow-sm flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})` }}
            >
              C
            </div>
            <div>
              <p className="text-[13px] font-bold text-slate-900 dark:text-neutral-100 leading-tight tracking-tight">
                ConstruPrice
              </p>
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 leading-tight">
                v2.4 · beta
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Section label */}
      {!collapsed && (
        <div className="px-5 pt-5 pb-1">
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-400 dark:text-neutral-600">
            Navegação
          </span>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 pt-1 pb-2 space-y-0.5">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              id={item.id}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl transition-all duration-150 text-[13px] font-medium",
                collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2.5",
                active
                  ? "bg-slate-900 dark:bg-neutral-100 text-white dark:text-neutral-900 shadow-sm"
                  : "text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-neutral-100"
              )}
            >
              <Icon className={cn(
                "shrink-0 transition-colors",
                collapsed ? "h-4 w-4" : "h-[17px] w-[17px]",
                active
                  ? "text-white dark:text-neutral-900"
                  : "text-slate-500 dark:text-neutral-500 group-hover:text-slate-700 dark:group-hover:text-neutral-300"
              )} />
              {!collapsed && (
                <span className="flex-1 whitespace-nowrap">{item.label}</span>
              )}
              {!collapsed && item.badge && (
                <span
                  className="shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold tracking-wide"
                  style={active
                    ? { background: "rgba(255,255,255,0.2)", color: "#fff" }
                    : { background: ACC, color: "#fff" }
                  }
                >
                  {item.badge}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="shrink-0 border-t border-slate-100 dark:border-neutral-800/80 px-3 py-3 space-y-0.5">
        {bottomItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              id={item.id}
              title={collapsed ? item.label : undefined}
              className={cn(
                "group flex items-center gap-3 rounded-xl transition-all duration-150 text-[13px] font-medium",
                collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2.5",
                active
                  ? "bg-slate-900 dark:bg-neutral-100 text-white dark:text-neutral-900"
                  : "text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 hover:text-slate-900 dark:hover:text-neutral-100"
              )}
            >
              <Icon className={cn(
                "shrink-0 h-[17px] w-[17px]",
                active
                  ? "text-white dark:text-neutral-900"
                  : "text-slate-500 dark:text-neutral-500"
              )} />
              {!collapsed && <span className="whitespace-nowrap">{item.label}</span>}
            </Link>
          );
        })}

        <button
          onClick={handleLogout}
          title={collapsed ? "Sair" : undefined}
          className={cn(
            "group flex w-full items-center gap-3 rounded-xl transition-all duration-150 text-[13px] font-medium",
            collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2.5",
            "text-slate-500 dark:text-neutral-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          )}
        >
          <LogOut className="shrink-0 h-[17px] w-[17px]" />
          {!collapsed && <span>Sair</span>}
        </button>

        {/* User info at bottom */}
        {!collapsed && (
          <div className="mt-2 pt-2 border-t border-slate-100 dark:border-neutral-800/80 flex items-center gap-2.5 px-1 py-1">
            <div
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white"
              style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})` }}
            >
              {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[12px] font-semibold text-slate-800 dark:text-neutral-200 truncate leading-tight">
                {user?.displayName ?? "Usuário"}
              </p>
              <p className="text-[10px] text-slate-400 dark:text-neutral-500 truncate leading-tight">
                {user?.email ?? ""}
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 dark:bg-neutral-950">

      {/* ── Desktop Sidebar ───────────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 bottom-0 z-40 hidden md:flex flex-col bg-white dark:bg-neutral-950 border-r border-slate-100 dark:border-neutral-800/80 overflow-hidden"
        style={{ boxShadow: "1px 0 0 0 rgba(0,0,0,0.04)" }}
      >
        <div className="flex-1 overflow-hidden" style={{ width: sidebarWidth }}>
          {sidebarContent}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="absolute -right-3 top-[68px] flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-400 dark:text-neutral-500 shadow-md transition-all hover:text-slate-700 dark:hover:text-neutral-300 hover:scale-110 z-10"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </motion.aside>

      {/* ── Mobile overlay ────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -260 }}
              animate={{ x: 0 }}
              exit={{ x: -260 }}
              transition={{ type: "spring", damping: 28, stiffness: 240 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-[240px] bg-white dark:bg-neutral-950 shadow-2xl md:hidden"
            >
              {sidebarContent}
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Desktop: main area ────────────────────────────────── */}
      <motion.div
        initial={false}
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 hidden md:flex md:flex-col h-dvh overflow-hidden min-w-0"
      >
        {/* Header */}
        <header className="sticky top-0 z-30 h-[60px] shrink-0 border-b border-slate-100 dark:border-neutral-800/80 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl">
          <div className="flex h-full items-center justify-between px-5 gap-4">

            {/* Left: breadcrumb */}
            <div className="flex items-center gap-2 min-w-0">
              <div className="h-4 w-px bg-slate-200 dark:bg-neutral-700" />
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-slate-900 dark:text-neutral-100 leading-tight truncate">
                  {currentPage?.label ?? "ConstruPrice"}
                </p>
              </div>
            </div>

            {/* Center: search */}
            <button
              id="tour-search-bar"
              onClick={() => window.dispatchEvent(new CustomEvent("open-command-menu"))}
              className="hidden lg:flex items-center gap-2.5 rounded-xl border border-slate-200 dark:border-neutral-700/80 bg-slate-50 dark:bg-neutral-900 px-3.5 py-2 w-64 xl:w-80 transition-all group hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-white dark:hover:bg-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
            >
              <SearchIcon className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 shrink-0 group-hover:text-slate-500 dark:group-hover:text-neutral-400 transition-colors" />
              <span className="flex-1 text-[13px] text-slate-400 dark:text-neutral-500 group-hover:text-slate-500 dark:group-hover:text-neutral-400 transition-colors text-left">
                Buscar variantes...
              </span>
              <div className="hidden xl:flex items-center gap-0.5 shrink-0">
                <kbd className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:text-neutral-400 shadow-[0_1px_1px_rgba(0,0,0,0.06)]">
                  <Command className="h-2.5 w-2.5" /> K
                </kbd>
              </div>
            </button>

            {/* Right: actions */}
            <div className="flex items-center gap-1.5 shrink-0">

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
                    showNotifications
                      ? "border-[rgb(var(--primary-500))] text-[rgb(var(--primary-500))]"
                      : "border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600 hover:text-slate-700 dark:hover:text-neutral-200"
                  )}
                >
                  <Bell className="h-[15px] w-[15px]" />
                  <span
                    className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ring-[1.5px] ring-white dark:ring-neutral-900"
                    style={{ background: ACC }}
                  />
                </button>
                <UpdateNotifications
                  open={showNotifications}
                  onClose={() => setShowNotifications(false)}
                />
              </div>

              {/* Theme toggle */}
              <DarkModeToggle />

              {/* Tour / help */}
              <button
                id="tour-help-button"
                onClick={() => window.dispatchEvent(new CustomEvent("start-app-tour"))}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 transition-all hover:text-white shadow-[0_1px_2px_rgba(0,0,0,0.04)]"
                onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = ACC; (e.currentTarget as HTMLButtonElement).style.borderColor = ACC6; }}
                onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = ""; (e.currentTarget as HTMLButtonElement).style.borderColor = ""; }}
                title="Iniciar Tour"
              >
                <Sparkles className="h-[15px] w-[15px]" />
              </button>

              {/* Divider */}
              <div className="h-6 w-px bg-slate-200 dark:bg-neutral-700 mx-0.5" />

              {/* User avatar */}
              <div className="flex items-center gap-2.5 rounded-xl px-2 py-1.5 transition-colors hover:bg-slate-100 dark:hover:bg-neutral-800 cursor-default">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})` }}
                >
                  {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <div className="hidden xl:block">
                  <p className="text-[12px] font-semibold text-slate-800 dark:text-neutral-200 leading-tight">
                    {user?.displayName ?? "Usuário"}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-neutral-500 leading-tight">
                    {user?.email ?? ""}
                  </p>
                </div>
              </div>
            </div>
          </div>
        </header>

        <main className="relative flex-1 w-full min-w-0 overflow-y-auto min-h-0">
          <CommandMenu />
          {children}
        </main>
        <AppTour />
      </motion.div>

      {/* ── Mobile layout ─────────────────────────────────────── */}
      <div className="flex-1 flex flex-col md:hidden h-dvh overflow-hidden">
        <header className="sticky top-0 z-30 border-b border-slate-100 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl shrink-0">
          <div className="flex h-14 items-center justify-between px-4 gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 flex-1 justify-center">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-lg text-white text-[10px] font-bold"
                style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})` }}
              >
                C
              </div>
              <span className="text-[13px] font-bold text-slate-900 dark:text-neutral-100 tracking-tight">
                ConstruPrice
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMode}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 text-slate-500 dark:text-neutral-400"
              >
                {isDark
                  ? <Sun className="h-3.5 w-3.5 text-amber-400" />
                  : <Moon className="h-3.5 w-3.5" />
                }
              </button>
              <div
                className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
                style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})` }}
              >
                {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
              </div>
            </div>
          </div>

          {/* Mobile search */}
          <div className="px-4 pb-3">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-command-menu"))}
              className="flex w-full items-center gap-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900 px-3 py-2 transition-colors active:bg-slate-100"
            >
              <SearchIcon className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 shrink-0" />
              <span className="flex-1 text-left text-[13px] text-slate-400 dark:text-neutral-500">
                Buscar produto ou variante...
              </span>
            </button>
          </div>
        </header>

        <main className="relative flex-1 overflow-y-auto min-h-0 min-w-0">
          <CommandMenu />
          {children}
        </main>
      </div>
    </div>
  );
}
