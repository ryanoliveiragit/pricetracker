const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

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

export interface FeedbackReport {
  id: number;
  user_email: string;
  user_name: string;
  search_query: string;
  expected_result: string;
  description: string;
  screenshot_url: string | null;
  reference_url: string | null;
  status: "pending" | "analyzed" | "approved" | "rejected";
  ai_summary: string | null;
  ai_fix_type: "add_abbreviation" | "add_synonym" | "ui_change" | "feature_request" | "bug_fix" | "manual" | "no_fix_needed" | null;
  ai_proposed_fix: Record<string, unknown> | null;
  ai_confidence: number | null;
  ai_explanation: string | null;
  admin_email: string | null;
  admin_notes: string | null;
  created_at: string;
  resolved_at: string | null;
  execution_status: "idle" | "running" | "done" | "error" | "tsc_error" | "applied" | "partial" | null;
  execution_diff: FileDiff[] | null;
  execution_summary: string | null;
  execution_error: string | null;
}

export async function submitFeedback(data: {
  problem_type: string;
  search_query: string;
  expected_result: string;
  description: string;
  reference_url?: string;
  screenshot?: File | null;
}): Promise<{ id: number; status: string; message: string }> {
  const form = new FormData();
  form.append("problem_type", data.problem_type);
  form.append("description", data.description);
  form.append("search_query", data.search_query);
  form.append("expected_result", data.expected_result);
  form.append("reference_url", data.reference_url ?? "");
  if (data.screenshot) form.append("screenshot", data.screenshot);

  const res = await fetch(`${BASE}/api/feedback`, {
    method: "POST",
    headers: authHeader(),
    body: form,
  });
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

export async function executeFeedback(id: number): Promise<{ id: number; execution_status: string }> {
  const res = await fetch(`${BASE}/api/feedback/${id}/execute`, {
    method: "POST",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function applyFeedbackChanges(id: number): Promise<{ results: { file: string; status: string; error?: string }[]; all_applied: boolean; tsc_error?: string }> {
  const res = await fetch(`${BASE}/api/feedback/${id}/apply-changes`, {
    method: "POST",
    headers: authHeader(),
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}

export async function resolveFeedback(
  id: number,
  action: "approve" | "reject",
  adminNotes?: string,
): Promise<{ id: number; status: string; fix_applied: boolean; message: string }> {
  const form = new FormData();
  form.append("action", action);
  form.append("admin_notes", adminNotes ?? "");

  const res = await fetch(`${BASE}/api/feedback/${id}/resolve`, {
    method: "PATCH",
    headers: authHeader(),
    body: form,
  });
  if (!res.ok) throw new Error(await res.text());
  return res.json();
}
