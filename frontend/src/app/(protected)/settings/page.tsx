"use client";

import { useState, useEffect, useRef, useCallback, ChangeEvent } from "react";
import { useAuth } from "../../../context/AuthContext";
import { RoleGuard } from "../../../components/auth/RoleGuard";
import {
  UserCircle, Users, ShieldAlert, Plus,
  KeyRound, Building, CreditCard,
  CheckCircle2, Loader2, Trash2, Edit2, UserX, UserCheck, X, LogOut,
  Camera, Store, Shield, Clock, Image as ImageIcon, AlertCircle
} from "lucide-react";
import { cn } from "../../../lib/utils";
import { usersApi, type ApiUser } from "../../../services/usersApi";
import { suppliersApi, type ApiSupplier } from "../../../services/api";

/* ─────────────────────────────────────────────────── //
   TOAST SYSTEM
   ─────────────────────────────────────────────────── // */

type ToastType = "success" | "error" | "info";

interface Toast {
  id: string;
  type: ToastType;
  message: string;
}

const toastQueue: Toast[] = [];
let listeners: (() => void)[] = [];

function notify(toast: Omit<Toast, "id">) {
  const newToast: Toast = { ...toast, id: crypto.randomUUID() };
  toastQueue.push(newToast);
  listeners.forEach(fn => fn());
  setTimeout(() => {
    const idx = toastQueue.indexOf(newToast);
    if (idx > -1) toastQueue.splice(idx, 1);
    listeners.forEach(fn => fn());
  }, 4000);
}

const toast = {
  success: (message: string) => notify({ type: "success", message }),
  error: (message: string) => notify({ type: "error", message }),
  info: (message: string) => notify({ type: "info", message }),
};

function useToasts() {
  const [toasts, setToasts] = useState<Toast[]>([]);
  useEffect(() => {
    const sync = () => setToasts([...toastQueue]);
    listeners.push(sync);
    sync();
    return () => {
      listeners = listeners.filter(l => l !== sync);
    };
  }, []);

  const icons = {
    success: <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0" />,
    error: <AlertCircle className="h-4 w-4 text-red-500 flex-shrink-0" />,
    info: <UserCircle className="h-4 w-4 text-blue-500 flex-shrink-0" />,
  };

  return {
    toasts,
    render: () => (
      <div className="fixed bottom-4 right-4 z-[9999] space-y-2 w-80">
        {toasts.map(t => (
          <div
            key={t.id}
            className={cn(
              "flex items-center gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-sm animate-in slide-in-from-bottom-2",
              t.type === "success" && "bg-emerald-50/95 border-emerald-200 text-emerald-800",
              t.type === "error" && "bg-red-50/95 border-red-200 text-red-800",
              t.type === "info" && "bg-blue-50/95 border-blue-200 text-blue-800",
            )}
          >
            {icons[t.type]}
            <p className="text-sm font-medium flex-1">{t.message}</p>
          </div>
        ))}
      </div>
    ),
  };
}

/* ─────────────────────────────────────────────────── //
   MAIN PAGE
   ─────────────────────────────────────────────────── // */

type Tab = "profile" | "security" | "suppliers" | "team" | "plan";

interface NavItem {
  id: Tab;
  label: string;
  icon: any;
  roles?: string[] | null;
  iconColor: string;
  iconBg: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const { render: renderToasts } = useToasts();

  const navGroups: NavGroup[] = [
    {
      label: "Pessoal",
      items: [
        { id: "profile", label: "Informações", icon: UserCircle, iconColor: "text-blue-500", iconBg: "bg-blue-50" },
        { id: "security", label: "Segurança", icon: Shield, iconColor: "text-blue-500", iconBg: "bg-blue-50" },
      ],
    },
    {
      label: "Administração",
      items: [
        { id: "suppliers", label: "Fornecedores", icon: Store, iconColor: "text-amber-500", iconBg: "bg-amber-50" },
        { id: "team", label: "Funcionários", icon: Users, iconColor: "text-amber-500", iconBg: "bg-amber-50", roles: ["admin", "gestor", "usuario"] },
      ],
    },
    {
      label: "Conta",
      items: [{ id: "plan", label: "Assinatura", icon: CreditCard, iconColor: "text-emerald-500", iconBg: "bg-emerald-50" }],
    },
  ];

