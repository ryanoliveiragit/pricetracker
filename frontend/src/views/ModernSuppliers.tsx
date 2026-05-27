"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Edit2,
  Globe,
  Loader2,
  Lock,
  MapPin,
  Plus,
  Power,
  Search,
  ShieldCheck,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { forwardRef, useEffect, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { useSuppliers } from "../context/SupplierContext";
import { LoginError } from "../services/api";
import type { Supplier } from "../types/supplier";
import { supplierSchema, type SupplierFormData } from "../schemas/validation";
import ImageUploadCrop from "../components/ImageUploadCrop";

const EMPTY_FORM: SupplierFormData = {
  name: "",
  url: "",
  logo: "",
  requiresLogin: false,
  username: "",
  password: "",
  region: "",
  notes: "",
};

const ACCENT = "rgb(var(--primary-500))";
const ACCENT_SOFT = "rgb(var(--primary-500) / 0.10)";
const ACCENT_BORDER = "rgb(var(--primary-500) / 0.25)";

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex justify-between items-center">
        <label className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </label>
        {error && (
          <span className="text-[11px] text-destructive flex items-center gap-1">
            <AlertCircle size={10} /> {error}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const inputStyle = (focused: boolean, extra?: React.CSSProperties): React.CSSProperties => ({
  width: "100%",
  padding: "9px 12px",
  borderRadius: "calc(var(--radius) - 4px)",
  border: `1px solid ${focused ? ACCENT : "hsl(var(--border))"}`,
  background: focused ? "hsl(var(--background))" : "hsl(var(--muted))",
  fontSize: 13,
  color: "hsl(var(--foreground))",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 150ms, box-shadow 150ms, background 150ms",
  boxShadow: focused ? `0 0 0 3px ${ACCENT_SOFT}` : "none",
  ...extra,
});

const StyledInput = forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  function StyledInput({ onFocus, onBlur, style, ...props }, ref) {
    const [focused, setFocused] = useState(false);
    return (
      <input
        {...props}
        ref={ref}
        onFocus={e => { setFocused(true); onFocus?.(e); }}
        onBlur={e => { setFocused(false); onBlur?.(e); }}
        style={inputStyle(focused, style)}
      />
    );
  }
);

const StyledTextarea = forwardRef<HTMLTextAreaElement, React.TextareaHTMLAttributes<HTMLTextAreaElement>>(
  function StyledTextarea({ onFocus, onBlur, style, ...props }, ref) {
    const [focused, setFocused] = useState(false);
    return (
      <textarea
        {...props}
        ref={ref}
        onFocus={e => { setFocused(true); onFocus?.(e); }}
        onBlur={e => { setFocused(false); onBlur?.(e); }}
        style={inputStyle(focused, { resize: "none", ...style })}
      />
    );
  }
);

const StyledSelect = forwardRef<HTMLSelectElement, React.SelectHTMLAttributes<HTMLSelectElement>>(
  function StyledSelect({ onFocus, onBlur, style, ...props }, ref) {
    const [focused, setFocused] = useState(false);
    return (
      <select
        {...props}
        ref={ref}
        onFocus={e => { setFocused(true); onFocus?.(e); }}
        onBlur={e => { setFocused(false); onBlur?.(e); }}
        style={inputStyle(focused, { cursor: "pointer", ...style })}
      />
    );
  }
);

function ToggleRow({
  icon,
  title,
  description,
  checked,
  onChange,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <label className="flex items-center gap-3 py-2 cursor-pointer select-none group">
      <div className="flex-1 flex items-start gap-2.5 min-w-0">
        <span
          className="mt-0.5 flex-shrink-0 transition-colors"
          style={{ color: checked ? ACCENT : "hsl(var(--muted-foreground))" }}
        >
          {icon}
        </span>
        <div className="min-w-0">
          <p
            className="text-[13px] font-medium leading-tight transition-colors"
            style={{ color: checked ? ACCENT : "hsl(var(--foreground))" }}
          >
            {title}
          </p>
          <p className="text-[11px] text-muted-foreground mt-0.5 leading-snug">{description}</p>
        </div>
      </div>
      {/* Toggle pill */}
      <div
        className="relative flex-shrink-0 w-10 h-[22px] rounded-full transition-all duration-200"
        style={{ background: checked ? ACCENT : "hsl(var(--border))" }}
      >
        <div
          className="absolute top-[3px] w-4 h-4 rounded-full bg-white shadow transition-all duration-200"
          style={{ left: checked ? "22px" : "3px" }}
        />
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
          className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
        />
      </div>
    </label>
  );
}

export default function ModernSuppliers() {
  const { suppliers, loading: suppliersLoading, error: suppliersError, refetch, createSupplier, updateSupplier, removeSupplier, toggleSupplierStatus } =
    useSuppliers();

  useEffect(() => { void refetch(); }, []);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
    watch,
  } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: EMPTY_FORM,
  });

  const requiresLogin = watch("requiresLogin");
  const [requiresRegion, setRequiresRegion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return suppliers;
    const q = searchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        s.url.toLowerCase().includes(q) ||
        s.region?.toLowerCase().includes(q),
    );
  }, [suppliers, searchQuery]);

  const activeCount = suppliers.filter((s) => s.isActive).length;
  const credCount = suppliers.filter((s) => s.requiresLogin).length;

  async function onSubmit(data: SupplierFormData) {
    setIsSaving(true);
    setLoginError(null);
    try {
      if (editingId) await updateSupplier(editingId, data);
      else await createSupplier(data);
      reset(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
    } catch (err) {
      if (err instanceof LoginError) {
        setLoginError(err.message);
      } else {
        toast.error("Erro ao salvar fornecedor");
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleEdit(supplier: Supplier) {
    const data: SupplierFormData = {
      name: supplier.name,
      url: supplier.url,
      logo: supplier.logo || "",
      requiresLogin: supplier.requiresLogin,
      username: supplier.username || "",
      password: supplier.password || "",
      region: supplier.region || "",
      notes: supplier.notes || "",
    };
    setRequiresRegion(!!supplier.region);
    setEditingId(supplier.id);
    setShowForm(true);
    // setTimeout(0) garante reset() após o form montar e os refs do
    // react-hook-form estarem registrados (AnimatePresence desmonta o form).
    setTimeout(() => reset(data), 0);
  }

  function handleCancel() {
    reset(EMPTY_FORM);
    setRequiresRegion(false);
    setEditingId(null);
    setShowForm(false);
    setLoginError(null);
  }

  function handleDelete(id: string) {
    if (deleteConfirm === id) {
      removeSupplier(id);
      setDeleteConfirm(null);
    } else {
      setDeleteConfirm(id);
      setTimeout(() => setDeleteConfirm(null), 3000);
    }
  }

  return (
    <div className="max-w-[1100px] mx-auto px-6 py-7">

      {/* ── Header ── */}
      <div className="flex items-start justify-between gap-4 mb-7 flex-wrap">
        <div>
          <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground mb-1">
            Configurações
          </p>
          <h1 className="text-[22px] font-bold text-foreground tracking-tight leading-none">
            Lojas &amp; Fornecedores
          </h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 text-[13px] font-semibold text-white cursor-pointer transition-opacity hover:opacity-90 active:opacity-80"
          style={{
            background: ACCENT,
            border: "none",
            borderRadius: "calc(var(--radius) - 2px)",
            fontFamily: "inherit",
            boxShadow: `0 2px 8px -1px rgb(var(--primary-500) / 0.35)`,
          }}
        >
          <Plus size={14} /> Novo Fornecedor
        </button>
      </div>

      {/* ── Error / Loading state ── */}
      {suppliersLoading && (
        <div className="flex items-center gap-2 py-3 mb-4 text-sm text-muted-foreground">
          <Loader2 size={14} className="animate-spin" /> Carregando fornecedores...
        </div>
      )}
      {suppliersError && !suppliersLoading && (
        <div
          className="flex items-center gap-3 px-4 py-3 rounded-xl mb-4 text-sm"
          style={{ background: "hsl(var(--destructive)/0.07)", border: "1px solid hsl(var(--destructive)/0.2)", color: "hsl(var(--destructive))" }}
        >
          <AlertCircle size={15} className="flex-shrink-0" />
          <span>Erro ao carregar fornecedores: {suppliersError}</span>
          <button
            onClick={() => void refetch()}
            className="ml-auto text-xs underline underline-offset-2"
          >
            Tentar novamente
          </button>
        </div>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-3 gap-3 mb-5">
        {[
          {
            label: "Cadastrados",
            value: suppliers.length,
            icon: <Store size={13} />,
            highlight: false,
          },
          {
            label: "Ativos",
            value: activeCount,
            icon: <CheckCircle2 size={13} />,
            highlight: activeCount > 0,
          },
          {
            label: "Com login",
            value: credCount,
            icon: <Lock size={13} />,
            highlight: false,
          },
        ].map((stat) => (
          <div
            key={stat.label}
            className="bg-card border border-border px-4 py-3.5"
            style={{
              borderRadius: "var(--radius)",
              borderColor: stat.highlight ? ACCENT_BORDER : undefined,
            }}
          >
            <div
              className="flex items-center gap-1.5 mb-2 text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground"
              style={stat.highlight ? { color: ACCENT } : undefined}
            >
              {stat.icon}
              {stat.label}
            </div>
            <div
              className="text-[26px] font-bold leading-none text-foreground"
              style={stat.highlight && stat.value > 0 ? { color: ACCENT } : undefined}
            >
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* ── Search bar ── */}
      <div className="relative mb-4">
        <Search
          size={14}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
        />
        <StyledInput
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Pesquisar por nome, URL ou região..."
          style={{ paddingLeft: 34 }}
        />
      </div>

      {/* ── Supplier grid ── */}
      {filteredSuppliers.length === 0 ? (
        <div
          className="border border-dashed border-border bg-muted/30 py-14 px-6 text-center"
          style={{ borderRadius: "var(--radius)" }}
        >
          <Store size={30} className="text-muted-foreground/40 mx-auto mb-3" />
          <p className="text-sm font-semibold text-foreground/60 mb-1">
            {searchQuery ? "Nenhum resultado encontrado" : "Nenhum fornecedor cadastrado"}
          </p>
          <p className="text-xs text-muted-foreground">
            {searchQuery
              ? "Tente outro termo de busca."
              : "Clique em 'Novo Fornecedor' para adicionar."}
          </p>
        </div>
      ) : (
        <div
          className="grid gap-3"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))" }}
        >
          <AnimatePresence initial={false}>
            {filteredSuppliers.map((supplier) => (
              <motion.div
                key={supplier.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: supplier.isActive ? 1 : 0.5, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                className="bg-card border border-border relative overflow-hidden transition-shadow hover:shadow-[0_4px_14px_0_rgb(0_0_0/0.07)] dark:hover:shadow-[0_4px_14px_0_rgb(0_0_0/0.25)]"
                style={{
                  borderRadius: "var(--radius)",
                  padding: 18,
                  borderColor: supplier.isActive ? ACCENT_BORDER : undefined,
                }}
              >
                {/* Active accent line */}
                {supplier.isActive && (
                  <div
                    className="absolute top-0 left-0 right-0 h-[2px]"
                    style={{ background: ACCENT }}
                  />
                )}

                {/* Card header */}
                <div className="flex items-start gap-3 mb-3.5">
                  {supplier.logo ? (
                    <img
                      src={supplier.logo}
                      alt={supplier.name}
                      className="w-10 h-10 rounded-lg border border-border object-contain p-1 bg-background flex-shrink-0"
                    />
                  ) : (
                    <div
                      className="w-10 h-10 rounded-lg flex-shrink-0 grid place-items-center"
                      style={{
                        background: ACCENT_SOFT,
                        border: `1px solid ${ACCENT_BORDER}`,
                        color: ACCENT,
                      }}
                    >
                      <Store size={17} />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-card-foreground mb-0.5 truncate">
                      {supplier.name}
                    </h3>
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1 truncate">
                      <Globe size={10} />
                      {supplier.url.replace(/^https?:\/\//, "").split("/")[0]}
                    </p>
                  </div>

                  {/* Power toggle */}
                  <button
                    onClick={() => toggleSupplierStatus(supplier.id)}
                    title={supplier.isActive ? "Desativar" : "Ativar"}
                    className="w-7 h-7 rounded-md flex-shrink-0 grid place-items-center cursor-pointer transition-all"
                    style={{
                      background: supplier.isActive ? ACCENT_SOFT : "hsl(var(--muted))",
                      border: `1px solid ${supplier.isActive ? ACCENT_BORDER : "hsl(var(--border))"}`,
                      color: supplier.isActive ? ACCENT : "hsl(var(--muted-foreground))",
                    }}
                  >
                    <Power size={12} />
                  </button>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3.5">
                  <span
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-[0.05em]"
                    style={{
                      background: supplier.isActive ? ACCENT_SOFT : "hsl(var(--muted))",
                      border: `1px solid ${supplier.isActive ? ACCENT_BORDER : "hsl(var(--border))"}`,
                      color: supplier.isActive ? ACCENT : "hsl(var(--muted-foreground))",
                    }}
                  >
                    {supplier.isActive ? <CheckCircle2 size={9} /> : <Power size={9} />}
                    {supplier.isActive ? "ATIVO" : "INATIVO"}
                  </span>
                  {supplier.requiresLogin && !supplier.username && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-[0.05em] bg-amber-50 border border-amber-200 text-amber-800 dark:bg-amber-500/10 dark:border-amber-500/25 dark:text-amber-400">
                      <Lock size={9} /> LOGIN
                    </span>
                  )}
                  {supplier.requiresLogin && supplier.username && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-[0.05em] bg-emerald-50 border border-emerald-200 text-emerald-700 dark:bg-emerald-500/10 dark:border-emerald-500/25 dark:text-emerald-400">
                      <ShieldCheck size={9} /> Verificado
                    </span>
                  )}
                  {supplier.region && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-semibold tracking-[0.05em] bg-blue-50 border border-blue-200 text-blue-700 dark:bg-blue-500/10 dark:border-blue-500/25 dark:text-blue-400">
                      <MapPin size={9} /> {supplier.region.toUpperCase()}
                    </span>
                  )}
                </div>

                {supplier.notes && (
                  <p className="text-xs text-muted-foreground leading-relaxed mb-3.5 line-clamp-2">
                    {supplier.notes}
                  </p>
                )}

                {/* Actions */}
                <div className="flex gap-1.5 pt-3 border-t border-border">
                  <button
                    onClick={() => handleEdit(supplier)}
                    className="flex-1 flex items-center justify-center gap-1.5 py-[7px] rounded-md text-xs font-medium text-muted-foreground bg-muted border border-border cursor-pointer transition-all"
                    style={{ fontFamily: "inherit" }}
                    onMouseEnter={e => {
                      const el = e.currentTarget;
                      el.style.background = ACCENT_SOFT;
                      el.style.borderColor = ACCENT_BORDER;
                      el.style.color = ACCENT;
                    }}
                    onMouseLeave={e => {
                      const el = e.currentTarget;
                      el.style.background = "";
                      el.style.borderColor = "";
                      el.style.color = "";
                    }}
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id)}
                    className="flex items-center justify-center gap-1.5 px-3 py-[7px] rounded-md text-xs font-medium cursor-pointer transition-all"
                    title={
                      deleteConfirm === supplier.id
                        ? "Clique novamente para confirmar"
                        : "Excluir"
                    }
                    style={{
                      background:
                        deleteConfirm === supplier.id
                          ? "hsl(var(--destructive) / 0.08)"
                          : "hsl(var(--muted))",
                      border: `1px solid ${
                        deleteConfirm === supplier.id
                          ? "hsl(var(--destructive) / 0.35)"
                          : "hsl(var(--border))"
                      }`,
                      color:
                        deleteConfirm === supplier.id
                          ? "hsl(var(--destructive))"
                          : "hsl(var(--muted-foreground))",
                      fontFamily: "inherit",
                    }}
                  >
                    {deleteConfirm === supplier.id ? (
                      <><AlertCircle size={12} /> Confirmar</>
                    ) : (
                      <Trash2 size={12} />
                    )}
                  </button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Modal ── */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-6"
            style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(4px)" }}
            onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
          >
            <motion.form
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 380 }}
              onSubmit={handleSubmit(onSubmit)}
              className="w-full sm:max-w-[540px] bg-card flex flex-col overflow-hidden supplier-modal-form"
              style={{
                borderRadius: "16px 16px 0 0",
                border: "1px solid hsl(var(--border))",
                boxShadow: "0 -2px 24px rgba(0,0,0,0.12), 0 24px 64px rgba(0,0,0,0.2)",
                maxHeight: "94dvh",
              }}
            >
              {/* Drag handle — mobile only */}
              <div className="flex justify-center pt-2.5 pb-0 sm:hidden flex-shrink-0">
                <div className="w-10 h-[3px] rounded-full bg-border" />
              </div>

              {/* ── Header ── */}
              <div className="flex items-center justify-between gap-3 px-5 pt-4 pb-4 sm:pt-5 flex-shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  {/* Avatar */}
                  <div
                    className="w-10 h-10 rounded-xl flex-shrink-0 grid place-items-center"
                    style={{ background: ACCENT_SOFT, border: `1px solid ${ACCENT_BORDER}`, color: ACCENT }}
                  >
                    <Store size={18} />
                  </div>
                  <div className="min-w-0">
                    <h2 className="text-[15px] font-semibold text-foreground leading-tight">
                      {editingId ? "Editar fornecedor" : "Novo fornecedor"}
                    </h2>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {editingId ? "Atualize os dados da loja" : "Adicione uma nova loja às buscas"}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  className="w-8 h-8 rounded-lg grid place-items-center flex-shrink-0 cursor-pointer transition-colors text-muted-foreground hover:text-foreground hover:bg-muted"
                  style={{ border: "1px solid hsl(var(--border))" }}
                >
                  <X size={15} />
                </button>
              </div>

              {/* ── Divider ── */}
              <div className="h-px bg-border flex-shrink-0" />

              {/* ── Body ── */}
              <div className="overflow-y-auto flex-1 px-5 py-5">

                {/* Error banner */}
                <AnimatePresence>
                  {loginError && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="overflow-hidden mb-4"
                    >
                      <div
                        className="flex gap-3 p-3.5 rounded-xl"
                        style={{
                          background: "hsl(var(--destructive) / 0.07)",
                          border: "1px solid hsl(var(--destructive) / 0.2)",
                        }}
                      >
                        <AlertCircle size={15} className="flex-shrink-0 mt-0.5" style={{ color: "hsl(var(--destructive))" }} />
                        <div style={{ color: "hsl(var(--destructive))" }}>
                          <p className="text-xs font-semibold mb-0.5">Falha na autenticação</p>
                          <p className="text-xs leading-relaxed opacity-85">{loginError}</p>
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>

                {/* ══ Grid 2 colunas ══ */}
                <div className="supplier-form-grid">
                  {/* Nome */}
                  <div style={{ gridArea: "nome" }}>
                    <Field label="Nome da loja *" error={errors.name?.message}>
                      <StyledInput
                        type="text"
                        {...register("name")}
                        placeholder="Ex: Telhanorte Matriz"
                      />
                    </Field>
                  </div>

                  {/* URL */}
                  <div style={{ gridArea: "url" }}>
                    <Field label="URL do sistema *" error={errors.url?.message}>
                      <StyledInput
                        type="url"
                        {...register("url")}
                        placeholder="https://loja.com.br"
                      />
                    </Field>
                  </div>

                  {/* Logo — ocupa as 2 linhas acima */}
                  <div
                    style={{ gridArea: "logo" }}
                    className="flex flex-col items-center justify-center gap-2 rounded-xl"
                  >
                    <div
                      className="flex flex-col items-center justify-center gap-2 rounded-xl w-full h-full"
                      style={{ background: "hsl(var(--muted) / 0.5)", border: "1px solid hsl(var(--border))", minHeight: 104, padding: "12px 8px" }}
                    >
                      <div className="w-[72px]">
                        <ImageUploadCrop
                          value={watch("logo")}
                          onChange={(v) => setValue("logo", v)}
                          aspect={1}
                        />
                      </div>
                      <span className="text-[10px] text-muted-foreground font-medium">Logo</span>
                    </div>
                  </div>

                  {/* Sep 1 */}
                  <div style={{ gridArea: "sep1" }} className="h-px bg-border" />

                  {/* Toggle: Região */}
                  <div style={{ gridArea: "region" }}>
                    <ToggleRow
                      icon={<MapPin size={14} />}
                      title="Filtro regional"
                      description="Exige seleção de estado"
                      checked={requiresRegion}
                      onChange={(v) => { setRequiresRegion(v); if (!v) setValue("region", ""); }}
                    />
                  </div>

                  {/* Estado — col 2, aparece quando regional ativo */}
                  <div style={{ gridArea: "estado" }}>
                    <AnimatePresence initial={false}>
                      {requiresRegion ? (
                        <motion.div
                          key="estado"
                          initial={{ opacity: 0, scale: 0.97 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.97 }}
                          transition={{ duration: 0.15 }}
                        >
                          <Field label="Estado" error={errors.region?.message}>
                            <StyledSelect {...register("region")}>
                              <option value="">Selecione</option>
                              {["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS",
                                "MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC",
                                "SE","SP","TO"].map((uf) => (
                                <option key={uf} value={uf.toLowerCase()}>{uf}</option>
                              ))}
                            </StyledSelect>
                          </Field>
                        </motion.div>
                      ) : (
                        <div className="h-full rounded-lg border border-dashed border-border flex items-center justify-center" style={{ minHeight: 56 }}>
                          <span className="text-[11px] text-muted-foreground/50">Não aplicável</span>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Sep 2 */}
                  <div style={{ gridArea: "sep2" }} className="h-px bg-border" />

                  {/* Toggle: Login — full width */}
                  <div style={{ gridArea: "login" }}>
                    <ToggleRow
                      icon={<Lock size={14} />}
                      title="Requer autenticação B2B"
                      description="Credenciais do robô para preços restritos"
                      checked={requiresLogin}
                      onChange={(v) => setValue("requiresLogin", v)}
                    />
                  </div>

                  {/* Credenciais — full width, animado */}
                  <div style={{ gridArea: "creds" }}>
                    <AnimatePresence initial={false}>
                      {requiresLogin && (
                        <motion.div
                          key="creds"
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: "auto" }}
                          exit={{ opacity: 0, height: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div
                            className="flex flex-col gap-3 pt-3 pl-3 mt-1"
                            style={{ borderLeft: `2px solid ${ACCENT}` }}
                          >
                            {/* Status verificado — só aparece ao editar fornecedor com creds salvas */}
                            {editingId && suppliers.find(s => s.id === editingId)?.username && !loginError && (
                              <div
                                className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium"
                                style={{ background: "rgba(16,185,129,0.08)", border: "1px solid rgba(16,185,129,0.25)", color: "rgb(5,150,105)" }}
                              >
                                <ShieldCheck size={13} className="flex-shrink-0" />
                                Credenciais verificadas — login funcionando
                              </div>
                            )}
                            <div className="grid grid-cols-2 gap-3">
                            <Field label="Usuário B2B" error={errors.username?.message}>
                              <StyledInput
                                type="text"
                                placeholder="login@empresa.com"
                                {...register("username")}
                                onInput={() => setLoginError(null)}
                              />
                            </Field>
                            <Field label="Senha" error={errors.password?.message}>
                              <StyledInput
                                type="password"
                                placeholder="••••••••"
                                {...register("password")}
                                onInput={() => setLoginError(null)}
                              />
                            </Field>
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Sep 3 */}
                  <div style={{ gridArea: "sep3" }} className="h-px bg-border" />

                  {/* Observações — full width */}
                  <div style={{ gridArea: "notes" }}>
                    <Field label="Observações internas" error={errors.notes?.message}>
                      <StyledTextarea
                        {...register("notes")}
                        rows={2}
                        placeholder="Anotações sobre esta loja (opcional)..."
                      />
                    </Field>
                  </div>
                </div>
              </div>

              {/* ── Footer ── */}
              <div
                className="flex items-center justify-end gap-2 px-5 py-3.5 flex-shrink-0"
                style={{ borderTop: "1px solid hsl(var(--border))", background: "hsl(var(--muted) / 0.3)" }}
              >
                <button
                  type="button"
                  onClick={handleCancel}
                  className="px-4 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-colors"
                  style={{
                    fontFamily: "inherit",
                    color: "hsl(var(--muted-foreground))",
                    background: "transparent",
                    border: "1px solid hsl(var(--border))",
                  }}
                  onMouseEnter={e => { e.currentTarget.style.background = "hsl(var(--muted))"; }}
                  onMouseLeave={e => { e.currentTarget.style.background = "transparent"; }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="flex items-center gap-2 px-5 py-2 rounded-lg text-[13px] font-semibold text-white border-none cursor-pointer transition-all disabled:opacity-60 disabled:cursor-default"
                  style={{
                    background: ACCENT,
                    fontFamily: "inherit",
                    boxShadow: isSaving ? "none" : `0 2px 10px -2px rgb(var(--primary-500) / 0.45)`,
                  }}
                >
                  {isSaving
                    ? <><Loader2 size={13} className="animate-spin" />{requiresLogin ? "Verificando..." : "Salvando..."}</>
                    : <>{editingId ? "Salvar alterações" : "Cadastrar loja"}</>
                  }
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
