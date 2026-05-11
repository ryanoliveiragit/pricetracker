"use client";

import { useEffect, useState } from "react";
import { suppliersApi, type ApiSupplier } from "../../../services/api";
import { adminApi } from "../../../services/adminApi";
import { notify } from "../_toast";

export default function SuppliersPage() {
  const [suppliers, setSuppliers] = useState<ApiSupplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setSuppliers(await suppliersApi.getAll());
    } catch { notify("Erro ao carregar fornecedores", "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(supplier: ApiSupplier) {
    try {
      const updated = await suppliersApi.update(supplier.id, { isActive: !supplier.isActive });
      setSuppliers(prev => prev.map(s => s.id === updated.id ? updated : s));
      notify(`Fornecedor ${updated.isActive ? "ativado" : "desativado"}`);
    } catch { notify("Erro ao atualizar", "error"); }
  }

  async function handleDelete(supplier: ApiSupplier) {
    if (!confirm(`Remover "${supplier.name}" permanentemente?`)) return;
    try {
      await suppliersApi.delete(supplier.id);
      setSuppliers(prev => prev.filter(s => s.id !== supplier.id));
      notify("Fornecedor removido");
    } catch { notify("Erro ao remover", "error"); }
  }

  async function handleReseed() {
    try {
      const res = await adminApi.reseedSuppliers();
      notify(`${res.suppliers_recreated} fornecedores recriados`);
      load();
    } catch { notify("Erro ao recriar fornecedores", "error"); }
  }

  const missingCreds = suppliers.filter(s => s.requiresLogin && !s.password);

  return (
    <div className="pg">
      <div className="pg-head">
        <div><h1>Fornecedores</h1><p>Catálogo global de fornecedores · {suppliers.length} cadastrados</p></div>
        <div className="pg-actions">
          <button className="btn" onClick={handleReseed}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 12a9 9 0 0 1 15.5-6.3L21 8M21 4v4h-4M21 12a9 9 0 0 1-15.5 6.3L3 16M3 20v-4h4"/></svg>
            Re-seed fornecedores
          </button>
          <button className="btn btn-accent" onClick={() => setEditingId("new")}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 5v14M5 12h14"/></svg>
            Novo fornecedor
          </button>
        </div>
      </div>

      <div className="kpi-row">
        <div className="kpi">
          <div className="kpi-label"><svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 7h11v9H3z"/><path d="M14 10h4l3 3v3h-7"/><circle cx={7} cy={18} r={2}/><circle cx={17} cy={18} r={2}/></svg><span>Total</span></div>
          <div className="kpi-value mono">{suppliers.length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><span>Ativos</span></div>
          <div className="kpi-value mono">{suppliers.filter(s => s.isActive).length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><span>Com login</span></div>
          <div className="kpi-value mono" style={{ color: "var(--warn)" }}>{suppliers.filter(s => s.requiresLogin).length}</div>
        </div>
        <div className="kpi">
          <div className="kpi-label"><span>Inativos</span></div>
          <div className="kpi-value mono" style={{ color: "var(--err)" }}>{suppliers.filter(s => !s.isActive).length}</div>
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#6d3df0] border-t-transparent" />
          </div>
        ) : (
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead><tr><th>Fornecedor</th><th>Tipo</th><th>Região</th><th>Status</th><th>Criado</th><th /></tr></thead>
              <tbody>
                {suppliers.map(s => (
                  <tr key={s.id}>
                    <td>
                      <div className="cell-tenant">
                        <span className="tenant-mark" style={{ "--mc": "var(--text-2)", width: 26, height: 26, fontSize: 11, background: "var(--surface-3)", color: "var(--text-2)" } as React.CSSProperties}>{s.name.charAt(0)}</span>
                        <div className="cell-meta"><b>{s.name}</b><span className="mono">{s.url?.replace(/https?:\/\//, "").replace(/\/.*/, "")}</span></div>
                      </div>
                    </td>
                    <td><span className={`chip ${s.requiresLogin ? "" : "info"}`}>{s.requiresLogin ? "selenium" : "api"}</span></td>
                    <td className="muted" style={{ fontSize: 12 }}>{s.region || "—"}</td>
                    <td>
                      <button onClick={() => handleToggle(s)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                        {s.isActive ? <span className="chip ok"><span className="dot" />Ativo</span> : <span className="chip err"><span className="dot" />Inativo</span>}
                      </button>
                    </td>
                    <td className="muted" style={{ fontSize: 11.5 }}>{s.createdAt ? new Date(s.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}</td>
                    <td><div className="row" style={{ justifyContent: "flex-end", gap: 2 }}>
                      <button className="btn icon btn-ghost" title="Editar" onClick={() => { setEditingId(s.id); notify(`Editar ${s.name} — em breve`); }}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M16 3l5 5L8 21H3v-5z"/></svg>
                      </button>
                      <button className="btn icon btn-ghost" title="Remover" onClick={() => handleDelete(s)}>
                        <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </button>
                    </div></td>
                  </tr>
                ))}
                {suppliers.length === 0 && (
                  <tr><td colSpan={6}><div className="empty">Nenhum fornecedor encontrado</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {missingCreds.length > 0 && (
        <div style={{ marginTop: 14, padding: "12px 14px", background: "var(--err-soft)", border: "1px solid color-mix(in oklab, var(--err) 25%, transparent)", borderRadius: 10, display: "flex", gap: 10, alignItems: "flex-start" }}>
          <span style={{ color: "var(--err)" }}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M10.3 3.4 1.8 17.5a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.4a2 2 0 0 0-3.4 0z"/><path d="M12 9v4M12 17v.01"/></svg>
          </span>
          <div style={{ flex: 1, fontSize: 12.5 }}>
            <div style={{ fontWeight: 600, color: "var(--err)" }}>{missingCreds.length} fornecedor(es) sem credenciais</div>
            <div className="muted" style={{ marginTop: 2 }}>Configure usuário e senha para permitir scraping.</div>
          </div>
          <button className="btn sm" onClick={() => notify("Redirecionando para configuração")}>Configurar</button>
        </div>
      )}
    </div>
  );
}
