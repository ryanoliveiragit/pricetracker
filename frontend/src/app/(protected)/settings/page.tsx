"use client";

import { useState, useEffect, FormEvent } from "react";
import { useAuth } from "../../../context/AuthContext";
import { RoleGuard } from "../../../components/auth/RoleGuard";
import {
  UserCircle, Users, ShieldAlert, Plus,
  KeyRound, Building, CreditCard,
  CheckCircle2, Loader2, Trash2, Edit2, UserX, UserCheck, X
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { usersApi, type ApiUser } from "../../../services/usersApi";

type Tab = "profile" | "team" | "plan";

interface NavItem {
  id: Tab;
  label: string;
  icon: any;
  roles?: string[] | null;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");

  const navGroups: NavGroup[] = [
    {
      label: "Pessoal",
      items: [{ id: "profile", label: "Meu Perfil", icon: UserCircle }],
    },
    {
      label: "Administração",
      items: [{ id: "team", label: "Funcionários", icon: Users, roles: ["admin", "gestor", "usuario"] }],
    },
    {
      label: "Conta",
      items: [{ id: "plan", label: "Assinatura", icon: CreditCard }],
    },
  ];

  return (
    <div className="flex h-full min-h-screen bg-[#F7F7F5]">

      {/* Left Nav Sidebar — same pattern as results filter sidebar */}
      <aside className="w-64 shrink-0 border-r border-[#E8E8E4] bg-white hidden lg:flex flex-col h-screen sticky top-0">
        <div className="px-5 py-6 flex-1 overflow-y-auto space-y-6">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A0A09A] mb-1 px-2">Configurações</p>
          </div>
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A] px-2 mb-1">{group.label}</p>
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                const btn = (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors text-left",
                      activeTab === item.id
                        ? "bg-[#84CC16] text-[#1A1A18]"
                        : "text-[#6B6B63] hover:bg-[#F7F7F5] hover:text-[#1A1A18]"
                    )}
                  >
                    <ItemIcon className={cn("h-4 w-4 flex-shrink-0", activeTab === item.id ? "text-[#1A1A18]" : "text-[#A0A09A]")} />
                    {item.label}
                  </button>
                );
                if (item.roles) {
                  return (
                    <RoleGuard key={item.id} roles={item.roles as any}>
                      {btn}
                    </RoleGuard>
                  );
                }
                return btn;
              })}
            </div>
          ))}
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-4xl px-6 py-8 mx-auto w-full">

        {/* Mobile tab row */}
        <div className="flex gap-2 mb-8 lg:hidden overflow-x-auto pb-1">
          {navGroups.flatMap(g => g.items).map(item => {
            const ItemIcon = item.icon;
            const content = (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-2 rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  activeTab === item.id
                    ? "bg-[#84CC16] border-[#84CC16] text-[#1A1A18]"
                    : "border-[#E8E8E4] bg-white text-[#6B6B63] hover:text-[#1A1A18]"
                )}
              >
                <ItemIcon className="h-3.5 w-3.5" />{item.label}
              </button>
            );
            if (item.roles) return <RoleGuard key={item.id} roles={item.roles as any}>{content}</RoleGuard>;
            return content;
          })}
        </div>

        {activeTab === "profile" && <ProfileTab user={user} />}
        {activeTab === "team" && <TeamTab user={user} />}
        {activeTab === "plan" && <PlanTab />}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────── //
