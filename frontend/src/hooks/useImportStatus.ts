import { useEffect, useRef, useState, useCallback } from 'react';
import type { ImportBatch, ImportStatus } from '../types/import';
import { getBatchStatus } from '../services/importService';

const TERMINAL_STATUSES: ImportStatus[] = ['completed', 'completed_with_errors', 'failed'];
const POLL_INTERVAL_MS = 3000;
const MAX_POLLS = 100;

interface UseImportStatusResult {
  batch: ImportBatch | null;
  isPolling: boolean;
  error: string | null;
  startPolling: (batchId: number) => void;
  stopPolling: () => void;
}

export function useImportStatus(): UseImportStatusResult {
  const [batch, setBatch] = useState<ImportBatch | null>(null);
  const [isPolling, setIsPolling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const intervalRef = useRef<number | null>(null);
  const pollCountRef = useRef(0);
  const batchIdRef = useRef<number | null>(null);

  const stopPolling = useCallback(() => {
    if (intervalRef.current !== null) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    setIsPolling(false);
    pollCountRef.current = 0;
  }, []);

  const poll = useCallback(async () => {
    if (batchIdRef.current === null) return;

    pollCountRef.current += 1;
    if (pollCountRef.current > MAX_POLLS) {
      stopPolling();
      setError('Polling timed out. Please refresh to check status.');
      return;
    }

    try {
      const response = await getBatchStatus(batchIdRef.current);
      setBatch(response.data);

      if (TERMINAL_STATUSES.includes(response.data.status)) {
        stopPolling();
      }
    } catch {
      stopPolling();
      setError('Failed to fetch import status.');
    }
  }, [stopPolling]);

  const startPolling = useCallback(
    (batchId: number) => {
      stopPolling();
      batchIdRef.current = batchId;
      setError(null);
      setIsPolling(true);
      pollCountRef.current = 0;

      // Fetch immediately
      poll();

      intervalRef.current = window.setInterval(poll, POLL_INTERVAL_MS);
    },
    [poll, stopPolling]
  );

  useEffect(() => {
    return () => {
      if (intervalRef.current !== null) {
        clearInterval(intervalRef.current);
      }
    };
  }, []);

  return { batch, isPolling, error, startPolling, stopPolling };
}

