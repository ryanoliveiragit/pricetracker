import type {
  Offer,
  SearchRequest,
  SearchResponse,
  SupplierSearchSelection,
} from "../types/search";

const API_BASE_URL =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

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

export type StoreStatus =
  | "pending"
  | "searching"
  | "done"
  | "error"
  | "login_error";

export interface StoreState {
  name: string;
  status: StoreStatus;
  offerCount: number;
  duration_ms?: number;
  error?: string;
}

interface StreamStart {
  event: "start";
  pending_stores: string[];
  done: false;
}

interface StreamStoreDone {
  event: "store_done";
  store: string;
  status: "done" | "error" | "login_error";
  offers: ApiOffer[];
  duration_ms: number;
  pending_stores: string[];
  done: false;
  error?: string;
}

interface StreamEnd {
  event: "end";
  done: true;
}

function mapOffer(apiOffer: ApiOffer, allOffers: ApiOffer[]): Offer {
  const minPrice = Math.min(
    ...allOffers.filter((o) => o.price > 0).map((o) => o.price),
  );
  return {
    store: apiOffer.store,
    productName: apiOffer.product_name,
    price: apiOffer.price,
    currency: apiOffer.currency,
    productUrl: apiOffer.product_url,
    addToCartUrl: apiOffer.add_to_cart_url,
    availability: apiOffer.availability as
      | "em_estoque"
      | "por_encomenda"
      | "indisponivel",
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
  onChunk: (partial: SearchResponse, stores: StoreState[]) => void,
): Promise<SearchResponse> {
  const selectedStores = normalizeStores(payload.stores);
  const response = await fetch(`${API_BASE_URL}/api/search/stream`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      items: payload.items,
      stores: selectedStores,
      force_refresh: payload.force_refresh ?? false,
    }),
  });

  if (!response.ok || !response.body) {
    throw new Error(`Erro na busca: ${response.status} ${response.statusText}`);
  }

  const allOffers: ApiOffer[] = [];
  const storeStates = new Map<string, StoreState>();
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

      const parsed: StreamStart | StreamStoreDone | StreamEnd = JSON.parse(raw);

      if (parsed.event === "start") {
        for (const name of parsed.pending_stores) {
          storeStates.set(name, { name, status: "pending", offerCount: 0 });
        }
        // Marca a primeira como "searching"
        const first = parsed.pending_stores[0];
        if (first)
          storeStates.set(first, {
            ...storeStates.get(first)!,
            status: "searching",
          });
        onChunk(buildResponse(payload.items, allOffers, []), [
          ...storeStates.values(),
        ]);
        continue;
      }

      if (parsed.event === "store_done") {
        allOffers.push(...parsed.offers);
        storeStates.set(parsed.store, {
          name: parsed.store,
          status: parsed.status,
          offerCount: parsed.offers.length,
          duration_ms: parsed.duration_ms,
          error: parsed.error,
        });
        // Próxima loja passa para "searching"
        const next = parsed.pending_stores[0];
        if (next && storeStates.get(next)?.status === "pending") {
          storeStates.set(next, {
            ...storeStates.get(next)!,
            status: "searching",
          });
        }
        const responseStores = [...new Set(allOffers.map((o) => o.store))];
        onChunk(buildResponse(payload.items, allOffers, responseStores), [
          ...storeStates.values(),
        ]);
        continue;
      }
    }
  }

  const responseStores = [...new Set(allOffers.map((o) => o.store))];
  return buildResponse(payload.items, allOffers, responseStores);
}

function buildResponse(
  items: string[],
  allOffers: ApiOffer[],
  stores: string[],
): SearchResponse {
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
export async function searchMaterials(
  payload: SearchRequest,
): Promise<SearchResponse> {
  return searchMaterialsStream(payload, () => {});
}

/**
 * Busca instantânea no catálogo pré-scraped (~50ms).
 * Se não houver catálogo, faz fallback automático para busca normal no backend.
 */
export async function searchInstant(
  payload: SearchRequest,
): Promise<SearchResponse> {
  const stores = normalizeStores(payload.stores);
  const response = await fetch(`${API_BASE_URL}/api/search/instant`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: payload.items, stores }),
  });

  if (!response.ok) {
    throw new Error(`Erro na busca instantânea: ${response.status}`);
  }

  const data = await response.json();
  const catalogAgeMinutes =
    data.estimated_wait_seconds?.catalog_age_minutes ?? null;

  const mapped = (data.items ?? []).map(
    (item: {
      raw_query: string;
      normalized_query?: string;
      offers: ApiOffer[];
    }) => ({
      rawQuery: item.raw_query,
      normalizedQuery: item.normalized_query,
      offers: item.offers.map((o: ApiOffer) => mapOffer(o, item.offers)),
    }),
  );

  return {
    items: mapped,
    totalItems: data.total_items ?? mapped.length,
    stores: data.stores ?? [],
    generatedAt: data.generated_at ?? new Date().toISOString(),
    catalogAgeMinutes,
    isFromCatalog: true,
  };
}

