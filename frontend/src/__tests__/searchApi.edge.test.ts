import { describe, it, expect, vi, beforeEach } from "vitest";
import { searchMaterialsStream, searchInstant, getCatalogStatus } from "../services/searchApi";
import type { SearchRequest } from "../types/search";

const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

beforeEach(() => vi.clearAllMocks());

function makePayload(items = ["cimento 50kg"]): SearchRequest {
  return { items, stores: undefined, force_refresh: false };
}

function encodeSSE(data: object): Uint8Array {
  return new TextEncoder().encode(`data: ${JSON.stringify(data)}\n\n`);
}

function makeStreamResponse(chunks: Uint8Array[]) {
  let idx = 0;
  const reader = {
    read: vi.fn(async () => {
      if (idx < chunks.length) return { done: false, value: chunks[idx++] };
      return { done: true, value: undefined };
    }),
  };
  return Promise.resolve({
    ok: true,
    status: 200,
    body: { getReader: () => reader },
  } as unknown as Response);
}

// ─── searchMaterialsStream ────────────────────────────────────────────────────

describe("searchMaterialsStream — SSE parsing", () => {
  it("processa evento start → store_done → end e retorna ofertas", async () => {
    const offer = {
      store: "EstoqueAtacadista",
      product_name: "Cimento CP-II 50kg",
      price: 35.9,
      currency: "BRL",
      product_url: "https://loja/cimento",
      availability: "em_estoque",
      score: 0.95,
    };
    const chunks = [
      encodeSSE({ event: "start", pending_stores: ["EstoqueAtacadista"], done: false }),
      encodeSSE({ event: "store_done", store: "EstoqueAtacadista", status: "done", offers: [offer], duration_ms: 1200, pending_stores: [], done: false }),
    ];
    mockFetch.mockResolvedValueOnce(makeStreamResponse(chunks));

    const onChunk = vi.fn();
    const result = await searchMaterialsStream(makePayload(), onChunk);

    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(result.items[0].offers).toHaveLength(1);
    expect(result.items[0].offers[0].store).toBe("EstoqueAtacadista");
  });

  it("identifica oferta de menor preço como isBestPrice", async () => {
    const cheap = { store: "A", product_name: "X", price: 30, currency: "BRL", product_url: "", availability: "em_estoque", score: 1 };
    const expensive = { store: "B", product_name: "X", price: 50, currency: "BRL", product_url: "", availability: "em_estoque", score: 0.8 };
    const chunks = [
      encodeSSE({ event: "start", pending_stores: ["A", "B"], done: false }),
      encodeSSE({ event: "store_done", store: "A", status: "done", offers: [cheap], duration_ms: 500, pending_stores: ["B"], done: false }),
      encodeSSE({ event: "store_done", store: "B", status: "done", offers: [expensive], duration_ms: 600, pending_stores: [], done: false }),
    ];
    mockFetch.mockResolvedValueOnce(makeStreamResponse(chunks));

    const result = await searchMaterialsStream(makePayload(), vi.fn());
    const offers = result.items[0].offers;
    const bestOffer = offers.find((o) => o.price === 30);
    expect(bestOffer?.isBestPrice).toBe(true);
    const worstOffer = offers.find((o) => o.price === 50);
    expect(worstOffer?.isBestPrice).toBe(false);
  });

  it("lança erro quando resposta não é ok", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 503, statusText: "Service Unavailable", body: null });
    await expect(searchMaterialsStream(makePayload(), vi.fn())).rejects.toThrow("Erro na busca: 503");
  });

  it("lança erro quando body é null", async () => {
    mockFetch.mockResolvedValueOnce({ ok: true, status: 200, body: null });
    await expect(searchMaterialsStream(makePayload(), vi.fn())).rejects.toThrow("Erro na busca:");
  });

  it("ignora linhas SSE sem prefixo 'data: '", async () => {
    const garbage = new TextEncoder().encode("ping\n:keepalive\n\n");
    mockFetch.mockResolvedValueOnce(makeStreamResponse([garbage]));
    const onChunk = vi.fn();
    const result = await searchMaterialsStream(makePayload(), onChunk);
    expect(onChunk).not.toHaveBeenCalled();
    expect(result.items[0].offers).toHaveLength(0);
  });

  it("trata status login_error na store", async () => {
    const chunks = [
      encodeSSE({ event: "start", pending_stores: ["Cofema"], done: false }),
      encodeSSE({ event: "store_done", store: "Cofema", status: "login_error", offers: [], duration_ms: 2000, pending_stores: [], done: false, error: "Credenciais inválidas" }),
    ];
    mockFetch.mockResolvedValueOnce(makeStreamResponse(chunks));
    const onChunk = vi.fn();
    const result = await searchMaterialsStream(makePayload(), onChunk);
    expect(result.items[0].offers).toHaveLength(0);
    // storeStates devem refletir login_error — verificado via onChunk
    const lastCall = onChunk.mock.calls.at(-1);
    expect(lastCall).toBeTruthy();
    const stores = lastCall![1] as Array<{ status: string; name: string }>;
    expect(stores.find((s) => s.name === "Cofema")?.status).toBe("login_error");
  });
});

// ─── searchInstant ────────────────────────────────────────────────────────────

describe("searchInstant", () => {
  it("retorna dados do catálogo com isFromCatalog=true", async () => {
    const data = {
      items: [{ raw_query: "cimento", normalized_query: "cimento", offers: [] }],
      total_items: 1,
      stores: ["EstoqueAtacadista"],
      generated_at: "2026-05-01T10:00:00Z",
      estimated_wait_seconds: { catalog_age_minutes: 15 },
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const result = await searchInstant(makePayload());
    expect(result.isFromCatalog).toBe(true);
    expect(result.catalogAgeMinutes).toBe(15);
  });

  it("lança erro em resposta 500", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: () => Promise.resolve(null) });
    await expect(searchInstant(makePayload())).rejects.toThrow("Erro na busca instantânea: 500");
  });
});

// ─── getCatalogStatus ─────────────────────────────────────────────────────────

describe("getCatalogStatus", () => {
  it("mapeia campos do backend corretamente", async () => {
    const data = {
      total_products: 1200,
      stores: { EstoqueAtacadista: { product_count: 1200, last_scraped: "2026-05-01", age_minutes: 60 } },
      is_scraping: false,
      catalog_age_minutes: 60,
    };
    mockFetch.mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(data) });
    const status = await getCatalogStatus();
    expect(status.totalProducts).toBe(1200);
    expect(status.isScraping).toBe(false);
    expect(status.stores["EstoqueAtacadista"].product_count).toBe(1200);
  });

  it("lança erro em falha", async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500 });
    await expect(getCatalogStatus()).rejects.toThrow("Erro ao buscar status do catálogo");
  });
});
