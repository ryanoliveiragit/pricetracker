"use client";

import { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { tenantsApi, type ApiTenant } from "../../services/api";
import { adminApi } from "../../services/adminApi";
import { getCatalogStatus } from "../../services/searchApi";

// ─── Sparkline ──────────────────────────────────────────────────────
function Sparkline({
  data,
  color = "var(--accent)",
  height = 36,
  fill = true,
  strokeWidth = 1.5,
}: {
  data: number[];
  color?: string;
  height?: number;
  fill?: boolean;
  strokeWidth?: number;
}) {
  if (!data || !data.length) return null;
  const w = 200,
    h = height,
    p = 2;
  const min = Math.min(...data),
    max = Math.max(...data);
  const r = Math.max(max - min, 1);
  const pts = data.map((v, i) => {
    const x = p + (i / (data.length - 1)) * (w - p * 2);
    const y = p + (1 - (v - min) / r) * (h - p * 2);
    return [x, y];
  });
  const d = pts
    .map(
      (p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`,
    )
    .join(" ");
  const fillD = `${d} L${pts[pts.length - 1][0]},${h} L${pts[0][0]},${h} Z`;
  return (
    <svg
      viewBox={`0 0 ${w} ${h}`}
      preserveAspectRatio="none"
      className="spark"
      style={{
        position: "absolute",
        right: 0,
        bottom: 0,
        left: 0,
        height,
        pointerEvents: "none",
        opacity: 0.9,
      }}
    >
      {fill && <path d={fillD} fill={color} opacity={0.1} />}
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={strokeWidth}
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

// ─── Bar Chart ──────────────────────────────────────────────────────
function BarChart({
  data,
  height = 200,
  color = "var(--accent)",
}: {
  data: number[];
  height?: number;
  color?: string;
}) {
  const w = 600,
    h = height,
    padL = 32,
    padB = 22,
    padT = 8,
    padR = 8;
  const max = Math.max(...data, 1);
  const bw = (w - padL - padR) / data.length;
  const ticks = [0, Math.round(max * 0.5), max];
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" style={{ height }}>
      {ticks.map((t, i) => {
        const y = padT + (1 - t / max) * (h - padT - padB);
        return (
          <g key={i}>
            <line className="grid-line" x1={padL} x2={w - padR} y1={y} y2={y} />
            <text className="axis-text" x={padL - 6} y={y + 3} textAnchor="end">
              {t.toLocaleString()}
            </text>
          </g>
        );
      })}
      {data.map((v, i) => {
        const bh = (v / max) * (h - padT - padB);
        const x = padL + i * bw + 1.5;
        const y = h - padB - bh;
        return (
          <rect
            key={i}
            x={x}
            y={y}
            width={Math.max(bw - 3, 1)}
            height={bh}
            fill={color}
            rx={1.5}
            opacity={i === data.length - 1 ? 1 : 0.7}
          />
        );
      })}
    </svg>
  );
}

// ─── Donut ──────────────────────────────────────────────────────────
function Donut({
  slices,
  size = 140,
  thickness = 20,
}: {
  slices: Array<{ label: string; value: number; color: string }>;
  size?: number;
  thickness?: number;
}) {
  const r = size / 2 - thickness / 2;
  const c = size / 2;
  const total = slices.reduce((a, b) => a + b.value, 0) || 1;
  let acc = 0;
  const circ = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
      <circle
        cx={c}
        cy={c}
        r={r}
        fill="none"
        stroke="var(--surface-3)"
        strokeWidth={thickness}
      />
      {slices.map((s, i) => {
        const len = (s.value / total) * circ;
        const off = circ - acc;
        acc += len;
        return (
          <circle
            key={i}
            cx={c}
            cy={c}
            r={r}
            fill="none"
            stroke={s.color}
            strokeWidth={thickness}
            strokeDasharray={`${len} ${circ}`}
            strokeDashoffset={off}
            transform={`rotate(-90 ${c} ${c})`}
            strokeLinecap="butt"
          />
        );
      })}
    </svg>
  );
}

// ─── KPI Card ───────────────────────────────────────────────────────
function Kpi({
  label,
  value,
  delta,
  deltaDir = "up",
  series,
  color = "var(--accent)",
  icon,
}: {
  label: string;
  value: string;
  delta?: string;
  deltaDir?: "up" | "dn" | "flat";
  series?: number[];
  color?: string;
  icon?: React.ReactNode;
}) {
  return (
    <div className="kpi">
      <div className="kpi-label">
        {icon}
        <span>{label}</span>
      </div>
      <div className="kpi-value mono">{value}</div>
      {delta != null && (
        <div className="kpi-foot">
          <span className={`delta ${deltaDir}`}>
            {deltaDir === "up" ? "↑" : deltaDir === "dn" ? "↓" : "→"} {delta}
          </span>
          <span className="muted" style={{ fontSize: 11 }}>
            vs 30 dias
          </span>
        </div>
      )}
      {series && <Sparkline data={series} color={color} height={36} />}
    </div>
  );
}

// ─── Dashboard Page ─────────────────────────────────────────────────
export default function AdminDashboardPage() {
  const router = useRouter();
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [searchAvg, setSearchAvg] = useState<number | null>(null);
  const [catalogTotal, setCatalogTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const [t, s, cs] = await Promise.allSettled([
          tenantsApi.getAll(),
          adminApi.getSearchStats(),
          getCatalogStatus(),
        ]);
        if (t.status === "fulfilled") setTenants(t.value);
        if (s.status === "fulfilled") setSearchAvg(s.value.scraper_avg_seconds);
        if (cs.status === "fulfilled") setCatalogTotal(cs.value.totalProducts);
      } catch {
        /* ignore */
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const active = tenants.filter((t) => t.isActive).length;
  const proent = tenants.filter((t) => t.plan !== "free").length;
  const free = tenants.filter((t) => t.plan === "free").length;

  const seriesData = useMemo(() => {
    const len = Math.max(tenants.length, 1);
    return {
      tenants: Array.from({ length: 30 }, (_, i) =>
        Math.max(1, Math.round(len * (0.3 + (i / 29) * 0.7))),
      ),
      searches: [
        820, 940, 1100, 1050, 1280, 1340, 1180, 1410, 1520, 1680, 1740, 1820,
        1620, 1980, 2100, 2040, 2280, 2420, 2580, 2520, 2680, 2840, 2960, 3100,
        3020, 3220, 3340, 3280, 3480, 3620,
      ],
    };
  }, [tenants.length]);

  const planSlices = [
    { label: "Free", value: free, color: "var(--text-3)" },
    {
      label: "Pro",
      value: tenants.filter((t) => t.plan === "pro").length,
      color: "var(--info)",
    },
    {
      label: "Enterprise",
      value: tenants.filter((t) => t.plan === "enterprise").length,
      color: "var(--accent)",
    },
  ];

  if (loading) {
    return (
      <div className="pg">
        <div className="flex items-center justify-center py-32">
          <div className="h-6 w-6 animate-spin rounded-full border-2 border-[#6d3df0] border-t-transparent" />
        </div>
      </div>
    );
  }

  return (
    <div className="pg">
      <div className="pg-head">
        <div>
          <h1>Dashboard</h1>
          <p>Visão geral da plataforma multi-tenant · últimas 30h.</p>
        </div>
        <div className="pg-actions">
          <button className="btn" onClick={() => window.location.reload()}>
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
            >
              <path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 4v4h-4M21 12a9 9 0 0 1-15.5 6.3L3 16M3 20v-4h4" />
            </svg>
            Atualizar
          </button>
          <button
            className="btn btn-accent"
            onClick={() => router.push("/admin/tenants")}
          >
            <svg
              width={12}
              height={12}
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.7}
            >
              <path d="M12 5v14M5 12h14" />
            </svg>
            Novo Tenant
          </button>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="grid-cards">
        <div className="card">
          <div className="card-h">
            <div>
              <h3>Buscas por dia</h3>
              <div className="sub">Últimos 30 dias · todos os tenants</div>
            </div>
            <div className="row">
              <span className="chip accent">
                <svg
                  width={10}
                  height={10}
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth={2}
                >
                  <path d="M5 12h14M13 5l7 7-7 7" />
                </svg>
                +27%
              </span>
            </div>
          </div>
          <div style={{ padding: 16 }}>
            <BarChart data={seriesData.searches} height={220} />
          </div>
        </div>
        <div className="card">
          <div className="card-h">
            <div>
              <h3>Distribuição de planos</h3>
              <div className="sub">{tenants.length} tenants</div>
            </div>
          </div>
          <div
            style={{
              padding: 20,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 16,
            }}
          >
            <div style={{ position: "relative" }}>
              <Donut slices={planSlices} size={150} thickness={20} />
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "grid",
                  placeItems: "center",
                  textAlign: "center",
                }}
              >
                <div>
                  <div
                    className="mono"
                    style={{ fontSize: 26, fontWeight: 600, lineHeight: 1 }}
                  >
                    {tenants.length}
                  </div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    tenants
                  </div>
                </div>
              </div>
            </div>
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: 8,
                width: "100%",
              }}
            >
              {planSlices.map((s) => (
                <div
                  key={s.label}
                  className="row"
                  style={{ justifyContent: "space-between" }}
                >
                  <span className="row" style={{ gap: 8 }}>
                    <span
                      style={{
                        width: 8,
                        height: 8,
                        borderRadius: 999,
                        background: s.color,
                      }}
                    />
                    <span style={{ fontSize: 12.5 }}>{s.label}</span>
                  </span>
                  <span
                    className="mono"
                    style={{ fontSize: 12, fontWeight: 600 }}
                  >
                    {s.value}{" "}
                    <span className="muted">
                      · {Math.round((s.value / (tenants.length || 1)) * 100)}%
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="grid-cards">
        <div className="card">
          <div className="card-h">
            <div>
              <h3>Tenants recentes</h3>
              <div className="sub">Últimos cadastrados</div>
            </div>
            <button
              className="btn sm"
              onClick={() => router.push("/admin/tenants")}
            >
              Ver todos
              <svg
                width={11}
                height={11}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path d="M5 12h14M13 5l7 7-7 7" />
              </svg>
            </button>
          </div>
          <table className="tbl">
            <thead>
              <tr>
                <th>Tenant</th>
                <th>Plano</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {tenants.slice(0, 5).map((t) => {
                const firstLetter = (t.settings.app_name || t.name)
                  .charAt(0)
                  .toUpperCase();
                return (
                  <tr
                    key={t.id}
                    style={{ cursor: "pointer" }}
                    onClick={() => router.push("/admin/tenants")}
                  >
                    <td>
                      <div className="cell-tenant">
                        <span
                          className="tenant-mark"
                          style={
                            {
                              "--mc": t.settings.primary_color || "#6d3df0",
                            } as React.CSSProperties
                          }
                        >
                          {firstLetter}
                        </span>
                        <div className="cell-meta">
                          <b>{t.settings.app_name || t.name}</b>
                          <span>{t.slug}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`chip plan-${t.plan}`}>{t.plan}</span>
                    </td>
                    <td>
                      {t.isActive ? (
                        <span className="chip ok">
                          <span className="dot" />
                          Ativo
                        </span>
                      ) : (
                        <span className="chip err">
                          <span className="dot" />
                          Inativo
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={3}>
                    <div className="empty">Nenhum tenant cadastrado</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="card">
          <div className="card-h">
            <div>
              <h3>Atividade do sistema</h3>
              <div className="sub">Eventos recentes</div>
            </div>
          </div>
          <div style={{ padding: "4px 0" }}>
            {[
              {
                icon: "search",
                cl: "err",
                label: "Soma Urânio falhou",
                meta: "construtora-bnblx · há 3 dias",
              },
              {
                icon: "ticket",
                cl: "warn",
                label: "1 ticket aguardando validação",
                meta: "fb1 · há 2 h",
              },
              {
                icon: "tenants",
                cl: "ok",
                label: "Tenant criado",
                meta: "lucia · ontem",
              },
              {
                icon: "layers",
                cl: "info",
                label: "Deploy fix/soma-login → main",
                meta: "diego · ontem",
              },
              {
                icon: "users",
                cl: "ok",
                label: "Marina (BnBLX) promovida a admin",
                meta: "lucia · há 22h",
              },
            ].map((a, i) => (
              <div
                key={i}
                className="row"
                style={{
                  padding: "10px 14px",
                  borderBottom: i < 4 ? "1px solid var(--line)" : "none",
                  gap: 10,
                }}
              >
                <span className={`chip ${a.cl}`} style={{ padding: "4px 5px" }}>
                  <svg
                    width={13}
                    height={13}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={1.7}
                  >
                    {a.icon === "search" ? (
                      <>
                        <circle cx={11} cy={11} r={7} />
                        <path d="M21 21l-4.3-4.3" />
                      </>
                    ) : a.icon === "ticket" ? (
                      <>
                        <path d="M21 12a2 2 0 0 0 0-4V5H3v3a2 2 0 0 1 0 4 2 2 0 0 1 0 4v3h18v-3a2 2 0 0 0 0-4z" />
                        <path d="M9 5v14M14 9l2 2-2 2" />
                      </>
                    ) : a.icon === "tenants" ? (
                      <>
                        <path d="M3 21V7l6-4 6 4v14" />
                        <path d="M15 11h6v10" />
                        <path d="M7 9v0M7 13v0M7 17v0M11 9v0M11 13v0M11 17v0M18 15v0M18 19v0" />
                      </>
                    ) : a.icon === "layers" ? (
                      <>
                        <path d="M12 2 2 7l10 5 10-5z" />
                        <path d="M2 17l10 5 10-5M2 12l10 5 10-5" />
                      </>
                    ) : (
                      <>
                        <circle cx={9} cy={8} r={4} />
                        <path d="M2 21c0-3.9 3.1-7 7-7s7 3.1 7 7" />
                        <circle cx={17} cy={7} r={3} />
                        <path d="M22 18c0-2.7-2.2-5-5-5" />
                      </>
                    )}
                  </svg>
                </span>
                <div style={{ flex: 1, lineHeight: 1.3 }}>
                  <div style={{ fontSize: 12.5 }}>{a.label}</div>
                  <div className="muted" style={{ fontSize: 11 }}>
                    {a.meta}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
