import { useEffect, useState } from 'react';
import type { Product, PaginatedResponse } from '../types/product';
import { getProducts } from '../services/productService';
import { getBatchProducts } from '../services/importService';

interface ProductTableProps {
  /** If set, show products from this batch. Otherwise show all products. */
  batchId?: number | null;
  title?: string;
  /** Trigger a refetch when this key changes */
  refreshKey?: number;
}

export function ProductTable({
  batchId,
  title = 'Products',
  refreshKey = 0,
}: ProductTableProps) {
  const [data, setData] = useState<PaginatedResponse<Product> | null>(null);
  const [page, setPage] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const response = batchId
          ? await getBatchProducts(batchId, page)
          : await getProducts(page);
        setData(response);
      } catch {
        setError('Failed to load products.');
        setData(null);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, [batchId, page, refreshKey]);

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
      <h2>{title}</h2>

      {isLoading && <p className="loading-text">Loading products...</p>}
      {error && <p className="error-text">{error}</p>}

      {!isLoading && !error && data && data.data.length === 0 && (
        <p className="help-text">No products found.</p>
      )}

      {data && data.data.length > 0 && (
        <>
          <div className="table-wrapper">
            <table>
              <thead>
                <tr>
                  <th>SKU</th>
                  <th>Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Qty</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {data.data.map((product) => (
                  <tr key={product.id}>
                    <td className="mono">{product.sku}</td>
                    <td>{product.name}</td>
                    <td>{product.category}</td>
                    <td className="text-right">{formatPrice(product.price)}</td>
                    <td className="text-right">{product.quantity}</td>
                    <td className="text-muted">{formatDate(product.updated_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {data.meta.last_page > 1 && (
            <div className="pagination">
              <button
                className="btn btn-sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                ← Previous
              </button>
              <span className="page-info">
                Page {data.meta.current_page} of {data.meta.last_page}
              </span>
              <button
                className="btn btn-sm"
                disabled={page >= data.meta.last_page}
                onClick={() => setPage((p) => p + 1)}
              >
                Next →
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}

