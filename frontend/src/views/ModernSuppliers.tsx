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
  RotateCcw,
  Store,
  Trash2,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSuppliers } from "../context/SupplierContext";
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
const ACCENT_BORDER = "rgb(var(--primary-500) / 0.30)";

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
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <label style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em", color: "#9ca3af" }}>
          {label}
        </label>
        {error && (
          <span style={{ fontSize: 11, color: "#ef4444", display: "flex", alignItems: "center", gap: 3 }}>
            <AlertCircle size={10} /> {error}
          </span>
        )}
      </div>
      {children}
    </div>
  );
}

const INPUT_STYLE: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  borderRadius: 8,
  border: "1px solid #e5e7eb",
  background: "#f9fafb",
  fontSize: 13,
  color: "#111827",
  outline: "none",
  fontFamily: "inherit",
  transition: "border-color 150ms, box-shadow 150ms",
};

function StyledInput(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <input
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={{
        ...INPUT_STYLE,
        borderColor: focused ? ACCENT : "#e5e7eb",
        boxShadow: focused ? `0 0 0 3px ${ACCENT_SOFT}` : "none",
        background: focused ? "#fff" : "#f9fafb",
        ...props.style,
      }}
    />
  );
}

function StyledTextarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <textarea
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={{
        ...INPUT_STYLE,
        resize: "none",
        borderColor: focused ? ACCENT : "#e5e7eb",
        boxShadow: focused ? `0 0 0 3px ${ACCENT_SOFT}` : "none",
        background: focused ? "#fff" : "#f9fafb",
        ...props.style,
      }}
    />
  );
}

function StyledSelect(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  const [focused, setFocused] = useState(false);
  return (
    <select
      {...props}
      onFocus={e => { setFocused(true); props.onFocus?.(e); }}
      onBlur={e => { setFocused(false); props.onBlur?.(e); }}
      style={{
        ...INPUT_STYLE,
        borderColor: focused ? ACCENT : "#e5e7eb",
        boxShadow: focused ? `0 0 0 3px ${ACCENT_SOFT}` : "none",
        background: focused ? "#fff" : "#f9fafb",
        cursor: "pointer",
        ...props.style,
      }}
    />
  );
}

