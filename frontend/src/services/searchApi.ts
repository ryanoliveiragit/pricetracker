import type { Offer, SearchRequest, SearchResponse } from "../types/search";

// URL da API real de web scraping (backend Python)
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

interface ApiSearchItemResult {
  raw_query: string;
  normalized_query: string;
  offers: ApiOffer[];
}

interface ApiSearchResponse {
  items: ApiSearchItemResult[];
  total_items: number;
  stores: string[];
  generated_at: string;
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

function mapApiResponse(data: ApiSearchResponse): SearchResponse {
  return {
    items: data.items.map((item) => ({
      rawQuery: item.raw_query,
      normalizedQuery: item.normalized_query,
      offers: item.offers.map((offer) => mapOffer(offer, item.offers)),
    })),
    totalItems: data.total_items,
    stores: data.stores,
    generatedAt: data.generated_at,
  };
}

export async function searchMaterials(payload: SearchRequest): Promise<SearchResponse> {
  console.log("🔍 Enviando busca para API real...");

  const response = await fetch(`${API_BASE_URL}/api/search`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: payload.items, stores: payload.stores }),
  });

  if (!response.ok) {
    throw new Error(`Erro na busca: ${response.status} ${response.statusText}`);
  }

  const data = (await response.json()) as ApiSearchResponse;
  console.log("✅ Resultados recebidos da API");

  return mapApiResponse(data);
}
