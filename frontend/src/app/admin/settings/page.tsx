"use client";

import { useState } from "react";
import { adminApi } from "../../../services/adminApi";
import { notify } from "../_toast";

function Toggle({ on: initial }: { on?: boolean }) {
  const [v, setV] = useState(initial ?? false);
  return (
    <button onClick={() => setV(!v)} style={{ width: 36, height: 20, borderRadius: 999, background: v ? "var(--accent)" : "var(--surface-3)", border: 0, position: "relative", cursor: "pointer" }}>
      <span style={{ position: "absolute", top: 2, left: v ? 18 : 2, width: 16, height: 16, background: "white", borderRadius: 999, transition: "left .15s", boxShadow: "0 1px 2px rgba(0,0,0,.2)" }} />
    </button>
  );
}

function SettingRow({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "200px 1fr", gap: 24, alignItems: "flex-start" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 500 }}>{label}</div>
        {hint && <div className="muted" style={{ fontSize: 11.5, marginTop: 2 }}>{hint}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

const SECTIONS = [
  ["general", "Geral"],
  ["scraping", "Scraping"],
  ["ai", "IA & Auto-fix"],
  ["cache", "Cache & Redis"],
  ["roles", "Roles & RBAC"],
  ["smtp", "E-mail (SMTP)"],
  ["env", "Variáveis"],
] as const;

const SECTION_TITLES: Record<string, string> = {
  general: "Configurações gerais",
  scraping: "Scraping",
  ai: "IA & Auto-fix",
  cache: "Cache & Redis",
  roles: "Roles & RBAC",
  smtp: "E-mail (SMTP)",
  env: "Variáveis de ambiente",
};

export default function SettingsPage() {
  const [tab, setTab] = useState("general");

  async function handleClearCache() {
    try {
      const res = await adminApi.clearSearchCache();
      notify(`Cache limpo (${res.entries_removed} entradas)`);
    } catch { notify("Erro ao limpar cache", "error"); }
  }

  async function handleReseedSuppliers() {
    try {
      const res = await adminApi.reseedSuppliers();
      notify(`${res.suppliers_recreated} fornecedores recriados`);
    } catch { notify("Erro ao recriar fornecedores", "error"); }
  }

  return (
    <div className="pg">
      <div className="pg-head">
        <div><h1>Configurações</h1><p>Configurações da plataforma</p></div>
      </div>

      <div style={{ display: "flex", gap: 24, alignItems: "flex-start", flexWrap: "wrap" }}>
        <div style={{ width: 200, flexShrink: 0, position: "sticky", top: 70 }}>
          {SECTIONS.map(([k, l]) => (
            <button key={k} className="sb-item" aria-current={tab === k ? "page" : undefined} onClick={() => setTab(k)} style={{ margin: "1px 0" }}>
              <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}>
                {k === "general" ? <><circle cx={12} cy={12} r={3}/><path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1"/></> :
                 k === "scraping" ? <><rect x={4} y={7} width={16} height={12} rx={2}/><circle cx={9} cy={13} r={1}/><circle cx={15} cy={13} r={1}/><path d="M12 7V3M9 19v2M15 19v2"/></> :
                 k === "ai" ? <><path d="M13 2L3 14h7l-1 8 10-12h-7z"/></> :
                 k === "cache" ? <><ellipse cx={12} cy={5} rx={9} ry={3}/><path d="M3 5v14a9 3 0 0 0 18 0V5M3 12a9 3 0 0 0 18 0"/></> :
                 k === "roles" ? <><path d="M12 3l8 4v5c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V7z"/></> :
                 k === "smtp" ? <><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16zM10 20a2 2 0 0 0 4 0"/></> :
                 <><path d="M12 2 2 7l10 5 10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/></>}
              </svg>
              <span>{l}</span>
            </button>
          ))}
        </div>

        <div className="card" style={{ flex: 1, minWidth: 0 }}>
          <div className="card-h"><h3>{SECTION_TITLES[tab]}</h3></div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 18 }}>
            {tab === "general" && <>
              <SettingRow label="Nome da plataforma" hint="Aparece no e-mail e no painel.">
                <div className="inp" style={{ maxWidth: 320 }}><input defaultValue="ConstruPrice" /></div>
              </SettingRow>
              <SettingRow label="URL canônica" hint="Usado para gerar links absolutos.">
                <div className="inp" style={{ maxWidth: 320 }}><input defaultValue="https://construprice.app" /></div>
              </SettingRow>
              <SettingRow label="Timezone padrão">
                <select className="btn" style={{ width: 200 }}><option>America/Sao_Paulo</option><option>UTC</option></select>
              </SettingRow>
            </>}
            {tab === "scraping" && <>
              <SettingRow label="Intervalo padrão" hint="Frequência base de execução por scraper."><div className="inp" style={{ maxWidth: 200 }}><input defaultValue="15 minutos" /></div></SettingRow>
              <SettingRow label="Max workers paralelos"><div className="inp" style={{ maxWidth: 120 }}><input className="mono" defaultValue="8" /></div></SettingRow>
              <SettingRow label="Timeout por scrape"><div className="inp" style={{ maxWidth: 120 }}><input className="mono" defaultValue="120s" /></div></SettingRow>
              <SettingRow label="Retry em falha" hint="Tentativas antes de marcar como falhado."><div className="inp" style={{ maxWidth: 120 }}><input className="mono" defaultValue="3" /></div></SettingRow>
              <SettingRow label="Re-seed fornecedores" hint="Recria fornecedores com credenciais padrão.">
                <button className="btn btn-danger" onClick={handleReseedSuppliers}>
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 4v4h-4M21 12a9 9 0 0 1-15.5 6.3L3 16M3 20v-4h4"/></svg>
                  Recriar fornecedores
                </button>
              </SettingRow>
            </>}
            {tab === "ai" && <>
              <SettingRow label="Modelo LLM"><select className="btn" style={{ width: 240 }}><option>claude-haiku-4-5</option><option>claude-sonnet-4</option><option>gpt-4o-mini</option></select></SettingRow>
              <SettingRow label="Temperature"><div className="inp" style={{ maxWidth: 120 }}><input className="mono" defaultValue="0.2" /></div></SettingRow>
              <SettingRow label="Auto-aprovar fixes triviais" hint="Ex: typos, copy changes."><Toggle on={false} /></SettingRow>
              <SettingRow label="Prompt template" hint="Template usado para transcrever feedbacks.">
                <textarea className="code" style={{ width: "100%", minHeight: 110 }} defaultValue={`Você é um agente de auto-fix.\nO usuário reportou: {{report}}\nProponha o menor diff possível que resolve o problema.`} />
              </SettingRow>
            </>}
            {tab === "cache" && <>
              <SettingRow label="Redis URL"><div className="inp" style={{ maxWidth: 360 }}><input className="mono" defaultValue="redis://default:****@redis-prod.aws/0" /></div></SettingRow>
              <SettingRow label="Limpar cache" hint="Remove todas as chaves do cache de busca. Operação irreversível.">
                <button className="btn btn-danger" onClick={handleClearCache}>
                  <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                  Limpar cache de busca
                </button>
              </SettingRow>
            </>}
            {tab === "roles" && <>
              <SettingRow label="super_admin" hint="Acesso total à plataforma."><span className="chip accent">2 usuários</span></SettingRow>
              <SettingRow label="admin" hint="Admin de tenant."><span className="chip">3 usuários</span></SettingRow>
              <SettingRow label="user" hint="Usuário regular."><span className="chip">3 usuários</span></SettingRow>
              <SettingRow label="buyer" hint="Pode aprovar cotações."><span className="chip">2 usuários</span></SettingRow>
              <SettingRow label="viewer" hint="Apenas leitura."><span className="chip">1 usuário</span></SettingRow>
            </>}
            {tab === "smtp" && <>
              <SettingRow label="Host"><div className="inp" style={{ maxWidth: 280 }}><input className="mono" defaultValue="smtp.sendgrid.net" /></div></SettingRow>
              <SettingRow label="Porta"><div className="inp" style={{ maxWidth: 100 }}><input className="mono" defaultValue="587" /></div></SettingRow>
              <SettingRow label="From"><div className="inp" style={{ maxWidth: 280 }}><input className="mono" defaultValue="no-reply@construprice.app" /></div></SettingRow>
              <SettingRow label="Testar configuração"><button className="btn" onClick={() => notify("E-mail de teste enviado")}>
                <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M18 16v-5a6 6 0 1 0-12 0v5l-2 2h16zM10 20a2 2 0 0 0 4 0"/></svg>
                Enviar e-mail de teste
              </button></SettingRow>
            </>}
            {tab === "env" && <>
              <div className="muted" style={{ fontSize: 12 }}>Variáveis de ambiente (somente leitura)</div>
              <pre className="code">{`DATABASE_URL=postgresql://****@db.prod/construprice
REDIS_URL=redis://****@redis-prod/0
ANTHROPIC_API_KEY=****
SMTP_HOST=smtp.sendgrid.net
NODE_ENV=production
SCRAPER_MAX_WORKERS=8
SCRAPER_INTERVAL_MIN=15`}</pre>
            </>}
          </div>
        </div>
      </div>
    </div>
  );
}