export default function ModernSuppliers() {
  const { suppliers, createSupplier, updateSupplier, removeSupplier, toggleSupplierStatus } =
    useSuppliers();
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

  function onSubmit(data: SupplierFormData) {
    setIsSaving(true);
    setTimeout(() => {
      if (editingId) updateSupplier(editingId, data);
      else createSupplier(data);
      reset(EMPTY_FORM);
      setEditingId(null);
      setShowForm(false);
      setIsSaving(false);
    }, 400);
  }

  function handleEdit(supplier: Supplier) {
    reset({
      name: supplier.name,
      url: supplier.url,
      logo: supplier.logo || "",
      requiresLogin: supplier.requiresLogin,
      username: supplier.username || "",
      password: supplier.password || "",
      region: supplier.region || "",
      notes: supplier.notes || "",
    });
    setRequiresRegion(!!supplier.region);
    setEditingId(supplier.id);
    setShowForm(true);
  }

  function handleCancel() {
    reset(EMPTY_FORM);
    setRequiresRegion(false);
    setEditingId(null);
    setShowForm(false);
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
    <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 24px" }}>

      {/* ── Header ── */}
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16, marginBottom: 28, flexWrap: "wrap" }}>
        <div>
          <p style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.14em", color: "#9ca3af", marginBottom: 4 }}>
            Configurações
          </p>
          <h1 style={{ fontSize: 22, fontWeight: 700, color: "#111827", letterSpacing: "-0.02em" }}>
            Lojas &amp; Fornecedores
          </h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          style={{
            display: "flex", alignItems: "center", gap: 7,
            padding: "9px 18px", borderRadius: 9,
            background: ACCENT, color: "#fff",
            border: "none", fontSize: 13, fontWeight: 600,
            cursor: "pointer", fontFamily: "inherit",
            boxShadow: "0 2px 8px -1px rgb(var(--primary-500) / 0.35)",
            transition: "all 160ms",
          }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "0.88"; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.opacity = "1"; }}
        >
          <Plus size={14} /> Novo Fornecedor
        </button>
      </div>

      {/* ── Stats row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          { label: "Cadastrados", value: suppliers.length, icon: <Store size={14} /> },
          { label: "Ativos", value: activeCount, icon: <CheckCircle2 size={14} style={{ color: "#22c55e" }} />, accent: activeCount > 0 },
          { label: "Com credenciais", value: credCount, icon: <Lock size={14} /> },
        ].map((stat) => (
          <div key={stat.label} style={{
            background: "#fff",
            border: "1px solid #f0f0ee",
            borderRadius: 10,
            padding: "14px 18px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6, color: "#9ca3af" }}>
              {stat.icon}
              <span style={{ fontSize: 10, fontWeight: 600, textTransform: "uppercase", letterSpacing: "0.1em" }}>{stat.label}</span>
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: "#111827", lineHeight: 1 }}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* ── Search bar ── */}
      <div style={{ marginBottom: 16 }}>
        <StyledInput
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Pesquisar por nome, URL ou região..."
          style={{ maxWidth: "100%" }}
        />
      </div>

      {/* ── Supplier grid ── */}
      {filteredSuppliers.length === 0 ? (
        <div style={{
          border: "1px dashed #e5e7eb", borderRadius: 12,
          padding: "56px 24px", textAlign: "center",
        }}>
          <Store size={32} style={{ color: "#d1d5db", margin: "0 auto 12px" }} />
          <p style={{ fontSize: 14, fontWeight: 600, color: "#6b7280", marginBottom: 4 }}>
            {searchQuery ? "Nenhum resultado encontrado" : "Nenhum fornecedor cadastrado"}
          </p>
          <p style={{ fontSize: 12, color: "#9ca3af" }}>
            {searchQuery ? "Tente outro termo de busca." : "Clique em 'Novo Fornecedor' para adicionar."}
          </p>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: 12 }}>
          <AnimatePresence initial={false}>
            {filteredSuppliers.map((supplier) => (
              <motion.div
                key={supplier.id}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: supplier.isActive ? 1 : 0.55, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                style={{
                  background: "#fff",
                  border: `1px solid ${supplier.isActive ? "#f0f0ee" : "#e5e7eb"}`,
                  borderRadius: 12,
                  padding: "18px",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                  position: "relative",
                  overflow: "hidden",
                }}
              >
                {/* Active accent line */}
                {supplier.isActive && (
                  <div style={{
                    position: "absolute", top: 0, left: 0, right: 0, height: 2,
                    background: ACCENT, borderRadius: "12px 12px 0 0",
                  }} />
                )}

                {/* Card header */}
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12, marginBottom: 14 }}>
                  {supplier.logo ? (
                    <img
                      src={supplier.logo}
                      alt={supplier.name}
                      style={{ width: 40, height: 40, borderRadius: 8, border: "1px solid #f0f0ee", objectFit: "contain", padding: 4, background: "#fff", flexShrink: 0 }}
                    />
                  ) : (
                    <div style={{
                      width: 40, height: 40, borderRadius: 8, flexShrink: 0,
                      background: ACCENT_SOFT, border: `1px solid ${ACCENT_BORDER}`,
                      display: "grid", placeItems: "center", color: ACCENT,
                    }}>
                      <Store size={18} />
                    </div>
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <h3 style={{ fontSize: 14, fontWeight: 700, color: "#111827", marginBottom: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {supplier.name}
                    </h3>
                    <p style={{ fontSize: 11, color: "#9ca3af", display: "flex", alignItems: "center", gap: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      <Globe size={10} />
                      {supplier.url.replace(/^https?:\/\//, "").split("/")[0]}
                    </p>
                  </div>

                  {/* Power toggle */}
                  <button
                    onClick={() => toggleSupplierStatus(supplier.id)}
                    title={supplier.isActive ? "Desativar" : "Ativar"}
                    style={{
                      width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                      display: "grid", placeItems: "center",
                      background: supplier.isActive ? ACCENT_SOFT : "#f3f4f6",
                      border: `1px solid ${supplier.isActive ? ACCENT_BORDER : "#e5e7eb"}`,
                      color: supplier.isActive ? ACCENT : "#9ca3af",
                      cursor: "pointer", transition: "all 160ms",
                    }}
                  >
                    <Power size={12} />
                  </button>
                </div>

                {/* Tags */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 14 }}>
                  <span style={{
                    display: "inline-flex", alignItems: "center", gap: 4,
                    padding: "3px 8px", borderRadius: 6,
                    background: supplier.isActive ? ACCENT_SOFT : "#f3f4f6",
                    border: `1px solid ${supplier.isActive ? ACCENT_BORDER : "#e5e7eb"}`,
                    fontSize: 10, fontWeight: 600, letterSpacing: "0.06em",
                    color: supplier.isActive ? ACCENT : "#6b7280",
                  }}>
                    {supplier.isActive ? <CheckCircle2 size={9} /> : <Power size={9} />}
                    {supplier.isActive ? "ATIVO" : "INATIVO"}
                  </span>
                  {supplier.requiresLogin && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: 6,
                      background: "#fef3c7", border: "1px solid #fde68a",
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "#92400e",
                    }}>
                      <Lock size={9} /> LOGIN
                    </span>
                  )}
                  {supplier.region && (
                    <span style={{
                      display: "inline-flex", alignItems: "center", gap: 4,
                      padding: "3px 8px", borderRadius: 6,
                      background: "#eff6ff", border: "1px solid #bfdbfe",
                      fontSize: 10, fontWeight: 600, letterSpacing: "0.06em", color: "#1d4ed8",
                    }}>
                      <MapPin size={9} /> {supplier.region.toUpperCase()}
                    </span>
                  )}
                </div>

                {supplier.notes && (
                  <p style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.5, marginBottom: 14, display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden" }}>
                    {supplier.notes}
                  </p>
                )}

                {/* Actions */}
                <div style={{ display: "flex", gap: 6, paddingTop: 12, borderTop: "1px solid #f3f4f6" }}>
                  <button
                    onClick={() => handleEdit(supplier)}
                    style={{
                      flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 5,
                      padding: "7px 0", borderRadius: 7,
                      background: "#f9fafb", border: "1px solid #e5e7eb",
                      fontSize: 12, fontWeight: 500, color: "#374151",
                      cursor: "pointer", fontFamily: "inherit", transition: "all 140ms",
                    }}
                    onMouseEnter={e => { const el = e.currentTarget; el.style.background = ACCENT_SOFT; el.style.borderColor = ACCENT_BORDER; el.style.color = ACCENT; }}
                    onMouseLeave={e => { const el = e.currentTarget; el.style.background = "#f9fafb"; el.style.borderColor = "#e5e7eb"; el.style.color = "#374151"; }}
                  >
                    <Edit2 size={12} /> Editar
                  </button>
                  <button
                    onClick={() => handleDelete(supplier.id)}
                    style={{
                      width: 34, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 7,
                      background: deleteConfirm === supplier.id ? "#fef2f2" : "#f9fafb",
                      border: `1px solid ${deleteConfirm === supplier.id ? "#fca5a5" : "#e5e7eb"}`,
                      color: deleteConfirm === supplier.id ? "#ef4444" : "#9ca3af",
                      cursor: "pointer", transition: "all 140ms",
                      fontSize: 11, fontWeight: 600, fontFamily: "inherit",
                    }}
                    title={deleteConfirm === supplier.id ? "Clique novamente para confirmar" : "Excluir"}
                  >
                    {deleteConfirm === supplier.id ? <AlertCircle size={12} /> : <Trash2 size={12} />}
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
            style={{
              position: "fixed", inset: 0, zIndex: 50,
              display: "flex", alignItems: "center", justifyContent: "center",
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(4px)", padding: 16,
            }}
            onClick={(e) => { if (e.target === e.currentTarget) handleCancel(); }}
          >
            <motion.form
              initial={{ opacity: 0, y: 16, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 8, scale: 0.97 }}
              transition={{ type: "spring", damping: 22, stiffness: 320 }}
              onSubmit={handleSubmit(onSubmit)}
              style={{
                width: "100%", maxWidth: 560,
                background: "#fff", borderRadius: 14,
                border: "1px solid #e5e7eb",
                boxShadow: "0 20px 60px -10px rgba(0,0,0,0.25)",
                maxHeight: "90vh", display: "flex", flexDirection: "column",
                overflow: "hidden",
              }}
            >
              {/* Modal header */}
              <div style={{ padding: "20px 24px 16px", borderBottom: "1px solid #f3f4f6", display: "flex", alignItems: "flex-start", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 2 }}>
                    {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
                  </h2>
                  <p style={{ fontSize: 11, color: "#9ca3af" }}>
                    {editingId ? "Atualize os dados de conexão" : "Integre uma nova loja às buscas"}
                  </p>
                </div>
                <button type="button" onClick={handleCancel} style={{
                  width: 28, height: 28, borderRadius: 7, display: "grid", placeItems: "center",
                  background: "#f3f4f6", border: "1px solid #e5e7eb", cursor: "pointer", color: "#6b7280",
                }}>
                  <X size={14} />
                </button>
              </div>

              {/* Modal body */}
              <div style={{ padding: "20px 24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 18 }}>

                <Field label="Nome da loja *" error={errors.name?.message}>
                  <StyledInput type="text" {...register("name")} placeholder="Ex: Telhanorte Matriz" />
                </Field>

                <Field label="URL do sistema *" error={errors.url?.message}>
                  <StyledInput type="url" {...register("url")} placeholder="https://" />
                </Field>

                <Field label="Logo da empresa">
                  <div style={{ width: 120 }}>
                    <ImageUploadCrop value={watch("logo")} onChange={(v) => setValue("logo", v)} aspect={1} />
                  </div>
                </Field>

                <div style={{ height: 1, background: "#f3f4f6" }} />

                {/* Region toggle */}
                <label style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 14px", borderRadius: 9,
                  background: requiresRegion ? ACCENT_SOFT : "#f9fafb",
                  border: `1px solid ${requiresRegion ? ACCENT_BORDER : "#e5e7eb"}`,
                  cursor: "pointer", transition: "all 160ms",
                }}>
                  <input
                    type="checkbox"
                    checked={requiresRegion}
                    onChange={(e) => {
                      setRequiresRegion(e.target.checked);
                      if (!e.target.checked) setValue("region", "");
                    }}
                    style={{ marginTop: 2, accentColor: ACCENT, cursor: "pointer" }}
                  />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                      <MapPin size={13} style={{ color: "#9ca3af" }} /> Filtragem Regional Obrigatória
                    </p>
                    <p style={{ fontSize: 11, color: "#9ca3af" }}>A loja exige seleção de estado antes da busca.</p>
                  </div>
                </label>
                {requiresRegion && (
                  <div style={{ paddingLeft: 8 }}>
                    <Field label="Estado" error={errors.region?.message}>
                      <StyledSelect {...register("region")}>
                        <option value="">Selecione o estado</option>
                        {["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"].map((uf) => (
                          <option key={uf} value={uf.toLowerCase()}>{uf}</option>
                        ))}
                      </StyledSelect>
                    </Field>
                  </div>
                )}

                {/* Login toggle */}
                <label style={{
                  display: "flex", alignItems: "flex-start", gap: 12,
                  padding: "12px 14px", borderRadius: 9,
                  background: requiresLogin ? ACCENT_SOFT : "#f9fafb",
                  border: `1px solid ${requiresLogin ? ACCENT_BORDER : "#e5e7eb"}`,
                  cursor: "pointer", transition: "all 160ms",
                }}>
                  <input
                    type="checkbox"
                    {...register("requiresLogin")}
                    style={{ marginTop: 2, accentColor: ACCENT, cursor: "pointer" }}
                  />
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", display: "flex", alignItems: "center", gap: 5, marginBottom: 2 }}>
                      <Lock size={13} style={{ color: "#9ca3af" }} /> Requer Autenticação (Login B2B)
                    </p>
                    <p style={{ fontSize: 11, color: "#9ca3af" }}>Credenciais do robô para acessar preços restritos.</p>
                  </div>
                </label>
                {requiresLogin && (
                  <div style={{ paddingLeft: 8, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, borderLeft: `2px solid ${ACCENT}`, paddingRight: 0 }}>
                    <Field label="Usuário B2B" error={errors.username?.message}>
                      <StyledInput type="text" {...register("username")} placeholder="login@empresa.com" />
                    </Field>
                    <Field label="Senha" error={errors.password?.message}>
                      <StyledInput type="password" {...register("password")} placeholder="••••••••" />
                    </Field>
                  </div>
                )}

                <Field label="Observações técnicas" error={errors.notes?.message}>
                  <StyledTextarea {...register("notes")} rows={2} placeholder="Anotações internas..." />
                </Field>
              </div>

              {/* Modal footer */}
              <div style={{
                display: "flex", justifyContent: "flex-end", gap: 8,
                padding: "16px 24px", borderTop: "1px solid #f3f4f6",
                background: "#fafafa",
              }}>
                <button
                  type="button"
                  onClick={handleCancel}
                  style={{
                    padding: "8px 16px", borderRadius: 8,
                    background: "#fff", border: "1px solid #e5e7eb",
                    fontSize: 13, fontWeight: 500, color: "#6b7280",
                    cursor: "pointer", fontFamily: "inherit",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "8px 20px", borderRadius: 8,
                    background: ACCENT, color: "#fff",
                    border: "none", fontSize: 13, fontWeight: 600,
                    cursor: isSaving ? "default" : "pointer",
                    fontFamily: "inherit", opacity: isSaving ? 0.7 : 1,
                    boxShadow: "0 2px 8px -1px rgb(var(--primary-500) / 0.35)",
                    transition: "opacity 160ms",
                  }}
                >
                  {isSaving && <Loader2 size={13} style={{ animation: "spin 0.75s linear infinite" }} />}
                  {editingId ? "Salvar Alterações" : "Cadastrar"}
                </button>
              </div>
            </motion.form>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