/**
 * Atualiza preços sob demanda — re-scrapa e retorna resultados frescos.
 */
export async function searchRefresh(
  payload: SearchRequest,
): Promise<SearchResponse> {
  const stores = normalizeStores(payload.stores);
  const response = await fetch(`${API_BASE_URL}/api/search/refresh`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ items: payload.items, stores }),
  });

  if (!response.ok) {
    throw new Error(`Erro ao atualizar preços: ${response.status}`);
  }

  const data = await response.json();

  const mapped = (data.items ?? []).map(
    (item: {
      raw_query: string;
      normalized_query?: string;
      offers: ApiOffer[];
    }) => ({
      rawQuery: item.raw_query,
      normalizedQuery: item.normalized_query,
      offers: item.offers.map((o: ApiOffer) => mapOffer(o, item.offers)),
    }),
  );

  return {
    items: mapped,
    totalItems: data.total_items ?? mapped.length,
    stores: data.stores ?? [],
    generatedAt: data.generated_at ?? new Date().toISOString(),
    catalogAgeMinutes: 0,
    isFromCatalog: false,
  };
}

export interface CatalogStatus {
  totalProducts: number;
  stores: Record<
    string,
    {
      product_count: number;
      last_scraped: string | null;
      age_minutes: number | null;
    }
  >;
  isScraping: boolean;
  catalogAgeMinutes: number | null;
}

export interface CatalogItem {
  id: number;
  store: string;
  productName: string;
  price: number;
  currency: string;
  productUrl: string;
  addToCartUrl?: string;
  availability: string;
  sku?: string;
  imageUrl?: string;
  description?: string;
  brand?: string;
  score?: number;
  sourceQuery: string;
  scraperKey?: string;
  scrapedAt?: string;
}

export interface CatalogItemsResponse {
  items: CatalogItem[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CatalogFacets {
  stores: { name: string; count: number }[];
  brands: { name: string; count: number }[];
  categories: { name: string; count: number }[];
  price_min: number;
  price_max: number;
  price_avg: number;
  availability: { name: string; count: number }[];
}

export async function getCatalogFacets(): Promise<CatalogFacets> {
  const response = await fetch(`${API_BASE_URL}/api/search/catalog-facets`);
  if (!response.ok) throw new Error("Erro ao buscar facetas");
  return response.json();
}

export async function getCatalogItems(params: {
  q?: string;
  stores?: string;
  availability?: string;
  brands?: string;
  categories?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  page?: number;
  limit?: number;
}): Promise<CatalogItemsResponse> {
  const qs = new URLSearchParams();
  if (params.q) qs.set("q", params.q);
  if (params.stores) qs.set("stores", params.stores);
  if (params.availability) qs.set("availability", params.availability);
  if (params.brands) qs.set("brands", params.brands);
  if (params.categories) qs.set("categories", params.categories);
  if (params.minPrice) qs.set("min_price", String(params.minPrice));
  if (params.maxPrice) qs.set("max_price", String(params.maxPrice));
  if (params.sortBy) qs.set("sort_by", params.sortBy);
  if (params.page) qs.set("page", String(params.page));
  if (params.limit) qs.set("limit", String(params.limit));
  const response = await fetch(`${API_BASE_URL}/api/search/catalog-items?${qs.toString()}`);
  if (!response.ok) throw new Error("Erro ao buscar itens do catálogo");
  return response.json();
}

export async function getCatalogStatus(): Promise<CatalogStatus> {
  const response = await fetch(`${API_BASE_URL}/api/search/catalog-status`);
  if (!response.ok) throw new Error("Erro ao buscar status do catálogo");
  const data = await response.json();
  return {
    totalProducts: data.total_products,
    stores: data.stores,
    isScraping: data.is_scraping,
    catalogAgeMinutes: data.catalog_age_minutes,
  };
}

export async function triggerCatalogScrape(): Promise<{
  status: string;
  message: string;
}> {
  const response = await fetch(`${API_BASE_URL}/api/search/trigger-scrape`, {
    method: "POST",
  });
  if (!response.ok) throw new Error("Erro ao iniciar scraping");
  return response.json();
}

function normalizeStores(
  stores?: SupplierSearchSelection[],
): SupplierSearchSelection[] | undefined {
  if (!stores || stores.length === 0) {
    return undefined;
  }

  return stores
    .map((store) => ({
      store_name: store.store_name.trim(),
      username: store.username?.trim(),
      password: store.password?.trim(),
      is_active: store.is_active,
    }))
    .filter((store) => store.store_name.length > 0);
}
