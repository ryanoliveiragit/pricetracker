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
  Database,
  Gem,
  LucideIcon,
  Zap,
  Activity,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useAuth } from "../context/AuthContext";
import { useTheme } from "../context/ThemeContext";
import CommandMenu from "../components/CommandMenu";
import UpdateNotifications from "../components/Notifications";
import AppTour from "../components/AppTour";
import FeedbackButton from "../components/FeedbackButton";
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
  {
    href: "/agent",
    label: "Agente IA",
    description: "Busca inteligente",
    icon: Bot,
    id: "tour-nav-agent",
    badge: "IA",
  },
  {
    href: "/suppliers",
    label: "Fornecedores",
    description: "Gerir lojas",
    icon: Store,
    id: "tour-nav-suppliers",
  },
  {
    href: "/results",
    label: "Resultados",
    description: "Cotações recentes",
    icon: BarChart3,
    id: "tour-nav-results",
  },
  {
    href: "/saves",
    label: "Ofertas Salvas",
    description: "Itens guardados",
    icon: Star,
    id: "tour-nav-saves",
  },
  {
    href: "/catalog",
    label: "Catálogo",
    description: "Produtos locais",
    icon: Database,
    id: "tour-nav-catalog",
    badge: "PLUS",
  },
];

const bottomItems: NavItem[] = [
  {
    href: "/settings",
    label: "Configurações",
    description: "Preferências",
    icon: Settings,
    id: "tour-nav-settings",
  },
];

const ACC = "rgb(var(--primary-500))";
const ACC6 = "rgb(var(--primary-600))";

const ROLE_LABEL: Record<string, string> = {
  admin: "Administrador",
  gestor: "Gestor",
  usuario: "Usuário",
  funcionario: "Funcionário",
};

/* ── Logo icon ─────────────────────────────────────────────── */
function LogoIcon({ size = 32 }: { size?: number }) {
  return (
    <div
      className="shrink-0 flex items-center justify-center rounded-lg"
      style={{ width: size, height: size, background: "#fa5d19" }}
    >
      <svg width={size * 0.5} height={size * 0.5} viewBox="0 0 16 16" fill="none">
        <circle cx="6.5" cy="6.5" r="4.5" stroke="white" strokeWidth="1.9" strokeLinecap="round" />
        <line x1="10.2" y1="10.2" x2="13.8" y2="13.8" stroke="white" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    </div>
  );
}

/* ── Tooltip for collapsed items ──────────────────────────── */
function NavTooltip({ label }: { label: string }) {
  return (
    <div className="pointer-events-none absolute left-full top-1/2 z-50 ml-3 -translate-y-1/2 whitespace-nowrap rounded-lg border border-slate-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 px-3 py-1.5 text-[12px] font-medium text-slate-700 dark:text-neutral-200 shadow-xl shadow-black/5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
      {label}
    </div>
  );
}

/* ── Nav badge ─────────────────────────────────────────────── */
function NavBadge({ badge }: { badge: string }) {
  if (badge === "PLUS") {
    return (
      <span
        className="shrink-0 inline-flex items-center gap-[3px] rounded-md border border-emerald-200 bg-emerald-50 px-[7px] py-[3px] text-[9px] font-semibold leading-none text-emerald-700 dark:border-emerald-800/50 dark:bg-emerald-950/40 dark:text-emerald-400"
        style={{ letterSpacing: "0.04em" }}
      >
        <Gem className="h-[7px] w-[7px] opacity-80" />
        Plus
      </span>
    );
  }
  if (badge === "IA") {
    return (
      <span
        className="shrink-0 inline-flex items-center gap-[3px] rounded-md px-[7px] py-[3px] text-[9px] font-bold leading-none"
        style={{
          background: "linear-gradient(135deg, #fa5d19 0%, #d44c14 100%)",
          color: "#fff",
          letterSpacing: "0.06em",
          boxShadow: "0 1px 6px rgba(250,93,25,0.35)",
        }}
      >
        <Zap className="h-[7px] w-[7px]" />
        IA
      </span>
    );
  }
  return (
    <span
      className="shrink-0 inline-flex items-center rounded-md px-[7px] py-[3px] text-[9px] font-bold leading-none"
      style={{
        background: `linear-gradient(135deg, ${ACC} 0%, ${ACC6} 100%)`,
        color: "#fff",
        letterSpacing: "0.06em",
      }}
    >
      {badge}
    </span>
  );
}

