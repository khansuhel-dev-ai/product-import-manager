import { useEffect, useState, useCallback } from 'react';
import type { Product, PaginatedResponse, CreateProductInput, UpdateProductInput, BulkUpdateInput } from '../types/product';
import {
  getProducts,
  createProduct,
  updateProduct,
  deleteProduct,
  bulkUpdateProducts,
  bulkDeleteProducts,
} from '../services/productService';
import { getBatchProducts } from '../services/importService';
import { ProductFormModal } from './ProductFormModal';
import { BulkEditModal } from './BulkEditModal';

interface ProductTableProps {
  batchId?: number | null;
  title?: string;
  refreshKey?: number;
  onTotalCountChange?: (count: number, maxLimit?: number) => void;
}

export function ProductTable({
  batchId,
  title = 'Products Catalog',
  refreshKey = 0,
  onTotalCountChange,
}: ProductTableProps) {
  const [data, setData] = useState<PaginatedResponse<Product> | null>(null);
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Selection state
  const [selectedIds, setSelectedIds] = useState<number[]>([]);

  // Modal states
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isBulkEditModalOpen, setIsBulkEditModalOpen] = useState(false);

  const fetchProducts = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const response = batchId
        ? await getBatchProducts(batchId, page, perPage)
        : await getProducts(page, perPage);
      setData(response);
      if (onTotalCountChange) {
        onTotalCountChange(response.meta.total, response.meta.max_limit);
      }
    } catch {
      setError('Failed to load products.');
      setData(null);
    } finally {
      setIsLoading(false);
    }
  }, [batchId, page, perPage, onTotalCountChange]);

  useEffect(() => {
    fetchProducts();
    setSelectedIds([]);
  }, [fetchProducts, refreshKey]);

  const showNotification = (msg: string) => {
    setSuccessMessage(msg);
    setTimeout(() => setSuccessMessage(null), 4000);
  };

  // Selection handlers
  const handleSelectAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!data) return;
    if (e.target.checked) {
      const allPageIds = data.data.map((p) => p.id);
      setSelectedIds(Array.from(new Set([...selectedIds, ...allPageIds])));
    } else {
      const currentPageIdSet = new Set(data.data.map((p) => p.id));
      setSelectedIds(selectedIds.filter((id) => !currentPageIdSet.has(id)));
    }
  };

  const handleSelectRow = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const isAllSelected =
    Boolean(data) &&
    data!.data.length > 0 &&
    data!.data.every((p) => selectedIds.includes(p.id));

  // Single Add / Edit Submit
  const handleFormSubmit = async (input: CreateProductInput | UpdateProductInput) => {
    if (editingProduct) {
      // Edit
      const res = await updateProduct(editingProduct.id, input as UpdateProductInput);
      showNotification(res.message || 'Product updated successfully.');
    } else {
      // Add
      const res = await createProduct(input as CreateProductInput);
      showNotification(res.message || 'Product added successfully.');
    }
    fetchProducts();
  };

  // Single Delete
  const handleDeleteSingle = async (product: Product) => {
    if (!window.confirm(`Are you sure you want to delete product "${product.name}" (${product.sku})?`)) {
      return;
    }
    try {
      const res = await deleteProduct(product.id);
      showNotification(res.message || 'Product deleted.');
      setSelectedIds((prev) => prev.filter((id) => id !== product.id));
      fetchProducts();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Failed to delete product.');
    }
  };

  // Bulk Edit Submit
  const handleBulkEditSubmit = async (payload: BulkUpdateInput) => {
    const res = await bulkUpdateProducts(payload);
    showNotification(res.message || 'Bulk update applied.');
    setSelectedIds([]);
    fetchProducts();
  };

  // Bulk Delete
  const handleBulkDelete = async () => {
    if (selectedIds.length === 0) return;
    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedIds.length} selected product(s)? This action cannot be undone.`
      )
    ) {
      return;
    }
    try {
      const res = await bulkDeleteProducts({ ids: selectedIds });
      showNotification(res.message || 'Selected products deleted.');
      setSelectedIds([]);
      fetchProducts();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Failed to delete selected products.');
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2,
    }).format(price);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="card">
      <div className="table-header-row">
        <div>
          <h2>{title}</h2>
          {data && (
            <p className="subtitle">
              Total Products: <strong>{data.meta.total}</strong> / 500 max
            </p>
          )}
        </div>

        <div className="table-actions">
          <button
            className="btn btn-primary"
            onClick={() => setIsAddModalOpen(true)}
            disabled={Boolean(data && data.meta.total >= 500)}
          >
            ➕ Add Product
          </button>

          {selectedIds.length > 0 && (
            <>
              <button
                className="btn btn-secondary"
                onClick={() => setIsBulkEditModalOpen(true)}
              >
                ✏️ Edit Selected ({selectedIds.length})
              </button>
              <button
                className="btn btn-danger"
                onClick={handleBulkDelete}
              >
                🗑️ Delete Selected ({selectedIds.length})
              </button>
            </>
          )}
        </div>
      </div>

      {successMessage && <div className="alert-success">{successMessage}</div>}
      {error && <div className="error-text card-alert">{error}</div>}

      {isLoading && <p className="loading-text">Loading products...</p>}

      {!isLoading && !error && data && data.data.length === 0 && (
        <p className="help-text">No products found in the catalog.</p>
      )}

      {!isLoading && data && data.data.length > 0 && (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th style={{ width: '40px' }}>
                    <input
                      type="checkbox"
                      checked={isAllSelected}
                      onChange={handleSelectAll}
                      title="Select all on this page"
                    />
                  </th>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Updated</th>
                  <th style={{ width: '130px', textAlign: 'center' }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((product) => {
                  const isSelected = selectedIds.includes(product.id);
                  return (
                    <tr key={product.id} className={isSelected ? 'selected-row' : ''}>
                      <td>
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => handleSelectRow(product.id)}
                        />
                      </td>
                      <td className="mono">{product.sku}</td>
                      <td>
                        <strong>{product.name}</strong>
                      </td>
                      <td>{product.category}</td>
                      <td className="text-right">{formatPrice(product.price)}</td>
                      <td className="text-right">{product.quantity}</td>
                      <td className="text-muted">{formatDate(product.updated_at)}</td>
                      <td className="text-center actions-cell">
                        <button
                          className="btn-icon btn-icon-edit"
                          title="Edit Product"
                          onClick={() => setEditingProduct(product)}
                        >
                          ✏️ Edit
                        </button>
                        <button
                          className="btn-icon btn-icon-delete"
                          title="Delete Product"
                          onClick={() => handleDeleteSingle(product)}
                        >
                          🗑️
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="pagination-bar">
            <div className="pagination-info">
              Showing {data.data.length > 0 ? (page - 1) * perPage + 1 : 0} to{' '}
              {Math.min(page * perPage, data.meta.total)} of {data.meta.total} products
            </div>

            <div className="pagination-controls">
              <div className="per-page-selector">
                <label>Show: </label>
                <select
                  value={perPage}
                  onChange={(e) => {
                    setPerPage(Number(e.target.value));
                    setPage(1);
                  }}
                >
                  <option value={10}>10 per page</option>
                  <option value={25}>25 per page</option>
                  <option value={50}>50 per page</option>
                </select>
              </div>

              <button
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage(1)}
                title="First Page"
              >
                « First
              </button>
              <button
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Prev
              </button>
              <span className="page-badge">
                Page {data.meta.current_page} of {data.meta.last_page}
              </span>
              <button
                className="btn btn-sm"
                disabled={page >= data.meta.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
              <button
                className="btn btn-sm"
                disabled={page >= data.meta.last_page}
                onClick={() => setPage(data.meta.last_page)}
                title="Last Page"
              >
                Last »
              </button>
            </div>
          </div>
        </>
      )}

      {/* Add Product Modal */}
      <ProductFormModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        onSubmit={handleFormSubmit}
      />

      {/* Edit Product Modal */}
      <ProductFormModal
        isOpen={Boolean(editingProduct)}
        product={editingProduct}
        onClose={() => setEditingProduct(null)}
        onSubmit={handleFormSubmit}
      />

      {/* Bulk Edit Modal */}
      <BulkEditModal
        isOpen={isBulkEditModalOpen}
        selectedCount={selectedIds.length}
        selectedIds={selectedIds}
        onClose={() => setIsBulkEditModalOpen(false)}
        onSubmit={handleBulkEditSubmit}
      />
    </div>
  );
}
