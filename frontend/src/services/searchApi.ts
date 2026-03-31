import type { Offer, SearchRequest, SearchResponse } from "../types/search";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

interface ApiOffer {
  store: string;
  product_name: string;
  price: number;
  currency: string;
  product_url: string;
  add_to_cart_url?: string;
  availability: string;
  score: number;
  sku?: string;
  image_url?: string;
  description?: string;
  brand?: string;
}

interface StreamChunk {
  store: string;
  offers: ApiOffer[];
  duration_ms: number;
  done: false;
  error?: string;
}

interface StreamDone {
  done: true;
}

function mapOffer(apiOffer: ApiOffer, allOffers: ApiOffer[]): Offer {
  const minPrice = Math.min(...allOffers.filter((o) => o.price > 0).map((o) => o.price));
  return {
    store: apiOffer.store,
    productName: apiOffer.product_name,
    price: apiOffer.price,
    currency: apiOffer.currency,
    productUrl: apiOffer.product_url,
    addToCartUrl: apiOffer.add_to_cart_url,
    availability: apiOffer.availability as "em_estoque" | "por_encomenda" | "indisponivel",
    isBestPrice: apiOffer.price === minPrice,
    score: apiOffer.score,
    sku: apiOffer.sku,
    imageUrl: apiOffer.image_url,
    description: apiOffer.description,
    brand: apiOffer.brand,
  };
}

export async function searchMaterialsStream(
  payload: SearchRequest,
  onChunk: (partial: SearchResponse) => void
): Promise<SearchResponse> {
  const response = await fetch(`${API_BASE_URL}/api/search/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: payload.items }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Erro na busca: ${response.status} ${response.statusText}`);
  }

  const allOffers: ApiOffer[] = [];
  const stores = new Set<string>();
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const raw = line.slice(6).trim();
      if (!raw) continue;

      const parsed: StreamChunk | StreamDone = JSON.parse(raw);
      if (parsed.done) continue;

      allOffers.push(...parsed.offers);
      stores.add(parsed.store);

      // Emitir resultado parcial acumulado
      const partial = buildResponse(payload.items, allOffers, [...stores]);
      onChunk(partial);
    }
  }

  return buildResponse(payload.items, allOffers, [...stores]);
}

function buildResponse(items: string[], allOffers: ApiOffer[], stores: string[]): SearchResponse {
  const mapped = allOffers.map((o) => mapOffer(o, allOffers));
  return {
    items: items.map((rawQuery) => ({
      rawQuery,
      normalizedQuery: rawQuery.toLowerCase(),
      offers: mapped,
    })),
    totalItems: items.length,
    stores,
    generatedAt: new Date().toISOString(),
  };
}

// Mantém compatibilidade com código legado
export async function searchMaterials(payload: SearchRequest): Promise<SearchResponse> {
  return searchMaterialsStream(payload, () => {});
}
