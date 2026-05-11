"use client";

import { useEffect, useState } from "react";
import { usersApi, type ApiUser } from "../../../services/usersApi";
import { tenantsApi, type ApiTenant } from "../../../services/api";
import { notify } from "../_toast";

export default function UsersPage() {
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tenantFilter, setTenantFilter] = useState("all");
  const [roleFilter, setRoleFilter] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [u, t] = await Promise.all([usersApi.getAll(), tenantsApi.getAll()]);
      setUsers(u);
      setTenants(t);
    } catch { notify("Erro ao carregar dados", "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  const items = users.filter(u => {
    if (tenantFilter !== "all" && String(u.tenant_id) !== tenantFilter) return false;
    if (roleFilter !== "all" && u.role !== roleFilter) return false;
    if (q && !u.nome.toLowerCase().includes(q.toLowerCase()) && !u.email.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const tenantMap = new Map(tenants.map(t => [t.id, t]));

  async function handleToggle(u: ApiUser) {
    try {
      const updated = await usersApi.toggleStatus(u.id);
      setUsers(prev => prev.map(x => x.id === updated.id ? updated : x));
      notify(`Usuário ${updated.is_active ? "ativado" : "desativado"}`);
    } catch { notify("Erro ao alterar status", "error"); }
  }

  async function handleDelete(u: ApiUser) {
    if (!confirm(`Remover "${u.nome}" permanentemente?`)) return;
    try {
      await usersApi.delete(u.id);
      setUsers(prev => prev.filter(x => x.id !== u.id));
      notify("Usuário removido");
    } catch { notify("Erro ao remover", "error"); }
  }

  return (
    <div className="pg">
      <div className="pg-head">
        <div><h1>Usuários</h1><p>Visão global · {users.length} usuários · {users.filter(u => u.is_active).length} ativos</p></div>
        <div className="pg-actions">
          <button className="btn" onClick={() => notify("Exportação iniciada")}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 3v13M6 12l6 6 6-6M4 21h16"/></svg>
            Exportar
          </button>
          <button className="btn btn-accent" onClick={() => setShowCreate(true)}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 5v14M5 12h14"/></svg>
            Novo usuário
          </button>
        </div>
      </div>

      <div className="card">
        <div className="toolbar">
          <div className="inp" style={{ flex: 1, maxWidth: 320 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx={11} cy={11} r={7}/><path d="M21 21l-4.3-4.3"/></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar nome ou e-mail…" />
          </div>
          <select value={tenantFilter} onChange={e => setTenantFilter(e.target.value)} className="btn sm" style={{ minWidth: 140 }}>
            <option value="all">Todos tenants</option>
            {tenants.map(t => <option key={t.id} value={t.id}>{t.settings.app_name || t.name}</option>)}
          </select>
          <select value={roleFilter} onChange={e => setRoleFilter(e.target.value)} className="btn sm" style={{ minWidth: 110 }}>
            <option value="all">Todas roles</option>
            <option value="super_admin">super_admin</option>
            <option value="admin">admin</option>
            <option value="gestor">gestor</option>
            <option value="usuario">usuario</option>
            <option value="funcionario">funcionario</option>
          </select>
          <div style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 11.5 }}>{items.length} de {users.length}</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#6d3df0] border-t-transparent" />
          </div>
        ) : (
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead><tr><th style={{ width: 32 }}><input type="checkbox" /></th><th>Usuário</th><th>Tenant</th><th>Role</th><th>Status</th><th>Criado</th><th /></tr></thead>
              <tbody>
                {items.map(u => {
                  const t = tenantMap.get(u.tenant_id?.toString() ?? "");
                  const color = t?.settings?.primary_color || "#6d3df0";
                  return (
                    <tr key={u.id}>
                      <td><input type="checkbox" /></td>
                      <td>
                        <div className="cell-tenant">
                          <span className="tenant-mark" style={{ "--mc": color, width: 26, height: 26, fontSize: 11, borderRadius: 999 } as React.CSSProperties}>{u.nome.charAt(0).toUpperCase()}</span>
                          <div className="cell-meta"><b>{u.nome}</b><span>{u.email}</span></div>
                        </div>
                      </td>
                      <td>
                        {t ? (
                          <div className="row" style={{ gap: 6 }}>
                            <span className="tenant-mark" style={{ "--mc": t.settings?.primary_color || "#6d3df0", width: 18, height: 18, fontSize: 9 } as React.CSSProperties}>{(t.settings?.app_name || t.name).charAt(0)}</span>
                            <span className="mono" style={{ fontSize: 11.5 }}>{t.slug}</span>
                          </div>
                        ) : <span className="muted">—</span>}
                      </td>
                      <td><span className={`chip ${u.role === "admin" || u.role === "super_admin" ? "accent" : ""}`}>{u.role}</span></td>
                      <td>
                        <button onClick={() => handleToggle(u)} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                          {u.is_active ? <span className="chip ok"><span className="dot" />Ativo</span> : <span className="chip err"><span className="dot" />Inativo</span>}
                        </button>
                      </td>
                      <td className="muted" style={{ fontSize: 11.5 }}>{u.created_at ? new Date(u.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }) : "—"}</td>
                      <td><div className="row" style={{ justifyContent: "flex-end", gap: 2 }}>
                        <button className="btn icon btn-ghost" title="Ver" onClick={() => notify(`Perfil de ${u.nome}`)}>
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12z"/><circle cx={12} cy={12} r={3}/></svg>
                        </button>
                        <button className="btn icon btn-ghost" title="Remover" onClick={() => handleDelete(u)}>
                          <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                        </button>
                      </div></td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={7}><div className="empty">Nenhum usuário encontrado</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateUserModal tenants={tenants} onClose={() => setShowCreate(false)} onCreated={() => { setShowCreate(false); load(); }} />}
    </div>
  );
}

function CreateUserModal({ tenants, onClose, onCreated }: { tenants: ApiTenant[]; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nome: "", email: "", password: "", role: "funcionario", tenant_id: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setLoading(true); setErr(null);
    try {
      if (form.tenant_id) {
        const { tenantsApi } = await import("../../../services/api");
        await tenantsApi.createAdmin(form.tenant_id, { nome: form.nome, email: form.email, password: form.password });
      } else {
        await usersApi.create({ nome: form.nome, email: form.email, password: form.password, role: form.role });
      }
      onCreated();
      notify("Usuário criado");
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro ao criar"); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-h"><h2>Novo usuário</h2>
          <button className="btn icon btn-ghost" onClick={onClose}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          {err && <div style={{ marginBottom: 14, padding: "8px 12px", background: "var(--err-soft)", border: "1px solid color-mix(in oklab, var(--err) 25%, transparent)", borderRadius: 8, fontSize: 12.5, color: "var(--err)" }}>{err}</div>}
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Nome</label>
            <div className="inp"><input value={form.nome} onChange={e => setForm({...form, nome: e.target.value})} placeholder="Nome completo" /></div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>E-mail</label>
            <div className="inp"><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="email@exemplo.com" /></div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Senha</label>
            <div className="inp"><input value={form.password} onChange={e => setForm({...form, password: e.target.value})} type="password" placeholder="••••••" /></div>
          </div>
          <div className="grid-2" style={{ marginBottom: 12 }}>
            <div className="field">
              <label>Role</label>
              <select value={form.role} onChange={e => setForm({...form, role: e.target.value})} className="btn" style={{ width: "100%", height: 34, fontSize: 12.5 }}>
                <option value="funcionario">funcionario</option>
                <option value="usuario">usuario</option>
                <option value="admin">admin</option>
                <option value="gestor">gestor</option>
              </select>
            </div>
            <div className="field">
              <label>Tenant (opcional)</label>
              <select value={form.tenant_id} onChange={e => setForm({...form, tenant_id: e.target.value})} className="btn" style={{ width: "100%", height: 34, fontSize: 12.5 }}>
                <option value="">Sem tenant (admin)</option>
                {tenants.map(t => <option key={t.id} value={t.id}>{t.settings.app_name || t.name}</option>)}
              </select>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={submit} disabled={loading}>{loading ? "Criando..." : "Criar"}</button>
        </div>
      </div>
    </div>
  );
}
