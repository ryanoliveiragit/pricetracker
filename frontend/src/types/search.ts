export type AvailabilityStatus = "em_estoque" | "indisponivel" | "por_encomenda";

export interface StoreCredential {
  store_name: string;
  username?: string;
  password?: string;
  is_active: boolean;
}

export interface SearchRequest {
  items: string[];
  stores?: StoreCredential[];
  force_refresh?: boolean;
}

export interface Offer {
  store: string;
  productName: string;
  price: number;
  currency: string;
  productUrl: string;
  addToCartUrl?: string;
  availability: AvailabilityStatus;
  isBestPrice: boolean;
  score?: number;
  sku?: string;
  imageUrl?: string;
  description?: string;
  brand?: string;
}

export interface SearchItemResult {
  rawQuery: string;
  normalizedQuery?: string;
  offers: Offer[];
}

export interface SearchResponse {
  items: SearchItemResult[];
  totalItems: number;
  stores: string[];
  generatedAt?: string;
  catalogAgeMinutes?: number | null;
  isFromCatalog?: boolean;
}

export type SortOption = "best_price" | "alphabetical";
