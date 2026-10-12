// src/components/dashboard/SkeletonCard.tsx
// Skeleton loading placeholder cho KPI card, chart và table

export function SkeletonKpiCard() {
  return (
    <article className="kpi-card skeleton-card" aria-hidden="true" aria-label="Đang tải...">
      <div className="kpi-top">
        <div className="skel skel-text" style={{ width: '60%', height: '12px' }} />
        <div className="skel skel-badge" style={{ width: '44px', height: '18px' }} />
      </div>
      <div className="kpi-body" style={{ marginTop: '8px' }}>
        <div>
          <div className="skel skel-text" style={{ width: '80%', height: '22px', marginBottom: '6px' }} />
          <div className="skel skel-text" style={{ width: '50%', height: '10px' }} />
        </div>
        <div className="skel skel-sparkline" style={{ width: '80px', height: '32px' }} />
      </div>
    </article>
  );
}

export function SkeletonChart() {
  return (
    <section className="dash-card skeleton-card" aria-hidden="true">
      <div className="card-header">
        <div>
          <div className="skel skel-text" style={{ width: '200px', height: '16px', marginBottom: '8px' }} />
          <div className="skel skel-text" style={{ width: '140px', height: '11px' }} />
        </div>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3].map((i) => (
            <div key={i} className="skel" style={{ width: '44px', height: '28px', borderRadius: '8px' }} />
          ))}
        </div>
      </div>
      <div className="skel" style={{ width: '100%', height: '280px', borderRadius: '12px' }} />
    </section>
  );
}

export function SkeletonTable() {
  return (
    <section className="dash-card skeleton-card" aria-hidden="true">
      <div className="card-header">
        <div>
          <div className="skel skel-text" style={{ width: '180px', height: '16px', marginBottom: '8px' }} />
          <div className="skel skel-text" style={{ width: '240px', height: '11px' }} />
        </div>
      </div>
      <div className="table-scroll-wrap">
        <table className="quote-table">
          <thead>
            <tr>
              {['Mã / Tên', 'Giá mua', 'Giá bán', 'Thay đổi', 'Trạng thái'].map((col) => (
                <th key={col} scope="col">{col}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }).map((_, i) => (
              <tr key={i} className="quote-row">
                <td>
                  <div className="cell-symbol-wrap">
                    <div className="skel" style={{ width: '8px', height: '8px', borderRadius: '50%' }} />
                    <div>
                      <div className="skel skel-text" style={{ width: '60px', height: '13px', marginBottom: '4px' }} />
                      <div className="skel skel-text" style={{ width: '90px', height: '10px' }} />
                    </div>
                  </div>
                </td>
                {[1, 2, 3].map((j) => (
                  <td key={j} className="text-right">
                    <div className="skel skel-text" style={{ width: '80px', height: '13px', marginLeft: 'auto' }} />
                  </td>
                ))}
                <td className="text-center">
                  <div className="skel skel-badge" style={{ width: '56px', height: '20px', margin: '0 auto' }} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

export function SkeletonNews() {
  return (
    <section className="dash-card skeleton-card" style={{ padding: '24px' }} aria-hidden="true">
      <div className="card-header" style={{ marginBottom: '16px' }}>
        <div>
          <div className="skel skel-text" style={{ width: '160px', height: '18px', marginBottom: '8px' }} />
          <div className="skel skel-text" style={{ width: '220px', height: '12px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="news-card" style={{ opacity: 0.7 }}>
            <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
              <div className="skel skel-badge" style={{ width: '70px', height: '18px' }} />
              <div className="skel skel-text" style={{ width: '60px', height: '14px' }} />
            </div>
            <div className="skel skel-text" style={{ width: '90%', height: '16px', marginBottom: '6px' }} />
            <div className="skel skel-text" style={{ width: '75%', height: '12px', marginBottom: '12px' }} />
            <div className="skel skel-text" style={{ width: '40%', height: '10px' }} />
          </div>
        ))}
      </div>
    </section>
  );
}
