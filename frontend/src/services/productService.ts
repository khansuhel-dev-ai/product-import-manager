import { api } from './api';
import type { PaginatedResponse, Product } from '../types/product';

export async function getProducts(page = 1): Promise<PaginatedResponse<Product>> {
  return api.get<PaginatedResponse<Product>>(`/products?page=${page}`);
}

