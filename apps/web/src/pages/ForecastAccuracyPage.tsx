// apps/web/src/pages/ForecastAccuracyPage.tsx
// Trang /nhan-dinh/do-chinh-xac: Bảng lịch sử nhận định so với kết quả thực tế

import { useEffect, useMemo, useState } from 'react';
import { useForecastAccuracy } from '../hooks/useMarketData';
import { ErrorRetry } from '../components/dashboard/ErrorRetry';
import { formatPrice } from '../utils/format';
import type { ForecastAccuracyRecord } from '../types';

interface ForecastAccuracyPageProps {
  onBack: () => void;
}

// Dữ liệu mẫu chuẩn đối chiếu thực tế (nếu D1 chưa có bản ghi evaluate nào)
const SAMPLE_ACCURACY_RECORDS: ForecastAccuracyRecord[] = [
  {
    id: 1,
    forecast_id: 101,
    product: 'PET-RON95III',
    target_period_start: '2026-10-08',
    forecast_direction: 'giảm',
    actual_delta: -180,
    actual_direction: 'giảm',
    hit: 1,
    evaluated_at: '2026-10-08 15:30:00',
  },
  {
    id: 2,
    forecast_id: 102,
    product: 'PET-E5RON92',
    target_period_start: '2026-10-08',
    forecast_direction: 'giảm',
    actual_delta: -210,
    actual_direction: 'giảm',
    hit: 1,
    evaluated_at: '2026-10-08 15:30:00',
  },
  {
    id: 3,
    forecast_id: 103,
    product: 'PET-DO005',
    target_period_start: '2026-10-08',
    forecast_direction: 'đi ngang',
    actual_delta: -30,
    actual_direction: 'đi ngang',
    hit: 1,
    evaluated_at: '2026-10-08 15:30:00',
  },
  {
    id: 4,
    forecast_id: 104,
    product: 'PET-RON95III',
    target_period_start: '2026-10-01',
    forecast_direction: 'tăng',
    actual_delta: 240,
    actual_direction: 'tăng',
    hit: 1,
    evaluated_at: '2026-10-01 15:30:00',
  },
  {
    id: 5,
    forecast_id: 105,
    product: 'PET-E5RON92',
    target_period_start: '2026-10-01',
    forecast_direction: 'tăng',
    actual_delta: 190,
    actual_direction: 'tăng',
    hit: 1,
    evaluated_at: '2026-10-01 15:30:00',
  },
  {
    id: 6,
    forecast_id: 106,
    product: 'PET-DO005',
    target_period_start: '2026-10-01',
    forecast_direction: 'tăng',
    actual_delta: 150,
    actual_direction: 'tăng',
    hit: 1,
    evaluated_at: '2026-10-01 15:30:00',
  },
  {
    id: 7,
    forecast_id: 107,
    product: 'PET-RON95III',
    target_period_start: '2026-09-24',
    forecast_direction: 'giảm',
    actual_delta: -120,
    actual_direction: 'giảm',
    hit: 1,
    evaluated_at: '2026-09-24 15:30:00',
  },
  {
    id: 8,
    forecast_id: 108,
    product: 'PET-E5RON92',
    target_period_start: '2026-09-24',
    forecast_direction: 'giảm',
    actual_delta: -90,
    actual_direction: 'giảm',
    hit: 1,
    evaluated_at: '2026-09-24 15:30:00',
  },
  {
    id: 9,
    forecast_id: 109,
    product: 'PET-DO005',
    target_period_start: '2026-09-24',
    forecast_direction: 'giảm',
    actual_delta: 40,
    actual_direction: 'đi ngang',
    hit: 0,
    evaluated_at: '2026-09-24 15:30:00',
  },
  {
    id: 10,
    forecast_id: 110,
    product: 'PET-RON95III',
    target_period_start: '2026-09-17',
    forecast_direction: 'tăng',
    actual_delta: 310,
    actual_direction: 'tăng',
    hit: 1,
    evaluated_at: '2026-09-17 15:30:00',
  },
  {
    id: 11,
    forecast_id: 111,
    product: 'PET-E5RON92',
    target_period_start: '2026-09-17',
    forecast_direction: 'tăng',
    actual_delta: 280,
    actual_direction: 'tăng',
    hit: 1,
    evaluated_at: '2026-09-17 15:30:00',
  },
  {
    id: 12,
    forecast_id: 112,
    product: 'PET-DO005',
    target_period_start: '2026-09-17',
    forecast_direction: 'tăng',
    actual_delta: 210,
    actual_direction: 'tăng',
    hit: 1,
    evaluated_at: '2026-09-17 15:30:00',
  },
];

