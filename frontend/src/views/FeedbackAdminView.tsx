"use client";

import {
  type FeedbackReport,
  type FileDiff,
  executeFeedback,
  listFeedback,
  markFeedbackMerged,
  reanalyzeFeedback,
  rejectFeedback,
  updateFeedbackPrompt,
  validateFeedback,
} from "@/services/feedbackApi";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bot,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GitBranch,
  Loader2,
  Pencil,
  RotateCcw,
  XCircle,
  Zap,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useMemo, useState } from "react";

// ─── Constantes ────────────────────────────────────────────────────────────────

const TYPE_META: Record<string, { label: string; cls: string }> = {
  add_abbreviation: { label: "Abreviação",  cls: "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" },
  add_synonym:      { label: "Sinônimo",    cls: "bg-blue-100 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300" },
  ui_change:        { label: "Interface",   cls: "bg-pink-100 text-pink-700 dark:bg-pink-500/15 dark:text-pink-300" },
  feature_request:  { label: "Sugestão",    cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-300" },
  bug_fix:          { label: "Bug",         cls: "bg-red-100 text-red-700 dark:bg-red-500/15 dark:text-red-300" },
  manual:           { label: "Manual",      cls: "bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300" },
  no_fix_needed:    { label: "Sem ação",    cls: "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400" },
};

const AUTO_FIX_TYPES = ["add_abbreviation", "add_synonym"];

// Stepper: 4 etapas visuais. Cada status do backend mapeia em uma delas.
type Step = 0 | 1 | 2 | 3;
const STEP_LABELS = ["Transcrever", "Validar", "Executar", "Deploy"] as const;

function statusToStep(status: FeedbackReport["status"]): Step {
  switch (status) {
    case "pending":   return 0;
    case "analyzed":  return 1;          // transcrito, aguarda validação
    case "approved":                     // legado
    case "validated": return 2;          // pronto para executar
    case "executing": return 2;          // executando
    case "deployed":  return 3;
    case "merged":    return 3;
    default:          return 0;          // rejected
  }
}

// ─── Pequenos helpers ──────────────────────────────────────────────────────────

function TypeBadge({ type }: { type: string }) {
  const m = TYPE_META[type] ?? TYPE_META.manual;
  return <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-[11px] font-semibold ${m.cls}`}>{m.label}</span>;
}

function StatusDot({ status }: { status: FeedbackReport["status"] }) {
  const cls =
    status === "pending" ? "bg-amber-400 animate-pulse" :
    status === "analyzed" ? "bg-blue-500" :
    status === "validated" ? "bg-violet-500" :
    status === "executing" ? "bg-indigo-500 animate-pulse" :
    status === "deployed" ? "bg-cyan-500" :
    status === "merged" ? "bg-emerald-500" :
    status === "rejected" ? "bg-slate-300 dark:bg-neutral-600" :
    "bg-slate-300 dark:bg-neutral-600";
  return <div className={`h-2 w-2 rounded-full shrink-0 ${cls}`} />;
}

function Stepper({ current, rejected }: { current: Step; rejected: boolean }) {
  return (
    <div className="flex items-center gap-1.5">
      {STEP_LABELS.map((label, i) => {
        const done = i < current;
        const active = i === current;
        const stepCls = rejected
          ? "bg-slate-200 dark:bg-neutral-700 text-slate-400 dark:text-neutral-500"
          : done
          ? "bg-emerald-500 text-white"
          : active
          ? "bg-violet-500 text-white"
          : "bg-slate-200 dark:bg-neutral-700 text-slate-400 dark:text-neutral-500";
        return (
          <div key={label} className="flex items-center gap-1.5">
            <div className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${stepCls}`}>
              {done && !rejected ? <Check className="h-3 w-3" /> : i + 1}
            </div>
            <span className={`text-[11px] font-medium ${active && !rejected ? "text-slate-700 dark:text-neutral-300" : "text-slate-400 dark:text-neutral-500"}`}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && <div className="w-3 h-px bg-slate-200 dark:bg-neutral-700 mx-0.5" />}
          </div>
        );
      })}
    </div>
  );
}