/* ── System status widget ─────────────────────────────────── */
function SystemStatus({ collapsed }: { collapsed: boolean }) {
  if (collapsed) {
    return (
      <div className="flex justify-center py-1.5">
        <div className="relative flex h-[7px] w-[7px]">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
          <span className="relative inline-flex h-[7px] w-[7px] rounded-full bg-emerald-500" />
        </div>
      </div>
    );
  }
  return (
    <div className="mx-2 mb-1 border-t border-slate-100 dark:border-neutral-800/50 pt-2 pb-1 px-2">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[9.5px] font-semibold uppercase tracking-[0.12em] text-slate-400 dark:text-neutral-600">
          Status
        </span>
      </div>
      {/* Online row */}
      <div className="flex items-center justify-between py-[3px]">
        <div className="flex items-center gap-1.5">
          <div className="relative flex h-[6px] w-[6px]">
            <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping" />
            <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-emerald-500" />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-neutral-400">Plataforma</span>
        </div>
        <span className="text-[10px] text-emerald-600 dark:text-emerald-500">online</span>
      </div>
      {/* Scrapers row */}
      <div className="flex items-center justify-between py-[3px]">
        <div className="flex items-center gap-1.5">
          <div className="relative flex h-[6px] w-[6px]">
            <span className="absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-50 animate-ping" style={{ animationDelay: "0.7s" }} />
            <span className="relative inline-flex h-[6px] w-[6px] rounded-full bg-orange-500" />
          </div>
          <span className="text-[11px] text-slate-500 dark:text-neutral-400">Scrapers</span>
        </div>
        <span className="text-[10px] text-orange-500 dark:text-orange-400">2 / 4 ativos</span>
      </div>
    </div>
  );
}

