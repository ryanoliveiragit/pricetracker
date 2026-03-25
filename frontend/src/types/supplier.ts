export interface Supplier {
  id: string;
  name: string;
  url: string;
  logo?: string;
  requiresLogin: boolean;
  username?: string;
  password?: string;
  isActive: boolean;
  region?: string;
  notes?: string;
  createdAt: string;
}

export interface SupplierInput {
  name: string;
  url: string;
  logo?: string;
  requiresLogin: boolean;
  username?: string;
  password?: string;
  region?: string;
  notes?: string;
}
