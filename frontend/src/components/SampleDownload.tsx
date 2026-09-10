import { useState } from 'react';
import { downloadSample } from '../services/importService';

export function SampleDownload() {
  const [isDownloading, setIsDownloading] = useState(false);

  const handleDownload = async () => {
    setIsDownloading(true);
    try {
      await downloadSample();
    } catch {
      alert('Failed to download sample template. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="card">
      <h2>Sample Template</h2>
      <p className="help-text">
        Download the CSV template to see the expected format and headers.
      </p>
      <button
        className="btn btn-secondary"
        onClick={handleDownload}
        disabled={isDownloading}
      >
        {isDownloading ? 'Downloading...' : 'Download Sample CSV'}
      </button>
    </div>
  );
}

