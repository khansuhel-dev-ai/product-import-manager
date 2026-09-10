import { useRef, useState } from 'react';

interface FileUploadProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
  maxSizeMB?: number;
  isLimitReached?: boolean;
}

const ACCEPTED_TYPES = '.csv';

export function FileUpload({
  onUpload,
  isUploading,
  maxSizeMB = 2,
  isLimitReached = false,
}: FileUploadProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFileError(null);
    const file = e.target.files?.[0] ?? null;

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (isLimitReached) {
      setFileError('System limit reached (500 products). Please delete existing products before uploading more.');
      setSelectedFile(null);
      return;
    }

    // Client-side validation
    if (!file.name.toLowerCase().endsWith('.csv')) {
      setFileError('Please select a CSV file.');
      setSelectedFile(null);
      return;
    }

    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      setFileError(`File size exceeds ${maxSizeMB} MB limit.`);
      setSelectedFile(null);
      return;
    }

    setSelectedFile(file);
  };

  const handleUpload = () => {
    if (isLimitReached) {
      setFileError('System limit reached (500 products). Please delete existing products first.');
      return;
    }
    if (selectedFile && !isUploading) {
      onUpload(selectedFile);
    }
  };

  const handleClear = () => {
    setSelectedFile(null);
    setFileError(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div className="card">
      <h2>Upload CSV</h2>

      <div className="file-input-wrapper">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES}
          onChange={handleFileSelect}
          disabled={isUploading || isLimitReached}
          id="csv-file-input"
        />
        <label htmlFor="csv-file-input" className={`file-input-label ${isLimitReached ? 'disabled' : ''}`}>
          {isLimitReached
            ? '⚠️ Upload disabled (500 product limit reached)'
            : selectedFile
            ? selectedFile.name
            : 'Choose a CSV file...'}
        </label>
      </div>

      {selectedFile && (
        <div className="file-info">
          <span className="file-name">{selectedFile.name}</span>
          <span className="file-size">{formatFileSize(selectedFile.size)}</span>
        </div>
      )}

      {fileError && <p className="error-text">{fileError}</p>}
      {isLimitReached && (
        <p className="error-text card-alert">
          Limit reached: The system cannot store more than 500 products. Delete existing products to enable CSV import.
        </p>
      )}

      <p className="help-text">
        Accepted: CSV files up to {maxSizeMB} MB
      </p>

      <div className="button-group">
        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading || isLimitReached}
        >
          {isUploading ? 'Uploading...' : 'Upload CSV'}
        </button>
        <button
          className="btn btn-secondary"
          onClick={handleClear}
          disabled={isUploading}
        >
          Clear
        </button>
      </div>
    </div>
  );
}
