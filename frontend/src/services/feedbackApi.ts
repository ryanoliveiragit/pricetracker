const BASE = process.env.NEXT_PUBLIC_API_BASE_URL ?? process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function getToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem("construprice-auth");
    if (!raw) return null;
    return JSON.parse(raw)?.token ?? null;
  } catch {
    return null;
  }
}

function authHeader(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export interface FileDiff {
  file: string;
  old: string;
  new: string;
}

export type FeedbackStatus =
  | "pending"
  | "analyzed"
  | "approved"     // legado
  | "validated"
  | "executing"
  | "deployed"
  | "merged"
  | "rejected";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface ChatResponse {
  text: string;
  refined_prompt: string | null;
  prompt_updated: boolean;
  validated_prompt: string | null;
}

export interface FeedbackReport {
  id: number;
  user_email: string;
  user_name: string;
  search_query: string;
  expected_result: string;
  description: string;
  screenshot_url: string | null;
  reference_url: string | null;
  status: FeedbackStatus;
  ai_summary: string | null;
  ai_fix_type:
    | "add_abbreviation"
    | "add_synonym"
    | "ui_change"
    | "feature_request"
    | "bug_fix"
    | "manual"
    | "no_fix_needed"
    | null;
  ai_proposed_fix: Record<string, unknown> | null;
  ai_confidence: number | null;
  ai_explanation: string | null;
  admin_email: string | null;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  execution_status:
    | "idle"
    | "running"
    | "done"
    | "error"
    | "tsc_error"
    | "applied"
    | "partial"
    | "deployed"
    | null;
  execution_diff: FileDiff[] | null;
  execution_summary: string | null;
  execution_error: string | null;
  // Fluxo agente
  validated_prompt: string | null;
  branch_name: string | null;
  commit_sha: string | null;
  preview_url: string | null;
  branch_url: string | null;
  chat_history: ChatMessage[];
}

export interface DuplicateError extends Error {
  status: 409;
  similarId: string | null;
}

export async function submitFeedback(data: {
  problem_type: string;
  search_query: string;
  expected_result: string;
  description: string;
  reference_url?: string;
  screenshot?: File | null;
  force?: boolean;
}): Promise<{ id: number; status: string; message: string }> {
  const form = new FormData();
  form.append("problem_type", data.problem_type);
  form.append("description", data.description);
  form.append("search_query", data.search_query);
  form.append("expected_result", data.expected_result);
  form.append("reference_url", data.reference_url ?? "");
  form.append("force", data.force ? "true" : "false");
  if (data.screenshot) form.append("screenshot", data.screenshot);

  const res = await fetch(`${BASE}/api/feedback`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });

  if (res.status === 409) {
    const body = await res.json();
    const err = new Error(body.detail) as DuplicateError;
    err.status = 409;
    err.similarId = res.headers.get("X-Similar-Id");
    throw err;
  }

  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function listFeedback(statusFilter?: string): Promise<FeedbackReport[]> {
  const url = new URL(`${BASE}/api/feedback`);
  if (statusFilter) url.searchParams.set("status_filter", statusFilter);
  const res = await fetch(url.toString(), { headers: authHeader() });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function reanalyzeFeedback(id: number): Promise<{ id: number; status: string; message: string }> {
  const res = await fetch(`${BASE}/api/feedback/${id}/reanalyze`, {
    method: "POST",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function updateFeedbackPrompt(
  id: number,
  prompt: string,
): Promise<{ id: number; validated_prompt: string }> {
  const form = new FormData();
  form.append("prompt", prompt);
  const res = await fetch(`${BASE}/api/feedback/${id}/prompt`, {
    method: "PATCH",
    headers: authHeader(),
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function validateFeedback(
  id: number,
): Promise<{ id: number; status: FeedbackStatus; auto_applied: boolean }> {
  const res = await fetch(`${BASE}/api/feedback/${id}/validate`, {
    method: "POST",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function executeFeedback(
  id: number,
): Promise<{ id: number; status: FeedbackStatus; execution_status: string }> {
  const res = await fetch(`${BASE}/api/feedback/${id}/execute`, {
    method: "POST",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function markFeedbackMerged(
  id: number,
): Promise<{ id: number; status: FeedbackStatus }> {
  const res = await fetch(`${BASE}/api/feedback/${id}/merge`, {
    method: "POST",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function rejectFeedback(
  id: number,
  adminNotes?: string,
): Promise<{ id: number; status: FeedbackStatus }> {
  const form = new FormData();
  form.append("admin_notes", adminNotes ?? "");
  const res = await fetch(`${BASE}/api/feedback/${id}/reject`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// ─── Compat ──────────────────────────────────────────────────────────────────
// Mantemos resolveFeedback como wrapper para não quebrar código antigo.

export async function resolveFeedback(
  id: number,
  action: "approve" | "reject",
  adminNotes?: string,
): Promise<{ id: number; status: string }> {
  if (action === "approve") {
    const r = await validateFeedback(id);
    return { id: r.id, status: r.status };
  }
  return rejectFeedback(id, adminNotes);
}

export async function chatWithTicket(
  id: number,
  message: string,
): Promise<ChatResponse> {
  const form = new FormData();
  form.append("message", message);
  const res = await fetch(`${BASE}/api/feedback/${id}/chat`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

// applyFeedbackChanges removido — mudanças agora são commitadas em branch.
// Mantido como no-op para evitar erro de import durante a transição.
export async function applyFeedbackChanges(
  _id: number,
): Promise<{ results: { file: string; status: string; error?: string }[]; all_applied: boolean; tsc_error?: string }> {
  throw new Error(
    "applyFeedbackChanges foi removido. Use executeFeedback — mudanças são aplicadas em uma branch isolada.",
  );
}
