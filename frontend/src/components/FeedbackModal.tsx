"use client";

import { submitFeedback } from "@/services/feedbackApi";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  CheckCircle2,
  Image as ImageIcon,
  Layers,
  Lightbulb,
  Link2,
  Loader2,
  MessageSquarePlus,
  Search,
  X,
  Zap,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

interface Props {
  open: boolean;
  onClose: () => void;
  prefillQuery?: string;
}

type Step = "form" | "sending" | "done" | "error";

type ProblemType = "search" | "ui" | "bug" | "suggestion";

const PROBLEM_TYPES: {
  key: ProblemType;
  label: string;
  icon: React.ElementType;
  color: string;
  activeCls: string;
  placeholder: string;
}[] = [
  {
    key: "search",
    label: "Busca",
    icon: Search,
    color: "text-violet-500",
    activeCls: "border-violet-400 bg-violet-50/60 dark:border-violet-500 dark:bg-violet-500/10",
    placeholder: "Ex: busquei 'cad' mas não encontrou 'cadeado'. O produto existe no sistema com nome diferente...",
  },
  {
    key: "ui",
    label: "Interface",
    icon: Layers,
    color: "text-pink-500",
    activeCls: "border-pink-400 bg-pink-50/60 dark:border-pink-500 dark:bg-pink-500/10",
    placeholder: "Ex: no tema dark o texto dos cards está muito difícil de ler, o contraste está ruim. Principalmente na tela de resultados...",
  },
  {
    key: "bug",
    label: "Bug",
    icon: Zap,
    color: "text-red-500",
    activeCls: "border-red-400 bg-red-50/60 dark:border-red-500 dark:bg-red-500/10",
    placeholder: "Ex: ao clicar em 'salvar oferta' aparece um erro em tela e a oferta não é salva. Acontece sempre com produtos da loja X...",
  },
  {
    key: "suggestion",
    label: "Sugestão",
    icon: Lightbulb,
    color: "text-amber-500",
    activeCls: "border-amber-400 bg-amber-50/60 dark:border-amber-500 dark:bg-amber-500/10",
    placeholder: "Ex: seria legal poder agrupar o botão de sair e gerenciar conta num dropdown dentro do avatar do perfil, ficaria mais organizado...",
  },
];

const INPUT_CLS =
  "w-full rounded-xl border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 px-3 py-2.5 text-[13px] text-slate-800 dark:text-neutral-200 placeholder:text-slate-400 dark:placeholder:text-neutral-500 focus:outline-none focus:border-violet-400 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-400/20 transition-all";

