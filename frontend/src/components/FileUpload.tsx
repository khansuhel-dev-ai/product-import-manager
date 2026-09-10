import { useRef, useState } from 'react';

interface FileUploadProps {
  onUpload: (file: File) => void;
  isUploading: boolean;
  maxSizeMB?: number;
}

const ACCEPTED_TYPES = '.csv';

export function FileUpload({ onUpload, isUploading, maxSizeMB = 2 }: FileUploadProps) {
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
          disabled={isUploading}
          id="csv-file-input"
        />
        <label htmlFor="csv-file-input" className="file-input-label">
          {selectedFile ? selectedFile.name : 'Choose a CSV file...'}
        </label>
      </div>

      {selectedFile && (
        <div className="file-info">
          <span className="file-name">{selectedFile.name}</span>
          <span className="file-size">{formatFileSize(selectedFile.size)}</span>
        </div>
      )}

      {fileError && <p className="error-text">{fileError}</p>}

      <p className="help-text">
        Accepted: CSV files up to {maxSizeMB} MB
      </p>

      <div className="button-group">
        <button
          className="btn btn-primary"
          onClick={handleUpload}
          disabled={!selectedFile || isUploading}
        >
          {isUploading ? 'Uploading...' : 'Upload'}
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

