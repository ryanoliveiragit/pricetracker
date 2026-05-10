"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { tenantsApi } from "../../services/api";
import { getTenantUrl } from "../../services/headers";

// ─── Color presets ─────────────────────────────────────────────────────────────

const PRIMARY_PRESETS = [
  { label: "Azul",    hex: "#2563eb" },
  { label: "Índigo",  hex: "#4f46e5" },
  { label: "Roxo",    hex: "#7c3aed" },
  { label: "Verde",   hex: "#059669" },
  { label: "Ciano",   hex: "#0891b2" },
  { label: "Laranja", hex: "#ea580c" },
  { label: "Rosa",    hex: "#db2777" },
  { label: "Grafite", hex: "#374151" },
];

const ACCENT_PRESETS = [
  { label: "Roxo",    hex: "#7c3aed" },
  { label: "Índigo",  hex: "#4f46e5" },
  { label: "Azul",    hex: "#2563eb" },
  { label: "Verde",   hex: "#059669" },
  { label: "Laranja", hex: "#ea580c" },
  { label: "Rosa",    hex: "#db2777" },
  { label: "Ciano",   hex: "#0891b2" },
  { label: "Âmbar",   hex: "#d97706" },
];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function darken(hex: string, pct = 18): string {
  const c = hex.replace("#", "");
  const r = Math.max(0, parseInt(c.slice(0, 2), 16) - Math.round((parseInt(c.slice(0, 2), 16) * pct) / 100));
  const g = Math.max(0, parseInt(c.slice(2, 4), 16) - Math.round((parseInt(c.slice(2, 4), 16) * pct) / 100));
  const b = Math.max(0, parseInt(c.slice(4, 6), 16) - Math.round((parseInt(c.slice(4, 6), 16) * pct) / 100));
  return `#${r.toString(16).padStart(2, "0")}${g.toString(16).padStart(2, "0")}${b.toString(16).padStart(2, "0")}`;
}

