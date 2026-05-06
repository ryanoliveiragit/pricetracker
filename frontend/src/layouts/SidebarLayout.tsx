"use client";

import { motion, AnimatePresence } from "framer-motion";
import {
  BarChart3,
  Store,
  Settings,
  LogOut,
  Bell,
  Menu,
  SearchIcon,
  Command,
  Star,
  Sparkles,
  Bot,
  ChevronLeft,
  ChevronRight,
  Sun,
  Moon,
  Home,
  LucideIcon,
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

/* ── Nav config ─────────────────────────────────────────── */
interface NavItem {
  href: string;
  label: string;
  description: string;
  icon: LucideIcon;
  id: string;
  badge?: string;
}

const navItems: NavItem[] = [
  { href: "/agent",     label: "Agente IA",     description: "Busca inteligente",  icon: Bot,      id: "tour-nav-agent",     badge: "IA" },
  { href: "/suppliers", label: "Fornecedores",   description: "Gerir lojas",         icon: Store,    id: "tour-nav-suppliers" },
  { href: "/results",   label: "Resultados",     description: "Cotações recentes",   icon: BarChart3,id: "tour-nav-results" },
  { href: "/saves",     label: "Ofertas Salvas", description: "Itens guardados",     icon: Star,     id: "tour-nav-saves" },
];

const bottomItems: NavItem[] = [
  { href: "/settings", label: "Configurações", description: "Preferências",  icon: Settings, id: "tour-nav-settings" },
];

const ACC  = "rgb(var(--primary-500))";
const ACC6 = "rgb(var(--primary-600))";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  usuario: "Usuário",
  funcionario: "Funcionário",
};

