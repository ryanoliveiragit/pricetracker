"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  getFeedbackCounts,
  listFeedback,
  type FeedbackCounts,
  type FeedbackReport,
  type FeedbackStatus,
} from "@/services/feedbackApi";

const BASE = (process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000").replace(/\/api\/?$/, "");

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try { return JSON.parse(localStorage.getItem("construprice-auth") ?? "null")?.token ?? null; } catch { return null; }
}

function authHeader(): Record<string, string> {
  const t = getToken();
  return t ? { Authorization: `Bearer ${t}` } : {};
}

async function callStatus(id: number, newStatus: FeedbackStatus): Promise<void> {
  // Try specific semantic endpoints first
  const SPECIFIC: Partial<Record<FeedbackStatus, string>> = {
    pending: "reanalyze",
    validated: "validate",
    executing: "execute",
    merged: "merge",
    rejected: "reject",
  };

  const endpoint = SPECIFIC[newStatus];
  if (endpoint) {
    const res = await fetch(`${BASE}/api/feedback/${id}/${endpoint}`, {
      method: "POST",
      headers: authHeader(),
    });
    if (res.ok) return;
    const body = await res.json().catch(() => null);
    throw new Error(body?.detail ?? `HTTP ${res.status}`);
  }

  // Fallback: generic PATCH (backend may or may not support it)
  const res = await fetch(`${BASE}/api/feedback/${id}/status`, {
    method: "PATCH",
    headers: { ...authHeader(), "Content-Type": "application/json" },
    body: JSON.stringify({ status: newStatus }),
  });
  if (res.ok) return;
  const body = await res.json().catch(() => null);
  throw new Error(body?.detail ?? `HTTP ${res.status}`);
}

// ─── Config ───────────────────────────────────────────────────────────────────

const COLUMNS: FeedbackStatus[] = [
  "pending", "analyzed", "validated", "executing", "deployed", "merged", "rejected",
];

const LABEL: Record<FeedbackStatus, string> = {
  pending: "Pendente",
  analyzed: "Analisado",
  approved: "Aprovado",
  validated: "Validado",
  executing: "Executando",
  deployed: "Deployed",
  merged: "Mergeado",
  rejected: "Rejeitado",
};

const DOT: Record<FeedbackStatus, string> = {
  pending: "bg-gray-500",
  analyzed: "bg-blue-400",
  approved: "bg-blue-400",
  validated: "bg-purple-400",
  executing: "bg-amber-400 animate-pulse",
  deployed: "bg-green-400",
  merged: "bg-emerald-400",
  rejected: "bg-red-500",
};

const COLUMN_HOVER: Record<FeedbackStatus, string> = {
  pending: "border-gray-500 bg-gray-800/30",
  analyzed: "border-blue-500 bg-blue-950/20",
  approved: "border-blue-500 bg-blue-950/20",
  validated: "border-purple-500 bg-purple-950/20",
  executing: "border-amber-500 bg-amber-950/20",
  deployed: "border-green-500 bg-green-950/20",
  merged: "border-emerald-500 bg-emerald-950/20",
  rejected: "border-red-500 bg-red-950/20",
};

const BADGE: Record<FeedbackStatus, string> = {
  pending: "bg-gray-800 text-gray-400",
  analyzed: "bg-blue-900 text-blue-300",
  approved: "bg-blue-900 text-blue-300",
  validated: "bg-purple-900 text-purple-300",
  executing: "bg-amber-900 text-amber-300",
  deployed: "bg-green-900 text-green-300",
  merged: "bg-emerald-900 text-emerald-300",
  rejected: "bg-red-900 text-red-400",
};

function timeAgo(iso?: string): string {
  if (!iso) return "";
  const m = Math.floor((Date.now() - new Date(iso).getTime()) / 60000);
  if (m < 1) return "agora";
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function Card({
  report,
  error,
  onDragStart,
  onClick,
}: {
  report: FeedbackReport;
  error?: string;
  onDragStart: () => void;
  onClick: () => void;
}) {
  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        onDragStart();
      }}
      className="cursor-grab active:cursor-grabbing select-none"
    >
      <div
        onClick={onClick}
        className="bg-gray-900 border border-gray-700 rounded-lg p-3 hover:border-gray-600 hover:bg-gray-800/80 transition-all"
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-mono text-gray-500">#{report.id}</span>
          <span className="text-xs text-gray-600">{timeAgo(report.created_at)}</span>
        </div>
        <p className="text-sm text-gray-200 line-clamp-2 leading-snug mb-2">
          {report.description || report.search_query || "(sem descrição)"}
        </p>
        <p className="text-xs text-gray-500 truncate">{report.user_email}</p>
      </div>
      {error && (
        <div className="mt-1 px-2 py-1.5 bg-red-950 border border-red-800 rounded-md text-xs text-red-300 leading-snug">
          {error}
        </div>
      )}
    </div>
  );
}

