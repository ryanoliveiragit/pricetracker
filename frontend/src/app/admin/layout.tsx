"use client";

import {
  useEffect,
  useState,
  useRef,
  useMemo,
  useCallback,
  type ReactNode,
} from "react";
import { useRouter, usePathname } from "next/navigation";
import { notify, ToastHost } from "./_toast";

const ACC = "#6d3df0";
const AUTH_KEY = "construprice-auth";

interface AdminSession {
  email: string;
  displayName: string;
  role: string;
  token: string;
}

const NAV_SECTIONS = [
  {
    label: "Plataforma",
    items: [
      {
        id: "dashboard",
        label: "Dashboard",
        icon: "dashboard",
        desc: "Visão geral",
      },
      {
        id: "tenants",
        label: "Tenants",
        icon: "tenants",
        desc: "Clientes",
        badge: null,
      },
      { id: "users", label: "Usuários", icon: "users", desc: "Global" },
      { id: "analytics", label: "Analytics", icon: "chart", desc: "Métricas" },
    ],
  },
  {
    label: "Catálogo",
    items: [
      { id: "products", label: "Produtos", icon: "package", desc: "Catálogo" },
      { id: "suppliers", label: "Fornecedores", icon: "truck", desc: "Lojas" },
    ],
  },
  {
    label: "Operações",
    items: [
      { id: "scrapers", label: "Scrapers", icon: "bot", desc: "Monitoramento" },
      { id: "feedback", label: "Tickets", icon: "ticket", desc: "Auto-fix" },
      { id: "audit", label: "Audit log", icon: "layers", desc: "Histórico" },
    ],
  },
  {
    label: "Sistema",
    items: [
      {
        id: "settings",
        label: "Configurações",
        icon: "settings",
        desc: "Preferências",
      },
    ],
  },
];

// ─── Icon SVGs ─────────────────────────────────────────────────────
const ICONS: Record<string, (s?: number) => ReactNode> = {
  dashboard: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x={3} y={3} width={7} height={9} rx={1.5} />
      <rect x={14} y={3} width={7} height={5} rx={1.5} />
      <rect x={14} y={12} width={7} height={9} rx={1.5} />
      <rect x={3} y={16} width={7} height={5} rx={1.5} />
    </svg>
  ),
  tenants: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21V7l6-4 6 4v14" />
      <path d="M15 11h6v10" />
      <path d="M7 9v0M7 13v0M7 17v0M11 9v0M11 13v0M11 17v0M18 15v0M18 19v0" />
    </svg>
  ),
  users: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={9} cy={8} r={4} />
      <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
      <circle cx={17} cy={7} r={3} />
      <path d="M22 18c0-2.7-2.2-5-5-5" />
    </svg>
  ),
  chart: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 21V3M21 21H3M7 17l4-6 4 4 5-8" />
    </svg>
  ),
  package: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7l9-4 9 4v10l-9 4-9-4z" />
      <path d="M3 7l9 4 9-4M12 11v10" />
    </svg>
  ),
  truck: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 7h11v9H3z" />
      <path d="M14 10h4l3 3v3h-7" />
      <circle cx={7} cy={18} r={2} />
      <circle cx={17} cy={18} r={2} />
    </svg>
  ),
  bot: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect x={4} y={7} width={16} height={12} rx={2} />
      <circle cx={9} cy={13} r={1} />
      <circle cx={15} cy={13} r={1} />
      <path d="M12 7V3M9 19v2M15 19v2" />
    </svg>
  ),
  ticket: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12a2 2 0 0 0 0-4V5H3v3a2 2 0 0 1 0 4 2 2 0 0 1 0 4v3h18v-3a2 2 0 0 0 0-4z" />
      <path d="M9 5v14M14 9l2 2-2 2" />
    </svg>
  ),
  layers: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 2 2 7l10 5 10-5z" />
      <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
    </svg>
  ),
  settings: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={12} cy={12} r={3} />
      <path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />
    </svg>
  ),
  search: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={11} cy={11} r={7} />
      <path d="M21 21l-4.3-4.3" />
    </svg>
  ),
  bell: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16zM10 20a2 2 0 0 0 4 0" />
    </svg>
  ),
  sun: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={12} cy={12} r={4} />
      <path d="M12 3v2M12 19v2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M3 12h2M19 12h2M5.6 18.4 7 17M17 7l1.4-1.4" />
    </svg>
  ),
  moon: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  ),
  chevLeft: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M15 6l-6 6 6 6" />
    </svg>
  ),
  chevRight: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 6l6 6-6 6" />
    </svg>
  ),
  logout: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
    </svg>
  ),
  plus: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  ),
  check: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 13l4 4 10-10" />
    </svg>
  ),
  alert: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M10.3 3.4 1.8 17.5a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.4a2 2 0 0 0-3.4 0z" />
      <path d="M12 9v4M12 17v.01" />
    </svg>
  ),
  info: (s) => (
    <svg
      width={s || 14}
      height={s || 14}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx={12} cy={12} r={9} />
      <path d="M12 8v.01M12 12v4" />
    </svg>
  ),
};

