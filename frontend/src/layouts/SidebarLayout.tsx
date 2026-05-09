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
  ChevronDown,
  Sun,
  Moon,
  Home,
  Database,
  Gem,
  MessageSquarePlus,
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

const adminItems: NavItem[] = [
  {
    href: "/feedback",
    label: "Tickets",
    description: "Análise de Tickets",
    icon: MessageSquarePlus,
    id: "tour-nav-feedback",
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
        className="shrink-0 inline-flex items-center gap-[3px] rounded-md px-[7px] py-[3px] text-[9px] font-semibold leading-none"
        style={{
          background: "linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)",
          color: "#fff",
          boxShadow: "0 2px 8px rgba(109,40,217,0.35), inset 0 1px 0 rgba(255,255,255,0.15)",
          letterSpacing: "0.05em",
        }}
      >
        <Gem className="h-[7px] w-[7px] opacity-90" />
        Plus
      </span>
    );
  }

  return (
    <span
      className="shrink-0 inline-flex items-center rounded-md px-[7px] py-[3px] text-[9px] font-bold leading-none"
      style={{
        background: `linear-gradient(135deg, ${ACC} 0%, ${ACC6} 100%)`,
        color: "#fff",
        boxShadow: `0 2px 8px color-mix(in srgb, ${ACC} 35%, transparent), inset 0 1px 0 rgba(255,255,255,0.15)`,
        letterSpacing: "0.06em",
      }}
    >
      {badge}
    </span>
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
  const [showUserMenu, setShowUserMenu] = useState(false);

  function handleLogout() {
    logout();
    router.push("/login");
  }

  function isActive(path: string) {
    if (!pathname) return false;
    return path === "/" ? pathname === "/" : pathname.startsWith(path);
  }

  const sidebarWidth = collapsed ? 68 : 240;
  const currentPage = [...navItems, ...bottomItems].find((i) =>
    isActive(i.href),
  );
  const CurrentIcon = currentPage?.icon ?? Home;
  const userRole = (user as any)?.role as string | undefined;

  /* ── Sidebar content ──────────────────────────────────── */
  const sidebarContent = (
    <div className="flex h-full flex-col select-none">
      {/* Logo */}
      <div
        className="flex h-[60px] shrink-0 items-center border-b border-slate-100/80 dark:border-neutral-800/50"
        style={{ padding: collapsed ? "0 14px" : "0 16px" }}
      >
        {collapsed ? (
          <div
            className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-[13px] font-black shadow-md"
            style={{
              background: `linear-gradient(140deg, ${ACC}, ${ACC6})`,
              boxShadow: `0 3px 12px -2px color-mix(in srgb, ${ACC} 50%, transparent)`,
            }}
          >
            C
          </div>
        ) : (
          <div className="flex items-center gap-2.5 min-w-0">
            <div
              className="flex h-8 w-8 items-center justify-center rounded-lg text-white text-[13px] font-black shadow-md shrink-0"
              style={{
                background: `linear-gradient(140deg, ${ACC}, ${ACC6})`,
                boxShadow: `0 3px 12px -2px color-mix(in srgb, ${ACC} 50%, transparent)`,
              }}
            >
              C
            </div>
            <div className="min-w-0">
              <p className="text-[13.5px] font-bold text-slate-900 dark:text-neutral-50 leading-tight tracking-tight">
                ConstruPrice
              </p>
              <div className="flex items-center gap-1 mt-[3px]">
                <span
                  className="inline-flex items-center rounded px-1.5 py-px text-[9px] font-semibold"
                  style={{
                    background: `color-mix(in srgb, ${ACC} 10%, transparent)`,
                    color: ACC,
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

      {/* Section label */}
      {!collapsed && (
        <div className="px-3.5 pt-5 pb-1">
          <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400/80 dark:text-neutral-600">
            Navegação
          </span>
        </div>
      )}

      {/* Main nav */}
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
                collapsed ? "justify-center h-10 w-10 mx-auto" : "px-2.5 py-2",
                active
                  ? ""
                  : "hover:bg-slate-50 dark:hover:bg-neutral-800/50",
              )}
              style={
                active
                  ? {
                      background: `color-mix(in srgb, ${ACC} 9%, transparent)`,
                    }
                  : {}
              }
            >
              {/* Active left pill */}
              {active && !collapsed && (
                <span
                  className="absolute left-0 top-1/2 -translate-y-1/2 w-[3px] h-[18px] rounded-full"
                  style={{ background: ACC }}
                />
              )}

              <div
                className={cn(
                  "flex shrink-0 items-center justify-center rounded-lg transition-all duration-150",
                  collapsed ? "h-9 w-9" : "h-7 w-7",
                )}
                style={
                  active
                    ? {
                        background: `color-mix(in srgb, ${ACC} 14%, transparent)`,
                      }
                    : {}
                }
              >
                <Icon
                  className={cn(
                    "transition-colors duration-150",
                    collapsed ? "h-[16px] w-[16px]" : "h-[15px] w-[15px]",
                    active
                      ? "text-[rgb(var(--primary-500))]"
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
                        ? "font-semibold text-[rgb(var(--primary-600))] dark:text-[rgb(var(--primary-400))]"
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

      {/* Bottom section */}
      <div className="shrink-0 border-t border-slate-100/80 dark:border-neutral-800/50 px-2 py-2 space-y-px">
        {/* Admin-only items */}
        {userRole === "admin" && (
          <>
            {!collapsed && (
              <div className="px-2 pb-1 pt-1">
                <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400/80 dark:text-neutral-600">
                  Admin
                </span>
              </div>
            )}
            {adminItems.map((item) => {
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
                    collapsed ? "justify-center h-10 w-10 mx-auto" : "px-2.5 py-2",
                    active ? "" : "hover:bg-slate-50 dark:hover:bg-neutral-800/50",
                  )}
                  style={active ? { background: "color-mix(in srgb, #7c3aed 9%, transparent)" } : {}}
                >
                  <Icon
                    className={cn(
                      "shrink-0 h-[15px] w-[15px] transition-colors duration-150",
                      active ? "text-violet-600 dark:text-violet-400" : "text-slate-400 dark:text-neutral-500 group-hover:text-slate-600 dark:group-hover:text-neutral-300",
                    )}
                  />
                  {!collapsed && (
                    <span className={cn("text-[13px] font-medium", active ? "text-violet-600 dark:text-violet-400" : "text-slate-600 dark:text-neutral-400 group-hover:text-slate-800 dark:group-hover:text-neutral-200")}>
                      {item.label}
                    </span>
                  )}
                  {collapsed && <NavTooltip label={item.label} />}
                </Link>
              );
            })}
            <div className="h-px bg-slate-100 dark:bg-neutral-800/60 my-1" />
          </>
        )}

        {/* User card with dropdown */}
        <div className="relative mt-1.5 pt-2 border-t border-slate-100/80 dark:border-neutral-800/50">
          {collapsed ? (
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="group relative flex h-10 w-10 mx-auto items-center justify-center rounded-xl hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition-colors"
              title="Perfil"
            >
              {user?.avatar ? (
                <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
              ) : (
                <div
                  className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
                  style={{ background: `linear-gradient(140deg, ${ACC}, ${ACC6})` }}
                >
                  {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
                </div>
              )}
              <NavTooltip label="Perfil" />
            </button>
          ) : (
            <button
              onClick={() => setShowUserMenu(v => !v)}
              className="flex w-full items-center gap-2.5 px-2 py-2 rounded-xl hover:bg-slate-50 dark:hover:bg-neutral-800/40 transition-colors"
            >
              <div className="relative shrink-0">
                {user?.avatar ? (
                  <img src={user.avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
                ) : (
                  <div
                    className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{ background: `linear-gradient(140deg, ${ACC}, ${ACC6})` }}
                  >
                    {user?.displayName?.charAt(0).toUpperCase() ?? "U"}
                  </div>
                )}
                <div className="absolute -bottom-px -right-px h-2 w-2 rounded-full bg-emerald-400 ring-[1.5px] ring-white dark:ring-neutral-950" />
              </div>
              <div className="flex-1 min-w-0 text-left">
                <p className="text-[12px] font-semibold text-slate-800 dark:text-neutral-200 truncate leading-tight">
                  {user?.displayName ?? "Usuário"}
                </p>
                <span
                  className="inline-flex items-center rounded px-1.5 py-px mt-0.5 text-[9px] font-medium"
                  style={{ background: `color-mix(in srgb, ${ACC} 8%, transparent)`, color: ACC }}
                >
                  {ROLE_LABEL[userRole ?? "funcionario"] ?? "Funcionário"}
                </span>
              </div>
              <ChevronDown className={`h-3.5 w-3.5 text-slate-400 shrink-0 transition-transform ${showUserMenu ? "rotate-180" : ""}`} />
            </button>
          )}

          {showUserMenu && (
            <>
              <div className="fixed inset-0 z-10" onClick={() => setShowUserMenu(false)} />
              <div className="absolute bottom-full left-0 mb-1 z-20 w-52 rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-lg">
                <Link
                  href="/settings"
                  onClick={() => { setShowUserMenu(false); setMobileOpen(false); }}
                  className="flex w-full items-center gap-2.5 rounded-t-xl px-4 py-3 text-sm text-slate-700 hover:bg-slate-50 dark:text-neutral-300 dark:hover:bg-neutral-800"
                >
                  <Settings className="h-4 w-4" />
                  Configurações
                </Link>
                <div className="border-t border-slate-100 dark:border-neutral-800" />
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
        style={{
          boxShadow:
            "1px 0 0 0 rgba(0,0,0,0.03), 4px 0 20px -8px rgba(0,0,0,0.06)",
        }}
      >
        <div className="flex-1 overflow-hidden" style={{ width: sidebarWidth }}>
          {sidebarContent}
        </div>
      </motion.aside>

      {/* Collapse toggle — outside aside so overflow-hidden doesn't clip it */}
      <motion.button
        initial={false}
        animate={{ left: sidebarWidth - 11 }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        onClick={() => setCollapsed((c) => !c)}
        aria-label={collapsed ? "Expandir sidebar" : "Recolher sidebar"}
        aria-expanded={!collapsed}
        className="fixed top-[72px] z-[55] hidden md:flex h-[22px] w-[22px] items-center justify-center rounded-full bg-white dark:bg-neutral-900 border border-slate-200/80 dark:border-neutral-700/80 text-slate-400 dark:text-neutral-500 shadow-sm transition-all hover:text-slate-700 dark:hover:text-neutral-200 hover:border-slate-300 dark:hover:border-neutral-600 hover:shadow-md"
      >
        {collapsed ? (
          <ChevronRight className="h-2.5 w-2.5" />
        ) : (
          <ChevronLeft className="h-2.5 w-2.5" />
        )}
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

      {/* ── Desktop: main area ──────────────────────────── */}
      <motion.div
        initial={false}
        animate={{ marginLeft: sidebarWidth }}
        transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
        className="flex-1 hidden md:flex md:flex-col h-dvh overflow-hidden min-w-0"
      >
        {/* Header */}
        <header
          className="sticky top-0 z-[48] h-[60px] shrink-0 border-b border-slate-100/80 dark:border-neutral-800/60 bg-white dark:bg-neutral-950"
          style={{
            boxShadow:
              "0 1px 0 0 rgba(0,0,0,0.03), 0 2px 8px -4px rgba(0,0,0,0.05)",
          }}
        >
          <div className="flex h-full items-center justify-between px-6 gap-4">
            {/* Left: page breadcrumb */}
            <div className="flex items-center gap-3 min-w-0">
              <div
                className="hidden sm:flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
                style={{
                  background: `color-mix(in srgb, ${ACC} 10%, transparent)`,
                }}
              >
                <CurrentIcon
                  className="h-[15px] w-[15px]"
                  style={{ color: ACC }}
                />
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
              onClick={() =>
                window.dispatchEvent(new CustomEvent("open-command-menu"))
              }
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
                      ? "border-[rgb(var(--primary-500))] bg-[color-mix(in_srgb,rgb(var(--primary-500))_10%,transparent)] text-[rgb(var(--primary-500))]"
                      : "border-slate-200/80 dark:border-neutral-700/60 bg-white/80 dark:bg-neutral-900/80 text-slate-500 dark:text-neutral-400 hover:border-slate-300 dark:hover:border-neutral-600 hover:text-slate-700 dark:hover:text-neutral-200 hover:shadow-sm",
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
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("start-app-tour"))
                }
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200/80 dark:border-neutral-700/60 bg-white/80 dark:bg-neutral-900/80 text-slate-500 dark:text-neutral-400 transition-all hover:text-white hover:shadow-sm"
                onMouseEnter={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = ACC;
                  el.style.borderColor = ACC6;
                }}
                onMouseLeave={(e) => {
                  const el = e.currentTarget as HTMLButtonElement;
                  el.style.background = "";
                  el.style.borderColor = "";
                }}
                title="Iniciar Tour"
              >
                <Sparkles className="h-[14px] w-[14px]" />
              </button>

              {/* Divider */}
              <div className="h-5 w-px bg-slate-200 dark:bg-neutral-700/60 mx-1" />

              {/* User card */}
              <div className="flex items-center gap-2.5 rounded-xl border border-slate-200/80 dark:border-neutral-700/60 bg-white/80 dark:bg-neutral-900/80 px-2.5 py-1.5 cursor-default hover:border-slate-300 dark:hover:border-neutral-600 hover:shadow-sm transition-all">
                <div className="relative shrink-0">
                  {user?.avatar ? (
                    <img src={user.avatar} alt="" className="h-6 w-6 rounded-full object-cover" />
                  ) : (
                  <div
                    className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-bold text-white"
                    style={{
                      background: `linear-gradient(135deg, ${ACC}, ${ACC6})`,
                    }}
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
                  <p
                    className="text-[10px] leading-tight"
                    style={{ color: ACC }}
                  >
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
              <div
                className="flex h-7 w-7 items-center justify-center rounded-lg text-white text-[11px] font-bold shadow-sm"
                style={{
                  background: `linear-gradient(135deg, ${ACC}, ${ACC6})`,
                }}
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
                  style={{
                    background: `linear-gradient(135deg, ${ACC}, ${ACC6})`,
                  }}
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
              onClick={() =>
                window.dispatchEvent(new CustomEvent("open-command-menu"))
              }
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
