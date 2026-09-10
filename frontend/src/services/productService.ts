import { api } from './api';
import type {
  PaginatedResponse,
  Product,
  CreateProductInput,
  UpdateProductInput,
  BulkUpdateInput,
  BulkDeleteInput,
} from '../types/product';

export async function getProducts(page = 1, perPage = 10): Promise<PaginatedResponse<Product>> {
  return api.get<PaginatedResponse<Product>>(`/products?page=${page}&per_page=${perPage}`);
}

export async function createProduct(input: CreateProductInput): Promise<{ message: string; data: Product }> {
  return api.post<{ message: string; data: Product }>('/products', input);
}

export async function updateProduct(id: number, input: UpdateProductInput): Promise<{ message: string; data: Product }> {
  return api.put<{ message: string; data: Product }>(`/products/${id}`, input);
}

export async function deleteProduct(id: number): Promise<{ message: string; data: Product }> {
  return api.delete<{ message: string; data: Product }>(`/products/${id}`);
}

export async function bulkUpdateProducts(input: BulkUpdateInput): Promise<{ message: string; count: number }> {
  return api.post<{ message: string; count: number }>('/products/bulk-update', input);
}

export async function bulkDeleteProducts(input: BulkDeleteInput): Promise<{ message: string; count: number }> {
  return api.post<{ message: string; count: number }>('/products/bulk-delete', input);
}
