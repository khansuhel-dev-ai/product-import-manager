import { api } from './api';
import type { ImportBatch, ImportError, UploadResponse } from '../types/import';
import type { PaginatedResponse, Product } from '../types/product';

export async function uploadCsv(file: File): Promise<UploadResponse> {
  return api.postFile<UploadResponse>('/products/import', file);
}

export async function getBatchStatus(batchId: number): Promise<{ data: ImportBatch }> {
  return api.get<{ data: ImportBatch }>(`/products/import/${batchId}`);
}

export async function getBatchErrors(batchId: number): Promise<{ data: ImportError[] }> {
  return api.get<{ data: ImportError[] }>(`/products/import/${batchId}/errors`);
}

export async function getBatchProducts(
  batchId: number,
  page = 1
): Promise<PaginatedResponse<Product>> {
  return api.get<PaginatedResponse<Product>>(`/products/import/${batchId}/products?page=${page}`);
}

export async function downloadSample(): Promise<void> {
  return api.downloadFile('/products/sample', 'product-import-template.csv');
}

