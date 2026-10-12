// src/components/dashboard/QuoteTable.tsx
// Bảng niêm yết: dữ liệu thật từ API, tìm kiếm client, lọc danh mục, xuất Excel CSV BOM UTF-8, flash giá

import { useState, useMemo, useEffect } from 'react';
import { motion } from 'framer-motion';
import type { PriceRecord } from '../../types';
import { usePrevious } from '../../hooks/usePrevious';
import { useReducedMotion } from '../../hooks/useReducedMotion';
import { SkeletonTable } from './SkeletonCard';
import { ErrorRetry } from './ErrorRetry';

interface QuoteTableProps {
  records?: PriceRecord[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}

const CATEGORY_COLORS: Record<string, string> = {
  gold:   '#F5A623',
  silver: '#94a3b8',
  fuel:   '#60a5fa',
  oil:    '#2dd4bf',
  forex:  '#a78bfa',
};

const CATEGORY_LABELS: Record<string, string> = {
  all:    'Tất cả',
  gold:   'Vàng & Bạc',
  fuel:   'Xăng dầu',
  oil:    'Dầu thô',
  forex:  'Ngoại tệ',
};

function formatPriceNumber(v: number | null, unit?: string | null): string {
  if (v == null || isNaN(v)) return '—';
  const u = unit ? String(unit) : '';
  if (u.includes('USD/oz') || u.includes('USD/thùng')) {
    return v.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

function exportCsv(records: PriceRecord[]) {
  if (!records || records.length === 0) return;
  const header = ['Mã', 'Tên', 'Danh mục', 'Giá mua (Bid)', 'Giá bán (Ask)', 'Đơn vị', '% Thay đổi', 'Nguồn', 'Thời điểm lấy'];
  const lines = records.map((r) => [
    r.symbol ?? '',
    r.name ?? '',
    CATEGORY_LABELS[r.category] ?? r.category ?? '',
    r.bid != null ? r.bid : '',
    r.ask != null ? r.ask : '',
    r.unit ?? '',
    (r.change_pct ?? 0).toFixed(2),
    r.source ?? '',
    r.fetched_at ?? '',
  ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','));

  const csvContent = [header.join(','), ...lines].join('\r\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `vangdau-live-niem-yet-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

function StatusBadge({ changePct }: { changePct: number }) {
  if (changePct > 0) {
    return <span className="status-badge status-up">▲ Tăng</span>;
  }
  if (changePct < 0) {
    return <span className="status-badge status-down">▼ Giảm</span>;
  }
  return <span className="status-badge status-neutral">Ổn định</span>;
}

// ── PriceCell với hiệu ứng nhấp nháy khi giá đổi ────────────────────────────
function PriceCell({
  value,
  unit,
  className,
  reduced,
}: {
  value: number | null;
  unit?: string | null;
  className: string;
  reduced: boolean;
}) {
  const prev = usePrevious(value);
  const [flash, setFlash] = useState('');

  useEffect(() => {
    if (reduced || prev === undefined || prev === value || value === null) return;
    const cls = value > (prev ?? 0) ? 'flash-up' : 'flash-down';
    setFlash(cls);
    const t = setTimeout(() => setFlash(''), 700);
    return () => clearTimeout(t);
  }, [value, prev, reduced]);

  return (
    <td className={`text-right mono-cell ${className} ${flash}`}>
      {formatPriceNumber(value, unit)}
    </td>
  );
}

// ── Hàng dữ liệu ─────────────────────────────────────────────────────────────
function AnimatedRow({
  record,
  index,
  reduced,
}: {
  record: PriceRecord;
  index: number;
  reduced: boolean;
}) {
  const catColor = CATEGORY_COLORS[record.category] ?? '#94a3b8';
  const changeSign = (record.change_pct ?? 0) > 0 ? '+' : '';
  const changeClass =
    (record.change_pct ?? 0) > 0
      ? 'cell-up'
      : (record.change_pct ?? 0) < 0
      ? 'cell-down'
      : 'cell-neutral';

  return (
    <motion.tr
      className="quote-row"
      initial={reduced ? false : { opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.25, delay: reduced ? 0 : Math.min(index * 0.03, 0.4), ease: 'easeOut' }}
    >
      {/* Symbol + name + nguồn */}
      <td>
        <div className="cell-symbol-wrap">
          <span className="cat-dot" style={{ background: catColor }} aria-hidden="true" />
          <div>
            <div className="cell-symbol-line">
              <span className="cell-symbol">{record.symbol}</span>
              <span className="cell-source-tag">{record.source}</span>
            </div>
            <span className="cell-name">{record.name}</span>
          </div>
        </div>
      </td>

      {/* Giá mua – flash */}
      <PriceCell value={record.bid} unit={record.unit} className="cell-bid" reduced={reduced} />

      {/* Giá bán – flash */}
      <PriceCell value={record.ask} unit={record.unit} className="cell-ask" reduced={reduced} />

      {/* Đơn vị */}
      <td className="text-center cell-unit">
        {record.unit ?? ''}
      </td>

      {/* Thay đổi */}
      <td className={`text-right mono-cell ${changeClass}`}>
        {changeSign}{(record.change_pct ?? 0).toFixed(2)}%
      </td>

      {/* Trạng thái */}
      <td className="text-center">
        <StatusBadge changePct={record.change_pct ?? 0} />
      </td>
    </motion.tr>
  );
}

// ── Component chính ──────────────────────────────────────────────────────────
export function QuoteTable({
  records = [],
  isLoading,
  error,
  onRetry,
  searchTerm = '',
  onSearchChange,
}: QuoteTableProps) {
  const [localQuery, setLocalQuery] = useState('');
  const [selectedCat, setSelectedCat] = useState<string>('all');
  const reduced = useReducedMotion();

  const safeRecords = Array.isArray(records) ? records : [];
  const effectiveQuery = searchTerm || localQuery;

  const handleQueryChange = (val: string) => {
    setLocalQuery(val);
    onSearchChange?.(val);
  };

  const filtered = useMemo(() => {
    let result = safeRecords;

    if (selectedCat !== 'all') {
      if (selectedCat === 'gold') {
        result = result.filter((r) => r && (r.category === 'gold' || r.category === 'silver'));
      } else {
        result = result.filter((r) => r && r.category === selectedCat);
      }
    }

    const q = effectiveQuery.trim().toLowerCase();
    if (!q) return result;

    return result.filter((r) => {
      if (!r) return false;
      const sym = String(r.symbol || '').toLowerCase();
      const nm = String(r.name || '').toLowerCase();
      const src = String(r.source || '').toLowerCase();
      const catLabel = String(CATEGORY_LABELS[r.category] || '').toLowerCase();
      return sym.includes(q) || nm.includes(q) || src.includes(q) || catLabel.includes(q);
    });
  }, [safeRecords, selectedCat, effectiveQuery]);

  if (isLoading) {
    return <SkeletonTable />;
  }

  if (error && onRetry) {
    return (
      <section className="dash-card" style={{ padding: '24px' }}>
        <ErrorRetry
          title="Không thể tải bảng niêm yết"
          message={error}
          onRetry={onRetry}
        />
      </section>
    );
  }

  return (
    <section
      className="dash-card"
      id="quote-table"
      aria-label="Bảng niêm yết giá thời gian thực"
    >
      {/* Header */}
      <div className="card-header">
        <div>
          <h2 className="card-title">Bảng niêm yết thời gian thực</h2>
          <p className="card-subtitle">Giá mua – bán, đơn vị tính và nguồn dữ liệu kiểm chứng</p>
        </div>

        <div className="table-controls">
          <div className="tbl-search-wrap">
            <svg className="search-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              id="tbl-search"
              type="search"
              className="tbl-search-input"
              placeholder="Lọc mã hoặc tên…"
              value={effectiveQuery}
              onChange={(e) => handleQueryChange(e.target.value)}
              aria-label="Lọc theo mã hoặc tên"
            />
          </div>

          <button
            id="btn-export-csv"
            type="button"
            className="btn-export"
            onClick={() => exportCsv(filtered)}
            aria-label="Xuất dữ liệu đang lọc ra file CSV Excel"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Xuất Excel
          </button>
        </div>
      </div>

      {/* Tabs lọc danh mục nhanh */}
      <div className="table-category-tabs" role="tablist" aria-label="Bộ lọc danh mục">
        {Object.entries(CATEGORY_LABELS).map(([key, label]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={selectedCat === key}
            className={`cat-filter-btn ${selectedCat === key ? 'cat-filter-btn--active' : ''}`}
            onClick={() => setSelectedCat(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="table-scroll-wrap" role="region" aria-label="Bảng dữ liệu niêm yết" tabIndex={0}>
        <table className="quote-table" aria-live="polite" aria-label={`${filtered.length} hàng hóa`}>
          <thead>
            <tr>
              <th scope="col">Mã / Tên</th>
              <th scope="col" className="text-right">Giá mua (Bid)</th>
              <th scope="col" className="text-right">Giá bán (Ask)</th>
              <th scope="col" className="text-center">Đơn vị</th>
              <th scope="col" className="text-right">Thay đổi</th>
              <th scope="col" className="text-center">Trạng thái</th>
            </tr>
          </thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr>
                <td colSpan={6} className="empty-row">
                  <div className="empty-state-wrap">
                    <p className="empty-title">Không tìm thấy mã hoặc tên phù hợp</p>
                    <p className="empty-desc">
                      Không có kết quả nào khớp với "{effectiveQuery}". Thử tìm kiếm bằng từ khóa khác hoặc xóa bộ lọc.
                    </p>
                    <button
                      type="button"
                      className="btn-clear-filter"
                      onClick={() => {
                        handleQueryChange('');
                        setSelectedCat('all');
                      }}
                    >
                      Xóa bộ lọc
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              filtered.map((record, i) => (
                <AnimatedRow
                  key={record.symbol || `row-${i}`}
                  record={record}
                  index={i}
                  reduced={reduced}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {filtered.length > 0 && (
        <div className="table-footer-bar">
          <p className="table-footer-note">
            Hiển thị <strong>{filtered.length}</strong>/{safeRecords.length} hàng hóa niêm yết · Nhấp nháy xanh/đỏ khi giá biến động
          </p>
        </div>
      )}
    </section>
  );
}
