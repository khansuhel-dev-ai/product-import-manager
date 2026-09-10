import { useState, useCallback } from 'react';
import { FileUpload } from '../components/FileUpload';
import { SampleDownload } from '../components/SampleDownload';
import { ImportStatus } from '../components/ImportStatus';
import { ImportErrors } from '../components/ImportErrors';
import { ProductTable } from '../components/ProductTable';
import { useImportStatus } from '../hooks/useImportStatus';
import { uploadCsv } from '../services/importService';
import type { ImportError } from '../types/import';

type ViewMode = 'import' | 'all-products';

export function ProductImportPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<ImportError[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('import');
  const [productRefreshKey, setProductRefreshKey] = useState(0);

  const { batch, isPolling, error: pollingError, startPolling } = useImportStatus();

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadMessage(null);
    setUploadError(null);
    setSyncErrors([]);

    try {
      const response = await uploadCsv(file);
      setUploadMessage(response.message);

      if (response.status === 'pending') {
        // Queued — start polling
        startPolling(response.batch_id);
      } else {
        // Synchronous — fetch final status
        startPolling(response.batch_id);
        if (response.errors && response.errors.length > 0) {
          setSyncErrors(response.errors);
        }
        setProductRefreshKey((k) => k + 1);
      }
    } catch (err: unknown) {
      const apiErr = err as { message?: string; errors?: Record<string, string[]> };
      if (apiErr.errors) {
        const messages = Object.values(apiErr.errors).flat().join(' ');
        setUploadError(messages);
      } else {
        setUploadError(apiErr.message ?? 'Upload failed. Please try again.');
      }
    } finally {
      setIsUploading(false);
    }
  }, [startPolling]);

  const currentBatchId = batch?.id ?? null;
  const failedRows = batch?.failed_rows ?? 0;
  const isTerminal = batch?.status === 'completed'
    || batch?.status === 'completed_with_errors'
    || batch?.status === 'failed';

  return (
    <div className="app-container">
      <header className="app-header">
        <h1>Product Import Manager</h1>
        <p className="subtitle">Upload CSV files to import products into the catalog</p>
      </header>

      <main className="app-main">
        <div className="top-section">
          <FileUpload onUpload={handleUpload} isUploading={isUploading} />
          <SampleDownload />
        </div>

        {uploadError && (
          <div className="card">
            <p className="error-text">{uploadError}</p>
          </div>
        )}

        <ImportStatus
          batch={batch}
          isPolling={isPolling}
          error={pollingError}
          uploadMessage={uploadMessage}
        />

        {/* Show errors from synchronous import or fetch from API for async */}
        {syncErrors.length > 0 && (
          <div className="card">
            <h2>Validation Errors</h2>
            <div className="table-wrapper">
              <table>
                <thead>
                  <tr>
                    <th>Row</th>
                    <th>Field</th>
                    <th>Error</th>
                  </tr>
                </thead>
                <tbody>
                  {syncErrors.map((err, idx) => (
                    <tr key={idx}>
                      <td>{err.row_number}</td>
                      <td>{err.field ?? '—'}</td>
                      <td>{err.error_message}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {syncErrors.length === 0 && isTerminal && (
          <ImportErrors batchId={currentBatchId} failedRows={failedRows} />
        )}

        {isTerminal && batch && batch.successful_rows > 0 && (
          <ProductTable
            batchId={currentBatchId}
            title="Imported Products"
            refreshKey={productRefreshKey}
          />
        )}

        <div className="card">
          <div className="view-toggle">
            <button
              className={`btn ${viewMode === 'all-products' ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => {
                setViewMode('all-products');
                setProductRefreshKey((k) => k + 1);
              }}
            >
              View All Products
            </button>
            {viewMode === 'all-products' && (
              <button
                className="btn btn-secondary"
                onClick={() => setViewMode('import')}
              >
                Hide
              </button>
            )}
          </div>
        </div>

        {viewMode === 'all-products' && (
          <ProductTable
            title="All Products"
            refreshKey={productRefreshKey}
          />
        )}
      </main>

      <footer className="app-footer">
        <p>Product Import Manager — Take-Home Assessment</p>
      </footer>
    </div>
  );
}

