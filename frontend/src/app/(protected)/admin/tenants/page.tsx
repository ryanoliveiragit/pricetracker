"use client";

import { useEffect, useState } from "react";
import { tenantsApi, type ApiTenant } from "../../../../services/api";
import { getTenantUrl } from "../../../../services/headers";

type Modal =
  | { type: "create" }
  | { type: "edit"; tenant: ApiTenant }
  | { type: "newAdmin"; tenantId: string; tenantName: string }
  | null;

export default function TenantsAdminPage() {
  const [tenants, setTenants] = useState<ApiTenant[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<Modal>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      setTenants(await tenantsApi.getAll());
    } catch {
      setError("Erro ao carregar tenants. Verifique se você é super admin.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);

  async function handleToggle(tenant: ApiTenant) {
    try {
      const updated = await tenantsApi.update(tenant.id, { isActive: !tenant.isActive });
      setTenants((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
    } catch {
      setError("Erro ao atualizar tenant");
    }
  }

  async function handleDelete(tenant: ApiTenant) {
    if (!confirm(`Remover tenant "${tenant.name}"? Esta ação é irreversível.`)) return;
    try {
      await tenantsApi.delete(tenant.id);
      setTenants((prev) => prev.filter((t) => t.id !== tenant.id));
    } catch {
      setError("Erro ao remover tenant");
    }
  }

  const planBadge: Record<string, string> = {
    free: "bg-gray-100 text-gray-600",
    pro: "bg-blue-100 text-blue-700",
    enterprise: "bg-purple-100 text-purple-700",
  };

  return (
    <div className="max-w-6xl mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Gerenciar Tenants</h1>
          <p className="text-sm text-gray-500 mt-1">Super Admin — plataforma multi-tenancy</p>
        </div>
        <button
          onClick={() => setModal({ type: "create" })}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700"
        >
          + Novo Tenant
        </button>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 mb-4 text-sm">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>fechar</button>
        </div>
      )}

      {loading ? (
        <div className="text-center text-gray-400 py-16">Carregando...</div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-gray-500 uppercase text-xs">
              <tr>
                <th className="text-left px-4 py-3">Tenant</th>
                <th className="text-left px-4 py-3">Slug / Subdomínio</th>
                <th className="text-left px-4 py-3">Plano</th>
                <th className="text-left px-4 py-3">Usuários</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-left px-4 py-3">Criado em</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {tenants.map((t) => (
                <tr key={t.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {t.settings.app_name || t.name}
                  </td>
                  <td className="px-4 py-3 text-gray-500 font-mono">
                    <a href={getTenantUrl(t.slug)} target="_blank" rel="noreferrer" className="hover:text-blue-600 hover:underline">
                      {t.slug}
                    </a>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${planBadge[t.plan] ?? planBadge.free}`}>
                      {t.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{t.userCount}</td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => handleToggle(t)}
                      className={`px-2 py-0.5 rounded-full text-xs font-medium cursor-pointer ${
                        t.isActive
                          ? "bg-green-100 text-green-700"
                          : "bg-red-100 text-red-600"
                      }`}
                    >
                      {t.isActive ? "Ativo" : "Inativo"}
                    </button>
                  </td>
                  <td className="px-4 py-3 text-gray-400">
                    {new Date(t.createdAt).toLocaleDateString("pt-BR")}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => setModal({ type: "newAdmin", tenantId: t.id, tenantName: t.name })}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        + Admin
                      </button>
                      <button
                        onClick={() => setModal({ type: "edit", tenant: t })}
                        className="text-xs text-gray-500 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(t)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center text-gray-400">
                    Nenhum tenant cadastrado
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {modal?.type === "create" && (
        <CreateTenantModal
          onClose={() => setModal(null)}
          onCreated={(t) => { setTenants((prev) => [t, ...prev]); setModal(null); }}
        />
      )}

      {modal?.type === "edit" && (
        <EditTenantModal
          tenant={modal.tenant}
          onClose={() => setModal(null)}
          onUpdated={(t) => { setTenants((prev) => prev.map((x) => (x.id === t.id ? t : x))); setModal(null); }}
        />
      )}

      {modal?.type === "newAdmin" && (
        <NewAdminModal
          tenantId={modal.tenantId}
          tenantName={modal.tenantName}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}


// ─── Create Tenant Modal ──────────────────────────────────────────────────────

function CreateTenantModal({ onClose, onCreated }: { onClose: () => void; onCreated: (t: ApiTenant) => void }) {
  const [form, setForm] = useState({ name: "", slug: "", plan: "free", app_name: "", primary_color: "#2563eb" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const tenant = await tenantsApi.create({
        name: form.name,
        slug: form.slug.toLowerCase().replace(/[^a-z0-9-]/g, "-"),
        plan: form.plan,
        settings: { app_name: form.app_name || form.name, primary_color: form.primary_color },
      });
      onCreated(tenant);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao criar tenant");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalWrapper title="Novo Tenant" onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <Field label="Nome da empresa" required>
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Slug (subdomínio)" required>
          <input className={inputCls} placeholder="ex: cliente1" value={form.slug}
            onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })} required />
          <p className="text-xs text-gray-400 mt-1">Acessado via <strong>{getTenantUrl(form.slug || "slug")}</strong></p>
        </Field>
        <Field label="Nome do app (branding)">
          <input className={inputCls} placeholder={form.name} value={form.app_name}
            onChange={(e) => setForm({ ...form, app_name: e.target.value })} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Plano">
            <select className={inputCls} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </Field>
          <Field label="Cor primária">
            <div className="flex gap-2 items-center">
              <input type="color" value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
                className="w-10 h-10 rounded border border-gray-200 cursor-pointer" />
              <input className={`${inputCls} flex-1`} value={form.primary_color}
                onChange={(e) => setForm({ ...form, primary_color: e.target.value })} />
            </div>
          </Field>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? "Criando..." : "Criar Tenant"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}


// ─── Edit Tenant Modal ────────────────────────────────────────────────────────

function EditTenantModal({ tenant, onClose, onUpdated }: { tenant: ApiTenant; onClose: () => void; onUpdated: (t: ApiTenant) => void }) {
  const [form, setForm] = useState({
    name: tenant.name,
    plan: tenant.plan,
    app_name: tenant.settings.app_name ?? "",
    primary_color: tenant.settings.primary_color ?? "#2563eb",
    accent_color: tenant.settings.accent_color ?? "#7c3aed",
    logo_url: tenant.settings.logo_url ?? "",
  });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      const updated = await tenantsApi.update(tenant.id, {
        name: form.name,
        plan: form.plan,
        settings: {
          app_name: form.app_name,
          primary_color: form.primary_color,
          accent_color: form.accent_color,
          logo_url: form.logo_url,
        },
      });
      onUpdated(updated);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao atualizar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalWrapper title={`Editar: ${tenant.slug}`} onClose={onClose}>
      <form onSubmit={submit} className="space-y-4">
        {err && <p className="text-red-600 text-sm">{err}</p>}
        <Field label="Nome da empresa">
          <input className={inputCls} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
        </Field>
        <Field label="Nome do app">
          <input className={inputCls} value={form.app_name} onChange={(e) => setForm({ ...form, app_name: e.target.value })} />
        </Field>
        <Field label="URL do logo">
          <input className={inputCls} placeholder="https://..." value={form.logo_url}
            onChange={(e) => setForm({ ...form, logo_url: e.target.value })} />
        </Field>
        <div className="grid grid-cols-3 gap-3">
          <Field label="Plano">
            <select className={inputCls} value={form.plan} onChange={(e) => setForm({ ...form, plan: e.target.value })}>
              <option value="free">Free</option>
              <option value="pro">Pro</option>
              <option value="enterprise">Enterprise</option>
            </select>
          </Field>
          <Field label="Cor primária">
            <input type="color" value={form.primary_color}
              onChange={(e) => setForm({ ...form, primary_color: e.target.value })}
              className="w-full h-10 rounded border border-gray-200 cursor-pointer" />
          </Field>
          <Field label="Cor destaque">
            <input type="color" value={form.accent_color}
              onChange={(e) => setForm({ ...form, accent_color: e.target.value })}
              className="w-full h-10 rounded border border-gray-200 cursor-pointer" />
          </Field>
        </div>
        <div className="flex gap-3 pt-2">
          <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
          <button type="submit" disabled={loading} className={btnPrimary}>
            {loading ? "Salvando..." : "Salvar"}
          </button>
        </div>
      </form>
    </ModalWrapper>
  );
}


// ─── New Admin Modal ──────────────────────────────────────────────────────────

function NewAdminModal({ tenantId, tenantName, onClose }: { tenantId: string; tenantName: string; onClose: () => void }) {
  const [form, setForm] = useState({ nome: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setErr(null);
    try {
      await tenantsApi.createAdmin(tenantId, form);
      setSuccess(true);
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : "Erro ao criar admin");
    } finally {
      setLoading(false);
    }
  }

  return (
    <ModalWrapper title={`Novo Admin — ${tenantName}`} onClose={onClose}>
      {success ? (
        <div className="text-center py-4">
          <p className="text-green-600 font-medium">Admin criado com sucesso!</p>
          <button onClick={onClose} className={`mt-4 ${btnPrimary}`}>Fechar</button>
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-4">
          {err && <p className="text-red-600 text-sm">{err}</p>}
          <Field label="Nome completo">
            <input className={inputCls} value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} required />
          </Field>
          <Field label="E-mail">
            <input type="email" className={inputCls} value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })} required />
          </Field>
          <Field label="Senha inicial">
            <input type="password" className={inputCls} value={form.password}
              onChange={(e) => setForm({ ...form, password: e.target.value })} required minLength={6} />
          </Field>
          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className={btnSecondary}>Cancelar</button>
            <button type="submit" disabled={loading} className={btnPrimary}>
              {loading ? "Criando..." : "Criar Admin"}
            </button>
          </div>
        </form>
      )}
    </ModalWrapper>
  );
}


// ─── Shared UI components ─────────────────────────────────────────────────────

function ModalWrapper({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">{title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 text-lg leading-none">&times;</button>
        </div>
        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-600 mb-1">
        {label}{required && <span className="text-red-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}

const inputCls = "w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";
const btnPrimary = "flex-1 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-700 disabled:opacity-50";
const btnSecondary = "flex-1 border border-gray-200 text-gray-600 px-4 py-2 rounded-lg text-sm hover:bg-gray-50";
