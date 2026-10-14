// apps/web/src/components/forecast/SkeletonForecastCard.tsx
// Skeleton loading placeholder cho thẻ nhận định giá xăng

export function SkeletonForecastCard() {
  return (
    <div
      className="forecast-card forecast-card--skeleton"
      aria-hidden="true"
    >
      {/* Header */}
      <div className="forecast-card__header">
        <div className="skeleton skeleton--badge" style={{ width: '130px', height: '26px' }} />
        <div className="skeleton skeleton--text" style={{ width: '180px', height: '18px', marginTop: '8px' }} />
      </div>

      {/* Hero Direction Box */}
      <div className="forecast-hero-box forecast-hero-box--skeleton">
        <div className="skeleton skeleton--icon" style={{ width: '48px', height: '48px', borderRadius: '12px' }} />
        <div style={{ flex: 1 }}>
          <div className="skeleton skeleton--text" style={{ width: '160px', height: '24px', marginBottom: '6px' }} />
          <div className="skeleton skeleton--text" style={{ width: '110px', height: '16px' }} />
        </div>
      </div>

      {/* Confidence Meter */}
      <div className="forecast-confidence-meter">
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
          <div className="skeleton skeleton--text" style={{ width: '90px', height: '14px' }} />
          <div className="skeleton skeleton--badge" style={{ width: '60px', height: '18px' }} />
        </div>
        <div className="skeleton" style={{ width: '100%', height: '8px', borderRadius: '4px' }} />
      </div>

      {/* Impact Factors */}
      <div className="forecast-factors">
        <div className="skeleton skeleton--text" style={{ width: '120px', height: '16px', marginBottom: '12px' }} />
        <div className="forecast-factors__list">
          <div className="skeleton skeleton--row" style={{ height: '36px', borderRadius: '8px', marginBottom: '8px' }} />
          <div className="skeleton skeleton--row" style={{ height: '36px', borderRadius: '8px', marginBottom: '8px' }} />
          <div className="skeleton skeleton--row" style={{ height: '36px', borderRadius: '8px' }} />
        </div>
      </div>
    </div>
  );
}