// ─── Column ───────────────────────────────────────────────────────────────────

function Column({
  status,
  reports,
  count,
  isOver,
  errors,
  onDragOver,
  onDragLeave,
  onDrop,
  onDragStart,
  onCardClick,
}: {
  status: FeedbackStatus;
  reports: FeedbackReport[];
  count: number;
  isOver: boolean;
  errors: Record<number, string>;
  onDragOver: () => void;
  onDragLeave: () => void;
  onDrop: () => void;
  onDragStart: (r: FeedbackReport) => void;
  onCardClick: (r: FeedbackReport) => void;
}) {
  return (
    <div
      className={`flex flex-col min-w-[210px] max-w-[220px] shrink-0 rounded-xl border transition-all duration-150 p-2 ${
        isOver ? COLUMN_HOVER[status] : "border-transparent"
      }`}
      onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; onDragOver(); }}
      onDragLeave={onDragLeave}
      onDrop={(e) => { e.preventDefault(); onDrop(); }}
    >
      <div className="flex items-center gap-2 mb-3 px-1">
        <span className={`w-2 h-2 rounded-full shrink-0 ${DOT[status]}`} />
        <span className="text-sm font-medium text-gray-300 truncate">{LABEL[status]}</span>
        <span className="ml-auto shrink-0 text-xs text-gray-500 bg-gray-800 rounded px-1.5 py-0.5">{count}</span>
      </div>

      <div
        className={`flex flex-col gap-2 overflow-y-auto flex-1 max-h-[calc(100vh-200px)] min-h-[60px] rounded-lg transition-colors ${
          isOver ? "bg-white/5" : ""
        }`}
      >
        {reports.map((r) => (
          <Card
            key={r.id}
            report={r}
            error={errors[r.id]}
            onDragStart={() => onDragStart(r)}
            onClick={() => onCardClick(r)}
          />
        ))}
        {reports.length === 0 && (
          <div className={`text-xs text-center py-8 rounded-lg border border-dashed transition-colors ${
            isOver ? "text-gray-500 border-gray-600" : "text-gray-700 border-gray-800"
          }`}>
            {isOver ? "Soltar aqui" : "Vazio"}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Detail Drawer ────────────────────────────────────────────────────────────

function Drawer({ report, onClose }: { report: FeedbackReport; onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative w-full max-w-md bg-gray-950 border-l border-gray-800 flex flex-col shadow-2xl overflow-hidden">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-800 shrink-0">
          <button onClick={onClose} className="text-gray-500 hover:text-gray-300 text-lg leading-none">&#x2715;</button>
          <span className="text-sm font-mono text-gray-500">#{report.id}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${BADGE[report.status]}`}>
            {LABEL[report.status]}
          </span>
          <span className="ml-auto text-xs text-gray-600">{timeAgo(report.created_at)}</span>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          <section>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Reportado por</p>
            <p className="text-sm text-gray-300">{report.user_name || report.user_email}</p>
            {report.user_name && <p className="text-xs text-gray-500">{report.user_email}</p>}
          </section>

          <section>
            <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Descrição</p>
            <p className="text-sm text-gray-300 whitespace-pre-wrap leading-relaxed">{report.description}</p>
          </section>

          {report.search_query && (
            <section>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Query</p>
              <p className="text-sm font-mono text-gray-300 bg-gray-900 rounded px-2 py-1">{report.search_query}</p>
            </section>
          )}

          {report.expected_result && (
            <section>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Resultado esperado</p>
              <p className="text-sm text-gray-300">{report.expected_result}</p>
            </section>
          )}

          {report.reference_url && (
            <section>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">URL de referência</p>
              <a href={report.reference_url} target="_blank" rel="noreferrer"
                className="text-xs text-blue-400 hover:text-blue-300 underline break-all">
                {report.reference_url}
              </a>
            </section>
          )}

          {report.screenshot_url && (
            <section>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-2">Screenshot</p>
              <img src={`${BASE}${report.screenshot_url}`} alt="screenshot"
                className="w-full rounded-lg border border-gray-700 max-h-48 object-contain bg-gray-900" />
            </section>
          )}

          {report.admin_notes && (
            <section>
              <p className="text-xs text-gray-500 uppercase tracking-wider mb-1">Notas</p>
              <p className="text-sm text-gray-400">{report.admin_notes}</p>
            </section>
          )}

          {report.branch_name && (
            <section className="bg-gray-900 border border-gray-700 rounded-lg p-3 space-y-1">
              <p className="text-xs text-gray-500 uppercase tracking-wider">Branch</p>
              <p className="text-sm font-mono text-gray-300">{report.branch_name}</p>
              {report.preview_url && (
                <a href={report.preview_url} target="_blank" rel="noreferrer"
                  className="text-xs text-blue-400 hover:text-blue-300 underline">Preview</a>
              )}
              {report.branch_url && (
                <a href={report.branch_url} target="_blank" rel="noreferrer"
                  className="ml-3 text-xs text-blue-400 hover:text-blue-300 underline">GitHub</a>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function FeedbackPage() {
  const [reports, setReports] = useState<FeedbackReport[]>([]);
  const [counts, setCounts] = useState<FeedbackCounts | null>(null);
  const [selected, setSelected] = useState<FeedbackReport | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [dragOver, setDragOver] = useState<FeedbackStatus | null>(null);
  const [errors, setErrors] = useState<Record<number, string>>({});

  // Refs hold drag state without triggering renders
  const dragging = useRef<{ report: FeedbackReport; fromStatus: FeedbackStatus } | null>(null);

  const load = useCallback(async (q?: string) => {
    setLoading(true);
    try {
      const [rs, cs] = await Promise.all([
        listFeedback({ q: q || undefined, limit: 300 }),
        getFeedbackCounts(),
      ]);
      setReports(rs);
      setCounts(cs);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    const t = setTimeout(() => load(search), 400);
    return () => clearTimeout(t);
  }, [search, load]);

  function setError(id: number, msg: string) {
    setErrors((prev) => ({ ...prev, [id]: msg }));
    setTimeout(() => setErrors((prev) => { const n = { ...prev }; delete n[id]; return n; }), 4000);
  }

  async function handleDrop(toStatus: FeedbackStatus) {
    setDragOver(null);
    const drag = dragging.current;
    if (!drag || drag.fromStatus === toStatus) return;

    const { report, fromStatus } = drag;
    dragging.current = null;

    // Optimistic update
    setReports((prev) =>
      prev.map((r) => r.id === report.id ? { ...r, status: toStatus } : r)
    );

    try {
      await callStatus(report.id, toStatus);
      // Refresh counts silently
      getFeedbackCounts().then(setCounts).catch(() => null);
    } catch (e) {
      // Rollback
      setReports((prev) =>
        prev.map((r) => r.id === report.id ? { ...r, status: fromStatus } : r)
      );
      setError(report.id, e instanceof Error ? e.message : String(e));
    }
  }

  const byStatus = (s: FeedbackStatus) => reports.filter((r) => r.status === s);

  return (
    <div className="flex flex-col h-[calc(100vh-60px)]">
      {/* Toolbar */}
      <div className="flex items-center gap-3 pb-4 shrink-0">
        <h1 className="text-base font-semibold text-gray-100">Feedback</h1>
        <div className="ml-auto flex items-center gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar..."
            className="bg-gray-900 border border-gray-700 rounded-lg px-3 py-1.5 text-sm text-gray-200 placeholder-gray-500 focus:outline-none focus:border-purple-500 w-44"
          />
          <button
            onClick={() => load(search)}
            disabled={loading}
            className="px-3 py-1.5 text-sm bg-gray-800 hover:bg-gray-700 text-gray-300 rounded-lg transition-colors disabled:opacity-50"
          >
            {loading ? "..." : "Atualizar"}
          </button>
        </div>
      </div>

      {/* Board */}
      <div className="flex gap-3 overflow-x-auto flex-1 pb-2">
        {COLUMNS.map((status) => (
          <Column
            key={status}
            status={status}
            reports={byStatus(status)}
            count={counts?.[status as keyof FeedbackCounts] ?? byStatus(status).length}
            isOver={dragOver === status}
            errors={errors}
            onDragOver={() => setDragOver(status)}
            onDragLeave={() => setDragOver((prev) => (prev === status ? null : prev))}
            onDrop={() => handleDrop(status)}
            onDragStart={(r) => { dragging.current = { report: r, fromStatus: r.status }; }}
            onCardClick={setSelected}
          />
        ))}
      </div>

      {/* Detail drawer */}
      {selected && <Drawer report={selected} onClose={() => setSelected(null)} />}
    </div>
  );
}