function DiffView({ diff }: { diff: FileDiff[] }) {
  return (
    <div className="space-y-2">
      {diff.map((c, i) => (
        <div key={i} className="rounded-xl border border-slate-200 dark:border-neutral-700 overflow-hidden text-[11px] font-mono">
          <div className="px-3 py-1.5 bg-slate-50 dark:bg-neutral-800 text-[10px] font-sans font-semibold text-slate-500 dark:text-neutral-400 uppercase tracking-wide">
            {c.file}
          </div>
          <div className="bg-red-50/50 dark:bg-red-500/5 px-3 py-2 text-red-700 dark:text-red-400 whitespace-pre-wrap border-b border-red-100 dark:border-red-500/10">
            {(c.old ?? "").split("\n").map((l, j) => <div key={j}><span className="select-none opacity-40 mr-1.5">−</span>{l}</div>)}
          </div>
          <div className="bg-emerald-50/50 dark:bg-emerald-500/5 px-3 py-2 text-emerald-700 dark:text-emerald-400 whitespace-pre-wrap">
            {(c.new ?? "").split("\n").map((l, j) => <div key={j}><span className="select-none opacity-40 mr-1.5">+</span>{l}</div>)}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── ReportCard ────────────────────────────────────────────────────────────────

function ReportCard({ report, onRefresh }: { report: FeedbackReport; onRefresh: (silent?: boolean) => void }) {
  const [open, setOpen] = useState(report.status !== "merged" && report.status !== "rejected");
  const [editingPrompt, setEditingPrompt] = useState(false);
  const [promptDraft, setPromptDraft] = useState(report.validated_prompt ?? "");
  const [busy, setBusy] = useState<"validate" | "execute" | "reject" | "merge" | "save" | "reanalyze" | null>(null);

  const isPending   = report.status === "pending";
  const isAnalyzed  = report.status === "analyzed";
  const isValidated = report.status === "validated";
  const isExecuting = report.status === "executing";
  const isDeployed  = report.status === "deployed";
  const isMerged    = report.status === "merged";
  const isRejected  = report.status === "rejected";

  const isAutoFix = AUTO_FIX_TYPES.includes(report.ai_fix_type ?? "");
  const currentStep = statusToStep(report.status);

  // Sincroniza o draft quando o report atualiza (ex: reanálise gerou novo prompt)
  useEffect(() => {
    if (!editingPrompt) setPromptDraft(report.validated_prompt ?? "");
  }, [report.validated_prompt, editingPrompt]);

  // Polling enquanto análise/execução estiver rodando
  useEffect(() => {
    if (!isPending && !isExecuting) return;
    const id = setInterval(() => onRefresh(true), 3000);
    return () => clearInterval(id);
  }, [isPending, isExecuting, onRefresh]);

  async function withBusy<T>(label: typeof busy, fn: () => Promise<T>): Promise<T | undefined> {
    setBusy(label);
    try {
      return await fn();
    } catch (e) {
      console.error(e);
      alert(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  }

  async function savePrompt() {
    if (!promptDraft.trim()) return;
    await withBusy("save", async () => {
      await updateFeedbackPrompt(report.id, promptDraft.trim());
      setEditingPrompt(false);
      onRefresh();
    });
  }

  async function validate() {
    await withBusy("validate", async () => {
      // Se houver edição não salva, persiste antes
      if (editingPrompt && promptDraft.trim() && promptDraft.trim() !== (report.validated_prompt ?? "").trim()) {
        await updateFeedbackPrompt(report.id, promptDraft.trim());
        setEditingPrompt(false);
      }
      await validateFeedback(report.id);
      onRefresh();
    });
  }

  async function execute() {
    await withBusy("execute", async () => {
      await executeFeedback(report.id);
      onRefresh();
    });
  }

  async function merge() {
    await withBusy("merge", async () => {
      await markFeedbackMerged(report.id);
      onRefresh();
    });
  }

  async function reject() {
    if (!confirm("Rejeitar este feedback?")) return;
    await withBusy("reject", async () => {
      await rejectFeedback(report.id);
      onRefresh();
    });
  }

  async function reanalyze() {
    await withBusy("reanalyze", async () => {
      await reanalyzeFeedback(report.id);
      onRefresh();
    });
  }

  return (
    <div className="rounded-2xl border border-slate-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 overflow-hidden">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3">
        <StatusDot status={report.status} />
        <div className="flex-1 min-w-0 cursor-pointer" onClick={() => setOpen(o => !o)}>
          <div className="flex items-center gap-2 flex-wrap">
            {report.ai_fix_type && <TypeBadge type={report.ai_fix_type} />}
            <span className="text-[13px] text-slate-700 dark:text-neutral-300 truncate">
              {report.ai_summary || report.description.slice(0, 80)}
            </span>
          </div>
          <div className="flex items-center gap-2 mt-0.5">
            <span className="text-[11px] text-slate-400 dark:text-neutral-500">{report.user_name || report.user_email}</span>
            <span className="text-slate-200 dark:text-neutral-700">·</span>
            <span className="text-[11px] text-slate-400 dark:text-neutral-500">
              {new Date(report.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}
            </span>
            {isPending && <span className="flex items-center gap-1 text-[11px] text-amber-500"><Loader2 className="h-3 w-3 animate-spin" />transcrevendo…</span>}
            {isExecuting && <span className="flex items-center gap-1 text-[11px] text-indigo-500"><Loader2 className="h-3 w-3 animate-spin" />executando…</span>}
          </div>
        </div>
        <button onClick={() => setOpen(o => !o)}
          className="rounded-lg p-1.5 text-slate-300 dark:text-neutral-600 hover:text-slate-500 dark:hover:text-neutral-400 transition-colors">
          {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>
      </div>

      {/* ── Stepper ── */}
      {!isRejected && (
        <div className="px-4 pb-2 -mt-1">
          <Stepper current={currentStep} rejected={isRejected} />
        </div>
      )}

      {/* ── Conteúdo expandido ── */}
      <AnimatePresence>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.16 }} className="overflow-hidden">
            <div className="border-t border-slate-100 dark:border-neutral-800 px-4 pb-4 pt-3 space-y-3">

              {/* Descrição original */}
              <p className="text-[13px] text-slate-700 dark:text-neutral-300 leading-relaxed">{report.description}</p>

              {/* Contexto de busca */}
              {report.search_query && (
                <div className="flex items-center gap-2 text-[12px]">
                  <span className="rounded bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 font-mono text-slate-600 dark:text-neutral-300">
                    🔍 {report.search_query}
                  </span>
                  {report.expected_result && <>
                    <span className="text-slate-300 dark:text-neutral-600">→</span>
                    <span className="rounded bg-slate-100 dark:bg-neutral-800 px-2 py-0.5 font-mono text-slate-500 dark:text-neutral-400">{report.expected_result}</span>
                  </>}
                </div>
              )}

              {/* Screenshot */}
              {report.screenshot_url && (
                <a href={`http://localhost:8000${report.screenshot_url}`} target="_blank" rel="noopener noreferrer">
                  <div className="relative h-36 w-full rounded-xl overflow-hidden border border-slate-200 dark:border-neutral-700 hover:opacity-90 transition-opacity">
                    <Image src={`http://localhost:8000${report.screenshot_url}`} alt="screenshot" fill className="object-cover" />
                  </div>
                </a>
              )}

              {/* Reference URL */}
              {report.reference_url && (
                <a href={report.reference_url} target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-[12px] text-blue-500 hover:text-blue-600">
                  <ExternalLink className="h-3 w-3" />{report.reference_url}
                </a>
              )}

              {/* Auto-fix preview (abreviação/sinônimo) */}
              {isAutoFix && report.ai_proposed_fix && (
                <div className="rounded-xl border border-slate-100 dark:border-neutral-800 bg-slate-50 dark:bg-neutral-800/40 px-3 py-2.5 text-[12px]">
                  <p className="text-[10px] font-semibold text-slate-400 dark:text-neutral-500 uppercase tracking-wide mb-1.5">
                    {report.ai_fix_type === "add_abbreviation" ? "Abreviação proposta" : "Sinônimos propostos"}
                  </p>
                  {report.ai_fix_type === "add_abbreviation" ? (
                    <p className="font-mono">
                      <span className="text-slate-500 dark:text-neutral-400">&quot;{String(report.ai_proposed_fix.long_form)}&quot;</span>
                      {" → "}
                      {(report.ai_proposed_fix.short_forms as string[] ?? []).map(s => (
                        <code key={s} className="mx-0.5 px-1.5 py-0.5 rounded bg-violet-100 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300">{s}</code>
                      ))}
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-1">
                      {(report.ai_proposed_fix.group as string[] ?? []).map(t => (
                        <code key={t} className="px-1.5 py-0.5 rounded bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300">{t}</code>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Prompt transcrito (editável durante 'analyzed'; readonly depois) */}
              {!isAutoFix && (isAnalyzed || isValidated || isExecuting || isDeployed || isMerged) && (
                <div className="rounded-xl border border-slate-200 dark:border-neutral-700 overflow-hidden">
                  <div className="flex items-center justify-between px-3 py-2 bg-slate-50 dark:bg-neutral-800 border-b border-slate-200 dark:border-neutral-700">
                    <div className="flex items-center gap-1.5">
                      <Bot className="h-3.5 w-3.5 text-violet-500" />
                      <span className="text-[11px] font-semibold text-slate-600 dark:text-neutral-400">
                        Prompt {editingPrompt ? "(editando)" : "transcrito pela IA"}
                      </span>
                    </div>
                    {(isAnalyzed || isValidated) && !editingPrompt && (
                      <button onClick={() => setEditingPrompt(true)}
                        className="flex items-center gap-1 text-[11px] font-medium text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-200 transition-colors">
                        <Pencil className="h-3 w-3" />Editar
                      </button>
                    )}
                  </div>
                  {editingPrompt ? (
                    <div className="p-3 space-y-2 bg-white dark:bg-neutral-900">
                      <textarea
                        value={promptDraft}
                        onChange={(e) => setPromptDraft(e.target.value)}
                        rows={6}
                        className="w-full rounded-lg border border-slate-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-2 text-[12px] font-mono text-slate-700 dark:text-neutral-300 focus:outline-none focus:border-violet-400 dark:focus:border-violet-500 focus:ring-2 focus:ring-violet-400/20"
                      />
                      <div className="flex justify-end gap-2">
                        <button onClick={() => { setEditingPrompt(false); setPromptDraft(report.validated_prompt ?? ""); }}
                          className="px-2.5 py-1 text-[11px] font-medium rounded-md text-slate-500 hover:bg-slate-100 dark:hover:bg-neutral-800">
                          Cancelar
                        </button>
                        <button onClick={savePrompt} disabled={busy === "save" || !promptDraft.trim()}
                          className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-md bg-slate-700 hover:bg-slate-800 dark:bg-neutral-700 dark:hover:bg-neutral-600 text-white disabled:opacity-50">
                          {busy === "save" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                          Salvar prompt
                        </button>
                      </div>
                    </div>
                  ) : (
                    <pre className="px-3 py-3 text-[12px] text-slate-700 dark:text-neutral-300 whitespace-pre-wrap font-mono leading-relaxed bg-white dark:bg-neutral-900 max-h-56 overflow-y-auto">
                      {(report.validated_prompt || (report.ai_proposed_fix?.prompt as string) || "").trim() || "—"}
                    </pre>
                  )}
                </div>
              )}

              {/* Diff gerado (após execute) */}
              {(isDeployed || isMerged) && report.execution_diff && report.execution_diff.length > 0 && (
                <div className="space-y-2">
                  {report.execution_summary && (
                    <p className="text-[12px] text-slate-500 dark:text-neutral-400">{report.execution_summary}</p>
                  )}
                  <DiffView diff={report.execution_diff} />
                </div>
              )}

              {/* Branch + preview info (sempre que branch ou preview existir) */}
              {(report.branch_name || report.preview_url || report.branch_url) && (
                <div className="rounded-xl border border-cyan-200 dark:border-cyan-500/20 bg-cyan-50/50 dark:bg-cyan-500/5 px-3 py-2.5 space-y-2">
                  {report.branch_name && (
                    <div className="flex items-center gap-2 text-[12px]">
                      <GitBranch className="h-3.5 w-3.5 text-cyan-600 dark:text-cyan-400 shrink-0" />
                      <code className="font-mono text-cyan-700 dark:text-cyan-300 truncate">{report.branch_name}</code>
                      {report.commit_sha && (
                        <span className="text-[10px] text-cyan-600/60 dark:text-cyan-400/60 font-mono">
                          {report.commit_sha.slice(0, 7)}
                        </span>
                      )}
                    </div>
                  )}
                  <div className="flex flex-wrap items-center gap-2">
                    {report.branch_url && (
                      <a href={report.branch_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-medium rounded-lg bg-white dark:bg-neutral-900 border border-cyan-200 dark:border-cyan-500/30 px-2.5 py-1 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-500/10">
                        <ExternalLink className="h-3 w-3" />Ver branch no GitHub
                      </a>
                    )}
                    {report.preview_url ? (
                      <a href={report.preview_url} target="_blank" rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[11px] font-semibold rounded-lg bg-cyan-500 hover:bg-cyan-600 px-2.5 py-1 text-white">
                        <ExternalLink className="h-3 w-3" />Abrir preview
                      </a>
                    ) : report.branch_name && (
                      <span className="inline-flex items-center gap-1.5 text-[11px] font-medium rounded-lg bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-200 dark:border-cyan-500/20 px-2.5 py-1 text-cyan-500 dark:text-cyan-400">
                        <Loader2 className="h-3 w-3 animate-spin" />Vercel building…
                      </span>
                    )}
                  </div>
                </div>
              )}

              {/* Erros de execução */}
              {report.execution_status === "error" && report.execution_error && (
                <div className="rounded-xl bg-red-50 dark:bg-red-500/10 border border-red-200 dark:border-red-500/20 px-3 py-2.5 text-[12px] text-red-600 dark:text-red-400">
                  <div className="flex items-center gap-2 mb-1">
                    <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                    <span className="font-semibold">Execução falhou — voltou para validado para nova tentativa</span>
                  </div>
                  <pre className="mt-1 text-[11px] whitespace-pre-wrap opacity-80 max-h-32 overflow-y-auto">{report.execution_error}</pre>
                </div>
              )}

              {/* Resolvido por */}
              {(isMerged || isRejected) && report.admin_email && (
                <p className="text-[11px] text-slate-400 dark:text-neutral-500">
                  {isMerged ? "Mergeado" : "Rejeitado"} por {report.admin_email}
                  {report.resolved_at && ` · ${new Date(report.resolved_at).toLocaleDateString("pt-BR")}`}
                </p>
              )}

              {/* ── Ações ── */}
              <div className="flex flex-wrap items-center gap-2 pt-1">

                {isPending && (
                  <button onClick={reanalyze} disabled={busy === "reanalyze"}
                    className="flex items-center gap-1.5 rounded-lg border border-slate-200 dark:border-neutral-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800">
                    {busy === "reanalyze" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Re-transcrever
                  </button>
                )}

                {isAnalyzed && (
                  <>
                    <button onClick={validate} disabled={busy === "validate"}
                      className="flex items-center gap-1.5 rounded-lg bg-violet-500 hover:bg-violet-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">
                      {busy === "validate" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
                      {isAutoFix ? "Validar e aplicar" : "Validar prompt"}
                    </button>
                    <button onClick={reanalyze} disabled={busy === "reanalyze"}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-neutral-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800">
                      <RotateCcw className="h-3 w-3" />
                      Re-transcrever
                    </button>
                    <button onClick={reject} disabled={busy === "reject"}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-neutral-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800">
                      <XCircle className="h-3 w-3" />
                      Rejeitar
                    </button>
                  </>
                )}

                {isValidated && (
                  <>
                    <button onClick={execute} disabled={busy === "execute"}
                      className="flex items-center gap-1.5 rounded-lg bg-indigo-500 hover:bg-indigo-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">
                      {busy === "execute" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}
                      Executar em branch
                    </button>
                    <button onClick={reject} disabled={busy === "reject"}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-neutral-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800">
                      <XCircle className="h-3 w-3" />
                      Cancelar
                    </button>
                  </>
                )}

                {isExecuting && (
                  <span className="flex items-center gap-1.5 rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-indigo-600 dark:text-indigo-400">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    Criando branch + aplicando…
                  </span>
                )}

                {isDeployed && (
                  <>
                    <button onClick={merge} disabled={busy === "merge"}
                      className="flex items-center gap-1.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 px-3 py-1.5 text-[11px] font-semibold text-white disabled:opacity-50">
                      {busy === "merge" ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                      Marcar como mergeado
                    </button>
                    <button onClick={execute} disabled={busy === "execute"}
                      className="flex items-center gap-1 rounded-lg border border-slate-200 dark:border-neutral-700 px-2.5 py-1.5 text-[11px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800">
                      <RotateCcw className="h-3 w-3" />
                      Re-executar
                    </button>
                  </>
                )}

                {isMerged && (
                  <span className="flex items-center gap-1 rounded-lg bg-emerald-50 dark:bg-emerald-500/10 px-2.5 py-1.5 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    <CheckCircle2 className="h-3 w-3" />Mergeado
                  </span>
                )}

                {isRejected && (
                  <span className="flex items-center gap-1 rounded-lg bg-slate-50 dark:bg-neutral-800 px-2.5 py-1.5 text-[11px] font-semibold text-slate-500 dark:text-neutral-400">
                    <XCircle className="h-3 w-3" />Rejeitado
                  </span>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Main view ─────────────────────────────────────────────────────────────────

const TABS = [
  { key: "",          label: "Todos" },
  { key: "pending",   label: "Pendentes" },
  { key: "analyzed",  label: "Transcritos" },
  { key: "validated", label: "Validados" },
  { key: "deployed",  label: "Deployed" },
  { key: "merged",    label: "Mergeados" },
  { key: "rejected",  label: "Rejeitados" },
];

export default function FeedbackAdminView() {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState("");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    if (!silent) setError(null);
    try {
      setReports(await listFeedback(tab || undefined));
    } catch (e) {
      if (!silent) setError(e instanceof Error ? e.message : "Erro ao carregar feedbacks");
    } finally {
      if (!silent) setLoading(false);
    }
  }, [tab]);

  useEffect(() => { load(); }, [load]);

  const counts = useMemo(
    () => reports.reduce<Record<string, number>>(
      (acc, r) => { acc[r.status] = (acc[r.status] ?? 0) + 1; return acc; },
      {},
    ),
    [reports],
  );

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[20px] font-bold text-slate-900 dark:text-neutral-100">Feedbacks</h1>
          <p className="text-[12px] text-slate-400 dark:text-neutral-500 mt-0.5">
            Tarefa → IA transcreve → você valida → executa em branch isolada
          </p>
        </div>
        <button onClick={() => load()} disabled={loading}
          className="rounded-xl border border-slate-200 dark:border-neutral-700 px-3 py-2 text-[12px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors disabled:opacity-50">
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : "Atualizar"}
        </button>
      </div>

      <div className="flex gap-1 rounded-xl bg-slate-100 dark:bg-neutral-800/60 p-1 overflow-x-auto">
        {TABS.map(({ key, label }) => {
          const count = key ? (counts[key] ?? 0) : reports.length;
          return (
            <button key={key} onClick={() => setTab(key)}
              className={`flex-1 min-w-[80px] rounded-lg py-1.5 text-[12px] font-medium transition-all flex items-center justify-center gap-1.5 ${
                tab === key
                  ? "bg-white dark:bg-neutral-700 text-slate-800 dark:text-neutral-100 shadow-sm"
                  : "text-slate-500 dark:text-neutral-400 hover:text-slate-700 dark:hover:text-neutral-300"
              }`}>
              {label}
              {count > 0 && (
                <span className={`rounded-full px-1.5 py-px text-[10px] font-bold ${
                  tab === key ? "bg-violet-100 text-violet-600 dark:bg-violet-500/20 dark:text-violet-400" : "bg-slate-200 dark:bg-neutral-700 text-slate-500 dark:text-neutral-400"
                }`}>{count}</span>
              )}
            </button>
          );
        })}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-slate-300 dark:text-neutral-600" />
        </div>
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-20 gap-3 text-center">
          <AlertCircle className="h-8 w-8 text-red-400" />
          <div>
            <p className="text-[13px] font-semibold text-slate-700 dark:text-neutral-300">Falha ao carregar feedbacks</p>
            <p className="text-[11.5px] text-slate-400 dark:text-neutral-500 mt-1 font-mono">{error}</p>
          </div>
          <button
            onClick={() => load()}
            className="mt-1 rounded-xl border border-slate-200 dark:border-neutral-700 px-3 py-1.5 text-[12px] font-medium text-slate-500 dark:text-neutral-400 hover:bg-slate-50 dark:hover:bg-neutral-800 transition-colors"
          >
            Tentar novamente
          </button>
        </div>
      ) : reports.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 gap-2 text-center">
          <CheckCircle2 className="h-8 w-8 text-slate-200 dark:text-neutral-700" />
          <p className="text-[13px] text-slate-400 dark:text-neutral-500">Nenhum feedback encontrado</p>
        </div>
      ) : (
        <div className="space-y-2">
          {reports.map((r) => (
            <ReportCard key={r.id} report={r} onRefresh={load} />
          ))}
        </div>
      )}
    </div>
  );
}
