"use client";

import { useEffect, useState } from "react";
import { adminApi, type SearchStats } from "../../../services/adminApi";
import { getCatalogStatus, getCatalogFacets, type CatalogStatus, type CatalogFacets } from "../../../services/searchApi";
import { tenantsApi, type ApiTenant } from "../../../services/api";
import { notify } from "../_toast";

export default function AnalyticsPage() {
  const [stats, setStats] = useState<SearchStats | null>(null);
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus | null>(null);
  const [facets, setFacets] = useState<CatalogFacets | null>(null);
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const [s, cs, f, t] = await Promise.allSettled([
          adminApi.getSearchStats(),
          getCatalogStatus(),
          getCatalogFacets(),
          tenantsApi.getAll(),
        ]);
        if (s.status === "fulfilled") setStats(s.value);
        if (cs.status === "fulfilled") setCatalogStatus(cs.value);
        if (f.status === "fulfilled") setFacets(f.value);
        if (t.status === "fulfilled") setTenants(t.value);
      } catch { notify("Erro ao carregar dados", "error"); }
      finally { setLoading(false); }
    }
    load();
  }, []);

  const storeNames = catalogStatus?.stores ? Object.keys(catalogStatus.stores) : [];

  return (
    <div className="pg">
      <div className="pg-head">
        <div><h1>Analytics</h1><p>Métricas de uso · todos os tenants</p></div>
        <div className="pg-actions">
          <button className="btn" onClick={() => notify("Exportação iniciada")}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 3v13M6 12l6 6 6-6M4 21h16"/></svg>
            Exportar
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label"><span>Cache backend</span></div>
          <div className="kpi-value mono" style={{ fontSize: 22 }}>{stats?.cache_backend || "—"}</div>
          <div className="kpi-foot"><span className="muted" style={{ fontSize: 11 }}>TTL: {stats?.cache_ttl_seconds || "—"}s</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label" style={{ color: "var(--info)" }}><span>Tempo médio scraper</span></div>
          <div className="kpi-value mono" style={{ color: "var(--info)", fontSize: 22 }}>{stats?.scraper_avg_seconds != null ? `${stats.scraper_avg_seconds.toFixed(1)}s` : "—"}</div>
          <div className="kpi-foot"><span className="muted" style={{ fontSize: 11 }}>por scraper</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label" style={{ color: "var(--ok)" }}><span>Lojas indexadas</span></div>
          <div className="kpi-value mono" style={{ color: "var(--ok)" }}>{storeNames.length}</div>
          <div className="kpi-foot"><span className="muted" style={{ fontSize: 11 }}>{catalogStatus?.totalProducts?.toLocaleString("pt-BR") || 0} produtos</span></div>
        </div>
        <div className="kpi">
          <div className="kpi-label" style={{ color: "var(--warn)" }}><span>Tenants</span></div>
          <div className="kpi-value mono" style={{ color: "var(--warn)" }}>{tenants.length}</div>
          <div className="kpi-foot"><span className="muted" style={{ fontSize: 11 }}>{tenants.filter(t => t.isActive).length} ativos</span></div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="grid-cards-3">
        <div className="card">
          <div className="card-h"><h3>Tenants</h3></div>
          <div style={{ padding: "8px 14px 14px" }}>
            {tenants.slice(0, 10).map((t, i) => {
              const color = t.settings?.primary_color || "#6d3df0";
              return (
                <div key={t.id} style={{ padding: "7px 0", borderBottom: i < Math.min(tenants.length, 10) - 1 ? "1px solid var(--line)" : "none" }}>
                  <div className="row" style={{ justifyContent: "space-between" }}>
                    <span className="row" style={{ gap: 8 }}>
                      <span className="tenant-mark" style={{ "--mc": color, width: 20, height: 20, fontSize: 9 } as React.CSSProperties}>{(t.settings?.app_name || t.name).charAt(0)}</span>
                      <span style={{ fontSize: 12.5 }}>{t.settings?.app_name || t.name}</span>
                    </span>
                    <span className="chip" style={{ fontSize: 10 }}>{t.plan}</span>
                  </div>
                </div>
              );
            })}
            {tenants.length === 0 && <div className="empty">Nenhum tenant</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Categorias</h3><span className="muted" style={{ fontSize: 11 }}>Catálogo</span></div>
          <div style={{ padding: "8px 14px 14px" }}>
            {(facets?.categories ?? []).slice(0, 10).map((x, i) => {
              const max = Math.max(...(facets?.categories ?? []).map(c => c.count), 1);
              return (
                <div key={x.name} style={{ padding: "7px 0", borderBottom: i < 9 ? "1px solid var(--line)" : "none" }}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5 }}>{x.name}</span>
                    <span className="mono" style={{ fontSize: 11.5 }}>{x.count.toLocaleString("pt-BR")}</span>
                  </div>
                  <div style={{ height: 3, background: "var(--surface-3)", borderRadius: 2 }}>
                    <div style={{ width: `${(x.count / max) * 100}%`, height: "100%", background: "var(--accent)" }} />
                  </div>
                </div>
              );
            })}
            {(!facets?.categories || facets.categories.length === 0) && <div className="empty">Nenhuma categoria</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-h"><h3>Marcas</h3><span className="muted" style={{ fontSize: 11 }}>Catálogo</span></div>
          <div style={{ padding: "8px 14px 14px" }}>
            {(facets?.brands ?? []).slice(0, 10).map((x, i) => {
              const max = Math.max(...(facets?.brands ?? []).map(b => b.count), 1);
              return (
                <div key={x.name} style={{ padding: "7px 0", borderBottom: i < 9 ? "1px solid var(--line)" : "none" }}>
                  <div className="row" style={{ justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 12.5 }}>{x.name}</span>
                    <span className="mono" style={{ fontSize: 11.5 }}>{x.count.toLocaleString("pt-BR")}</span>
                  </div>
                  <div style={{ height: 3, background: "var(--surface-3)", borderRadius: 2 }}>
                    <div style={{ width: `${(x.count / max) * 100}%`, height: "100%", background: "var(--ok)" }} />
                  </div>
                </div>
              );
            })}
            {(!facets?.brands || facets.brands.length === 0) && <div className="empty">Nenhuma marca</div>}
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        <div className="card-h"><h3>Disponibilidade</h3><span className="muted" style={{ fontSize: 11 }}>Estados de estoque</span></div>
        <table className="tbl">
          <thead><tr><th>Estado</th><th>Produtos</th></tr></thead>
          <tbody>
            {(facets?.availability ?? []).map(a => (
              <tr key={a.name}>
                <td><span className="chip">{a.name}</span></td>
                <td className="mono">{a.count.toLocaleString("pt-BR")}</td>
              </tr>
            ))}
            {(!facets?.availability || facets.availability.length === 0) && (
              <tr><td colSpan={2}><div className="empty">Nenhum dado de disponibilidade</div></td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
