interface ConfirmDeleteModalProps {
  isOpen: boolean;
  title?: string;
  message: string;
  onClose: () => void;
  onConfirm: () => Promise<void>;
  isDeleting?: boolean;
}

export function ConfirmDeleteModal({
  isOpen,
  title = 'Confirm Deletion',
  message,
  onClose,
  onConfirm,
  isDeleting = false,
}: ConfirmDeleteModalProps) {
  if (!isOpen) return null;

  return (
    <div className="modal-backdrop">
      <div className="modal-content modal-delete-content">
        <div className="modal-header">
          <h3>🗑️ {title}</h3>
          <button className="modal-close-btn" onClick={onClose} disabled={isDeleting}>
            &times;
          </button>
        </div>

        <div className="modal-delete-body">
          <p className="delete-warning-text">{message}</p>
          <p className="help-text">This action cannot be undone.</p>
        </div>

        <div className="modal-actions">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={onClose}
            disabled={isDeleting}
          >
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={onConfirm}
            disabled={isDeleting}
          >
            {isDeleting ? 'Deleting...' : 'Delete'}
          </button>
        </div>
      </div>
    </div>
  );
}