/* ── Main component ─────────────────────────────────────── */
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

  function isActive(path: string) {
    if (!pathname) return false;
    return path === "/" ? pathname === "/" : pathname.startsWith(path);
  }

  const sidebarWidth = collapsed ? 68 : 240;
  const currentPage = [...navItems, ...bottomItems].find((i) => isActive(i.href));
  const CurrentIcon = currentPage?.icon ?? Home;
  const userRole = (user as any)?.role as string | undefined;

  /* ── Sidebar content ──────────────────────────────────── */
  const sidebarContent = (
    <div className="flex h-full flex-col select-none">

      {/* ── Logo ──────────────────────────────────────────── */}
      <div
        className="flex h-[60px] shrink-0 items-center border-b border-slate-100/80 dark:border-neutral-800/50"
        style={{ padding: collapsed ? "0 18px" : "0 16px" }}
      >
        {collapsed ? (
          <LogoIcon size={32} />
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <LogoIcon size={34} />
            <div className="min-w-0">
              <p className="text-[14px] font-black text-slate-900 dark:text-neutral-50 leading-tight tracking-tight">
                ConstruPrice
              </p>
              <div className="flex items-center gap-1.5 mt-[3px]">
                <span
                  className="inline-flex items-center rounded-md px-1.5 py-px text-[9px] font-bold"
                  style={{
                    background: "rgba(250,93,25,0.12)",
                    color: "#fa5d19",
                    letterSpacing: "0.04em",
                  }}
                >
                  v2.4
                </span>
                <span className="text-[9px] text-slate-400 dark:text-neutral-600 font-medium">
                  beta
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Nav section ───────────────────────────────────── */}
      {!collapsed && (
        <div className="px-3.5 pt-5 pb-1">
          <span className="text-[9.5px] font-bold uppercase tracking-[0.16em] text-slate-400/80 dark:text-neutral-600">
            Navegação
          </span>
        </div>
      )}

      {/* ── Main nav ──────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-2 pt-1 pb-2 space-y-px">
        {navItems.map((item) => {
          const Icon = item.icon;
          const active = isActive(item.href);

          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={() => setMobileOpen(false)}
              id={item.id}
              className={cn(
                "group relative flex items-center gap-3 rounded-xl transition-all duration-150",
                collapsed ? "justify-center h-10 w-10 mx-auto" : "px-2.5 py-[9px]",
                active ? "" : "hover:bg-slate-50 dark:hover:bg-neutral-800/50",
              )}
              style={
                active
                  ? { background: "rgba(250,93,25,0.08)", boxShadow: "inset 0 0 0 1px rgba(250,93,25,0.12)" }
                  : {}
              }
            >
              {/* Active left pill */}
              {active && !collapsed && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[20px] rounded-full"
                  style={{ background: "#fa5d19" }}
                />
              )}

              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-lg transition-all duration-150",
                  collapsed ? "h-9 w-9" : "h-7 w-7",
                )}
                style={
                  active
                    ? { background: "rgba(250,93,25,0.14)" }
                    : {}
                }
              >
                <Icon
                  className={cn(
                    "transition-colors duration-150",
                    collapsed ? "h-[16px] w-[16px]" : "h-[15px] w-[15px]",
                    active
                      ? "text-orange-500"
                      : "text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300",
                  )}
                />
              </div>

              {!collapsed && (
                <div className="flex-1 min-w-0">
                  <p
                    className={cn(
                      "text-[13px] leading-tight truncate",
                      active
                        ? "font-semibold text-orange-600 dark:text-orange-400"
                        : "font-medium text-slate-700 dark:text-neutral-300 group-hover:text-slate-900 dark:group-hover:text-neutral-100",
                    )}
                  >
                    {item.label}
                  </p>
                  {!active && (
                    <p className="text-[10px] text-slate-400 dark:text-neutral-600 leading-tight mt-px truncate">
                      {item.description}
                    </p>
                  )}
                </div>
              )}

              {!collapsed && item.badge && <NavBadge badge={item.badge} />}
              {collapsed && <NavTooltip label={item.label} />}
            </Link>
          );
        })}
      </nav>

      {/* ── System status ─────────────────────────────────── */}
      <div className="px-0 pb-1">
        <SystemStatus collapsed={collapsed} />
      </div>

      {/* ── Bottom section ────────────────────────────────── */}
      <div className="shrink-0 border-t border-slate-100/80 dark:border-neutral-800/50 px-2 pt-2 pb-2">

        {/* User card (collapsed: avatar only) */}
        {collapsed ? (
          <div className="flex flex-col items-center gap-1">
            <div className="group relative">
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
              ) : (
                <div
                  className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white"
                  style={{ background: "linear-gradient(140deg, #fa5d19, #d44c14)" }}
                >
                  {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
                </div>
              )}
              <div className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-emerald-400 ring-[1.5px] ring-white dark:ring-neutral-950" />
            </div>
            {bottomItems.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileOpen(false)}
                  id={item.id}
                  className={cn(
                    "group relative flex justify-center items-center h-10 w-10 mx-auto rounded-xl transition-all duration-150",
                    active ? "" : "hover:bg-slate-50 dark:hover:bg-neutral-800/50",
                  )}
                  style={active ? { background: "rgba(250,93,25,0.08)" } : {}}
                >
                  <Icon className={cn("h-[15px] w-[15px]", active ? "text-orange-500" : "text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300")} />
                  <NavTooltip label={item.label} />
                </Link>
              );
            })}
            <button
              onClick={handleLogout}
              className="group relative flex justify-center items-center h-10 w-10 mx-auto rounded-xl transition-all duration-150 text-slate-400 dark:text-neutral-500 hover:bg-red-50/80 dark:hover:bg-red-500/10 hover:text-red-500 dark:hover:text-red-400"
            >
              <LogOut className="h-[15px] w-[15px]" />
              <NavTooltip label="Sair" />
            </button>
          </div>
        ) : (
          /* Expanded: user card com configurações e sair integrados */
          <div className="rounded-xl border border-slate-100 dark:border-neutral-800/60 overflow-hidden">
            {/* User info */}
            <div className="flex items-center gap-2.5 px-3 py-2.5 bg-slate-50/60 dark:bg-neutral-900/40">
              <div className="relative shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[12px] font-bold text-white"
                    style={{ background: "linear-gradient(140deg, #fa5d19, #d44c14)" }}
                  >
                    {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
                  </div>
                )}
                <div className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-emerald-400 ring-[1.5px] ring-white dark:ring-neutral-950" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-800 dark:text-neutral-200 truncate leading-tight">
                  {user?.displayName ?? "Usuário"}
                </p>
                <span className="text-[10px] text-orange-500" style={{ letterSpacing: "0.01em" }}>
                  {ROLE_LABEL[userRole ?? "funcionario"] ?? "Funcionário"}
                </span>
              </div>
            </div>
            {/* Actions */}
            <div className="border-t border-slate-100 dark:border-neutral-800/60 flex">
              {bottomItems.map((item) => {
                const Icon = item.icon;
                const active = isActive(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    id={item.id}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium transition-colors",
                      active
                        ? "text-orange-500 bg-orange-50/60 dark:bg-orange-500/10"
                        : "text-slate-500 dark:text-neutral-500 hover:text-slate-700 dark:hover:text-neutral-300 hover:bg-slate-50 dark:hover:bg-neutral-800/40",
                    )}
                  >
                    <Icon className="h-[13px] w-[13px]" />
                    <span>{item.label}</span>
                  </Link>
                );
              })}
              <div className="w-px bg-slate-100 dark:bg-neutral-800/60" />
              <button
                onClick={handleLogout}
                className="flex-1 flex items-center justify-center gap-1.5 py-2 text-[11px] font-medium text-slate-400 dark:text-neutral-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-red-50/60 dark:hover:bg-red-500/10 transition-colors"
              >
                <LogOut className="h-[13px] w-[13px]" />
                <span>Sair</span>
              </button>
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
      </motion.aside>

      {/* Collapse toggle */}
      <motion.button
        initial={false}
        animate={{ left: sidebarWidth - 11 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        aria-expanded={!collapsed}
        className="fixed top-[72px] z-[55] hidden md:flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-700/80 text-slate-400 dark:text-neutral-500 shadow-sm transition-all hover:text-slate-700 dark:hover:text-neutral-200 hover:border-slate-300 dark:hover:border-neutral-600 hover:shadow-md"
      >
        {collapsed ? <ChevronRight className="h-2.5 w-2.5" /> : <ChevronLeft className="h-2.5 w-2.5" />}
      </motion.button>

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

      {/* ── Desktop main area ───────────────────────────── */}
      <motion.div
        initial={false}
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 hidden md:flex md:flex-col h-dvh overflow-hidden min-w-0"
      >
        {/* Header */}
        <header
          className="sticky top-0 z-[48] h-[60px] shrink-0 border-b border-slate-100/80 dark:border-neutral-800/60 bg-white dark:bg-neutral-950"
          style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.03), 0 2px 8px -4px rgba(0,0,0,0.05)" }}
        >
          <div className="flex h-full items-center justify-between px-6 gap-4">
            {/* Left: breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{ background: "rgba(250,93,25,0.1)" }}
              >
                <CurrentIcon className="h-[15px] w-[15px] text-orange-500" />
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
              title="Abrir menu de comandos"
            >
              <Command className="h-3.5 w-3.5 text-slate-400 dark:text-neutral-500 shrink-0 group-hover:text-slate-500 dark:group-hover:text-neutral-400 transition-colors" />
              <span className="flex-1 text-[13px] text-slate-400 dark:text-neutral-500 group-hover:text-slate-500 dark:group-hover:text-neutral-400 transition-colors text-left">
                Comandos e navegação…
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
                  onClick={() => setShowNotifications((s) => !s)}
                  className={cn(
                    "relative flex h-8 w-8 items-center justify-center rounded-lg border transition-all",
                    showNotifications
                      ? "border-orange-300 bg-orange-50 text-orange-500 dark:border-orange-700 dark:bg-orange-500/10"
                      : "border-slate-200/80 dark:border-neutral-700/60 bg-white/80 dark:bg-neutral-900/80 text-slate-500 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600 hover:text-slate-700 dark:hover:text-neutral-200 hover:shadow-sm",
                  )}
                >
                  <Bell className="h-[14px] w-[14px]" />
                  <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-orange-500 ring-[1.5px] ring-white dark:ring-neutral-950" />
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
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 dark:border-neutral-700/60 bg-white/80 dark:bg-neutral-900/80 text-slate-500 dark:text-neutral-400 transition-all hover:border-orange-300 hover:bg-orange-50 hover:text-orange-500 dark:hover:border-orange-700 dark:hover:bg-orange-500/10 dark:hover:text-orange-400"
                title="Iniciar Tour"
              >
                <Sparkles className="h-[14px] w-[14px]" />
              </button>

              <div className="h-5 w-px bg-slate-200 dark:bg-neutral-700/60 mx-1" />

              {/* User card */}
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-neutral-700/60 bg-white/80 dark:bg-neutral-900/80 px-2.5 py-1.5 cursor-default hover:border-slate-300 dark:hover:border-neutral-600 hover:shadow-sm transition-all">
                <div className="relative shrink-0">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                    <div
                      className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: "linear-gradient(135deg, #fa5d19, #d44c14)" }}
                    >
                      {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
                    </div>
                  )}
                  <div className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-emerald-400 ring-1 ring-white dark:ring-neutral-900" />
                </div>
                <div className="hidden xl:block">
                  <p className="text-[12px] font-semibold text-slate-800 dark:text-neutral-200 leading-tight">
                    {user?.displayName ?? "Usuário"}
                  </p>
                  <p className="text-[10px] leading-tight text-orange-500">
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
          <FeedbackButton />
        </main>
        <AppTour />
      </motion.div>

      {/* ── Mobile layout ───────────────────────────────── */}
      <div className="flex-1 flex flex-col md:hidden h-dvh overflow-hidden">
        <header
          className="sticky top-0 z-30 border-b border-slate-100 dark:border-neutral-800 bg-white/95 dark:bg-neutral-950/95 backdrop-blur-xl shrink-0"
          style={{ boxShadow: "0 1px 0 0 rgba(0,0,0,0.04)" }}
        >
          <div className="flex h-14 items-center justify-between px-4 gap-3">
            <button
              onClick={() => setMobileOpen(true)}
              aria-label="Abrir menu de navegação"
              aria-expanded={mobileOpen}
              aria-controls="mobile-sidebar"
              className="flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-600 dark:text-neutral-300 shadow-sm"
            >
              <Menu className="h-4 w-4" />
            </button>

            <div className="flex items-center gap-2 flex-1 justify-center">
              <LogoIcon size={28} />
              <span className="text-[14px] font-black text-slate-900 dark:text-neutral-100 tracking-tight">
                ConstruPrice
              </span>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={toggleMode}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-slate-500 dark:text-neutral-400 shadow-sm"
              >
                {isDark ? (
                  <Sun className="h-3.5 w-3.5 text-amber-400" />
                ) : (
                  <Moon className="h-3.5 w-3.5" />
                )}
              </button>
              <div className="relative">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="h-8 w-8 rounded-full object-cover shadow-sm" />
                ) : (
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full text-[11px] font-bold text-white shadow-sm"
                    style={{ background: "linear-gradient(135deg, #fa5d19, #d44c14)" }}
                  >
                    {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
                  </div>
                )}
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
          {children}
        </main>
      </div>
    </div>
  );
}
