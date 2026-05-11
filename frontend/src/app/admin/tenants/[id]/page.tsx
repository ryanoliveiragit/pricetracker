"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { tenantsApi, type ApiTenant } from "../../../../services/api";
import { usersApi, type ApiUser } from "../../../../services/usersApi";
import { notify } from "../../_toast";

function Sparkline({ data, color = "var(--accent)", height = 28 }: { data: number[]; color?: string; height?: number }) {
  if (!data?.length) return null;
  const w = 200, h = height, p = 2;
  const min = Math.min(...data), max = Math.max(...data);
  const r = Math.max(max - min, 1);
  const pts = data.map((v, i) => {
    const x = p + (i / (data.length - 1)) * (w - p * 2);
    const y = p + (1 - (v - min) / r) * (h - p * 2);
    return [x, y];
  });
  const d = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(" ");
  return (
    <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="spark">
      <path d={d} fill="none" stroke={color} strokeWidth={1.2} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

export default function TenantDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [tenant, setTenant] = useState<ApiTenant | null>(null);
  const [users, setUsers] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editName, setEditName] = useState("");
  const [editPlan, setEditPlan] = useState("");
  const [saving, setSaving] = useState(false);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [editColor, setEditColor] = useState("");
  const [editAppName, setEditAppName] = useState("");
  const [editLogoUrl, setEditLogoUrl] = useState("");

  async function load() {
    setLoading(true);
    try {
      const [allTenants, allUsers] = await Promise.all([tenantsApi.getAll(), usersApi.getAll()]);
      const t = allTenants.find(x => x.id === id);
      if (t) {
        setTenant(t);
        setEditName(t.name);
        setEditPlan(t.plan);
        setEditColor(t.settings?.primary_color || "#6d3df0");
        setEditAppName(t.settings?.app_name || "");
        setEditLogoUrl(t.settings?.logo_url || "");
      }
      setUsers(allUsers.filter(u => u.tenant_id?.toString() === id));
    } catch { notify("Erro ao carregar dados", "error"); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, [id]);

  async function handleSave() {
    if (!tenant) return;
    setSaving(true);
    try {
      const updated = await tenantsApi.update(tenant.id, {
        name: editName, plan: editPlan,
        settings: { ...(tenant.settings ?? {}), primary_color: editColor, app_name: editAppName, logo_url: editLogoUrl },
      });
      setTenant(updated);
      notify("Tenant atualizado");
    } catch { notify("Erro ao salvar", "error"); }
    finally { setSaving(false); }
  }

  async function handleToggleActive() {
    if (!tenant) return;
    try {
      const updated = await tenantsApi.update(tenant.id, { isActive: !tenant.isActive });
      setTenant(updated);
      notify(`Tenant ${updated.isActive ? "ativado" : "desativado"}`);
    } catch { notify("Erro ao atualizar", "error"); }
  }

  async function handleDelete() {
    if (!tenant) return;
    if (!confirm(`Remover "${tenant.name}" permanentemente? Todos os dados serão perdidos.`)) return;
    try {
      await tenantsApi.delete(tenant.id);
      notify("Tenant removido");
      router.push("/admin/tenants");
    } catch { notify("Erro ao remover", "error"); }
  }

  if (loading) {
    return (
      <div className="pg">
        <div className="flex items-center justify-center py-20">
          <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#6d3df0] border-t-transparent" />
        </div>
      </div>
    );
  }

  if (!tenant) {
    return (
      <div className="pg">
        <div className="card"><div className="empty">Tenant não encontrado</div></div>
      </div>
    );
  }

  const color = tenant.settings?.primary_color || "#6d3df0";

  return (
    <div className="pg">
      <div className="pg-head">
        <div className="row" style={{ gap: 14, alignItems: "center" }}>
          <button className="btn icon btn-ghost" onClick={() => router.back()}>
            <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          <span className="tenant-mark" style={{ "--mc": color, width: 40, height: 40, fontSize: 18 } as React.CSSProperties}>{(tenant.settings?.app_name || tenant.name).charAt(0)}</span>
          <div>
            <h1 style={{ margin: 0 }}>{tenant.settings?.app_name || tenant.name}</h1>
            <p className="muted" style={{ fontSize: 12.5, marginTop: 2 }}>{tenant.slug}.construprice.app · <span className={`chip plan-${tenant.plan}`}>{tenant.plan}</span></p>
          </div>
          <div style={{ flex: 1 }} />
          {tenant.isActive ? <span className="chip ok"><span className="dot" />Ativo</span> : <span className="chip err"><span className="dot" />Inativo</span>}
        </div>
      </div>

      <div className="grid-cards">
        <div className="card">
          <div className="card-h"><h3>Informações</h3></div>
          <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 16 }}>
            <div className="field">
              <label>Nome da empresa</label>
              <div className="inp"><input value={editName} onChange={e => setEditName(e.target.value)} /></div>
            </div>
            <div className="field">
              <label>Slug</label>
              <div className="inp"><input value={tenant.slug} disabled className="mono" /></div>
            </div>
            <div className="field">
              <label>Plano</label>
              <div className="row" style={{ gap: 6, flexWrap: "wrap" }}>
                {["free", "pro", "enterprise"].map(p => (
                  <button key={p} onClick={() => setEditPlan(p)}
                    className={`chip plan-${p}`}
                    style={{ padding: "6px 12px", border: editPlan === p ? "1.5px solid currentColor" : "1px solid var(--line)", cursor: "pointer", background: editPlan === p ? "var(--surface)" : "transparent" }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Cor primária</label>
              <div className="row" style={{ gap: 6 }}>
                {["#6d3df0", "#1f6cc7", "#1a8e5c", "#c23131", "#ea580c", "#0891b2"].map(c => (
                  <button key={c} onClick={() => setEditColor(c)} style={{ width: 28, height: 28, background: c, borderRadius: 6, border: editColor === c ? "2px solid var(--text)" : "1px solid var(--line)", cursor: "pointer" }} />
                ))}
              </div>
            </div>
            <div className="row" style={{ gap: 8, marginTop: 8, flexWrap: "wrap" }}>
              <button className="btn btn-accent" onClick={handleSave} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</button>
              <button className="btn" onClick={handleToggleActive}>{tenant.isActive ? "Desativar" : "Ativar"}</button>
              <div style={{ flex: 1 }} />
              <button className="btn btn-danger" onClick={handleDelete}>
                <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                Remover
              </button>
            </div>
          </div>
        </div>

        <div className="card">
          <div className="card-h">
            <h3>Usuários</h3>
            <button className="btn sm" onClick={() => setShowCreateUser(true)}>
              <svg width={11} height={11} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 5v14M5 12h14"/></svg>
              Novo
            </button>
          </div>
          {users.length === 0 ? (
            <div style={{ padding: "0 14px 14px" }}><div className="empty">Nenhum usuário</div></div>
          ) : (
            <div className="tbl-wrapper" style={{ padding: "0 0 4px" }}>
              <table className="tbl" style={{ minWidth: 420 }}>
                <thead>
                  <tr>
                    <th>Usuário</th>
                    <th>Função</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {users.slice(0, 8).map(u => (
                    <tr key={u.id}>
                      <td>
                        <div className="cell-tenant">
                          <span className="tenant-mark" style={{ "--mc": color, width: 24, height: 24, fontSize: 10, borderRadius: 999 } as React.CSSProperties}>{u.nome.charAt(0).toUpperCase()}</span>
                          <div className="cell-meta"><b style={{ fontSize: 12 }}>{u.nome}</b><span style={{ fontSize: 11 }}>{u.email}</span></div>
                        </div>
                      </td>
                      <td><span className={`chip ${u.role === "admin" ? "accent" : ""}`} style={{ fontSize: 10 }}>{u.role}</span></td>
                      <td>{u.is_active ? <span className="chip ok" style={{ fontSize: 10 }}>Ativo</span> : <span className="chip err" style={{ fontSize: 10 }}>Inativo</span>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <div style={{ height: 16 }} />

      <div className="card">
        <div className="card-h"><h3>Configurações</h3></div>
        <div style={{ padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          <div className="field">
            <label>App name</label>
            <div className="inp" style={{ maxWidth: 320 }}><input value={editAppName} onChange={e => setEditAppName(e.target.value)} placeholder="Nome do app" /></div>
          </div>
          <div className="field">
            <label>Logo URL</label>
            <div className="inp" style={{ maxWidth: 480 }}><input value={editLogoUrl} onChange={e => setEditLogoUrl(e.target.value)} placeholder="https://..." /></div>
          </div>
          <div className="field">
            <label>Criado em</label>
            <div className="muted" style={{ fontSize: 12.5, padding: "6px 0" }}>{new Date(tenant.createdAt).toLocaleString("pt-BR")}</div>
          </div>
        </div>
      </div>

      {showCreateUser && (
        <CreateAdminModal tenant={tenant} onClose={() => setShowCreateUser(false)} onCreated={() => { setShowCreateUser(false); load(); }} />
      )}
    </div>
  );
}

function CreateAdminModal({ tenant, onClose, onCreated }: { tenant: ApiTenant; onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({ nome: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit() {
    setLoading(true); setErr(null);
    try {
      await tenantsApi.createAdmin(tenant.id, form);
      onCreated();
      notify("Administrador criado");
    } catch (e: unknown) { setErr(e instanceof Error ? e.message : "Erro ao criar"); }
    finally { setLoading(false); }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-h"><h2>Novo administrador — {tenant.settings?.app_name || tenant.name}</h2>
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
            <div className="inp"><input value={form.email} onChange={e => setForm({...form, email: e.target.value})} placeholder="admin@exemplo.com" /></div>
          </div>
          <div className="field" style={{ marginBottom: 12 }}>
            <label>Senha</label>
            <div className="inp"><input value={form.password} onChange={e => setForm({...form, password: e.target.value})} type="password" placeholder="••••••" /></div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={submit} disabled={loading}>{loading ? "Criando..." : "Criar admin"}</button>
        </div>
      </div>
    </div>
  );
}
