export type ImportStatus =
  | 'pending'
  | 'processing'
  | 'completed'
  | 'completed_with_errors'
  | 'failed';

export interface ImportBatch {
  id: number;
  original_filename: string;
  total_rows: number;
  processed_rows: number;
  successful_rows: number;
  failed_rows: number;
  status: ImportStatus;
  error_summary: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ImportError {
  id: number;
  import_batch_id: number;
  row_number: number;
  field: string | null;
  error_message: string;
  row_data: Record<string, string> | null;
}

export interface UploadResponse {
  message: string;
  batch_id: number;
  status: ImportStatus;
  summary?: {
    total_rows: number;
    successful_rows: number;
    failed_rows: number;
  };
  errors?: ImportError[];
}

