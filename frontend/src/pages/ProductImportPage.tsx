import { useState, useCallback } from 'react';
import { FileUpload } from '../components/FileUpload';
import { SampleDownload } from '../components/SampleDownload';
import { ImportStatus } from '../components/ImportStatus';
import { ImportErrors } from '../components/ImportErrors';
import { ProductTable } from '../components/ProductTable';
import { useImportStatus } from '../hooks/useImportStatus';
import { uploadCsv } from '../services/importService';
import type { ImportError } from '../types/import';

export function ProductImportPage() {
  const [isUploading, setIsUploading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [syncErrors, setSyncErrors] = useState<ImportError[]>([]);
  const [productRefreshKey, setProductRefreshKey] = useState(0);

  // Storage count tracking (limit set to 1000)
  const [totalProducts, setTotalProducts] = useState(0);
  const [maxLimit, setMaxLimit] = useState(1000);

  // Auto refresh table when async polling reaches completion
  const handleImportComplete = useCallback(() => {
    setProductRefreshKey((k) => k + 1);
  }, []);

  const { batch, isPolling, error: pollingError, startPolling, resetStatus } = useImportStatus(handleImportComplete);

  // Clear import status and validation errors when user performs Add, Edit, or Delete actions
  const handleProductMutation = useCallback(() => {
    setUploadMessage(null);
    setUploadError(null);
    setSyncErrors([]);
    resetStatus();
  }, [resetStatus]);

  const handleTotalCountChange = useCallback((count: number, limit?: number) => {
    setTotalProducts(count);
    if (limit) setMaxLimit(limit);
  }, []);

  const handleUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    setUploadMessage(null);
    setUploadError(null);
    setSyncErrors([]);

    try {
      const response = await uploadCsv(file);
      setUploadMessage(response.message);

      // Instantly trigger product table refresh on upload response
      setProductRefreshKey((k) => k + 1);

      if (response.status === 'pending') {
        // Queued — start polling
        startPolling(response.batch_id);
      } else {
        // Synchronous — fetch final status
        startPolling(response.batch_id);
        if (response.errors && response.errors.length > 0) {
          setSyncErrors(response.errors);
        }
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

  const isLimitReached = totalProducts >= maxLimit;

  return (
    <div className="app-container">
      <header className="app-header">
        <div className="header-content">
          <h1>Product Import Manager</h1>
          <p className="subtitle">Upload CSV files, manage product catalog, and edit/delete products</p>
        </div>
      </header>

      <main className="app-main">
        <div className="top-section">
          <FileUpload
            onUpload={handleUpload}
            isUploading={isUploading}
            isLimitReached={isLimitReached}
            totalProducts={totalProducts}
            maxLimit={maxLimit}
          />
          <SampleDownload />
        </div>

        {uploadError && (
          <div className="card card-error">
            <p className="error-text">⚠️ {uploadError}</p>
          </div>
        )}

        <ImportStatus
          batch={batch}
          isPolling={isPolling}
          error={pollingError}
          uploadMessage={uploadMessage}
        />

        {/* Validation Errors */}
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

        {/* Main Product Table - Shows All Products (10 per page default) */}
        <ProductTable
          title="All Products Catalog"
          refreshKey={productRefreshKey}
          onTotalCountChange={handleTotalCountChange}
          onMutation={handleProductMutation}
        />
      </main>

      <footer className="app-footer">
        <p>Product Import Manager — Maximum Storage Limit: 1,000 Products</p>
      </footer>
    </div>
  );
}
