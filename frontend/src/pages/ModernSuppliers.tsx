"use client";

import { motion, AnimatePresence } from "framer-motion";
import { Store, Plus, Edit2, Trash2, X, Sparkles, Power, Lock, Globe, MapPin, AlertCircle } from "lucide-react";
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
  notes: ""
};

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

  function onSubmit(data: SupplierFormData): void {
    if (editingId) {
      updateSupplier(editingId, data);
    } else {
      createSupplier(data);
    }

    reset(EMPTY_FORM);
    setEditingId(null);
    setShowForm(false);
  }

  function handleEdit(supplier: Supplier): void {
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

  function handleCancel(): void {
    reset(EMPTY_FORM);
    setRequiresRegion(false);
    setEditingId(null);
    setShowForm(false);
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Store className="h-5 w-5 text-emerald-500" />
              <span className="text-sm font-medium text-emerald-500">Fornecedores</span>
            </div>
            <h1 className="text-3xl font-bold text-slate-800 dark:text-neutral-100 mb-2">
              Gerenciar Fornecedores
            </h1>
            <p className="text-slate-500 dark:text-neutral-400">
              Configure as lojas para consulta de preços - {activeSuppliers} ativos de {suppliers.length} cadastrados
            </p>
          </div>

          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-600"
          >
            <Plus className="h-4 w-4" />
            Novo Fornecedor
          </button>
        </div>
      </motion.div>

      {/* Form Modal */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4"
            onClick={handleCancel}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="w-full max-w-2xl rounded-2xl border border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6 shadow-2xl max-h-[90vh] overflow-y-auto"
            >
              <div className="mb-6 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-emerald-500" />
                  <h2 className="text-xl font-semibold text-slate-800 dark:text-neutral-100">
                    {editingId ? "Editar Fornecedor" : "Novo Fornecedor"}
                  </h2>
                </div>
                <button
                  onClick={handleCancel}
                  className="flex h-8 w-8 items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 transition-colors hover:bg-slate-100 hover:dark:bg-neutral-700 hover:text-slate-600 hover:dark:text-neutral-300"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-600 dark:text-neutral-300">Nome da Loja *</label>
                    <input
                      type="text"
                      {...register("name")}
                      className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:outline-none focus:ring-2 ${
                        errors.name
                          ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500/20"
                          : "border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/20"
                      }`}
                      placeholder="Ex: Estoque Megaleste"
                    />
                    {errors.name && (
                      <p className="flex items-center gap-1 text-xs text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        {errors.name.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-600 dark:text-neutral-300">URL do Site *</label>
                    <input
                      type="url"
                      {...register("url")}
                      className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:outline-none focus:ring-2 ${
                        errors.url
                          ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500/20"
                          : "border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/20"
                      }`}
                      placeholder="https://exemplo.com.br"
                    />
                    {errors.url && (
                      <p className="flex items-center gap-1 text-xs text-red-500">
                        <AlertCircle className="h-3 w-3" />
                        {errors.url.message}
                      </p>
                    )}
                  </div>

                  <div className="space-y-2 sm:col-span-2">
                    <label className="block text-sm font-medium text-slate-600 dark:text-neutral-300">Logo (Opcional)</label>
                    <ImageUploadCrop
                      value={watch("logo")}
                      onChange={(base64) => setValue("logo", base64)}
                      aspect={1}
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-neutral-300">
                      <MapPin className="h-4 w-4" />
                      Requer seleção de região?
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-4 py-2.5 cursor-pointer hover:bg-slate-100 hover:dark:bg-neutral-700">
                      <input
                        type="checkbox"
                        checked={requiresRegion}
                        onChange={(e) => {
                          setRequiresRegion(e.target.checked);
                          if (!e.target.checked) setValue("region", "");
                        }}
                        className="h-4 w-4 rounded border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <span className="text-sm text-slate-600 dark:text-neutral-300">Sim, selecionar estado (UF)</span>
                    </label>
                    {requiresRegion && (
                      <select
                        {...register("region")}
                        className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-4 py-2.5 text-sm text-slate-800 dark:text-neutral-100 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                      >
                        <option value="">Selecione o estado</option>
                        {[
                          ["AC","Acre"],["AL","Alagoas"],["AM","Amazonas"],["AP","Amapá"],
                          ["BA","Bahia"],["CE","Ceará"],["DF","Distrito Federal"],["ES","Espírito Santo"],
                          ["GO","Goiás"],["MA","Maranhão"],["MG","Minas Gerais"],["MS","Mato Grosso do Sul"],
                          ["MT","Mato Grosso"],["PA","Pará"],["PB","Paraíba"],["PE","Pernambuco"],
                          ["PI","Piauí"],["PR","Paraná"],["RJ","Rio de Janeiro"],["RN","Rio Grande do Norte"],
                          ["RO","Rondônia"],["RR","Roraima"],["RS","Rio Grande do Sul"],["SC","Santa Catarina"],
                          ["SE","Sergipe"],["SP","São Paulo"],["TO","Tocantins"]
                        ].map(([uf, name]) => (
                          <option key={uf} value={uf.toLowerCase()}>{uf} — {name}</option>
                        ))}
                      </select>
                    )}
                  </div>

                  <div className="space-y-2">
                    <label className="flex items-center gap-2 text-sm font-medium text-slate-600 dark:text-neutral-300">
                      <Lock className="h-4 w-4" />
                      Requer Login?
                    </label>
                    <label className="flex items-center gap-3 rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-4 py-2.5 cursor-pointer hover:bg-slate-100 hover:dark:bg-neutral-700">
                      <input
                        type="checkbox"
                        {...register("requiresLogin")}
                        className="h-4 w-4 rounded border-slate-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      />
                      <span className="text-sm text-slate-600 dark:text-neutral-300">Sim, necessita credenciais</span>
                    </label>
                  </div>
                </div>

                {requiresLogin && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: "auto" }}
                    exit={{ opacity: 0, height: 0 }}
                    className="grid gap-4 sm:grid-cols-2 border-t border-slate-200 dark:border-neutral-700 pt-4"
                  >
                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-600 dark:text-neutral-300">Usuário *</label>
                      <input
                        type="text"
                        {...register("username")}
                        className={`w-full rounded-xl border px-4 py-2.5 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:outline-none focus:ring-2 ${
                          errors.username
                            ? "border-red-500 bg-red-50 focus:border-red-500 focus:ring-red-500/20"
                            : "border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 focus:border-emerald-500 focus:ring-emerald-500/20"
                        }`}
                        placeholder="usuario@email.com"
                      />
                      {errors.username && (
                        <p className="flex items-center gap-1 text-xs text-red-500">
                          <AlertCircle className="h-3 w-3" />
                          {errors.username.message}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="block text-sm font-medium text-slate-600 dark:text-neutral-300">Senha</label>
                      <input
                        type="password"
                        {...register("password")}
                        className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-4 py-2.5 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                        placeholder="••••••••"
                      />
                    </div>
                  </motion.div>
                )}

                <div className="space-y-2">
                  <label className="block text-sm font-medium text-slate-600 dark:text-neutral-300">Observações</label>
                  <textarea
                    {...register("notes")}
                    className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-4 py-2.5 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20 resize-none"
                    placeholder="Informações adicionais sobre o fornecedor"
                    rows={3}
                  />
                </div>

                <div className="flex gap-3 pt-2">
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="flex-1 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-4 py-2.5 text-sm font-medium text-slate-600 dark:text-neutral-300 transition-colors hover:bg-slate-50 dark:hover:bg-neutral-700 hover:text-slate-800 dark:hover:text-neutral-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    className="flex-1 rounded-lg bg-emerald-500 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-emerald-600"
                  >
                    {editingId ? "Salvar Alterações" : "Adicionar Fornecedor"}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Suppliers Grid */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.5 }}
        className="space-y-4"
      >
        <div className="rounded-2xl border border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4 shadow-card">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar fornecedores..."
            className="w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 px-4 py-2.5 text-sm text-slate-800 dark:text-neutral-100 placeholder-slate-400 dark:placeholder-neutral-500 transition-colors focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filteredSuppliers.length === 0 ? (
            <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
              <div className="mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 dark:bg-neutral-800">
                <Store className="h-6 w-6 text-slate-400 dark:text-neutral-500" />
              </div>
              <p className="text-sm text-slate-500 dark:text-neutral-400">Nenhum fornecedor encontrado</p>
            </div>
          ) : (
            filteredSuppliers.map((supplier) => (
              <motion.div
                key={supplier.id}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className={`
                  rounded-2xl border p-6 transition-all shadow-card
                  ${supplier.isActive
                    ? "border-slate-100 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-slate-200 dark:hover:border-neutral-700"
                    : "border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-900/50 opacity-60"
                  }
                `}
              >
                <div className="mb-4 flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    {supplier.logo ? (
                      <img
                        src={supplier.logo}
                        alt={`Logo ${supplier.name}`}
                        className="h-10 w-10 rounded-lg border border-slate-200 dark:border-neutral-700 object-cover"
                      />
                    ) : (
                      <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${
                        supplier.isActive
                          ? "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-500"
                          : "bg-slate-100 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500"
                      }`}>
                        <Store className="h-5 w-5" />
                      </div>
                    )}
                    <div>
                      <h3 className="font-semibold text-slate-800 dark:text-neutral-100">{supplier.name}</h3>
                      {supplier.region && (
                        <p className="text-xs text-slate-400 dark:text-neutral-500">{supplier.region}</p>
                      )}
                    </div>
                  </div>

                  <button
                    onClick={() => toggleSupplierStatus(supplier.id)}
                    className={`flex h-8 w-8 items-center justify-center rounded-lg border transition-colors ${
                      supplier.isActive
                        ? "border-success/20 bg-success/10 text-success hover:bg-success/20"
                        : "border-slate-200 dark:border-neutral-700 bg-slate-50 dark:bg-neutral-800 text-slate-400 dark:text-neutral-500 hover:bg-slate-100 dark:hover:bg-neutral-700"
                    }`}
                    title={supplier.isActive ? "Desativar" : "Ativar"}
                  >
                    <Power className="h-4 w-4" />
                  </button>
                </div>

                <div className="mb-4 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                    <Globe className="h-3 w-3" />
                    <span className="truncate">{supplier.url}</span>
                  </div>

                  {supplier.requiresLogin && (
                    <div className="flex items-center gap-2 text-xs text-warning">
                      <Lock className="h-3 w-3" />
                      <span>Requer autenticação</span>
                    </div>
                  )}

                  {supplier.region && (
                    <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-neutral-400">
                      <MapPin className="h-3 w-3" />
                      <span>Região: <span className="font-mono uppercase text-emerald-500">{supplier.region}</span></span>
                    </div>
                  )}

                  {supplier.notes && (
                    <p className="text-xs text-slate-400 dark:text-neutral-500 line-clamp-2">{supplier.notes}</p>
                  )}
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => handleEdit(supplier)}
                    className="flex-1 flex items-center justify-center gap-2 rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-slate-500 dark:text-neutral-400 transition-colors hover:border-emerald-500 dark:hover:border-emerald-500/50 hover:bg-emerald-50 dark:hover:bg-emerald-500/10 hover:text-emerald-600 dark:hover:text-emerald-400"
                  >
                    <Edit2 className="h-3 w-3" />
                    Editar
                  </button>
                  <button
                    onClick={() => removeSupplier(supplier.id)}
                    className="flex items-center justify-center rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-2 text-xs font-medium text-slate-500 dark:text-neutral-400 transition-colors hover:border-error hover:bg-error/10 hover:text-error"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </motion.div>
    </div>
  );
}