// PROFILE TAB
// ─────────────────────────────────────────────────── //
function ProfileTab({ user }: { user: any }) {
  const [isSaving, setIsSaving] = useState(false);
  const [isSaved, setIsSaved] = useState(false);
  const [form, setForm] = useState({
    nome: user?.displayName || "",
    email: user?.email || "",
    telefone: "",
    empresa: "",
    cargo: "",
    senha: "",
    confirmaSenha: "",
  });

  const handleSave = (e: FormEvent) => {
    e.preventDefault();
    if (form.senha && form.senha !== form.confirmaSenha) return alert("As senhas não coincidem.");
    setIsSaving(true);
    setTimeout(() => { setIsSaving(false); setIsSaved(true); setTimeout(() => setIsSaved(false), 3000); }, 900);
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A0A09A]">Configurações</p>
          <h1 className="text-2xl font-bold text-[#1A1A18] mt-0.5">Meu Perfil</h1>
        </div>
        <span className="text-[10px] font-semibold uppercase tracking-widest bg-white border border-[#E8E8E4] text-[#6B6B63] px-2.5 py-1 rounded-lg shadow-sm">
          {user?.role || "admin"}
        </span>
      </div>

      {/* Avatar + core info card */}
      <div className="bg-white border border-[#E8E8E4] rounded-xl p-6 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A] mb-4">Identidade</p>
        <div className="flex flex-col sm:flex-row gap-6 items-start">
          {/* Avatar */}
          <div className="flex flex-col items-center gap-2 flex-shrink-0">
            <div className="group relative w-24 h-24 rounded-xl overflow-hidden bg-[#F7F7F5] border border-[#E8E8E4] flex items-center justify-center cursor-pointer">
              <span className="text-3xl font-bold text-[#1A1A18]">{form.nome?.[0]?.toUpperCase() || "U"}</span>
              <div className="absolute inset-0 bg-[#84CC16]/90 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                <UserCircle className="h-6 w-6 text-[#1A1A18]" />
              </div>
            </div>
            <p className="text-[10px] text-[#A0A09A] text-center leading-tight">JPG, PNG · max 2MB</p>
          </div>

          {/* Name + Email */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <Field label="Nome Completo" required>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} type="text" required className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
            </Field>
            <Field label="E-mail">
              <input value={form.email} disabled type="email" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#A0A09A] cursor-not-allowed outline-none" />
            </Field>
            <Field label="Telefone">
              <input value={form.telefone} onChange={e => setForm({ ...form, telefone: e.target.value })} type="text" placeholder="(DD) 90000-0000" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
            </Field>
            <Field label="Cargo / Função">
              <input value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} type="text" placeholder="Ex: Comprador, Engenheiro..." className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
            </Field>
            <Field label="Empresa" className="sm:col-span-2">
              <input value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} type="text" placeholder="Nome da empresa ou construtora" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
            </Field>
          </div>
        </div>
      </div>

      {/* Security card */}
      <div className="bg-white border border-[#E8E8E4] rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="h-3.5 w-3.5 text-[#A0A09A]" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Segurança</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Nova Senha">
            <input value={form.senha} onChange={e => setForm({ ...form, senha: e.target.value })} type="password" placeholder="••••••••" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
          </Field>
          <Field label="Confirmar Nova Senha">
            <input value={form.confirmaSenha} onChange={e => setForm({ ...form, confirmaSenha: e.target.value })} type="password" placeholder="••••••••" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
          </Field>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end items-center gap-3">
        {isSaved && (
          <span className="flex items-center gap-1.5 text-xs font-medium text-[#3d6600]">
            <CheckCircle2 className="h-4 w-4 text-[#84CC16]" /> Alterações salvas com sucesso
          </span>
        )}
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-[#84CC16] px-5 py-2.5 text-sm font-semibold text-[#1A1A18] transition-all hover:bg-[#78b814] disabled:opacity-60 shadow-sm"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar Alterações
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────── //
// TEAM TAB
// ─────────────────────────────────────────────────── //
function TeamTab({ user }: { user: any }) {
  const [employees, setEmployees] = useState<ApiUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingId, setLoadingId] = useState<number | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [editEmployee, setEditEmployee] = useState<ApiUser | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await usersApi.getAll();
      setEmployees(data);
    } catch (err: any) {
      alert("Erro ao carregar lista de usuários: " + err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const toggleStatus = async (id: number) => {
    setLoadingId(id);
    try {
      const updated = await usersApi.toggleStatus(id);
      setEmployees(prev => prev.map(e => e.id === id ? updated : e));
    } catch (err: any) {
      alert("Erro ao alterar status: " + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const remove = async (id: number) => {
    if (!confirm("Excluir permanentemente esse funcionário e revogar o acesso?")) return;
    setLoadingId(id);
    try {
      await usersApi.delete(id);
      setEmployees(prev => prev.filter(e => e.id !== id));
    } catch (err: any) {
      alert("Erro ao excluir funcionário: " + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A0A09A]">Administração</p>
          <h1 className="text-2xl font-bold text-[#1A1A18] mt-0.5">Quadro de Funcionários</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <RoleGuard roles={["admin"]}>
            <span className="flex items-center gap-1 text-[10px] font-semibold uppercase tracking-widest text-[#6B6B63] bg-white border border-[#E8E8E4] px-2.5 py-1 rounded-lg shadow-sm">
              <ShieldAlert className="h-3 w-3" /> Admin
            </span>
          </RoleGuard>
          <RoleGuard roles={["admin", "gestor", "usuario"]}>
            <button
              onClick={() => { setEditEmployee(null); setShowModal(true); }}
              className="flex items-center gap-1.5 rounded-lg bg-[#84CC16] px-4 py-2.5 text-sm font-semibold text-[#1A1A18] transition-all hover:bg-[#78b814] shadow-sm"
            >
              <Plus className="h-4 w-4" /> Cadastrar Funcionário
            </button>
          </RoleGuard>
        </div>
      </div>

      {/* Stats row */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Total cadastrados", value: employees.length },
            { label: "Ativos", value: employees.filter(e => e.is_active).length },
            { label: "Suspensos", value: employees.filter(e => !e.is_active).length },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-[#E8E8E4] rounded-xl px-5 py-4 shadow-sm">
              <p className="text-[11px] font-medium uppercase tracking-widest text-[#A0A09A] mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-[#1A1A18]">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#E8E8E4] rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E8E4]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Funcionários</span>
          <span className="text-[11px] text-[#A0A09A]">{loading ? "Carregando..." : `${employees.length} registros`}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E8E8E4] bg-[#F7F7F5]">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Nome</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Acesso</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Empresa</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Status</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A] text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EC]">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-[#A0A09A]">
                    <Loader2 className="mx-auto h-6 w-6 mb-3 animate-spin text-[#84CC16]" />
                    <p className="text-sm font-medium">Buscando quadro de funcionários...</p>
                  </td>
                </tr>
              )}
              {!loading && employees.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-[#A0A09A]">
                    <UserX className="mx-auto h-8 w-8 mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhum funcionário cadastrado</p>
                    <p className="text-xs mt-1">Use o botão acima para adicionar o primeiro.</p>
                  </td>
                </tr>
              )}
              {!loading && employees.map(emp => (
                <tr key={emp.id} className={cn("group hover:bg-[#F7F7F5] transition-colors", !emp.is_active && "opacity-50")}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0",
                        emp.is_active ? "bg-[#1A1A18] text-white" : "bg-[#E8E8E4] text-[#A0A09A]"
                      )}>
                        {emp.nome?.[0]?.toUpperCase() || "U"}
                      </div>
                      <div>
                        <p className="font-semibold text-[#1A1A18] text-[13px]">{emp.nome}</p>
                        <p className="text-[11px] text-[#A0A09A]">{emp.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-md bg-[#F7F7F5] border border-[#E8E8E4] px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#6B6B63]">
                      {emp.role}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-1 text-[12px] text-[#6B6B63] font-medium">
                      <Building className="h-3 w-3 text-[#C0C0BA]" /> {emp.empresa || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {emp.is_active ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#84CC16]/15 border border-[#84CC16]/30 px-2.5 py-1 text-[11px] font-medium text-[#3d6600]">
                        ● Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F7F7F5] border border-[#E8E8E4] px-2.5 py-1 text-[11px] font-medium text-[#A0A09A]">
                        ● Suspenso
                      </span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {loadingId === emp.id ? (
                        <Loader2 className="h-4 w-4 animate-spin text-[#A0A09A]" />
                      ) : (
                        <>
                          <button onClick={() => toggleStatus(emp.id)} title={emp.is_active ? "Suspender" : "Reativar"} className="flex items-center gap-1 rounded-lg border border-[#E8E8E4] bg-white px-2.5 py-1.5 text-[11px] font-medium text-[#6B6B63] hover:bg-[#F7F7F5] hover:text-[#1A1A18] transition-colors">
                            {emp.is_active ? <UserX className="h-3.5 w-3.5" /> : <UserCheck className="h-3.5 w-3.5" />}
                            {emp.is_active ? "Suspender" : "Reativar"}
                          </button>
                          <button onClick={() => { setEditEmployee(emp); setShowModal(true); }} title="Editar" className="rounded-lg border border-[#E8E8E4] bg-white p-1.5 text-[#6B6B63] hover:bg-[#F7F7F5] hover:text-[#1A1A18] transition-colors">
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button onClick={() => remove(emp.id)} title="Excluir" className="rounded-lg border border-[#E8E8E4] bg-white p-1.5 text-[#6B6B63] hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors">
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal — Add / Edit employee */}
      {showModal && (
        <EmployeeModal
          employee={editEmployee}
          onClose={() => setShowModal(false)}
          onSave={loadData}
        />
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────── //
// EMPLOYEE MODAL
// ─────────────────────────────────────────────────── //
function EmployeeModal({ employee, onClose, onSave }: {
  employee: ApiUser | null;
  onClose: () => void;
  onSave: () => void;
}) {
  const [form, setForm] = useState({
    nome: employee?.nome || "",
    email: employee?.email || "",
    empresa: employee?.empresa || "",
    role: employee?.role || "funcionario",
    password: "",
  });
  const [isSaving, setIsSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (employee) {
        const payload: any = {
          nome: form.nome,
          empresa: form.empresa,
          role: form.role,
        };
        if (form.password) payload.password = form.password; // only send if changing
        await usersApi.update(employee.id, payload);
      } else {
        await usersApi.create({
          nome: form.nome,
          email: form.email,
          empresa: form.empresa,
          role: form.role,
          password: form.password || "123456", // default safe min length fallback
        });
      }
      onSave();
      onClose();
    } catch (err: any) {
      alert("Falha ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
      <form onSubmit={handleSubmit} className="w-full max-w-md bg-white border border-[#E8E8E4] rounded-xl shadow-2xl mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E4]">
          <h3 className="text-sm font-semibold text-[#1A1A18]">
            {employee ? "Editar Funcionário" : "Cadastrar Funcionário"}
          </h3>
          <button type="button" onClick={onClose} className="text-[#A0A09A] hover:text-[#1A1A18] transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="px-6 py-5 space-y-4">
          <Field label="Nome Completo" required>
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} type="text" required placeholder="Nome do funcionário" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
          </Field>
          <Field label="E-mail" required>
            <input disabled={!!employee} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" required placeholder="email@empresa.com" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
          </Field>
          <Field label="Empresa">
            <input value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} type="text" placeholder="Filial ou unidade" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
          </Field>
          <Field label="Nível de Acesso">
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors">
              <option value="funcionario">Funcionário</option>
              <option value="usuario">Usuário</option>
              <option value="gestor">Gestor</option>
            </select>
          </Field>
          <Field label={employee ? "Nova Senha (opcional)" : "Senha de Acesso"} required={!employee}>
            <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={4} required={!employee} type="password" placeholder="Definir senha provisória" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E8E8E4] bg-[#F7F7F5] rounded-b-xl">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg border border-[#E8E8E4] bg-white px-4 py-2 text-sm font-medium text-[#6B6B63] hover:bg-[#EFEFEA] transition-colors disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={isSaving} className="flex items-center gap-2 rounded-lg bg-[#84CC16] px-4 py-2 text-sm font-semibold text-[#1A1A18] hover:bg-[#78b814] transition-colors shadow-sm disabled:opacity-50">
            {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
            {employee ? "Salvar Alterações" : "Cadastrar"}
          </button>
        </div>
      </form>
    </div>
  );
}

// ─────────────────────────────────────────────────── //
// PLAN TAB
// ─────────────────────────────────────────────────── //
function PlanTab() {
  return (
    <div className="space-y-6">
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A0A09A]">Conta</p>
        <h1 className="text-2xl font-bold text-[#1A1A18] mt-0.5">Assinatura e Limites</h1>
      </div>
      <div className="bg-white border border-[#E8E8E4] rounded-xl px-6 py-5 shadow-sm flex items-center justify-between">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A] mb-1">Plano atual</p>
          <p className="text-xl font-bold text-[#1A1A18]">Profissional</p>
          <p className="text-sm text-[#6B6B63] mt-1">Relatórios ilimitados · Busca turbo · Múltiplos usuários</p>
        </div>
        <span className="rounded-full bg-[#84CC16]/15 border border-[#84CC16]/30 px-3 py-1 text-xs font-semibold text-[#3d6600]">Ativo</span>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Buscas realizadas", value: "248", sub: "este mês" },
          { label: "Usuários ativos", value: "4", sub: "de 10 inclusos" },
          { label: "Próxima cobrança", value: "01/05", sub: "R$ 299,00" },
        ].map(s => (
          <div key={s.label} className="bg-white border border-[#E8E8E4] rounded-xl px-5 py-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-widest text-[#A0A09A] mb-2">{s.label}</p>
            <p className="text-2xl font-bold text-[#1A1A18]">{s.value}</p>
            <p className="text-xs text-[#A0A09A] mt-0.5">{s.sub}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────── //
// FIELD HELPER
// ─────────────────────────────────────────────────── //
function Field({ label, children, required, className }: { label: string; children: React.ReactNode; required?: boolean; className?: string }) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">
        {label}{required && <span className="text-[#84CC16] ml-0.5">*</span>}
      </p>
      {children}
    </div>
  );
}