/* ── Tooltip for collapsed items ──────────────────────────── */
function NavTooltip({ label }: { label: string }) {
  return (
    <div className="
      pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2
      whitespace-nowrap rounded-lg border border-slate-200 dark:border-neutral-700
      bg-white dark:bg-neutral-900 px-2.5 py-1.5 text-[12px] font-medium
      text-slate-700 dark:text-neutral-200 shadow-lg opacity-0
      group-hover:opacity-100 transition-opacity duration-150
    ">
      {label}
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */
export default function SidebarLayout({ children }: { children: ReactNode }) {
  const pathname  = usePathname();
  const router    = useRouter();
  const { user, logout }         = useAuth();
  const { isDark, toggleMode }   = useTheme();
  const [collapsed, setCollapsed]               = useState(false);
  const [mobileOpen, setMobileOpen]             = useState(false);
  const [showNotifications, setShowNotifications] = useState(false);

  function handleLogout() { logout(); router.push("/login"); }

  function isActive(path: string) {
    if (!pathname) return false;
    return path === "/" ? pathname === "/" : pathname.startsWith(path);
  }

  const sidebarWidth  = collapsed ? 68 : 240;
  const currentPage   = [...navItems, ...bottomItems].find(i => isActive(i.href));
  const CurrentIcon   = currentPage?.icon ?? Home;
  const userRole      = (user as any)?.role as string | undefined;

  /* ── Sidebar content ──────────────────────────────────── */
  const sidebarContent = (
    <div className="flex h-full flex-col select-none">

      {/* Logo */}
      <div
        className="flex h-[60px] shrink-0 items-center border-b border-slate-100/80 dark:border-neutral-800/60"
        style={{ padding: collapsed ? "0 14px" : "0 18px" }}
      >
        {collapsed ? (
          <div
            className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-bold shadow-md"
            style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})`, boxShadow: `0 4px 14px -2px color-mix(in srgb, ${ACC} 40%, transparent)` }}
          >
            C
          </div>
        ) : (
          <div className="flex items-center gap-3 min-w-0">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-xl text-white text-sm font-bold shadow-md shrink-0"
              style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})`, boxShadow: `0 4px 14px -2px color-mix(in srgb, ${ACC} 40%, transparent)` }}
            >
              C
            </div>
            <div className="min-w-0">
              <p className="text-[14px] font-bold text-slate-900 dark:text-neutral-50 leading-tight tracking-tight">
                ConstruPrice
              </p>
              <div className="flex items-center gap-1.5 mt-0.5">
                <span className="inline-flex items-center rounded-full px-1.5 py-px text-[9px] font-semibold tracking-wide border"
                  style={{ background: `color-mix(in srgb, ${ACC} 10%, transparent)`, borderColor: `color-mix(in srgb, ${ACC} 30%, transparent)`, color: ACC }}
                >
                  v2.4
                </span>
                <span className="text-[10px] text-slate-400 dark:text-neutral-500">beta</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Section label */}
      {!collapsed && (
        <div className="px-4 pt-5 pb-1.5">
          <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-neutral-600">
            Menu principal
          </span>
        </div>
      )}

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-2.5 pt-1 pb-2 space-y-0.5">
        {navItems.map(item => {
          const Icon   = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              id={item.id}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl transition-all duration-150",
                collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2.5",
                active
                  ? "shadow-sm"
                  : "hover:bg-slate-100/80 dark:hover:bg-neutral-800/60"
              )}
              style={active ? {
                background: `linear-gradient(135deg, color-mix(in srgb, ${ACC} 12%, transparent), color-mix(in srgb, ${ACC} 6%, transparent))`,
                borderLeft: collapsed ? undefined : `2px solid ${ACC}`,
                paddingLeft: collapsed ? undefined : "10px",
              } : {}}
            >
              {/* Active left accent for non-collapsed */}
              {active && !collapsed && (
                <div
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-0.5 h-5 rounded-full"
                  style={{ background: ACC, marginLeft: -1 }}
                />
              )}

              <div className={cn(
                "flex shrink-0 items-center justify-center rounded-lg transition-all",
                collapsed ? "h-9 w-9" : "h-7 w-7",
                active ? "shadow-sm" : ""
              )}
                style={active ? {
                  background: `color-mix(in srgb, ${ACC} 15%, transparent)`,
                } : {}}
              >
                <Icon className={cn(
                  "transition-colors",
                  collapsed ? "h-[17px] w-[17px]" : "h-4 w-4",
                  active
                    ? "text-[rgb(var(--primary-500))]"
                    : "text-slate-500 dark:text-neutral-500 group-hover:text-slate-700 dark:group-hover:text-neutral-300"
                )} />
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p className={cn(
                    "text-[13px] font-medium leading-tight truncate",
                    active
                      ? "text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-400))]"
                      : "text-slate-700 dark:text-neutral-300"
                  )}>
                    {item.label}
                  </p>
                  <p className="text-[10px] text-slate-400 dark:text-neutral-600 leading-tight mt-px truncate">
                    {item.description}
                  </p>
                </div>
              )}

              {!collapsed && item.badge && (
                <span
                  className="shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold tracking-wide text-white"
                  style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})` }}
                >
                  {item.badge}
                </span>
              )}

              {collapsed && <NavTooltip label={item.label} />}
            </Link>
          );
        })}
      </nav>

      {/* Bottom section */}
      <div className="shrink-0 border-t border-slate-100/80 dark:border-neutral-800/60 px-2.5 py-2.5 space-y-0.5">
        {!collapsed && (
          <div className="px-1.5 pb-1.5">
            <span className="text-[9px] font-bold uppercase tracking-[0.16em] text-slate-400 dark:text-neutral-600">
              Sistema
            </span>
          </div>
        )}

        {bottomItems.map(item => {
          const Icon   = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              id={item.id}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl transition-all duration-150",
                collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2",
                active
                  ? ""
                  : "hover:bg-slate-100/80 dark:hover:bg-neutral-800/60"
              )}
              style={active ? {
                background: `linear-gradient(135deg, color-mix(in srgb, ${ACC} 12%, transparent), color-mix(in srgb, ${ACC} 6%, transparent))`,
              } : {}}
            >
              <Icon className={cn(
                "shrink-0 h-[16px] w-[16px] transition-colors",
                active
                  ? "text-[rgb(var(--primary-500))]"
                  : "text-slate-500 dark:text-neutral-500 group-hover:text-slate-700 dark:group-hover:text-neutral-300"
              )} />
              {!collapsed && (
                <span className={cn(
                  "text-[13px] font-medium",
                  active
                    ? "text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-400))]"
                    : "text-slate-600 dark:text-neutral-400"
                )}>
                  {item.label}
                </span>
              )}
              {collapsed && <NavTooltip label={item.label} />}
            </Link>
          );
        })}

        <button
          onClick={handleLogout}
          className={cn(
            "group relative flex w-full items-center gap-3 rounded-xl transition-all duration-150 text-[13px] font-medium",
            collapsed ? "justify-center h-10 w-10 mx-auto" : "px-3 py-2",
            "text-slate-500 dark:text-neutral-500 hover:bg-red-50 dark:hover:bg-red-500/10 hover:text-red-600 dark:hover:text-red-400"
          )}
        >
          <LogOut className="shrink-0 h-[16px] w-[16px]" />
          {!collapsed && <span>Sair</span>}
          {collapsed && <NavTooltip label="Sair" />}
        </button>

        {/* User card */}
        {!collapsed && (
          <div className="mt-2 pt-2.5 border-t border-slate-100/80 dark:border-neutral-800/60">
            <div className="flex items-center gap-2.5 px-2 py-1.5 rounded-xl hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition-colors cursor-default">
              <div className="relative shrink-0">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white ring-2"
                  style={{
                    background: `linear-gradient(135deg, ${ACC}, ${ACC6})`,
                    ["--tw-ring-color" as string]: `color-mix(in srgb, ${ACC} 25%, transparent)`,
                  }}
                >
                  {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <div className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-neutral-950" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-800 dark:text-neutral-200 truncate leading-tight">
                  {user?.displayName ?? "Usuário"}
                </p>
                <span className="inline-flex items-center rounded-full px-1.5 py-px mt-0.5 text-[9px] font-semibold border"
                  style={{
                    background: `color-mix(in srgb, ${ACC} 8%, transparent)`,
                    borderColor: `color-mix(in srgb, ${ACC} 25%, transparent)`,
                    color: ACC,
                  }}
                >
                  {ROLE_LABEL[userRole ?? "funcionario"] ?? "Funcionário"}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-50 dark:bg-neutral-950">

      {/* ── Desktop Sidebar ─────────────────────────────── */}
      <motion.aside
        initial={false}
        animate={{ width: sidebarWidth }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="fixed left-0 top-0 bottom-0 z-[45] hidden md:flex flex-col bg-white dark:bg-neutral-950 border-r border-slate-100/80 dark:border-neutral-800/60 overflow-hidden"
        style={{ boxShadow: "1px 0 0 0 rgba(0,0,0,0.03), 4px 0 20px -8px rgba(0,0,0,0.06)" }}
      >
        <div className="flex-1 overflow-hidden" style={{ width: sidebarWidth }}>
          {sidebarContent}
        </div>

        {/* Collapse toggle */}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="absolute -right-3 top-[68px] flex h-6 w-6 items-center justify-center rounded-full bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-700 text-slate-400 dark:text-neutral-500 shadow-md transition-all hover:text-slate-700 dark:hover:text-neutral-200 hover:scale-110 hover:shadow-lg z-[50]"
        >
          {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
        </button>
      </motion.aside>

      {/* ── Mobile overlay ──────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm md:hidden"
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

      {/* ── Desktop: main area ──────────────────────────── */}
      <motion.div
        initial={false}
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 hidden md:flex md:flex-col h-dvh overflow-hidden min-w-0"
      >
        {/* Header */}
        <header className="sticky top-0 z-30 h-[60px] shrink-0 border-b border-slate-100/80 dark:border-neutral-800/60 bg-white/90 dark:bg-neutral-950/90 backdrop-blur-xl"
          style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.03), 0 2px 8px -4px rgba(0,0,0,0.05)" }}
        >
          <div className="flex h-full items-center justify-between px-6 gap-4">

            {/* Left: page breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: `color-mix(in srgb, ${ACC} 10%, transparent)` }}
              >
                <CurrentIcon className="h-[15px] w-[15px]" style={{ color: ACC }} />
              </div>
              <div className="min-w-0">
                <p className="text-[14px] font-semibold text-slate-900 dark:text-neutral-100 leading-tight truncate">
                  {currentPage?.label ?? "ConstruPrice"}
                </p>
                <p className="text-[10px] text-slate-400 dark:text-neutral-500 leading-none mt-px hidden sm:block">
                  {currentPage?.description ?? "Plataforma de cotação"}
                </p>
              </div>
            </div>

            {/* Center: search */}
            <button
              id="tour-search-bar"
              onClick={() => window.dispatchEvent(new CustomEvent("open-command-menu"))}
              className="hidden lg:flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-neutral-700/60 bg-slate-50/80 dark:bg-neutral-900/80 px-3.5 py-2 w-64 xl:w-80 transition-all group hover:border-slate-300 dark:hover:border-neutral-600 hover:bg-white dark:hover:bg-neutral-800/80 hover:shadow-sm"
            >
              <SearchIcon className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 shrink-0 group-hover:text-slate-500 dark:group-hover:text-neutral-400 transition-colors" />
              <span className="flex-1 text-[13px] text-slate-400 dark:text-neutral-500 group-hover:text-slate-500 dark:group-hover:text-neutral-400 transition-colors text-left">
                Buscar produto ou variante…
              </span>
              <kbd className="hidden xl:inline-flex items-center gap-1 rounded-md border border-slate-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-1.5 py-0.5 text-[10px] font-medium text-slate-400 dark:text-neutral-500 shadow-sm shrink-0">
                <Command className="h-2.5 w-2.5" /> K
              </kbd>
            </button>

            {/* Right: actions */}
            <div className="flex items-center gap-1 shrink-0">

              {/* Notifications */}
              <div className="relative">
                <button
                  onClick={() => setShowNotifications(s => !s)}
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
                    showNotifications
                      ? "border-[rgb(var(--primary-500))] bg-[color-mix(in_srgb,rgb(var(--primary-500))_10%,transparent)] text-[rgb(var(--primary-500))]"
                      : "border-slate-200/80 dark:border-neutral-700/60 bg-white/80 dark:bg-neutral-900/80 text-slate-500 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600 hover:text-slate-700 dark:hover:text-neutral-200 hover:shadow-sm"
                  )}
                >
                  <Bell className="h-[14px] w-[14px]" />
                  <span
                    className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full ring-[1.5px] ring-white dark:ring-neutral-950"
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
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 dark:border-neutral-700/60 bg-white/80 dark:bg-neutral-900/80 text-slate-500 dark:text-neutral-400 transition-all hover:text-white hover:shadow-sm"
                onMouseEnter={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = ACC; el.style.borderColor = ACC6; }}
                onMouseLeave={e => { const el = e.currentTarget as HTMLButtonElement; el.style.background = ""; el.style.borderColor = ""; }}
                title="Iniciar Tour"
              >
                <Sparkles className="h-[14px] w-[14px]" />
              </button>

              {/* Divider */}
              <div className="h-5 w-px bg-slate-200 dark:bg-neutral-700/60 mx-1" />

              {/* User card */}
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-neutral-700/60 bg-white/80 dark:bg-neutral-900/80 px-2.5 py-1.5 cursor-default hover:border-slate-300 dark:hover:border-neutral-600 hover:shadow-sm transition-all">
                <div className="relative shrink-0">
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})` }}
                  >
                    {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
                  </div>
                  <div className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-white dark:ring-neutral-900" />
                </div>
                <div className="hidden xl:block">
                  <p className="text-[12px] font-semibold text-slate-800 dark:text-neutral-200 leading-tight">
                    {user?.displayName ?? "Usuário"}
                  </p>
                  <p className="text-[10px] leading-tight" style={{ color: ACC }}>
                    {ROLE_LABEL[userRole ?? "funcionario"] ?? "Funcionário"}
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

      {/* ── Mobile layout ───────────────────────────────── */}
      <div className="flex-1 flex flex-col md:hidden h-dvh overflow-hidden">
        <header className="sticky top-0 z-30 border-b border-slate-100 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl shrink-0"
          style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.04)" }}
        >
          <div className="flex h-14 items-center justify-between px-4 gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300 shadow-sm"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 flex-1 justify-center">
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-[11px] font-bold shadow-sm"
                style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})` }}
              >
                C
              </div>
              <span className="text-[14px] font-bold text-slate-900 dark:text-neutral-100 tracking-tight">
                ConstruPrice
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMode}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 shadow-sm"
              >
                {isDark
                  ? <Sun className="h-3.5 w-3.5 text-amber-400" />
                  : <Moon className="h-3.5 w-3.5" />}
              </button>
              <div className="relative">
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
                  style={{ background: `linear-gradient(135deg, ${ACC}, ${ACC6})` }}
                >
                  {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
                </div>
                <div className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-white dark:ring-neutral-900" />
              </div>
            </div>
          </div>

          <div className="px-4 pb-3">
            <button
              onClick={() => window.dispatchEvent(new CustomEvent("open-command-menu"))}
              className="flex w-full items-center gap-2 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-900 px-3 py-2 transition-colors active:bg-slate-100 shadow-sm"
            >
              <SearchIcon className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 shrink-0" />
              <span className="flex-1 text-left text-[13px] text-slate-400 dark:text-neutral-500">
                Buscar produto ou variante…
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
