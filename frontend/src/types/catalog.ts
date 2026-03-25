export interface CatalogProduct {
  id: string;
  name: string;
  category: string;
  brand: string;
  unit: string;
  sku?: string;
  logo?: string;
  notes?: string;
  createdAt: string;
}

export interface ProductInput {
  name: string;
  category: string;
  brand: string;
  unit: string;
  sku?: string;
  logo?: string;
  notes?: string;
}
