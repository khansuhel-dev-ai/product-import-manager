interface StorageLimitBannerProps {
  totalCount: number;
  maxLimit?: number;
}

export function StorageLimitBanner({ totalCount, maxLimit = 500 }: StorageLimitBannerProps) {
  const percentage = Math.min(100, Math.round((totalCount / maxLimit) * 100));
  const isFull = totalCount >= maxLimit;

  return (
    <div className={`storage-banner ${isFull ? 'storage-full' : ''}`}>
      <div className="storage-banner-header">
        <span className="banner-icon">{isFull ? '⚠️' : 'ℹ️'}</span>
        <div className="banner-text">
          <strong>System Storage Limit Notice:</strong> The system can store a maximum of{' '}
          <strong>{maxLimit} products</strong>.
          {isFull ? (
            <span className="banner-alert"> Limit reached! Delete products to enable new imports or manual additions.</span>
          ) : (
            <span> You currently have <strong>{totalCount}</strong> / {maxLimit} products stored.</span>
          )}
        </div>
      </div>
      <div className="storage-progress-bar">
        <div
          className={`storage-progress-fill ${isFull ? 'fill-full' : percentage > 80 ? 'fill-warning' : ''}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