function Icon({ name, size = 14 }: { name: string; size?: number }) {
  const fn = ICONS[name];
  return fn ? <>{fn(size)}</> : null;
}

// ─── Session helpers ────────────────────────────────────────────────
function getSession(): AdminSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed.token || !parsed.role) return null;
    return parsed;
  } catch {
    return null;
  }
}

function clearSession() {
  if (typeof window === "undefined") return;
  localStorage.removeItem(AUTH_KEY);
}

// ─── Command Palette ────────────────────────────────────────────────
function CommandPalette({
  open,
  onClose,
  go,
}: {
  open: boolean;
  onClose: () => void;
  go: (r: string) => void;
}) {
  const [q, setQ] = useState("");
  const [active, setActive] = useState(0);
  const inpRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQ("");
      setActive(0);
      setTimeout(() => inpRef.current?.focus(), 50);
    }
  }, [open]);

  const items = useMemo(() => {
    const pages = NAV_SECTIONS.flatMap((s) => s.items).map((it) => ({
      id: it.id,
      label: `Ir para ${it.label}`,
      section: "Navegar",
      icon: it.icon,
      action: () => go(it.id),
    }));
    const actions = [
      {
        id: "new-tenant",
        label: "Criar novo tenant…",
        section: "Ações",
        icon: "plus",
        action: () => {
          go("tenants");
          notify("Modal de novo tenant aberto");
        },
      },
      {
        id: "clear-cache",
        label: "Limpar cache Redis",
        section: "Ações",
        icon: "layers",
        action: () => notify("Cache Redis limpo"),
      },
      {
        id: "rerun-scrapers",
        label: "Re-executar scrapers que falharam",
        section: "Ações",
        icon: "bot",
        action: () => notify("3 scrapers re-enfileirados"),
      },
    ];
    const all = [...pages, ...actions];
    if (!q.trim()) return all;
    const ql = q.toLowerCase();
    return all.filter((i) => i.label.toLowerCase().includes(ql));
  }, [q, go]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((a) => Math.min(a + 1, items.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((a) => Math.max(a - 1, 0));
      } else if (e.key === "Enter") {
        e.preventDefault();
        items[active]?.action();
        onClose();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, items, active, onClose]);

  if (!open) return null;
  const grouped = items.reduce(
    (acc, it) => {
      (acc[it.section] = acc[it.section] || []).push(it);
      return acc;
    },
    {} as Record<string, typeof items>,
  );
  let idx = -1;

  return (
    <div className="cmdk-overlay" onClick={onClose}>
      <div className="cmdk" onClick={(e) => e.stopPropagation()}>
        <div className="cmdk-input">
          <Icon name="search" size={16} />
          <input
            ref={inpRef}
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setActive(0);
            }}
            placeholder="Buscar tenant, ação ou página…"
          />
          <kbd>esc</kbd>
        </div>
        <div className="cmdk-list">
          {Object.entries(grouped).map(([sec, list]) => (
            <div key={sec}>
              <div className="cmdk-section">{sec}</div>
              {list.map((it) => {
                idx++;
                const isActive = idx === active;
                return (
                  <div
                    key={it.id}
                    className={`cmdk-row ${isActive ? "active" : ""}`}
                    onMouseEnter={() => setActive(active)}
                    onClick={() => {
                      it.action();
                      onClose();
                    }}
                  >
                    <Icon name={it.icon} size={14} />
                    <span>{it.label}</span>
                  </div>
                );
              })}
            </div>
          ))}
          {items.length === 0 && (
            <div className="empty">Nada encontrado para &ldquo;{q}&rdquo;</div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Layout ─────────────────────────────────────────────────────────
export default function AdminLayout({ children }: { children: ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [session, setSession] = useState<AdminSession | null>(null);
  const [checking, setChecking] = useState(true);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdkOpen, setCmdkOpen] = useState(false);
  const [theme, setTheme] = useState<"light" | "dark">("light");

  const isLoginPage = pathname === "/admin/login";

  useEffect(() => {
    const saved = localStorage.getItem("admin-theme") as
      | "light"
      | "dark"
      | null;
    if (saved) setTheme(saved);
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-admin-theme", theme);
    localStorage.setItem("admin-theme", theme);
  }, [theme]);

  useEffect(() => {
    if (isLoginPage) {
      setChecking(false);
      return;
    }
    const s = getSession();
    if (!s || (s.role !== "super_admin" && s.role !== "admin")) {
      router.replace("/admin/login");
    } else {
      setSession(s);
    }
    setChecking(false);
  }, [router, isLoginPage]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdkOpen((o) => !o);
      }
      if (e.key === "Escape") setCmdkOpen(false);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, []);

  function go(route: string) {
    const pathMap: Record<string, string> = {
      dashboard: "/admin",
      tenants: "/admin/tenants",
      users: "/admin/users",
      analytics: "/admin/analytics",
      products: "/admin/products",
      suppliers: "/admin/suppliers",
      scrapers: "/admin/scrapers",
      feedback: "/admin/feedback",
      audit: "/admin/audit",
      settings: "/admin/settings",
    };
    const target = pathMap[route] || `/admin/${route}`;
    router.push(target);
    setCmdkOpen(false);
  }

  function isActive(id: string) {
    const pathMap: Record<string, string> = {
      dashboard: "/admin",
      tenants: "/admin/tenants",
      users: "/admin/users",
      analytics: "/admin/analytics",
      products: "/admin/products",
      suppliers: "/admin/suppliers",
      scrapers: "/admin/scrapers",
      feedback: "/admin/feedback",
      audit: "/admin/audit",
      settings: "/admin/settings",
    };
    const target = pathMap[id] || `/admin/${id}`;
    if (target === "/admin") return pathname === "/admin";
    return pathname.startsWith(target);
  }

  function handleLogout() {
    clearSession();
    router.push("/admin/login");
  }

  const crumbs = useMemo(() => {
    const segments = pathname.split("/").slice(2).filter(Boolean);
    const route = segments[0] || "dashboard";
    const crumbMap: Record<string, string[]> = {
      dashboard: ["Dashboard"],
      tenants: ["Tenants"],
      users: ["Usuários"],
      products: ["Produtos"],
      suppliers: ["Fornecedores"],
      scrapers: ["Operações", "Scrapers"],
      analytics: ["Analytics"],
      feedback: ["Operações", "Tickets"],
      audit: ["Operações", "Audit log"],
      settings: ["Sistema", "Configurações"],
    };
    const base = crumbMap[route] || ["—"];
    if (segments.length > 1) {
      if (route === "tenants") {
        base.push("Detalhes");
      } else {
        base.push(segments[1]);
      }
    }
    return base;
  }, [pathname]);

  if (isLoginPage) {
    return (
      <div className="admin-shell" data-theme={theme}>
        {children}
      </div>
    );
  }

  if (checking) {
    return (
      <div className="admin-shell" data-theme={theme}>
        <div
          className="flex min-h-screen items-center justify-center"
          style={{ background: "var(--bg)" }}
        >
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6d3df0] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!session) return null;

  return (
    <div className="admin-shell" data-theme={theme}>
      <div className={`shell ${collapsed ? "sb-collapsed" : ""}`}>
        {/* Sidebar */}
        {mobileOpen && (
          <div className="sb-overlay" onClick={() => setMobileOpen(false)} />
        )}
        <aside
          className={`sb ${mobileOpen ? "mobile-open" : ""}`}
          style={{ position: "fixed", left: 0, top: 0, zIndex: 40 }}
        >
          <div className="sb-brand">
            <div className="sb-brand-mark">⌘</div>
            <div className="sb-brand-text">
              <b>ConstruPrice</b>
              <span>Admin · v2.4</span>
            </div>
            <button
              className="sb-collapse"
              onClick={() => setCollapsed(!collapsed)}
              title="Colapsar"
            >
              {collapsed ? (
                <Icon name="chevRight" size={14} />
              ) : (
                <Icon name="chevLeft" size={14} />
              )}
            </button>
          </div>

          <div className="sb-search">
            <button onClick={() => setCmdkOpen(true)}>
              <Icon name="search" size={13} />
              <span>Buscar…</span>
              <kbd>⌘K</kbd>
            </button>
          </div>

          <nav className="sb-nav">
            {NAV_SECTIONS.map((s) => (
              <div key={s.label}>
                <div className="sb-section">{s.label}</div>
                {s.items.map((it) => {
                  const active = isActive(it.id);
                  return (
                    <button
                      key={it.id}
                      className="sb-item"
                      aria-current={active ? "page" : undefined}
                      onClick={() => go(it.id)}
                      title={collapsed ? it.label : undefined}
                    >
                      <Icon name={it.icon} size={14} />
                      <span>{it.label}</span>
                      {(it as any).badge != null && (
                        <span className="badge muted">{(it as any).badge}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))}
          </nav>

          <div className="sb-foot">
            <div className="sb-avatar">
              {(session.displayName || "?").charAt(0).toUpperCase()}
            </div>
            <div className="sb-foot-meta">
              <b>{session.displayName}</b>
              <span>{session.email}</span>
            </div>
            <button title="Sair" onClick={handleLogout}>
              <Icon name="logout" size={14} />
            </button>
          </div>
        </aside>

        {/* Main area */}
        <div
          className="main bg-red-700"
          style={{
            marginLeft: collapsed ? 64 : 240,
            transition: "margin-left .2s",
          }}
        >
          {/* Topbar */}
          <div className="tb">
            <button
              className="sb-hamburger"
              onClick={() => setMobileOpen(true)}
              title="Menu"
            >
              <svg
                width={16}
                height={16}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={1.7}
              >
                <path d="M3 6h18M3 12h18M3 18h18" />
              </svg>
            </button>
            <div className="tb-crumbs">
              {crumbs.map((c: string, i: number) => (
                <span key={i}>
                  {i > 0 && <span className="sep">/</span>}
                  {i === crumbs.length - 1 ? <b>{c}</b> : <span>{c}</span>}
                </span>
              ))}
            </div>
            <div className="tb-spacer" />
            <span className="tb-status">
              <span className="dot"></span> Sistema saudável
            </span>
            <button className="tb-action" onClick={() => setCmdkOpen(true)}>
              <Icon name="search" size={13} /> Buscar
              <kbd
                style={{
                  fontFamily: "var(--font-mono)",
                  fontSize: 10,
                  background: "var(--surface-3)",
                  padding: "1px 5px",
                  borderRadius: 4,
                  color: "var(--text-3)",
                  border: "1px solid var(--line)",
                }}
              >
                ⌘K
              </kbd>
            </button>
            <button
              className="tb-action icon"
              onClick={() => setTheme((t) => (t === "dark" ? "light" : "dark"))}
              title="Tema"
            >
              {theme === "dark" ? (
                <Icon name="sun" size={14} />
              ) : (
                <Icon name="moon" size={14} />
              )}
            </button>
            <button className="tb-action icon" title="Notificações">
              <Icon name="bell" size={14} />
            </button>
          </div>

          {/* Content */}
          <main className="flex-1 ">{children}</main>
        </div>
      </div>

      <CommandPalette
        open={cmdkOpen}
        onClose={() => setCmdkOpen(false)}
        go={go}
      />
      <ToastHost />
    </div>
  );
}