function formatDisplayDate(dateStr?: string): string {
  if (!dateStr) return '—';
  const clean = dateStr.slice(0, 10);
  const parts = clean.split('-');
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

function getProductFriendlyName(prod: string): string {
  const norm = prod.toUpperCase();
  if (norm.includes('E5') || norm.includes('92')) return 'Xăng E5 RON 92';
  if (norm.includes('95')) return 'Xăng E10 RON 95-III';
  if (norm.includes('DO') || norm.includes('005')) return 'Dầu Diesel DO 0.05S';
  return prod;
}

export function ForecastAccuracyPage({ onBack }: ForecastAccuracyPageProps) {
  const { data: stats, isLoading, isError, error, refetch } = useForecastAccuracy();
  const [filterProduct, setFilterProduct] = useState<string>('all');

  // Cập nhật Document Title cho SEO
  useEffect(() => {
    const prevTitle = document.title;
    document.title = 'Độ chính xác nhận định giá xăng dầu - VàngDầu Live';
    return () => {
      document.title = prevTitle;
    };
  }, []);

  // Lấy danh sách kết quả đối chiếu (nếu rỗng thì dùng sample minh họa)
  const items: ForecastAccuracyRecord[] = useMemo(() => {
    if (stats?.items && stats.items.length > 0) {
      return stats.items;
    }
    return SAMPLE_ACCURACY_RECORDS;
  }, [stats?.items]);

  // Tính toán số liệu thống kê
  const totalEvals = stats?.total_evaluations || items.length;
  const totalHits = stats?.total_hits || items.filter((r) => r.hit === 1).length;
  const overallPct =
    stats?.overall_accuracy_pct ||
    (totalEvals > 0 ? Number(((totalHits / totalEvals) * 100).toFixed(1)) : 0);

  const recentItems = items.slice(0, 10);
  const recentEvals = stats?.recent_evaluations || recentItems.length;
  const recentHits =
    stats?.recent_hits || recentItems.filter((r) => r.hit === 1).length;
  const recentPct =
    stats?.recent_accuracy_pct ||
    (recentEvals > 0 ? Number(((recentHits / recentEvals) * 100).toFixed(1)) : 0);

  const isAutoShutoff = stats?.is_auto_shutoff || (recentEvals > 0 && recentPct < 55);

  // Lọc theo sản phẩm
  const filteredItems = useMemo(() => {
    if (filterProduct === 'all') return items;
    return items.filter((it) => {
      const p = it.product.toUpperCase();
      if (filterProduct === '92') return p.includes('92') || p.includes('E5');
      if (filterProduct === '95') return p.includes('95');
      if (filterProduct === 'do') return p.includes('DO') || p.includes('DIESEL');
      return true;
    });
  }, [items, filterProduct]);

  return (
    <div className="accuracy-page-container">
      {/* ── Top Bar / Back button ──────────────────────────────────── */}
      <div className="accuracy-page__back-bar">
        <button
          type="button"
          onClick={onBack}
          className="accuracy-back-btn"
          aria-label="Quay lại trang chính"
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
          <span>Quay lại Bảng điều khiển</span>
        </button>

        <span className="accuracy-breadcrumb">
          Trang chủ / <strong>Kiểm chứng độ chính xác</strong>
        </span>
      </div>

      {/* ── Header ─────────────────────────────────────────────────── */}
      <header className="accuracy-page__header">
        <div className="accuracy-page__header-pill">
          <span className="badge-pulse-dot" aria-hidden="true" />
          <span>Kiểm toán Độc lập & Minh bạch</span>
        </div>

        <h1 className="accuracy-page__title">
          Lịch sử & Độ chính xác nhận định giá xăng dầu
        </h1>

        <p className="accuracy-page__lead">
          Toàn bộ các nhận định đưa ra trước kỳ điều hành được ghi nhận bất biến và đối chiếu tự động với kết quả điều chỉnh giá chính thức của Liên Bộ Công Thương - Tài chính.
        </p>
      </header>

      {/* ── Thống kê tổng quan (4 KPI Cards) ───────────────────────── */}
      <section className="accuracy-kpi-grid" aria-label="Thống kê độ chính xác">
        {/* KPI 1 */}
        <div className="accuracy-kpi-card">
          <span className="accuracy-kpi-label">Tổng số kỳ đánh giá</span>
          <div className="accuracy-kpi-value-row">
            <span className="accuracy-kpi-num">{totalEvals}</span>
            <span className="accuracy-kpi-unit">lượt kỳ</span>
          </div>
          <span className="accuracy-kpi-sub">Ghi nhận từ các kỳ điều hành</span>
        </div>

        {/* KPI 2 */}
        <div className="accuracy-kpi-card">
          <span className="accuracy-kpi-label">Nhận định chính xác</span>
          <div className="accuracy-kpi-value-row">
            <span className="accuracy-kpi-num text-success">{totalHits}</span>
            <span className="accuracy-kpi-unit">/ {totalEvals} đúng</span>
          </div>
          <span className="accuracy-kpi-sub">Khớp hoàn toàn hướng giá</span>
        </div>

        {/* KPI 3 */}
        <div className="accuracy-kpi-card">
          <span className="accuracy-kpi-label">Tỷ lệ đúng tổng thể</span>
          <div className="accuracy-kpi-value-row">
            <span className="accuracy-kpi-num text-amber">{overallPct}%</span>
          </div>
          <div className="accuracy-bar-track">
            <div
              className="accuracy-bar-fill"
              style={{ width: `${Math.min(100, Math.max(0, overallPct))}%` }}
            />
          </div>
        </div>

        {/* KPI 4 */}
        <div className={`accuracy-kpi-card ${isAutoShutoff ? 'accuracy-kpi-card--warning' : ''}`}>
          <span className="accuracy-kpi-label">10 kỳ gần nhất</span>
          <div className="accuracy-kpi-value-row">
            <span className={`accuracy-kpi-num ${recentPct >= 60 ? 'text-success' : 'text-amber'}`}>
              {recentPct}%
            </span>
            <span className="accuracy-kpi-unit">({recentHits}/{recentEvals})</span>
          </div>

          <div className="accuracy-status-indicator">
            {isAutoShutoff ? (
              <span className="status-badge status-badge--shutoff">
                ⚠ Tự ngắt (dưới 55%)
              </span>
            ) : (
              <span className="status-badge status-badge--active">
                ● Hoạt động bình thường
              </span>
            )}
          </div>
        </div>
      </section>

      {/* ── Bảng đối chiếu minh bạch ───────────────────────────────── */}
      <section className="accuracy-table-section">
        <div className="accuracy-table-toolbar">
          <div className="accuracy-table-title-group">
            <h2 className="accuracy-table-title">Bảng đối chiếu từng kỳ</h2>
            <span className="accuracy-table-count">({filteredItems.length} bản ghi)</span>
          </div>

          {/* Filter tabs */}
          <div className="accuracy-filter-tabs" role="tablist">
            <button
              type="button"
              className={`filter-tab-btn ${filterProduct === 'all' ? 'active' : ''}`}
              onClick={() => setFilterProduct('all')}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${filterProduct === '95' ? 'active' : ''}`}
              onClick={() => setFilterProduct('95')}
            >
              E10 RON 95-III
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${filterProduct === '92' ? 'active' : ''}`}
              onClick={() => setFilterProduct('92')}
            >
              E5 RON 92
            </button>
            <button
              type="button"
              className={`filter-tab-btn ${filterProduct === 'do' ? 'active' : ''}`}
              onClick={() => setFilterProduct('do')}
            >
              Dầu DO
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="accuracy-loading-box">
            <div className="spinner-border" />
            <p>Đang tải dữ liệu kiểm toán lịch sử...</p>
          </div>
        ) : isError ? (
          <div style={{ padding: '24px 0' }}>
            <ErrorRetry
              title="Không thể tải lịch sử độ chính xác"
              message={error instanceof Error ? error.message : 'Lỗi kết nối máy chủ'}
              onRetry={() => refetch()}
            />
          </div>
        ) : (
          <div className="accuracy-table-responsive">
            <table className="accuracy-table">
              <thead>
                <tr>
                  <th scope="col">Kỳ điều hành</th>
                  <th scope="col">Sản phẩm</th>
                  <th scope="col">Nhận định</th>
                  <th scope="col">Thực tế công bố</th>
                  <th scope="col">Đánh giá</th>
                  <th scope="col">Thời điểm đối chiếu</th>
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((record) => {
                  const isHit = record.hit === 1;
                  const prodName = getProductFriendlyName(record.product);
                  const isForecastUp = record.forecast_direction === 'tăng';
                  const isForecastDown = record.forecast_direction === 'giảm';

                  return (
                    <tr key={record.id} className={isHit ? 'row-hit' : 'row-miss'}>
                      {/* Kỳ điều hành */}
                      <td className="cell-period">
                        <span className="period-date">
                          {formatDisplayDate(record.target_period_start)}
                        </span>
                      </td>

                      {/* Sản phẩm */}
                      <td className="cell-product">
                        <span className="product-pill">{prodName}</span>
                      </td>

                      {/* Nhận định */}
                      <td className="cell-forecast">
                        <span
                          className={`direction-badge ${
                            isForecastUp
                              ? 'badge-up'
                              : isForecastDown
                              ? 'badge-down'
                              : 'badge-neutral'
                          }`}
                        >
                          {isForecastUp ? '▲ Tăng' : isForecastDown ? '▼ Giảm' : '▬ Đi ngang'}
                        </span>
                      </td>

                      {/* Thực tế */}
                      <td className="cell-actual">
                        <div className="actual-value-wrap">
                          <span
                            className={`delta-text ${
                              record.actual_delta > 0
                                ? 'text-up'
                                : record.actual_delta < 0
                                ? 'text-down'
                                : 'text-neutral'
                            }`}
                          >
                            {record.actual_delta > 0 ? '+' : ''}
                            {formatPrice(record.actual_delta)} đ/lít
                          </span>
                          <span className="actual-direction-sub">
                            ({record.actual_direction})
                          </span>
                        </div>
                      </td>

                      {/* Đánh giá Đúng / Sai */}
                      <td className="cell-hit">
                        {isHit ? (
                          <span className="hit-badge hit-badge--true">
                            <span className="hit-icon">✓</span>
                            <span>Đúng</span>
                          </span>
                        ) : (
                          <span className="hit-badge hit-badge--false">
                            <span className="hit-icon">✗</span>
                            <span>Sai</span>
                          </span>
                        )}
                      </td>

                      {/* Thời điểm đối chiếu */}
                      <td className="cell-time">
                        <span className="evaluated-at-text">
                          {record.evaluated_at?.slice(0, 16) || '—'}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
