import { useState } from 'react';
import type { BulkUpdateInput } from '../types/product';

interface BulkEditModalProps {
  isOpen: boolean;
  selectedCount: number;
  selectedIds: number[];
  onClose: () => void;
  onSubmit: (data: BulkUpdateInput) => Promise<void>;
}

export function BulkEditModal({
  isOpen,
  selectedCount,
  selectedIds,
  onClose,
  onSubmit,
}: BulkEditModalProps) {
  const [updateCategory, setUpdateCategory] = useState(false);
  const [category, setCategory] = useState('');

  const [updatePrice, setUpdatePrice] = useState(false);
  const [price, setPrice] = useState('');

  const [updateQuantity, setUpdateQuantity] = useState(false);
  const [quantity, setQuantity] = useState('');

  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!updateCategory && !updatePrice && !updateQuantity) {
      setError('Please select at least one field to update.');
      return;
    }

    const payload: BulkUpdateInput = {
      ids: selectedIds,
    };

    if (updateCategory) {
      if (!category.trim()) {
        setError('Category cannot be blank if selected for update.');
        return;
      }
      payload.category = category.trim();
    }

    if (updatePrice) {
      const numPrice = parseFloat(price);
      if (isNaN(numPrice) || numPrice < 0) {
        setError('Price must be a valid non-negative number.');
        return;
      }
      payload.price = numPrice;
    }

    if (updateQuantity) {
      const numQty = parseInt(quantity, 10);
      if (isNaN(numQty) || numQty < 0) {
        setError('Quantity must be a valid non-negative integer.');
        return;
      }
      payload.quantity = numQty;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(payload);
      onClose();
    } catch (err: unknown) {
      const apiErr = err as { message?: string };
      setError(apiErr.message || 'Failed to apply bulk edit.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal-content">
        <div className="modal-header">
          <h3>✏️ Bulk Edit ({selectedCount} Selected Products)</h3>
          <button className="modal-close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {error && <div className="modal-error">{error}</div>}

        <p className="help-text">
          Check the fields you want to update across all {selectedCount} selected products:
        </p>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group border-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={updateCategory}
                onChange={(e) => setUpdateCategory(e.target.checked)}
              />
              Update Category
            </label>
            {updateCategory && (
              <input
                type="text"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                placeholder="New category name"
                required
              />
            )}
          </div>

          <div className="form-group border-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={updatePrice}
                onChange={(e) => setUpdatePrice(e.target.checked)}
              />
              Update Price (₹)
            </label>
            {updatePrice && (
              <input
                type="number"
                step="0.01"
                min="0"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                placeholder="New price"
                required
              />
            )}
          </div>

          <div className="form-group border-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={updateQuantity}
                onChange={(e) => setUpdateQuantity(e.target.checked)}
              />
              Update Quantity
            </label>
            {updateQuantity && (
              <input
                type="number"
                step="1"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="New quantity"
                required
              />
            )}
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Updating...' : `Save Changes (${selectedCount})`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

