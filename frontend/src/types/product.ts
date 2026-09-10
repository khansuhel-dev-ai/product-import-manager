export interface Product {
  id: number;
  sku: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
  import_batch_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CreateProductInput {
  sku: string;
  name: string;
  category: string;
  price: number;
  quantity: number;
}

export interface UpdateProductInput {
  sku?: string;
  name?: string;
  category?: string;
  price?: number;
  quantity?: number;
}

export interface BulkUpdateInput {
  ids: number[];
  category?: string;
  price?: number;
  quantity?: number;
}

export interface BulkDeleteInput {
  ids: number[];
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    max_limit?: number;
  };
  links: {
    first: string | null;
    last: string | null;
    prev: string | null;
    next: string | null;
  };
}
