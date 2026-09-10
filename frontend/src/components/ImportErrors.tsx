import { useEffect, useState } from 'react';
import type { ImportError } from '../types/import';
import { getBatchErrors } from '../services/importService';

interface ImportErrorsProps {
  batchId: number | null;
  failedRows: number;
}

export function ImportErrors({ batchId, failedRows }: ImportErrorsProps) {
  const [errors, setErrors] = useState<ImportError[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    if (!batchId || failedRows === 0) {
      setErrors([]);
      return;
    }

    const fetchErrors = async () => {
      setIsLoading(true);
      try {
        const response = await getBatchErrors(batchId);
        setErrors(response.data);
      } catch {
        setErrors([]);
      } finally {
        setIsLoading(false);
      }
    };

    fetchErrors();
  }, [batchId, failedRows]);

  if (!batchId || failedRows === 0) return null;

  return (
    <div className="card">
      <h2>Validation Errors</h2>

      {isLoading ? (
        <p className="loading-text">Loading errors...</p>
      ) : errors.length === 0 ? (
        <p className="help-text">No errors to display.</p>
      ) : (
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
              {errors.map((err) => (
                <tr key={err.id}>
                  <td>{err.row_number}</td>
                  <td>{err.field ?? '—'}</td>
                  <td>{err.error_message}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

