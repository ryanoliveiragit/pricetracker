const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export interface AgentOption {
  label: string;
  value: string;
}

export interface AgentSummaryField {
  field: string;
  value: string;
}

export interface AgentSummaryProduct {
  product_key: string;
  label: string;
  ready: boolean;
  active: boolean;
  position: number;
  search_item: string;
  selected_fields: AgentSummaryField[];
}

export interface AgentSummary {
  supplier_label: string;
  products: AgentSummaryProduct[];
}

export interface AgentResponse {
  message: string;
  ready: boolean;
  search_items: string[] | null;
  thinking?: string | null;
  step: string;
  product?: string | null;
  active_product?: string | null;
  progress_current: number;
  progress_total: number;
  input_type: "text" | "chips" | "select" | "multi_chips" | "none";
  allow_free_text: boolean;
  suggested_aliases: string[];
  options: AgentOption[];
  selected_suppliers: string[];
  summary: AgentSummary;
}

export interface SupplierSearchPayload {
  store_name: string;
  is_active: boolean;
  username?: string;
  password?: string;
}

export async function sendAgentMessage(
  message: string,
  history: ChatMessage[],
): Promise<AgentResponse> {
  const response = await fetch(`${API_BASE_URL}/api/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message, history }),
  });

  if (!response.ok) {
    throw new Error(`Erro no agente: ${response.status}`);
  }

  return response.json() as Promise<AgentResponse>;
}

export function buildSupplierSearchPayload(
  selectedSuppliers: string[],
): SupplierSearchPayload[] | undefined {
  const normalized = selectedSuppliers
    .map((supplier) => supplier.trim())
    .filter(Boolean);

  if (normalized.length === 0) {
    return undefined;
  }

  return normalized.map((supplier) => ({
    store_name: supplier,
    is_active: true,
  }));
}
