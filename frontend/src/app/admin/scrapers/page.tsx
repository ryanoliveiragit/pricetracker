"use client";

import { useEffect, useState } from "react";
import { adminApi, type ScraperSession } from "../../../services/adminApi";
import { getCatalogStatus, triggerCatalogScrape, type CatalogStatus } from "../../../services/searchApi";
import { notify } from "../_toast";

export default function ScrapersPage() {
  const [catalogStatus, setCatalogStatus] = useState<CatalogStatus | null>(null);
  const [sessions, setSessions] = useState<ScraperSession[]>([]);
  const [loading, setLoading] = useState(true);

  async function load() {
    setLoading(true);
    try {
      const [cs, ss] = await Promise.allSettled([
        getCatalogStatus(),
        adminApi.getScraperSessions(),
      ]);
      if (cs.status === "fulfilled") setCatalogStatus(cs.value);
      if (ss.status === "fulfilled") setSessions(ss.value.sessions);
    } catch { notify("Erro ao carregar dados", "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleTriggerScrape() {
    try {
      const res = await triggerCatalogScrape();
      notify(res.message || "Scraping iniciado");
      load();
    } catch { notify("Erro ao iniciar scraping", "error"); }
  }

  async function handleDeleteSession(key: string) {
    try {
      await adminApi.deleteScraperSession(key);
      notify(`Sessão ${key} removida`);
      setSessions(prev => prev.filter(s => s.scraper_key !== key));
    } catch { notify("Erro ao remover sessão", "error"); }
  }

  async function handleClearAllSessions() {
    if (!confirm("Remover todas as sessões? Todos os scrapers farão login novamente.")) return;
    try {
      const res = await adminApi.clearAllSessions();
      notify(`${res.deleted} sessões removidas`);
      load();
    } catch { notify("Erro ao limpar sessões", "error"); }
  }

  const storeList = catalogStatus?.stores ? Object.entries(catalogStatus.stores) : [];
  const healthyCount = storeList.filter(([, info]) => info.age_minutes != null && info.age_minutes < 120).length;
  const failingCount = storeList.filter(([, info]) => info.product_count === 0).length;

  return (
    <div className="pg">
      <div className="pg-head">
        <div><h1>Scrapers</h1><p>Monitoramento em tempo real · {storeList.length} scrapers ativos</p></div>
        <div className="pg-actions">
          <button className="btn" onClick={handleTriggerScrape}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 4v4h-4M21 12a9 9 0 0 1-15.5 6.3L3 16M3 20v-4h4"/></svg>
            Re-executar todos
          </button>
          <button className="btn btn-accent" onClick={handleTriggerScrape}>
            <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M6 4l14 8-14 8z"/></svg>
            Executar agora
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label"><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M5 13l4 4 10-10"/></svg><span>Saudáveis</span></div>
          <div className="kpi-value mono" style={{ color: "var(--ok)" }}>{healthyCount}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M6 4l14 8-14 8z"/></svg><span>Rodando agora</span></div>
          <div className="kpi-value mono" style={{ color: "var(--info)" }}>{catalogStatus?.isScraping ? "1" : "0"}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M10.3 3.4 1.8 17.5a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.4a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17v.01"/></svg><span>Falhando</span></div>
          <div className="kpi-value mono" style={{ color: "var(--err)" }}>{failingCount}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><span>Sessões ativas</span></div>
          <div className="kpi-value mono">{sessions.filter(s => s.state === "active").length}</div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="grid-cards">
        <div className="card">
          <div className="card-h"><h3>Lojas · scraping</h3><span className="muted" style={{ fontSize: 11 }}>Status por loja</span></div>
          <div style={{ padding: 16 }}>
            {loading ? (
              <div className="flex items-center justify-center py-10">
                <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#6d3df0] border-t-transparent" />
              </div>
            ) : storeList.length > 0 ? storeList.map(([name, info]) => {
              const ageOk = info.age_minutes != null && info.age_minutes < 120;
              const hasProducts = (info.product_count ?? 0) > 0;
              return (
                <div key={name} style={{ padding: "8px 0", borderBottom: "1px solid var(--line)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="row" style={{ gap: 8 }}>
                    <span className="dot" style={{ width: 6, height: 6, borderRadius: 999, background: hasProducts && ageOk ? "var(--ok)" : hasProducts ? "var(--warn)" : "var(--err)", display: "inline-block" }} />
                    <span style={{ fontSize: 12.5, fontWeight: 500 }}>{name}</span>
                  </div>
                  <div className="row" style={{ gap: 12 }}>
                    <span className="mono" style={{ fontSize: 11.5 }}>{info.product_count?.toLocaleString("pt-BR") || 0} prod.</span>
                    <span className="muted" style={{ fontSize: 11 }}>{info.age_minutes != null ? `${info.age_minutes} min` : "—"}</span>
                  </div>
                </div>
              );
            }) : <div className="empty">Nenhuma loja encontrada</div>}
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Sessões Selenium</h3>
            <button className="btn icon btn-ghost" title="Limpar todas" onClick={handleClearAllSessions}>
              <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
            </button>
          </div>
          <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
            {sessions.length === 0 && !loading && <div className="empty">Nenhuma sessão ativa</div>}
            {sessions.map(s => (
              <div key={s.scraper_key} className="row" style={{ justifyContent: "space-between" }}>
                <span className="row" style={{ gap: 8 }}>
                  <span className="dot" style={{ width: 6, height: 6, borderRadius: 999, background: s.state === "active" ? "var(--ok)" : s.state === "expired" ? "var(--err)" : "var(--text-3)", display: "inline-block" }} />
                  <span className="mono" style={{ fontSize: 12.5 }}>{s.scraper_key}</span>
                  <span className="muted" style={{ fontSize: 11 }}>{s.state}</span>
                </span>
                <button className="btn icon btn-ghost" title="Remover sessão" onClick={() => handleDeleteSession(s.scraper_key)}>
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M6 6l12 12M18 6L6 18"/></svg>
                </button>
              </div>
            ))}
            {loading && <div className="flex items-center justify-center py-6"><div className="h-4 w-4 animate-spin rounded-full border-2 border-[#6d3df0] border-t-transparent" /></div>}
          </div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        <div className="card-h"><h3>Catálogo</h3></div>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-[#6d3df0] border-t-transparent" />
          </div>
        ) : (
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead><tr><th>Loja</th><th>Produtos</th><th>Último scrape</th><th>Idade</th><th /></tr></thead>
              <tbody>
                {storeList.map(([name, info]) => (
                  <tr key={name}>
                    <td><b>{name}</b></td>
                    <td className="mono">{info.product_count?.toLocaleString("pt-BR") || 0}</td>
                    <td className="muted" style={{ fontSize: 12 }}>{info.last_scraped ? new Date(info.last_scraped).toLocaleString("pt-BR") : "—"}</td>
                    <td><span className={`chip ${info.age_minutes != null && info.age_minutes < 120 ? "ok" : "warn"}`}>{info.age_minutes != null ? `${info.age_minutes} min` : "—"}</span></td>
                    <td><button className="btn icon btn-ghost" title="Ver" onClick={() => notify(`Detalhes: ${name}`)}>
                      <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx={12} cy={12} r={3}/></svg>
                    </button></td>
                  </tr>
                ))}
                {storeList.length === 0 && <tr><td colSpan={5}><div className="empty">Nenhum dado disponível</div></td></tr>}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
