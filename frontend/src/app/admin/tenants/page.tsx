"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { tenantsApi, type ApiTenant } from "../../../services/api";
import { notify } from "../_toast";

// ─── Sparkline ──────────────────────────────────────────────────────
function Sparkline({ data, color = "var(--accent)", height = 22, fill = false, strokeWidth = 1.2 }: {
  data: number[]; color?: string; height?: number; fill?: boolean; strokeWidth?: number;
}) {
  if (!data || !data.length) return null;
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
      <path d={d} fill="none" stroke={color} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function TMark({ tenant, size = 26 }: { tenant: { name: string; app_name?: string; color?: string }; size?: number }) {
  const ch = (tenant.app_name || tenant.name || "?").charAt(0).toUpperCase();
  return <span className="tenant-mark" style={{ "--mc": tenant.color || "#6d3df0", width: size, height: size, fontSize: size * 0.42 } as React.CSSProperties}>{ch}</span>;
}

// ─── Tenants Page ───────────────────────────────────────────────────
export default function TenantsAdminPage() {
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [plan, setPlan] = useState("all");
  const [showCreate, setShowCreate] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setTenants(await tenantsApi.getAll());
    } catch {
      notify("Erro ao carregar tenants", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const items = tenants.filter(t => {
    if (plan !== "all" && t.plan !== plan) return false;
    if (q && !t.name.toLowerCase().includes(q.toLowerCase()) && !t.slug.toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });

  const activeCount = tenants.filter(t => t.isActive).length;
  const payingCount = tenants.filter(t => t.plan !== "free").length;

  async function handleToggle(tenant: ApiTenant) {
    try {
      const updated = await tenantsApi.update(tenant.id, { isActive: !tenant.isActive });
      setTenants(prev => prev.map(t => t.id === updated.id ? updated : t));
      notify(`Tenant ${updated.isActive ? "ativado" : "desativado"}`);
    } catch { notify("Erro ao atualizar tenant", "error"); }
  }

  async function handleDelete(tenant: ApiTenant) {
    if (!confirm(`Remover "${tenant.name}" permanentemente?`)) return;
    try {
      await tenantsApi.delete(tenant.id);
      setTenants(prev => prev.filter(t => t.id !== tenant.id));
      notify("Tenant removido");
    } catch { notify("Erro ao remover tenant", "error"); }
  }

  return (
    <div className="pg">
      <div className="pg-head">
        <div>
          <h1>Tenants</h1>
          <p>{tenants.length} clientes · {activeCount} ativos · {payingCount} pagantes</p>
        </div>
        <div className="pg-actions">
          <button className="btn" onClick={() => notify("Exportação iniciada")}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 3v13M6 12l6 6 6-6M4 21h16"/></svg>
            Exportar
          </button>
          <button className="btn btn-accent" onClick={() => setShowCreate(true)}>
            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M12 5v14M5 12h14"/></svg>
            Novo Tenant
          </button>
        </div>
      </div>

      <div className="card" style={{ overflow: "visible" }}>
        <div className="toolbar">
          <div className="inp" style={{ flex: 1, maxWidth: 320 }}>
            <svg width={13} height={13} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><circle cx={11} cy={11} r={7}/><path d="M21 21l-4.3-4.3"/></svg>
            <input value={q} onChange={e => setQ(e.target.value)} placeholder="Buscar por nome, slug ou app…" />
          </div>
          <div className="row" style={{ gap: 4, padding: 2, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 7 }}>
            {["all", "free", "pro", "enterprise"].map(p => (
              <button key={p} onClick={() => setPlan(p)}
                style={{ padding: "4px 10px", border: 0, borderRadius: 5, background: plan === p ? "var(--surface)" : "transparent",
                  color: plan === p ? "var(--text)" : "var(--text-3)", fontSize: 11.5, fontWeight: 500,
                  boxShadow: plan === p ? "var(--shadow-1)" : "none", cursor: "pointer" }}>
                {p === "all" ? "Todos" : p}
              </button>
            ))}
          </div>
          <div style={{ flex: 1 }} />
          <span className="muted" style={{ fontSize: 11.5 }}>{items.length} resultados</span>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-[#6d3df0] border-t-transparent" />
          </div>
        ) : (
          <div className="tbl-wrapper">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ width: 32 }}><input type="checkbox" /></th>
                  <th>Tenant</th>
                  <th>Slug</th>
                  <th>Plano</th>
                  <th>Status</th>
                  <th>Criado</th>
                  <th style={{ width: 60 }} />
                </tr>
              </thead>
              <tbody>
                {items.map(t => {
                  const firstLetter = (t.settings.app_name || t.name).charAt(0).toUpperCase();
                  return (
                    <tr key={t.id} style={{ cursor: "pointer" }}>
                      <td onClick={e => e.stopPropagation()}><input type="checkbox" /></td>
                      <td>
                        <div className="cell-tenant">
                          <span className="tenant-mark" style={{ "--mc": t.settings.primary_color || "#6d3df0" } as React.CSSProperties}>{firstLetter}</span>
                          <div className="cell-meta"><b>{t.settings.app_name || t.name}</b><span>{t.name}</span></div>
                        </div>
                      </td>
                      <td><span className="mono muted" style={{ fontSize: 11.5 }}>{t.slug}</span></td>
                      <td><span className={`chip plan-${t.plan}`}>{t.plan}</span></td>
                      <td>
                        <button onClick={e => { e.stopPropagation(); handleToggle(t); }} style={{ background: "none", border: "none", padding: 0, cursor: "pointer" }}>
                          {t.isActive ? <span className="chip ok"><span className="dot" />Ativo</span> : <span className="chip err"><span className="dot" />Inativo</span>}
                        </button>
                      </td>
                      <td className="muted" style={{ fontSize: 11.5 }}>{new Date(t.createdAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</td>
                      <td onClick={e => e.stopPropagation()}>
                        <div className="row" style={{ gap: 2, justifyContent: "flex-end" }}>
                          <button className="btn icon btn-ghost" title="Editar" onClick={() => notify("Editar tenant — em breve")}>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M16 3l5 5L8 21H3v-5z"/></svg>
                          </button>
                          <button className="btn icon btn-ghost" title="Remover" onClick={() => handleDelete(t)}>
                            <svg width={12} height={12} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {items.length === 0 && (
                  <tr><td colSpan={7}><div className="empty">Nenhum tenant encontrado</div></td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showCreate && <CreateTenantModal onClose={() => setShowCreate(false)} onCreated={(t) => { setTenants(prev => [t, ...prev]); setShowCreate(false); notify("Tenant criado"); }} />}
    </div>
  );
}

// ─── Create Tenant Modal ────────────────────────────────────────────
function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: ApiTenant) => void }) {
  const [form, setForm] = useState({ name: "", slug: "", app_name: "", plan: "free", color: "#6d3df0" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [slugStatus, setSlugStatus] = useState<"idle" | "checking" | "available" | "taken">("idle");
  const checkSlugTimer = useRef<ReturnType<typeof setTimeout>>();

  async function checkSlug(slug: string) {
    if (checkSlugTimer.current) clearTimeout(checkSlugTimer.current);
    if (!slug || slug.length < 3) { setSlugStatus("idle"); return; }
    setSlugStatus("checking");
    checkSlugTimer.current = setTimeout(async () => {
      try {
        const res = await tenantsApi.checkSlug(slug);
        setSlugStatus(res.available ? "available" : "taken");
      } catch { setSlugStatus("idle"); }
    }, 400);
  }

  async function submit() {
    setLoading(true);
    setErr(null);
    try {
      const tenant = await tenantsApi.create({
        name: form.name,
        slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        plan: form.plan,
        settings: { app_name: form.app_name || form.name, primary_color: form.color },
      });
      onCreated(tenant);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao criar tenant");
    } finally { setLoading(false); }
  }

  const slugInvalid = slugStatus === "taken";
  const canSubmit = form.name.trim() && form.slug.trim() && !loading && slugStatus !== "taken" && slugStatus !== "checking";

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-h">
          <h2>Novo Tenant</h2>
          <button className="btn icon btn-ghost" onClick={onClose}>
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7}><path d="M6 6l12 12M18 6L6 18"/></svg>
          </button>
        </div>
        <div className="modal-body">
          {err && <div style={{ marginBottom: 14, padding: "8px 12px", background: "var(--err-soft)", border: "1px solid color-mix(in oklab, var(--err) 25%, transparent)", borderRadius: 8, fontSize: 12.5, color: "var(--err)" }}>{err}</div>}
          <div className="grid-2">
            <div className="field">
              <label>Nome da empresa</label>
              <div className="inp"><input value={form.name} onChange={e => setForm({...form, name: e.target.value, slug: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, "-")})} placeholder="Construtora XYZ" /></div>
            </div>
            <div className="field">
              <label>Slug (subdomínio)</label>
              <div className="inp" style={{ borderColor: slugStatus === "taken" ? "var(--err)" : slugStatus === "available" ? "var(--ok)" : undefined }}>
                <input value={form.slug} onChange={e => { setForm({...form, slug: e.target.value}); checkSlug(e.target.value); }} />
                {slugStatus === "checking" && <span className="spinner-sm" />}
              </div>
              <div className="hint mono" style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span>{form.slug ? `${form.slug}.construprice.app` : "—"}</span>
                {slugStatus === "available" && <span style={{ color: "var(--ok)", fontSize: 11 }}>✓ Disponível</span>}
                {slugStatus === "taken" && <span style={{ color: "var(--err)", fontSize: 11 }}>✗ Já utilizado</span>}
              </div>
            </div>
          </div>
          <div className="field" style={{ marginTop: 14 }}>
            <label>Nome do app (branding)</label>
            <div className="inp"><input value={form.app_name} onChange={e => setForm({...form, app_name: e.target.value})} placeholder={form.name || "Ex: Cotações XYZ"} /></div>
          </div>
          <div className="grid-2" style={{ marginTop: 14 }}>
            <div className="field">
              <label>Plano</label>
              <div className="row" style={{ gap: 6 }}>
                {["free", "pro", "enterprise"].map(p => (
                  <button key={p} onClick={() => setForm({...form, plan: p})}
                    className={`chip plan-${p}`}
                    style={{ padding: "6px 12px", border: form.plan === p ? "1.5px solid currentColor" : "1px solid var(--line)", cursor: "pointer", flex: 1, justifyContent: "center" }}>
                    {p}
                  </button>
                ))}
              </div>
            </div>
            <div className="field">
              <label>Cor primária</label>
              <div className="row" style={{ gap: 6 }}>
                {["#6d3df0", "#1f6cc7", "#1a8e5c", "#c23131", "#ea580c", "#0891b2"].map(c => (
                  <button key={c} onClick={() => setForm({...form, color: c})}
                    style={{ width: 28, height: 28, background: c, borderRadius: 6, border: form.color === c ? "2px solid var(--text)" : "1px solid var(--line)", cursor: "pointer" }} />
                ))}
              </div>
            </div>
          </div>
          <div style={{ marginTop: 18, padding: 14, background: "var(--surface-2)", border: "1px solid var(--line)", borderRadius: 8 }}>
            <div className="muted" style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: ".06em", marginBottom: 8 }}>Preview</div>
            <div className="cell-tenant">
              <span className="tenant-mark" style={{ "--mc": form.color, width: 36, height: 36, fontSize: 14 } as React.CSSProperties}>{(form.app_name || form.name || "?").charAt(0).toUpperCase()}</span>
              <div className="cell-meta">
                <b style={{ fontSize: 14 }}>{form.app_name || form.name || "Nome do app"}</b>
                <span>{form.slug || "slug"}.construprice.app · <span className={`chip plan-${form.plan}`}>{form.plan}</span></span>
              </div>
            </div>
          </div>
        </div>
        <div className="modal-foot">
          <button className="btn" onClick={onClose}>Cancelar</button>
          <button className="btn btn-accent" onClick={submit} disabled={!canSubmit}>{loading ? "Criando..." : slugInvalid ? "Slug indisponível" : "Criar Tenant"}</button>
        </div>
      </div>
    </div>
  );
}
