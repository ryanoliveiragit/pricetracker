"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Store, Plus, Edit2, Trash2, X, Sparkles, Power, Lock, Globe, MapPin, AlertCircle, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useSuppliers } from "../context/SupplierContext";
import type { Supplier } from "../types/supplier";
import { supplierSchema, type SupplierFormData } from "../schemas/validation";
import ImageUploadCrop from "../components/ImageUploadCrop";
import { cn } from "../lib/utils";

const EMPTY_FORM: SupplierFormData = {
  name: "",
  url: "",
  logo: "",
  requiresLogin: false,
  username: "",
  password: "",
  region: "",
  notes: ""
};

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <label className="text-[10px] font-semibold uppercase tracking-widest text-[#A0A09A] flex justify-between">
        {label}
        {error && <span className="text-red-500 lowercase normal-case tracking-normal">{error}</span>}
      </label>
      {children}
    </div>
  );
}

export default function ModernSuppliers() {
  const { suppliers, createSupplier, updateSupplier, removeSupplier, toggleSupplierStatus } = useSuppliers();
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showForm, setShowForm] = useState(false);

  const { register, handleSubmit, formState: { errors }, reset, setValue, watch } = useForm<SupplierFormData>({
    resolver: zodResolver(supplierSchema),
    defaultValues: EMPTY_FORM
  });

  const requiresLogin = watch("requiresLogin");
  const regionValue = watch("region");
  const [requiresRegion, setRequiresRegion] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const filteredSuppliers = useMemo(() => {
    if (!searchQuery) return suppliers;
    const query = searchQuery.toLowerCase();
    return suppliers.filter(
      (s) =>
        s.name.toLowerCase().includes(query) ||
        s.url.toLowerCase().includes(query) ||
        s.region?.toLowerCase().includes(query)
    );
  }, [suppliers, searchQuery]);

  const activeSuppliers = suppliers.filter(s => s.isActive).length;

  function onSubmit(data: SupplierFormData) {
    setIsSaving(true);
    setTimeout(() => {
      if (editingId) {
        updateSupplier(editingId, data);
      } else {
        createSupplier(data);
      }
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
      notes: supplier.notes || ""
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

  return (
    <div className="space-y-6 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-widest text-[#A0A09A]">Ferramentas</p>
          <h1 className="text-2xl font-bold text-[#1A1A18] mt-0.5">Lojas e Fornecedores</h1>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-1.5 rounded-lg bg-[#84CC16] px-4 py-2.5 text-sm font-semibold text-[#1A1A18] shadow-sm transition-all hover:bg-[#78b814]"
        >
          <Plus className="h-4 w-4" /> Novo Fornecedor
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {[
          { label: "Total cadastrados", value: suppliers.length },
          { label: "Ativos na busca", value: activeSuppliers },
          { label: "Requerem credenciais", value: suppliers.filter(s => s.requiresLogin).length },
        ].map(stat => (
          <div key={stat.label} className="bg-white border border-[#E8E8E4] rounded-xl px-5 py-4 shadow-sm">
            <p className="text-[11px] font-medium uppercase tracking-widest text-[#A0A09A] mb-1">{stat.label}</p>
            <p className="text-2xl font-bold text-[#1A1A18]">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Toolbar */}
      <div className="bg-white border border-[#E8E8E4] rounded-xl shadow-sm p-3">
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Pesquisar por nome ou URL da loja..."
          className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-4 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:bg-white focus:border-[#84CC16] focus:outline-none transition-colors"
        />
      </div>

      {/* Grid */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {filteredSuppliers.length === 0 ? (
          <div className="col-span-full border border-[#E8E8E4] bg-white rounded-xl py-16 text-center text-[#A0A09A]">
            <Store className="mx-auto h-8 w-8 mb-3 opacity-30" />
            <p className="text-sm font-medium text-[#1A1A18]">Nenhum fornecedor encontrado</p>
            <p className="text-xs mt-1">Clique em 'Novo Fornecedor' para adicionar uma fonte.</p>
          </div>
        ) : (
          filteredSuppliers.map((supplier) => (
            <div
              key={supplier.id}
              className={cn(
                "group relative bg-white border rounded-xl p-5 transition-all shadow-sm",
                supplier.isActive ? "border-[#E8E8E4]" : "border-[#E8E8E4] bg-[#F7F7F5] opacity-60"
              )}
            >
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  {supplier.logo ? (
                    <img
                      src={supplier.logo}
                      alt={supplier.name}
                      className="h-10 w-10 rounded-lg border border-[#E8E8E4] bg-white object-contain p-1"
                    />
                  ) : (
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#F7F7F5] border border-[#E8E8E4] text-[#A0A09A]">
                      <Store className="h-5 w-5" />
                    </div>
                  )}
                  <div>
                    <h3 className="font-bold text-[#1A1A18] text-[14px] leading-tight mb-0.5">{supplier.name}</h3>
                    <p className="text-[11px] font-medium text-[#A0A09A] flex items-center gap-1.5"><Globe className="h-3 w-3" />{supplier.url.replace(/^https?:\/\//,'').split('/')[0]}</p>
                  </div>
                </div>

                <button
                  onClick={() => toggleSupplierStatus(supplier.id)}
                  className={cn(
                    "flex shrink-0 h-6 w-6 items-center justify-center rounded-md border transition-colors",
                    supplier.isActive
                      ? "border-[#84CC16]/40 bg-[#84CC16]/10 text-[#3d6600] hover:bg-[#84CC16]/20"
                      : "border-[#E8E8E4] bg-white text-[#A0A09A] hover:bg-[#EFEFEA]"
                  )}
                  title={supplier.isActive ? "Desativar busca" : "Ativar busca"}
                >
                  <Power className="h-3 w-3" />
                </button>
              </div>

              <div className="space-y-2 mb-4">
                {supplier.requiresLogin && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#F7F7F5] border border-[#E8E8E4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#A0A09A]">
                    <Lock className="h-2.5 w-2.5" /> Exige Login
                  </span>
                )}
                {supplier.region && (
                  <span className="inline-flex items-center gap-1 rounded-md bg-[#F7F7F5] border border-[#E8E8E4] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-[#A0A09A] ml-1">
                    <MapPin className="h-2.5 w-2.5" /> {supplier.region}
                  </span>
                )}
                {supplier.notes && (
                  <p className="text-[12px] text-[#6B6B63] leading-snug line-clamp-2 mt-2">{supplier.notes}</p>
                )}
              </div>

              <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleEdit(supplier)}
                  className="flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-[#E8E8E4] bg-white py-1.5 text-xs font-semibold text-[#6B6B63] hover:bg-[#F7F7F5] hover:text-[#1A1A18] transition-colors"
                >
                  <Edit2 className="h-3.5 w-3.5" /> Editar
                </button>
                <button
                  onClick={() => removeSupplier(supplier.id)}
                  className="flex items-center justify-center rounded-lg border border-[#E8E8E4] bg-white px-3 text-[#A0A09A] hover:bg-red-50 hover:border-red-200 hover:text-red-600 transition-colors"
                  title="Excluir"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Modal Add/Edit */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
          <form onSubmit={handleSubmit(onSubmit)} className="w-full max-w-2xl bg-white border border-[#E8E8E4] rounded-xl shadow-2xl max-h-[90vh] flex flex-col">
            <div className="flex items-center justify-between px-6 py-4 border-b border-[#E8E8E4] shrink-0">
              <div>
                <h2 className="text-base font-bold text-[#1A1A18]">
                  {editingId ? "Editar Fornecedor" : "Cadastrar Fornecedor"}
                </h2>
                <p className="text-[11px] text-[#A0A09A]">{editingId ? "Atualize os dados de conexão e acessos" : "Integre uma nova plataforma para as buscas"}</p>
              </div>
              <button type="button" onClick={handleCancel} className="text-[#A0A09A] hover:text-[#1A1A18] transition-colors">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="col-span-2">
                  <Field label="Nome da Loja *" error={errors.name?.message}>
                    <input type="text" {...register("name")} placeholder="Ex: Telhanorte Matriz" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
                  </Field>
                </div>
                <div className="col-span-2">
                  <Field label="URL do Sistema *" error={errors.url?.message}>
                    <input type="url" {...register("url")} placeholder="https://" className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
                  </Field>
                </div>
                
                <div className="col-span-2">
                  <Field label="Logo da Empresa">
                    <div className="w-32">
                      <ImageUploadCrop value={watch("logo")} onChange={(v) => setValue("logo", v)} aspect={1} />
                    </div>
                  </Field>
                </div>

                <div className="col-span-2 space-y-3 pt-2 border-t border-[#E8E8E4]">
                  <label className="flex items-center gap-3 bg-[#F7F7F5] border border-[#E8E8E4] rounded-lg px-4 py-3 cursor-pointer hover:bg-[#EFEFEA] transition-colors">
                    <input type="checkbox" checked={requiresRegion} onChange={e => { setRequiresRegion(e.target.checked); if (!e.target.checked) setValue("region", ""); }} className="h-4 w-4 rounded border-[#E8E8E4] text-[#84CC16] accent-[#84CC16] cursor-pointer" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#1A1A18] flex items-center gap-2"><MapPin className="h-4 w-4 text-[#A0A09A]" /> Filtragem Regional Obrigatória</p>
                      <p className="text-[11px] text-[#A0A09A]">A loja exige que o usuário marque um estado antes de buscar.</p>
                    </div>
                  </label>
                  {requiresRegion && (
                    <div className="pl-4">
                      <select {...register("region")} className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors">
                        <option value="">Selecione o estado principal</option>
                        {["AC","AL","AM","AP","BA","CE","DF","ES","GO","MA","MG","MS","MT","PA","PB","PE","PI","PR","RJ","RN","RO","RR","RS","SC","SE","SP","TO"].map(uf => (
                          <option key={uf} value={uf.toLowerCase()}>{uf}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  <label className="flex items-center gap-3 bg-[#F7F7F5] border border-[#E8E8E4] rounded-lg px-4 py-3 cursor-pointer hover:bg-[#EFEFEA] transition-colors mt-2">
                    <input type="checkbox" {...register("requiresLogin")} className="h-4 w-4 rounded border-[#E8E8E4] accent-[#84CC16] cursor-pointer" />
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-[#1A1A18] flex items-center gap-2"><Lock className="h-4 w-4 text-[#A0A09A]" /> Requer Autenticação (Login B2B)</p>
                      <p className="text-[11px] text-[#A0A09A]">Insira as credenciais do robô (scrapper) para acessar preços restritos.</p>
                    </div>
                  </label>
                </div>

                {requiresLogin && (
                  <div className="col-span-2 grid grid-cols-2 gap-4 border-l-2 border-[#84CC16] pl-4 mt-2">
                    <Field label="Nome de Usuário B2B" error={errors.username?.message}>
                      <input type="text" {...register("username")} className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
                    </Field>
                    <Field label="Senha" error={errors.password?.message}>
                      <input type="password" {...register("password")} className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors" />
                    </Field>
                  </div>
                )}
                
                <div className="col-span-2 pt-2 border-t border-[#E8E8E4]">
                  <Field label="Observações Técnicas" error={errors.notes?.message}>
                    <textarea {...register("notes")} rows={2} placeholder="Anotações internas..." className="w-full rounded-lg border border-[#E8E8E4] bg-[#F7F7F5] px-3 py-2.5 text-sm text-[#1A1A18] placeholder-[#A0A09A] focus:border-[#84CC16] focus:bg-white focus:outline-none transition-colors resize-none" />
                  </Field>
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 px-6 py-4 border-t border-[#E8E8E4] bg-[#F7F7F5] rounded-b-xl shrink-0">
              <button type="button" onClick={handleCancel} className="rounded-lg border border-[#E8E8E4] bg-white px-4 py-2 text-sm font-medium text-[#6B6B63] hover:bg-[#EFEFEA] transition-colors disabled:opacity-50">Cancelar</button>
              <button type="submit" disabled={isSaving} className="flex items-center gap-2 rounded-lg bg-[#84CC16] px-5 py-2 text-sm font-semibold text-[#1A1A18] hover:bg-[#78b814] transition-colors shadow-sm disabled:opacity-50">
                {isSaving && <Loader2 className="h-4 w-4 animate-spin" />}
                {editingId ? "Salvar Alterações" : "Cadastrar"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