function hexToRgba(hex: string, alpha: number): string {
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Step = "identity" | "visual" | "admin" | "success";

interface Form {
  company_name: string;
  app_name: string;
  slug: string;
  logo_url: string;
  primary_color: string;
  accent_color: string;
  admin_nome: string;
  admin_email: string;
  admin_password: string;
  admin_password_confirm: string;
}

const INITIAL: Form = {
  company_name: "",
  app_name: "",
  slug: "",
  logo_url: "",
  primary_color: "#2563eb",
  accent_color: "#7c3aed",
  admin_nome: "",
  admin_email: "",
  admin_password: "",
  admin_password_confirm: "",
};

const STEPS = [
  { id: "identity", label: "Identidade", num: 1 },
  { id: "visual",   label: "Aparência",  num: 2 },
  { id: "admin",    label: "Admin",      num: 3 },
] as const;

// ─── Live preview ─────────────────────────────────────────────────────────────

function LoginPreview({ form }: { form: Form }) {
  const primary = form.primary_color || "#2563eb";
  const dark    = darken(primary);
  const shadow  = hexToRgba(primary, 0.25);
  const appName = form.app_name || form.company_name || "Sua Plataforma";
  const logo    = form.logo_url;
  const slug    = form.slug || "minha-empresa";

  return (
    <div className="rounded-2xl overflow-hidden border border-gray-200 shadow-xl select-none">
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-3 py-2 bg-gray-100 border-b border-gray-200">
        <span className="w-2.5 h-2.5 rounded-full bg-red-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" />
        <span className="w-2.5 h-2.5 rounded-full bg-green-400" />
        <div className="flex-1 mx-2 bg-white rounded-md text-[9px] text-gray-400 px-2 py-0.5 text-center truncate">
          {slug}.pricetracker.com.br
        </div>
      </div>

      {/* Page body */}
      <div
        className="px-6 py-8 flex flex-col items-center gap-5"
        style={{ background: `linear-gradient(135deg, #f8fafc 0%, ${hexToRgba(primary, 0.06)} 100%)` }}
      >
        {/* Logo + name */}
        <div className="text-center">
          {logo ? (
            <img src={logo} alt="Logo" className="h-12 w-12 rounded-2xl object-contain mx-auto mb-3 shadow" />
          ) : (
            <div
              className="h-12 w-12 rounded-2xl flex items-center justify-center mx-auto mb-3 shadow-lg text-white font-bold text-xl"
              style={{ background: `linear-gradient(135deg, ${primary}, ${dark})`, boxShadow: `0 8px 20px ${shadow}` }}
            >
              {appName.charAt(0).toUpperCase()}
            </div>
          )}
          <p className="font-bold text-sm text-gray-900">{appName}</p>
          <p className="text-[10px] text-gray-400 mt-0.5">Acesse sua conta</p>
        </div>

        {/* Login card */}
        <div className="w-full bg-white rounded-2xl shadow border border-gray-100 p-4 space-y-2.5">
          <div className="rounded-lg bg-slate-50 border border-gray-200 h-8 text-[9px] text-gray-300 px-3 flex items-center">
            seu@email.com
          </div>
          <div className="rounded-lg bg-slate-50 border border-gray-200 h-8 text-[9px] text-gray-300 px-3 flex items-center">
            ••••••••
          </div>
          <button
            className="w-full h-9 rounded-xl text-[10px] font-semibold text-white transition-all"
            style={{
              background: `linear-gradient(135deg, ${primary}, ${dark})`,
              boxShadow: `0 4px 12px ${shadow}`,
            }}
          >
            Entrar na plataforma
          </button>
        </div>

        {/* Footer */}
        <p className="text-[9px] text-gray-400">© 2025 {appName}</p>
      </div>
    </div>
  );
}

// ─── Color picker ─────────────────────────────────────────────────────────────

function ColorPicker({
  label,
  value,
  presets,
  onChange,
}: {
  label: string;
  value: string;
  presets: { label: string; hex: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <div className="space-y-2.5">
      <label className="block text-sm font-semibold text-gray-700">{label}</label>
      <div className="flex flex-wrap gap-2">
        {presets.map((p) => (
          <button
            key={p.hex}
            type="button"
            title={p.label}
            onClick={() => onChange(p.hex)}
            className="w-8 h-8 rounded-full transition-all ring-offset-2"
            style={{
              backgroundColor: p.hex,
              boxShadow: value === p.hex ? `0 0 0 3px white, 0 0 0 5px ${p.hex}` : "none",
              transform: value === p.hex ? "scale(1.1)" : "scale(1)",
            }}
          />
        ))}
      </div>
      <div className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 bg-gray-50">
        <div className="relative">
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="opacity-0 absolute inset-0 w-full h-full cursor-pointer"
          />
          <div
            className="w-9 h-9 rounded-lg shadow-sm border border-black/10 cursor-pointer"
            style={{ backgroundColor: value }}
          />
        </div>
        <div className="flex-1">
          <p className="text-xs text-gray-400 mb-0.5">Personalizado</p>
          <input
            type="text"
            value={value}
            onChange={(e) => {
              const v = e.target.value;
              if (/^#[0-9a-fA-F]{0,6}$/.test(v)) onChange(v);
            }}
            className="font-mono text-sm text-gray-800 bg-transparent outline-none w-24 border-b border-dashed border-gray-300 focus:border-gray-600"
          />
        </div>
        <div className="w-12 h-12 rounded-xl shadow-md border border-black/5" style={{ backgroundColor: value }} />
      </div>
    </div>
  );
}

// ─── Field ─────────────────────────────────────────────────────────────────────

function Field({ label, hint, required, children }: {
  label: string; hint?: string; required?: boolean; children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-semibold text-gray-700 mb-1.5">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {hint && <p className="text-xs text-gray-400 mt-1.5">{hint}</p>}
    </div>
  );
}

const INPUT = "w-full border border-gray-200 rounded-xl px-3.5 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500 transition-all bg-white placeholder-gray-300";

// ─── Step 1: Identidade ───────────────────────────────────────────────────────

function IdentityStep({
  form, setForm, slugStatus, onSubmit,
}: {
  form: Form;
  setForm: React.Dispatch<React.SetStateAction<Form>>;
  slugStatus: { available: boolean; reason: string | null } | null;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const logoInputRef = useRef<HTMLInputElement>(null);
  const [logoMode, setLogoMode] = useState<"upload" | "url">("upload");

  function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 500 * 1024) {
      alert("Logo deve ter menos de 500 KB");
      return;
    }
    const reader = new FileReader();
    reader.onload = (ev) => {
      if (ev.target?.result)
        setForm((f) => ({ ...f, logo_url: ev.target!.result as string }));
    };
    reader.readAsDataURL(file);
  }

  return (
    <form onSubmit={onSubmit} className="p-8 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-gray-900">Identidade da plataforma</h2>
        <p className="text-sm text-gray-500 mt-1">Como sua empresa vai se apresentar aos usuários</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
        <Field label="Nome da empresa" required>
          <input
            className={INPUT}
            placeholder="Ex: Construtora Silva"
            value={form.company_name}
            onChange={(e) => setForm((f) => ({ ...f, company_name: e.target.value }))}
            required
            minLength={2}
          />
        </Field>

        <Field label="Nome da plataforma" hint="Como aparece para os usuários">
          <input
            className={INPUT}
            placeholder={form.company_name || "Ex: Silva Atacado"}
            value={form.app_name}
            onChange={(e) => setForm((f) => ({ ...f, app_name: e.target.value }))}
          />
        </Field>
      </div>

      <Field
        label="Subdomínio"
        required
        hint={`Endereço de acesso: ${form.slug || "minha-empresa"}.pricetracker.com.br`}
      >
        <div className="flex items-center border rounded-xl overflow-hidden focus-within:ring-2 focus-within:ring-blue-500/30 focus-within:border-blue-500 transition-all bg-white"
          style={{ borderColor: slugStatus ? (slugStatus.available ? "#86efac" : "#fca5a5") : "#e5e7eb" }}>
          <span className="px-3 text-sm text-gray-400 bg-gray-50 border-r border-gray-200 h-full flex items-center py-2.5 select-none">
            slug
          </span>
          <input
            className="flex-1 px-3 py-2.5 text-sm outline-none bg-transparent placeholder-gray-300"
            placeholder="minha-empresa"
            value={form.slug}
            onChange={(e) => setForm((f) => ({ ...f, slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "") }))}
            required
            minLength={4}
          />
          {form.slug.length >= 4 && (
            <span className={`px-3 text-xs font-semibold whitespace-nowrap ${
              slugStatus === null ? "text-gray-400" :
              slugStatus.available ? "text-green-600" : "text-red-500"
            }`}>
              {slugStatus === null ? "verificando…" : slugStatus.available ? "✓ disponível" : "✗ indisponível"}
            </span>
          )}
        </div>
        {slugStatus && !slugStatus.available && (
          <p className="text-xs text-red-500 mt-1">{slugStatus.reason}</p>
        )}
      </Field>

      {/* Logo */}
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Logo da empresa</label>
        <div className="flex gap-2 mb-3">
          {(["upload", "url"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setLogoMode(m)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-lg transition-all ${
                logoMode === m
                  ? "bg-blue-600 text-white shadow-sm"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {m === "upload" ? "Upload de arquivo" : "URL da imagem"}
            </button>
          ))}
        </div>

        {logoMode === "upload" ? (
          <div
            onClick={() => logoInputRef.current?.click()}
            className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all group"
          >
            {form.logo_url ? (
              <div className="flex items-center justify-center gap-4">
                <img src={form.logo_url} alt="Logo" className="h-14 w-14 rounded-xl object-contain shadow" />
                <div className="text-left">
                  <p className="text-sm font-medium text-gray-700">Logo carregado</p>
                  <p className="text-xs text-gray-400">Clique para trocar</p>
                </div>
              </div>
            ) : (
              <div>
                <div className="w-10 h-10 rounded-xl bg-gray-100 flex items-center justify-center mx-auto mb-2 group-hover:bg-blue-100 transition-colors">
                  <svg className="w-5 h-5 text-gray-400 group-hover:text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <p className="text-sm text-gray-600 font-medium">Clique para fazer upload</p>
                <p className="text-xs text-gray-400 mt-0.5">PNG, JPG, SVG • máx 500 KB</p>
              </div>
            )}
            <input
              ref={logoInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleLogoFile}
            />
          </div>
        ) : (
          <div className="space-y-2">
            <input
              className={INPUT}
              placeholder="https://empresa.com/logo.png"
              value={form.logo_url.startsWith("data:") ? "" : form.logo_url}
              onChange={(e) => setForm((f) => ({ ...f, logo_url: e.target.value }))}
            />
            {form.logo_url && !form.logo_url.startsWith("data:") && (
              <div className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                <img
                  src={form.logo_url}
                  alt="Preview"
                  className="h-10 w-10 rounded-lg object-contain"
                  onError={(e) => (e.currentTarget.style.display = "none")}
                />
                <p className="text-xs text-gray-500">Preview do logo</p>
              </div>
            )}
          </div>
        )}

        {form.logo_url && (
          <button
            type="button"
            onClick={() => setForm((f) => ({ ...f, logo_url: "" }))}
            className="mt-2 text-xs text-red-500 hover:underline"
          >
            Remover logo
          </button>
        )}
      </div>

      <button
        type="submit"
        disabled={!slugStatus?.available}
        className="w-full py-3 rounded-xl font-semibold text-sm text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200"
      >
        Continuar → Aparência
      </button>
    </form>
  );
}

// ─── Step 2: Visual ───────────────────────────────────────────────────────────

function VisualStep({
  form, setForm, onBack, onSubmit,
}: {
  form: Form;
  setForm: React.Dispatch<React.SetStateAction<Form>>;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  return (
    <form onSubmit={onSubmit}>
      <div className="grid grid-cols-1 md:grid-cols-2 divide-y md:divide-y-0 md:divide-x divide-gray-100">
        {/* Left: pickers */}
        <div className="p-8 space-y-7">
          <div>
            <h2 className="text-xl font-bold text-gray-900">Aparência</h2>
            <p className="text-sm text-gray-500 mt-1">Defina as cores da sua plataforma</p>
          </div>

          <ColorPicker
            label="Cor principal"
            value={form.primary_color}
            presets={PRIMARY_PRESETS}
            onChange={(v) => setForm((f) => ({ ...f, primary_color: v }))}
          />

          <ColorPicker
            label="Cor de destaque"
            value={form.accent_color}
            presets={ACCENT_PRESETS}
            onChange={(v) => setForm((f) => ({ ...f, accent_color: v }))}
          />

          {/* Color summary */}
          <div className="flex gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-lg shadow-sm" style={{ backgroundColor: form.primary_color }} />
              <div>
                <p className="text-[10px] text-gray-400 leading-none">Principal</p>
                <p className="font-mono text-xs text-gray-700">{form.primary_color}</p>
              </div>
            </div>
            <div className="w-px bg-gray-200" />
            <div className="flex gap-2 items-center">
              <div className="w-7 h-7 rounded-lg shadow-sm" style={{ backgroundColor: form.accent_color }} />
              <div>
                <p className="text-[10px] text-gray-400 leading-none">Destaque</p>
                <p className="font-mono text-xs text-gray-700">{form.accent_color}</p>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onBack}
              className="flex-none px-5 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all">
              ← Voltar
            </button>
            <button type="submit"
              className="flex-1 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200 transition-all">
              Continuar → Administrador
            </button>
          </div>
        </div>

        {/* Right: preview */}
        <div className="p-8 bg-gray-50/60 flex flex-col gap-4">
          <div>
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">Preview da plataforma</p>
            <LoginPreview form={form} />
          </div>
          <p className="text-xs text-gray-400 text-center">Visualização em tempo real</p>
        </div>
      </div>
    </form>
  );
}

// ─── Step 3: Admin ────────────────────────────────────────────────────────────

function AdminStep({
  form, setForm, loading, error, onBack, onSubmit,
}: {
  form: Form;
  setForm: React.Dispatch<React.SetStateAction<Form>>;
  loading: boolean;
  error: string | null;
  onBack: () => void;
  onSubmit: (e: React.FormEvent) => void;
}) {
  const set = (k: keyof Form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const passMatch = form.admin_password && form.admin_password === form.admin_password_confirm;
  const passMismatch = form.admin_password_confirm && form.admin_password !== form.admin_password_confirm;

  return (
    <form onSubmit={onSubmit} className="p-8 space-y-6">
      <div>
        <div className="flex items-center gap-3 mb-1">
          {form.logo_url ? (
            <img src={form.logo_url} alt="" className="h-8 w-8 rounded-lg object-contain" />
          ) : (
            <div className="h-8 w-8 rounded-lg flex items-center justify-center text-white text-sm font-bold"
              style={{ backgroundColor: form.primary_color }}>
              {(form.app_name || form.company_name).charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <h2 className="text-xl font-bold text-gray-900">Conta do administrador</h2>
            <p className="text-sm text-gray-500">Admin de <strong>{form.app_name || form.company_name}</strong></p>
          </div>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 rounded-xl p-3.5 text-sm flex items-start gap-2.5">
          <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          {error}
        </div>
      )}

      <div className="space-y-4">
        <Field label="Nome completo" required>
          <input className={INPUT} placeholder="João Silva" value={form.admin_nome} onChange={set("admin_nome")} required />
        </Field>
        <Field label="E-mail" required>
          <input type="email" className={INPUT} placeholder="joao@empresa.com" value={form.admin_email} onChange={set("admin_email")} required />
        </Field>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Field label="Senha" required>
            <input
              type="password"
              className={INPUT}
              placeholder="Mínimo 6 caracteres"
              value={form.admin_password}
              onChange={set("admin_password")}
              required
              minLength={6}
            />
          </Field>
          <Field label="Confirmar senha" required>
            <div className="relative">
              <input
                type="password"
                className={`${INPUT} pr-9 ${passMismatch ? "border-red-300 focus:border-red-400 focus:ring-red-200" : passMatch ? "border-green-300 focus:border-green-400 focus:ring-green-200" : ""}`}
                placeholder="Repita a senha"
                value={form.admin_password_confirm}
                onChange={set("admin_password_confirm")}
                required
              />
              {passMatch && (
                <svg className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            {passMismatch && <p className="text-xs text-red-500 mt-1">As senhas não coincidem</p>}
          </Field>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onBack}
          className="flex-none px-5 py-3 rounded-xl text-sm font-semibold text-gray-600 border border-gray-200 hover:bg-gray-50 transition-all">
          ← Voltar
        </button>
        <button
          type="submit"
          disabled={loading || !!passMismatch || !form.admin_password || !form.admin_password_confirm}
          className="flex-1 py-3 rounded-xl font-semibold text-sm text-white bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 shadow-lg shadow-blue-200 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Criando plataforma…
            </span>
          ) : "Criar minha plataforma →"}
        </button>
      </div>
    </form>
  );
}

// ─── Step 4: Success ──────────────────────────────────────────────────────────

function SuccessStep({
  result, form,
}: {
  result: { tenant: { name: string; slug: string }; user: { email: string }; accessUrl: string };
  form: Form;
}) {
  const [copied, setCopied] = useState(false);

  function copyUrl() {
    navigator.clipboard.writeText(result.accessUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div className="p-8 space-y-7">
      {/* Header */}
      <div className="text-center">
        <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg"
          style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${darken(form.primary_color)})` }}>
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-gray-900">Plataforma criada!</h2>
        <p className="text-gray-500 text-sm mt-1">Bem-vindo(a), <strong>{result.user.email}</strong></p>
      </div>

      {/* Branding card */}
      <div className="rounded-2xl border border-gray-200 overflow-hidden">
        {/* Color band */}
        <div className="h-2" style={{ background: `linear-gradient(90deg, ${form.primary_color}, ${form.accent_color})` }} />
        <div className="p-5 flex items-center gap-4">
          {form.logo_url ? (
            <img src={form.logo_url} alt="Logo" className="h-14 w-14 rounded-xl object-contain shadow-sm border border-gray-100" />
          ) : (
            <div className="h-14 w-14 rounded-xl flex items-center justify-center text-white text-2xl font-bold shadow-md"
              style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${darken(form.primary_color)})` }}>
              {(form.app_name || form.company_name).charAt(0).toUpperCase()}
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="font-bold text-gray-900 text-lg truncate">{form.app_name || form.company_name}</p>
            <p className="text-sm text-gray-500 truncate">{result.tenant.slug}.pricetracker.com.br</p>
            <div className="flex gap-2 mt-2">
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-medium"
                style={{ backgroundColor: form.primary_color }}>
                Principal: {form.primary_color}
              </span>
              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full text-white font-medium"
                style={{ backgroundColor: form.accent_color }}>
                Destaque: {form.accent_color}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Access URL */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Link de acesso</p>
        <div className="flex items-center gap-2 p-3 rounded-xl bg-gray-50 border border-gray-200">
          <span className="flex-1 font-mono text-sm text-blue-600 truncate">{result.accessUrl}</span>
          <button
            onClick={copyUrl}
            className="flex-none px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: copied ? "#dcfce7" : "#f1f5f9",
              color: copied ? "#16a34a" : "#475569",
            }}
          >
            {copied ? "✓ Copiado" : "Copiar"}
          </button>
        </div>
      </div>

      {/* Actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <a
          href={result.accessUrl}
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-white shadow-lg transition-all hover:opacity-90"
          style={{ background: `linear-gradient(135deg, ${form.primary_color}, ${darken(form.primary_color)})` }}
        >
          Acessar plataforma
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
          </svg>
        </a>
        <Link
          href="/login"
          className="flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-sm text-gray-700 border border-gray-200 hover:bg-gray-50 transition-all"
        >
          Fazer login agora
        </Link>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CadastroPage() {
  const [step, setStep] = useState<Step>("identity");
  const [form, setForm] = useState<Form>(INITIAL);
  const [slugStatus, setSlugStatus] = useState<{ available: boolean; reason: string | null } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    tenant: { name: string; slug: string };
    user: { email: string };
    accessUrl: string;
  } | null>(null);
  const slugTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-generate slug from company name
  useEffect(() => {
    if (step !== "identity") return;
    const generated = form.company_name
      .toLowerCase()
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 32);
    setForm((f) => ({
      ...f,
      slug: generated,
      app_name: f.app_name || f.company_name,
    }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.company_name]);

  // Debounced slug check
  useEffect(() => {
    if (step !== "identity") return;
    setSlugStatus(null);
    if (form.slug.length < 4) return;
    if (slugTimer.current) clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(async () => {
      const res = await tenantsApi.checkSlug(form.slug).catch(() => null);
      if (res) setSlugStatus(res as { available: boolean; reason: string | null });
    }, 500);
    return () => { if (slugTimer.current) clearTimeout(slugTimer.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.slug, step]);

  async function submitAdmin(e: React.FormEvent) {
    e.preventDefault();
    if (form.admin_password !== form.admin_password_confirm) {
      setError("As senhas não coincidem");
      return;
    }
    setError(null);
    setLoading(true);
    try {
      const res = await tenantsApi.signup({
        company_name: form.company_name,
        app_name: form.app_name || form.company_name,
        slug: form.slug,
        primary_color: form.primary_color,
        accent_color: form.accent_color,
        logo_url: form.logo_url,
        admin_nome: form.admin_nome,
        admin_email: form.admin_email,
        admin_password: form.admin_password,
      });
      setResult({
        tenant: res.tenant,
        user: res.user,
        accessUrl: getTenantUrl(res.tenant.slug),
      });
      setStep("success");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Erro ao criar conta");
    } finally {
      setLoading(false);
    }
  }

  const currentStepIdx = STEPS.findIndex((s) => s.id === step);
  const isWide = step === "visual";

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50/20 to-indigo-50/40 flex items-start justify-center p-4 py-12">
      <div className={`w-full transition-all duration-300 ${isWide ? "max-w-4xl" : "max-w-xl"}`}>
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-12 h-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl mb-4 shadow-lg shadow-blue-200">
            <svg className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Criar sua plataforma</h1>
          <p className="text-gray-400 mt-1.5 text-sm">Configure em minutos e comece a usar hoje</p>
        </div>

        {/* Stepper */}
        {step !== "success" && (
          <div className="flex items-center justify-center gap-1 mb-8">
            {STEPS.map((s, i) => (
              <div key={s.id} className="flex items-center gap-1">
                <div className="flex items-center gap-2 px-1">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    currentStepIdx > i
                      ? "bg-green-500 text-white shadow-sm shadow-green-200"
                      : currentStepIdx === i
                      ? "bg-blue-600 text-white shadow-md shadow-blue-200"
                      : "bg-white border-2 border-gray-200 text-gray-400"
                  }`}>
                    {currentStepIdx > i
                      ? <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
                      : s.num}
                  </div>
                  <span className={`text-sm font-medium hidden sm:block ${
                    currentStepIdx === i ? "text-gray-900" : currentStepIdx > i ? "text-green-600" : "text-gray-400"
                  }`}>
                    {s.label}
                  </span>
                </div>
                {i < STEPS.length - 1 && (
                  <div className={`h-0.5 w-6 sm:w-12 rounded-full mx-1 transition-all ${currentStepIdx > i ? "bg-green-400" : "bg-gray-200"}`} />
                )}
              </div>
            ))}
          </div>
        )}

        {/* Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-gray-200/50 border border-gray-100 overflow-hidden">
          {step === "identity" && (
            <IdentityStep
              form={form}
              setForm={setForm}
              slugStatus={slugStatus}
              onSubmit={(e) => { e.preventDefault(); if (slugStatus?.available) setStep("visual"); }}
            />
          )}
          {step === "visual" && (
            <VisualStep
              form={form}
              setForm={setForm}
              onBack={() => setStep("identity")}
              onSubmit={(e) => { e.preventDefault(); setStep("admin"); }}
            />
          )}
          {step === "admin" && (
            <AdminStep
              form={form}
              setForm={setForm}
              loading={loading}
              error={error}
              onBack={() => setStep("visual")}
              onSubmit={submitAdmin}
            />
          )}
          {step === "success" && result && (
            <SuccessStep result={result} form={form} />
          )}
        </div>

        {step !== "success" && (
          <p className="text-center text-sm text-gray-400 mt-6">
            Já tem uma conta?{" "}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">Fazer login</Link>
          </p>
        )}
      </div>
    </div>
  );
}