export default function FeedbackModal({ open, onClose, prefillQuery = "" }: Props) {
  const [step, setStep] = useState<Step>("form");
  const [problemType, setProblemType] = useState<ProblemType>("search");
  const [query, setQuery] = useState(prefillQuery);
  const [expected, setExpected] = useState("");
  const [description, setDescription] = useState("");
  const [refUrl, setRefUrl] = useState("");
  const [screenshot, setScreenshot] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") handleClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  function handleFile(file: File | null) {
    if (!file) return;
    setScreenshot(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!description.trim()) return;
    setStep("sending");
    try {
      await submitFeedback({
        problem_type: problemType,
        search_query: problemType === "search" ? query : "",
        expected_result: problemType === "search" ? expected : "",
        description,
        reference_url: refUrl,
        screenshot,
      });
      setStep("done");
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : "Erro desconhecido");
      setStep("error");
    }
  }

  function handleClose() {
    setStep("form");
    setProblemType("search");
    setQuery(prefillQuery);
    setExpected("");
    setDescription("");
    setRefUrl("");
    setScreenshot(null);
    setPreview(null);
    setErrorMsg("");
    onClose();
  }

  const activeProblem = PROBLEM_TYPES.find((p) => p.key === problemType)!;

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
            onClick={handleClose}
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: [0.25, 0.46, 0.45, 0.94] }}
            className="relative z-10 w-full max-w-[500px] rounded-2xl bg-white dark:bg-neutral-900 shadow-2xl shadow-black/25 ring-1 ring-black/8 dark:ring-white/8 overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100 dark:border-neutral-800">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl"
                  style={{ background: "linear-gradient(135deg, #7c3aed18, #4f46e518)" }}
                >
                  <MessageSquarePlus className="h-[18px] w-[18px] text-violet-600 dark:text-violet-400" />
                </div>
                <div>
                  <p className="text-[14px] font-semibold text-slate-900 dark:text-neutral-100 leading-tight">
                    Reportar problema
                  </p>
                  <p className="text-[11px] text-slate-400 dark:text-neutral-500 mt-px">
                    Nossa IA analisa e gera um prompt de correção
                  </p>
                </div>
              </div>
              <button
                onClick={handleClose}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Body */}
            <div className="p-5">
              {step === "form" && (
                <form onSubmit={handleSubmit} className="space-y-4">

                  {/* Tipo de problema */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-slate-600 dark:text-neutral-400 mb-2 uppercase tracking-wide">
                      Tipo de problema
                    </label>
                    <div className="grid grid-cols-4 gap-2">
                      {PROBLEM_TYPES.map(({ key, label, icon: Icon, color, activeCls }) => (
                        <button
                          key={key}
                          type="button"
                          onClick={() => setProblemType(key)}
                          className={`flex flex-col items-center gap-1.5 rounded-xl border-2 py-2.5 px-1 transition-all text-center ${
                            problemType === key
                              ? activeCls
                              : "border-slate-200 dark:border-neutral-700 hover:border-slate-300 dark:hover:border-neutral-600"
                          }`}
                        >
                          <Icon className={`h-4 w-4 ${problemType === key ? color : "text-slate-400 dark:text-neutral-500"}`} />
                          <span className={`text-[11px] font-semibold ${problemType === key ? "text-slate-800 dark:text-neutral-200" : "text-slate-500 dark:text-neutral-400"}`}>
                            {label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Campos de busca — só para tipo "search" */}
                  <AnimatePresence>
                    {problemType === "search" && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.18 }}
                        className="overflow-hidden"
                      >
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11.5px] font-semibold text-slate-600 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                              O que buscou?
                            </label>
                            <div className="relative">
                              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                              <input
                                type="text"
                                value={query}
                                onChange={(e) => setQuery(e.target.value)}
                                placeholder="cad, cx sif…"
                                className={`${INPUT_CLS} pl-8`}
                              />
                            </div>
                          </div>
                          <div>
                            <label className="block text-[11.5px] font-semibold text-slate-600 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                              O que esperava?
                            </label>
                            <input
                              type="text"
                              value={expected}
                              onChange={(e) => setExpected(e.target.value)}
                              placeholder="cadeado, caixa sifonada…"
                              className={INPUT_CLS}
                            />
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Descrição */}
                  <div>
                    <label className="block text-[11.5px] font-semibold text-slate-600 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                      Descrição <span className="text-red-400 normal-case">*</span>
                    </label>
                    <textarea
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      rows={3}
                      placeholder={activeProblem.placeholder}
                      className={`${INPUT_CLS} resize-none leading-relaxed`}
                    />
                  </div>

                  {/* Screenshot + link */}
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11.5px] font-semibold text-slate-600 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                        Print de tela
                        <span className="ml-1 normal-case font-normal text-slate-400">(opcional)</span>
                      </label>
                      <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => handleFile(e.target.files?.[0] ?? null)}
                      />
                      {preview ? (
                        <div
                          className="relative h-[68px] rounded-xl overflow-hidden border border-slate-200 dark:border-neutral-700 cursor-pointer group"
                          onClick={() => fileRef.current?.click()}
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={preview} alt="preview" className="h-full w-full object-cover" />
                          <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                            <span className="text-white text-[11px] font-medium">Trocar</span>
                          </div>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setScreenshot(null); setPreview(null); }}
                            className="absolute top-1 right-1 h-5 w-5 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => fileRef.current?.click()}
                          className="flex h-[68px] w-full flex-col items-center justify-center gap-1.5 rounded-xl border-2 border-dashed border-slate-200 dark:border-neutral-700 text-slate-400 dark:text-neutral-500 hover:border-violet-400/60 dark:hover:border-violet-500/50 hover:text-violet-500 dark:hover:text-violet-400 hover:bg-violet-50/30 dark:hover:bg-violet-500/5 transition-all"
                        >
                          <ImageIcon className="h-4 w-4" />
                          <span className="text-[11px]">Anexar print</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <label className="block text-[11.5px] font-semibold text-slate-600 dark:text-neutral-400 mb-1.5 uppercase tracking-wide">
                        Link de referência
                        <span className="ml-1 normal-case font-normal text-slate-400">(opcional)</span>
                      </label>
                      <div className="relative">
                        <Link2 className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-400 pointer-events-none" />
                        <input
                          type="url"
                          value={refUrl}
                          onChange={(e) => setRefUrl(e.target.value)}
                          placeholder="https://..."
                          className={`${INPUT_CLS} pl-8`}
                        />
                      </div>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center justify-between pt-1">
                    <p className="text-[11px] text-slate-400 dark:text-neutral-500">
                      Campos marcados com <span className="text-red-400">*</span> são obrigatórios
                    </p>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={handleClose}
                        className="px-3.5 py-2 rounded-xl text-[13px] font-medium text-slate-600 dark:text-neutral-400 hover:bg-slate-100 dark:hover:bg-neutral-800 transition-colors"
                      >
                        Cancelar
                      </button>
                      <button
                        type="submit"
                        disabled={!description.trim()}
                        className="px-4 py-2 rounded-xl text-[13px] font-semibold text-white transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:opacity-90 active:scale-[0.98]"
                        style={{ background: "linear-gradient(135deg, #7c3aed, #4f46e5)" }}
                      >
                        Enviar relatório
                      </button>
                    </div>
                  </div>
                </form>
              )}

              {step === "sending" && (
                <div className="flex flex-col items-center justify-center py-12 gap-4">
                  <div className="h-12 w-12 rounded-full border-4 border-violet-100 dark:border-violet-500/20 border-t-violet-500 animate-spin" />
                  <div className="text-center">
                    <p className="text-[14px] font-semibold text-slate-800 dark:text-neutral-200">Enviando relatório…</p>
                    <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-1">Nossa IA vai analisar em instantes</p>
                  </div>
                </div>
              )}

              {step === "done" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <motion.div
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", stiffness: 300, damping: 20 }}
                    className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 dark:bg-emerald-500/10"
                  >
                    <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                  </motion.div>
                  <div className="text-center space-y-1">
                    <p className="text-[16px] font-bold text-slate-900 dark:text-neutral-100">Relatório enviado!</p>
                    <p className="text-[12.5px] text-slate-500 dark:text-neutral-400 max-w-[280px] leading-relaxed">
                      Nossa IA está analisando. O administrador vai revisar e aplicar a correção.
                    </p>
                  </div>
                  <button
                    onClick={handleClose}
                    className="mt-1 px-5 py-2 rounded-xl text-[13px] font-medium bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:bg-slate-200 dark:hover:bg-neutral-700 transition-colors"
                  >
                    Fechar
                  </button>
                </div>
              )}

              {step === "error" && (
                <div className="flex flex-col items-center justify-center py-10 gap-4">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-red-50 dark:bg-red-500/10">
                    <AlertCircle className="h-8 w-8 text-red-500" />
                  </div>
                  <div className="text-center space-y-1">
                    <p className="text-[16px] font-bold text-slate-900 dark:text-neutral-100">Erro ao enviar</p>
                    <p className="text-[11.5px] text-slate-500 dark:text-neutral-400 font-mono bg-slate-50 dark:bg-neutral-800 px-3 py-2 rounded-lg max-w-xs">
                      {errorMsg}
                    </p>
                  </div>
                  <button
                    onClick={() => setStep("form")}
                    className="px-5 py-2 rounded-xl text-[13px] font-medium bg-slate-100 dark:bg-neutral-800 text-slate-700 dark:text-neutral-300 hover:bg-slate-200 transition-colors"
                  >
                    Tentar novamente
                  </button>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