  return (
    <div className="flex h-full min-h-screen bg-[#F7F7F5]">
      {/* Left Nav Sidebar */}
      <aside className="w-60 shrink-0 border-r border-[#E8E8E4] bg-white hidden lg:flex flex-col h-screen sticky top-0">
        {/* User card */}
        <div className="px-4 py-4 border-b border-[#E8E8E4]">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-[#1A1A18] flex items-center justify-center text-white text-sm font-bold flex-shrink-0 overflow-hidden">
              {(user as any)?.avatar
                ? <img src={(user as any).avatar} alt="avatar" className="w-full h-full object-cover" />
                : (user?.displayName?.[0] || user?.email?.[0] || "U").toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-[#1A1A18] truncate leading-tight">{user?.displayName || user?.email?.split("@")[0] || "Usuário"}</p>
              <span className="inline-block mt-0.5 text-[10px] font-semibold uppercase tracking-widest bg-[#F7F7F5] border border-[#E8E8E4] text-[#6B6B63] px-1.5 py-0.5 rounded-md">
                {user?.role || "admin"}
              </span>
            </div>
          </div>
        </div>

        {/* Nav groups */}
        <div className="px-3 py-4 flex-1 overflow-y-auto space-y-5">
          {navGroups.map((group) => (
            <div key={group.label} className="space-y-0.5">
              <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A] px-2 mb-1.5">{group.label}</p>
              {group.items.map((item) => {
                const ItemIcon = item.icon;
                const active = activeTab === item.id;
                const btn = (
                  <button
                    key={item.id}
                    onClick={() => setActiveTab(item.id)}
                    className={cn(
                      "w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors text-left",
                      active
                        ? "bg-[rgb(var(--primary-500))] text-[#1A1A18]"
                        : "text-[#6B6B63] hover:bg-[#F7F7F5] hover:text-[#1A1A18]"
                    )}
                  >
                    <div className={cn(
                      "w-6 h-6 rounded-md flex items-center justify-center flex-shrink-0 transition-colors",
                      active ? "bg-[#1A1A18]/10" : item.iconBg
                    )}>
                      <ItemIcon className={cn("h-3.5 w-3.5", active ? "text-[#1A1A18]" : item.iconColor)} />
                    </div>
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

        {/* Logout at bottom */}
        <div className="px-3 py-3 border-t border-[#E8E8E4]">
          <button
            onClick={logout}
            className="w-full flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <div className="w-6 h-6 rounded-md bg-red-100 flex items-center justify-center flex-shrink-0">
              <LogOut className="h-3.5 w-3.5 text-red-500" />
            </div>
            Sair da conta
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 min-w-0 max-w-4xl px-6 py-8 mx-auto w-full">
        {/* Mobile tab row */}
        <div className="flex gap-2 mb-6 lg:hidden overflow-x-auto pb-1">
          {navGroups.flatMap(g => g.items).map(item => {
            const ItemIcon = item.icon;
            const active = activeTab === item.id;
            const content = (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={cn(
                  "flex-shrink-0 flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[rgb(var(--primary-500))] border-[rgb(var(--primary-500))] text-[#1A1A18]"
                    : "border-[#E8E8E4] bg-white text-[#6B6B63] hover:text-[#1A1A18]"
                )}
              >
                <div className={cn("w-5 h-5 rounded flex items-center justify-center", active ? "bg-[#1A1A18]/10" : item.iconBg)}>
                  <ItemIcon className={cn("h-3 w-3", active ? "text-[#1A1A18]" : item.iconColor)} />
                </div>
                {item.label}
              </button>
            );
            if (item.roles) return <RoleGuard key={item.id} roles={item.roles as any}>{content}</RoleGuard>;
            return content;
          })}
          <button
            onClick={logout}
            className="flex-shrink-0 flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 transition-colors"
          >
            <div className="w-5 h-5 rounded bg-red-100 flex items-center justify-center">
              <LogOut className="h-3 w-3 text-red-500" />
            </div>
            Sair
          </button>
        </div>

        {activeTab === "profile" && <ProfileTab user={user} />}
        {activeTab === "security" && <SecurityTab />}
        {activeTab === "suppliers" && <SuppliersTab />}
        {activeTab === "team" && <TeamTab user={user} />}
        {activeTab === "plan" && <PlanTab />}
      </div>

      {renderToasts()}
    </div>
  );
}

// ─────────────────────────────────────────────────── //
// PHONE MASK
// ─────────────────────────────────────────────────── //
function applyPhoneMask(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length <= 2) return digits;
  if (digits.length <= 7) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

// ─────────────────────────────────────────────────── //
// PROFILE TAB
// ─────────────────────────────────────────────────── //
function ProfileTab({ user }: { user: any }) {
  const { updateUser } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarChanged, setAvatarChanged] = useState(false);
  const [form, setForm] = useState({
    id: 0,
    nome: "",
    email: "",
    telefone: "",
    empresa: "",
    cargo: "",
    avatar: "",
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        const data = await usersApi.getMe();
        setForm({
          id: data.id,
          nome: data.nome || "",
          email: data.email || "",
          telefone: applyPhoneMask(data.telefone || ""),
          empresa: data.empresa || "",
          cargo: data.cargo || "",
          avatar: data.avatar || "",
        });
        if (data.avatar) setAvatarPreview(data.avatar);
      } catch (err: any) {
        toast.error("Falha ao carregar perfil: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    loadProfile();
  }, []);

  const handleAvatarChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      toast.error("Imagem deve ter no máximo 2MB.");
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Selecione um arquivo de imagem válido (JPG ou PNG).");
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result as string;
      setAvatarPreview(base64);
      setForm(prev => ({ ...prev, avatar: base64 }));
      setAvatarChanged(true);
      toast.info("Foto alterada — clique em 'Salvar Alterações' para confirmar");
    };
    reader.readAsDataURL(file);
    // Reset input so same file can be selected again
    e.target.value = "";
  }, []);

  const removeAvatar = useCallback(() => {
    setAvatarPreview(null);
    setForm(prev => ({ ...prev, avatar: "" }));
    setAvatarChanged(true);
    toast.info("Foto removida — clique em 'Salvar Alterações' para confirmar");
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);

    try {
      const payload: any = {
        nome: form.nome,
        telefone: form.telefone.replace(/\D/g, ""),
        empresa: form.empresa,
        cargo: form.cargo,
      };

      if (avatarChanged) {
        payload.avatar = form.avatar;
      }

      const updated = await usersApi.updateMe(payload);

      // Sync auth context with new display name and avatar
      const displayName = form.nome || form.email.split("@")[0];
      updateUser({ displayName, avatar: updated.avatar || undefined });

      // Sync local state with server response
      setForm({
        ...form,
        nome: updated.nome,
        telefone: applyPhoneMask(updated.telefone || ""),
        empresa: updated.empresa || "",
        cargo: updated.cargo || "",
        avatar: updated.avatar || "",
      });
      if (updated.avatar) {
        setAvatarPreview(updated.avatar);
      }
      setAvatarChanged(false);
      toast.success("Perfil atualizado com sucesso!");
    } catch (err: any) {
      toast.error("Falha ao salvar: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-[rgb(var(--primary-500))]" />
      </div>
    );
  }

  return (
    <form onSubmit={handleSave} className="space-y-6">

      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A0A09A]">Pessoal</p>
        <h1 className="text-2xl font-bold text-[#1A1A18] mt-0.5">Informações do Perfil</h1>
      </div>

      {/* Avatar + core info card */}
      <div className="bg-white border border-[#E8E8E4] rounded-xl p-6 shadow-sm">
        <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A] mb-4">Identidade</p>
        <div className="flex flex-col sm:flex-row gap-6 items-start">

          {/* Avatar section */}
          <div className="flex flex-col items-center gap-3 flex-shrink-0">
            <div className="relative">
              <div
                className="group w-24 h-24 rounded-xl overflow-hidden bg-[#F7F7F5] border border-[#E8E8E4] flex items-center justify-center cursor-pointer transition-all hover:border-[rgb(var(--primary-500))]"
                onClick={() => fileInputRef.current?.click()}
              >
                {avatarUploading ? (
                  <Loader2 className="h-6 w-6 animate-spin text-[rgb(var(--primary-500))]" />
                ) : avatarPreview ? (
                  <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                ) : (
                  <span className="text-3xl font-bold text-[#1A1A18]">{form.nome?.[0]?.toUpperCase() || "U"}</span>
                )}
                <div className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <Camera className="h-5 w-5 text-white" />
                </div>
              </div>

              {/* Remove avatar button */}
              {avatarPreview && (
                <button
                  type="button"
                  onClick={removeAvatar}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-red-500 text-white flex items-center justify-center hover:bg-red-600 shadow-md transition-colors"
                  title="Remover foto"
                >
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleAvatarChange}
            />
            <p className="text-[10px] text-[#A0A09A] text-center leading-tight">
              {avatarChanged ? (
                <span className="text-[rgb(var(--primary-600))] font-medium">Alteração pendente</span>
              ) : (
                "JPG, PNG · max 2MB"
              )}
            </p>
          </div>

          {/* Fields */}
          <div className="flex-1 grid grid-cols-1 sm:grid-cols-2 gap-4 w-full">
            <Field label="Nome Completo" required>
              <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} type="text" required className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[rgb(var(--primary-500))] focus:bg-white focus:outline-none transition-colors" />
            </Field>
            <Field label="E-mail">
              <input value={form.email} disabled type="email" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#A0A09A] cursor-not-allowed outline-none" />
            </Field>
            <Field label="Telefone">
              <input value={form.telefone} onChange={e => setForm({ ...form, telefone: applyPhoneMask(e.target.value) })} type="text" placeholder="(DD) 90000-0000" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[rgb(var(--primary-500))] focus:bg-white focus:outline-none transition-colors" />
            </Field>
            <Field label="Cargo / Função">
              <input value={form.cargo} onChange={e => setForm({ ...form, cargo: e.target.value })} type="text" placeholder="Ex: Comprador, Engenheiro..." className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[rgb(var(--primary-500))] focus:bg-white focus:outline-none transition-colors" />
            </Field>
            <Field label="Empresa" className="sm:col-span-2">
              <input value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} type="text" placeholder="Nome da empresa ou construtora" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[rgb(var(--primary-500))] focus:bg-white focus:outline-none transition-colors" />
            </Field>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end items-center gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-[rgb(var(--primary-500))] px-5 py-2.5 text-sm font-semibold text-[#1A1A18] transition-all hover:bg-[rgb(var(--primary-600))] disabled:opacity-60 shadow-sm"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Salvar Alterações
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────── //
// SECURITY TAB
// ─────────────────────────────────────────────────── //
function SecurityTab() {
  const [isSaving, setIsSaving] = useState(false);
  const [form, setForm] = useState({
    novaSenha: "",
    confirmaSenha: "",
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!form.novaSenha || !form.confirmaSenha) {
      toast.error("Preencha todos os campos de senha.");
      return;
    }
    if (form.novaSenha !== form.confirmaSenha) {
      toast.error("As senhas não coincidem.");
      return;
    }
    if (form.novaSenha.length < 4) {
      toast.error("A nova senha deve ter no mínimo 4 caracteres.");
      return;
    }

    setIsSaving(true);
    try {
      await usersApi.updateMe({ password: form.novaSenha });
      setForm({ novaSenha: "", confirmaSenha: "" });
      toast.success("Senha alterada com sucesso!");
    } catch (err: any) {
      toast.error("Falha ao alterar senha: " + err.message);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A0A09A]">Segurança</p>
        <h1 className="text-2xl font-bold text-[#1A1A18] mt-0.5">Alterar Senha</h1>
      </div>

      {/* Password card */}
      <div className="bg-white border border-[#E8E8E4] rounded-xl p-6 shadow-sm">
        <div className="flex items-center gap-2 mb-4">
          <KeyRound className="h-3.5 w-3.5 text-[#A0A09A]" />
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Nova Senha</p>
        </div>
        <div className="space-y-4 max-w-md">
          <Field label="Nova Senha" required>
            <input
              value={form.novaSenha}
              onChange={e => setForm({ ...form, novaSenha: e.target.value })}
              type="password"
              placeholder="••••••••"
              required
              minLength={4}
              className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[rgb(var(--primary-500))] focus:bg-white focus:outline-none transition-colors"
            />
          </Field>
          <Field label="Confirmar Nova Senha" required>
            <input
              value={form.confirmaSenha}
              onChange={e => setForm({ ...form, confirmaSenha: e.target.value })}
              type="password"
              placeholder="••••••••"
              required
              minLength={4}
              className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[rgb(var(--primary-500))] focus:bg-white focus:outline-none transition-colors"
            />
          </Field>
        </div>
      </div>

      {/* Actions */}
      <div className="flex justify-end items-center gap-3">
        <button
          type="submit"
          disabled={isSaving}
          className="flex items-center gap-2 rounded-lg bg-[rgb(var(--primary-500))] px-5 py-2.5 text-sm font-semibold text-[#1A1A18] transition-all hover:bg-[rgb(var(--primary-600))] disabled:opacity-60 shadow-sm"
        >
          {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
          Alterar Senha
        </button>
      </div>
    </form>
  );
}

// ─────────────────────────────────────────────────── //
// SUPPLIERS TAB
// ─────────────────────────────────────────────────── //
interface ApiSupplierWithCreator extends ApiSupplier {
  createdBy?: string;
}

function SuppliersTab() {
  const [suppliers, setSuppliers] = useState<ApiSupplierWithCreator[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const data = await suppliersApi.getAll();
        setSuppliers(data as ApiSupplierWithCreator[]);
      } catch (err: any) {
        toast.error("Erro ao carregar fornecedores: " + err.message);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const formatDate = (iso: string) => {
    if (!iso) return "—";
    const d = new Date(iso);
    return d.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A0A09A]">Administração</p>
        <h1 className="text-2xl font-bold text-[#1A1A18] mt-0.5">Fornecedores Vinculados</h1>
      </div>

      {/* Stats */}
      {!loading && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {[
            { label: "Total", value: suppliers.length },
            { label: "Ativos", value: suppliers.filter(s => s.isActive).length },
            { label: "Inativos", value: suppliers.filter(s => !s.isActive).length },
          ].map(stat => (
            <div key={stat.label} className="bg-white border border-[#E8E8E4] rounded-xl px-5 py-3 shadow-sm">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[#A0A09A] mb-1">{stat.label}</p>
              <p className="text-2xl font-bold text-[#1A1A18]">{stat.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      <div className="bg-white border border-[#E8E8E4] rounded-xl shadow-sm overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-[#E8E8E4]">
          <span className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Lista de Fornecedores</span>
          <span className="text-[11px] text-[#A0A09A]">{loading ? "Carregando..." : `${suppliers.length} registros`}</span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-[#E8E8E4] bg-[#F7F7F5]">
              <tr>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Fornecedor</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Região</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Adicionado por</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Data/Hora</th>
                <th className="px-5 py-3 text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A]">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0F0EC]">
              {loading && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-[#A0A09A]">
                    <Loader2 className="mx-auto h-6 w-6 mb-3 animate-spin text-[rgb(var(--primary-500))]" />
                    <p className="text-sm font-medium">Buscando fornecedores...</p>
                  </td>
                </tr>
              )}
              {!loading && suppliers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-5 py-16 text-center text-[#A0A09A]">
                    <Store className="mx-auto h-8 w-8 mb-3 opacity-30" />
                    <p className="text-sm font-medium">Nenhum fornecedor vinculado</p>
                  </td>
                </tr>
              )}
              {!loading && suppliers.map(s => (
                <tr key={s.id} className={cn("group hover:bg-[#F7F7F5] transition-colors", !s.isActive && "opacity-50")}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className={cn("h-8 w-8 rounded-lg flex items-center justify-center text-sm font-bold flex-shrink-0",
                        s.isActive ? "bg-[#1A1A18] text-white" : "bg-[#E8E8E4] text-[#A0A09A]"
                      )}>
                        {s.name?.[0]?.toUpperCase() || "F"}
                      </div>
                      <div>
                        <p className="font-semibold text-[#1A1A18] text-[13px]">{s.name}</p>
                        <p className="text-[11px] text-[#A0A09A] truncate max-w-[200px]">{s.url}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-4">
                    <span className="inline-flex rounded-md bg-[#F7F7F5] border border-[#E8E8E4] px-2 py-1 text-[10px] font-semibold uppercase tracking-widest text-[#6B6B63]">
                      {s.region || "—"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-1 text-[12px] text-[#6B6B63] font-medium">
                      <Building className="h-3 w-3 text-[#C0C0BA]" />
                      {s.createdBy || "Sistema"}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    <span className="flex items-center gap-1 text-[12px] text-[#6B6B63]">
                      <Clock className="h-3 w-3 text-[#C0C0BA]" />
                      {formatDate(s.createdAt)}
                    </span>
                  </td>
                  <td className="px-5 py-4">
                    {s.isActive ? (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/15 border border-[rgb(var(--primary-500))]/30 px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--primary-600))]">
                        ● Ativo
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-full bg-[#F7F7F5] border border-[#E8E8E4] px-2.5 py-1 text-[11px] font-medium text-[#A0A09A]">
                        ● Inativo
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
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
      toast.error("Erro ao carregar funcionários: " + err.message);
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
      toast.success(`Status de ${updated.nome} alterado para ${updated.is_active ? "ativo" : "suspenso"}`);
    } catch (err: any) {
      toast.error("Erro ao alterar status: " + err.message);
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
      toast.success("Funcionário removido com sucesso");
    } catch (err: any) {
      toast.error("Erro ao excluir funcionário: " + err.message);
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
              className="flex items-center gap-1.5 rounded-lg bg-[rgb(var(--primary-500))] px-4 py-2.5 text-sm font-semibold text-[#1A1A18] transition-all hover:bg-[rgb(var(--primary-600))] shadow-sm"
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
            <div key={stat.label} className="bg-white border border-[#E8E8E4] rounded-xl px-5 py-3 shadow-sm">
              <p className="text-[10px] font-medium uppercase tracking-widest text-[#A0A09A] mb-1">{stat.label}</p>
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
                    <Loader2 className="mx-auto h-6 w-6 mb-3 animate-spin text-[rgb(var(--primary-500))]" />
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
                      <span className="inline-flex items-center gap-1 rounded-full bg-[rgb(var(--primary-500))]/15 border border-[rgb(var(--primary-500))]/30 px-2.5 py-1 text-[11px] font-medium text-[rgb(var(--primary-600))]">
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      if (employee) {
        const payload: any = {
          nome: form.nome,
          empresa: form.empresa,
          role: form.role,
        };
        if (form.password) payload.password = form.password;
        await usersApi.update(employee.id, payload);
        toast.success(`${form.nome} atualizado com sucesso`);
      } else {
        await usersApi.create({
          nome: form.nome,
          email: form.email,
          empresa: form.empresa,
          role: form.role,
          password: form.password || "123456",
        });
        toast.success(`${form.nome} cadastrado com sucesso`);
      }
      onSave();
      onClose();
    } catch (err: any) {
      toast.error("Falha ao salvar: " + err.message);
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
            <input value={form.nome} onChange={e => setForm({ ...form, nome: e.target.value })} type="text" required placeholder="Nome do funcionário" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[rgb(var(--primary-500))] focus:bg-white focus:outline-none transition-colors" />
          </Field>
          <Field label="E-mail" required>
            <input disabled={!!employee} value={form.email} onChange={e => setForm({ ...form, email: e.target.value })} type="email" required placeholder="email@empresa.com" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[rgb(var(--primary-500))] focus:bg-white focus:outline-none transition-colors disabled:opacity-60 disabled:cursor-not-allowed" />
          </Field>
          <Field label="Empresa">
            <input value={form.empresa} onChange={e => setForm({ ...form, empresa: e.target.value })} type="text" placeholder="Filial ou unidade" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[rgb(var(--primary-500))] focus:bg-white focus:outline-none transition-colors" />
          </Field>
          <Field label="Nível de Acesso">
            <select value={form.role} onChange={e => setForm({ ...form, role: e.target.value })} className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] focus:border-[rgb(var(--primary-500))] focus:bg-white focus:outline-none transition-colors">
              <option value="funcionario">Funcionário</option>
              <option value="usuario">Usuário</option>
              <option value="gestor">Gestor</option>
            </select>
          </Field>
          <Field label={employee ? "Nova Senha (opcional)" : "Senha de Acesso"} required={!employee}>
            <input value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} minLength={4} required={!employee} type="password" placeholder="Definir senha provisória" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[rgb(var(--primary-500))] focus:bg-white focus:outline-none transition-colors" />
          </Field>
        </div>
        <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E8E8E4] bg-[#F7F7F5] rounded-b-xl">
          <button type="button" onClick={onClose} disabled={isSaving} className="rounded-lg border border-[#E8E8E4] bg-white px-4 py-2 text-sm font-medium text-[#6B6B63] hover:bg-[#EFEFEA] transition-colors disabled:opacity-50">Cancelar</button>
          <button type="submit" disabled={isSaving} className="flex items-center gap-2 rounded-lg bg-[rgb(var(--primary-500))] px-4 py-2 text-sm font-semibold text-[#1A1A18] hover:bg-[rgb(var(--primary-600))] transition-colors shadow-sm disabled:opacity-50">
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
        <span className="rounded-full bg-[rgb(var(--primary-500))]/15 border border-[rgb(var(--primary-500))]/30 px-3 py-1 text-xs font-semibold text-[rgb(var(--primary-600))]">Ativo</span>
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
        {label}{required && <span className="text-[rgb(var(--primary-500))] ml-0.5">*</span>}
      </p>
      {children}
    </div>
  );
}
