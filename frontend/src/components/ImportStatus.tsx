import type { ImportBatch } from '../types/import';

interface ImportStatusProps {
  batch: ImportBatch | null;
  isPolling: boolean;
  error: string | null;
  uploadMessage: string | null;
}

const STATUS_CONFIG: Record<string, { label: string; className: string; description: string }> = {
  pending: {
    label: 'Pending',
    className: 'status-pending',
    description: 'Your file is queued for background processing.',
  },
  processing: {
    label: 'Processing',
    className: 'status-processing',
    description: 'Your file is being processed...',
  },
  completed: {
    label: 'Completed',
    className: 'status-completed',
    description: 'All rows were imported successfully.',
  },
  completed_with_errors: {
    label: 'Completed with Errors',
    className: 'status-warning',
    description: 'Import finished but some rows had validation errors.',
  },
  failed: {
    label: 'Failed',
    className: 'status-failed',
    description: 'The import failed. Please check the error details below.',
  },
};

export function ImportStatus({ batch, isPolling, error, uploadMessage }: ImportStatusProps) {
  if (!batch && !uploadMessage && !error) return null;

  return (
    <div className="card">
      <h2>Import Status</h2>

      {uploadMessage && !batch && (
        <p className="info-text">{uploadMessage}</p>
      )}

      {error && <p className="error-text">{error}</p>}

      {batch && (
        <>
          <div className="status-header">
            <span className={`status-badge ${STATUS_CONFIG[batch.status]?.className ?? ''}`}>
              {STATUS_CONFIG[batch.status]?.label ?? batch.status}
            </span>
            {isPolling && <span className="polling-indicator">● Polling</span>}
          </div>

          <p className="status-description">
            {STATUS_CONFIG[batch.status]?.description}
          </p>

          {batch.status === 'pending' && (
            <p className="info-text">
              Your file contains more than 50 rows and has been queued for background processing.
            </p>
          )}

          <div className="stats-grid">
            <div className="stat">
              <span className="stat-label">File</span>
              <span className="stat-value">{batch.original_filename}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Total Rows</span>
              <span className="stat-value">{batch.total_rows}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Processed</span>
              <span className="stat-value">{batch.processed_rows}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Successful</span>
              <span className="stat-value success">{batch.successful_rows}</span>
            </div>
            <div className="stat">
              <span className="stat-label">Failed</span>
              <span className="stat-value error">{batch.failed_rows}</span>
            </div>
          </div>

          {batch.error_summary && (
            <p className="error-text">{batch.error_summary}</p>
          )}
        </>
      )}
    </div>
  );
}

