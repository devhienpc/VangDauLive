// src/components/dashboard/QuoteTable.tsx
// Bảng niêm yết: dữ liệu thật từ API, tìm kiếm client, lọc danh mục, xuất Excel CSV BOM UTF-8, flash giá, phân biệt giá 2 chiều (vàng/ngoại tệ) và giá Vùng 1 / Vùng 2 (xăng dầu)

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
  selectedCategory?: string;
  onSelectCategory?: (cat: string) => void;
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
  if (u.includes('USD') || u.includes('%') || u.includes('/oz') || u.includes('/thùng')) {
    return v.toLocaleString('vi-VN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
  return v.toLocaleString('vi-VN', { maximumFractionDigits: 0 });
}

function getCleanSource(source?: string | null): string {
  if (!source) return 'Hệ thống';
  if (source.includes('Petrolimex')) return 'Petrolimex';
  if (source.includes('Vietcombank')) return 'Vietcombank';
  if (source.includes('WebGia') || source.includes('SJC')) return 'SJC';
  if (source.includes('Metals')) return 'Metals.dev';
  if (source.includes('Yahoo')) return 'Yahoo';
  if (source.includes('EIA')) return 'EIA';
  return source.length > 15 ? source.slice(0, 15) + '…' : source;
}

function exportCsv(records: PriceRecord[]) {
  if (!records || records.length === 0) return;
  const header = ['Mã', 'Tên', 'Danh mục', 'Giá 1 (Mua/Vùng 1)', 'Giá 2 (Bán/Vùng 2)', 'Đơn vị', '% Thay đổi', 'Nguồn', 'Thời điểm lấy'];
  const lines = records.map((r) => {
    const isFuel = r.category === 'fuel';
    const isOil = r.category === 'oil';
    const p1 = isFuel ? (r.price_zone1 ?? r.ask) : (r.bid ?? r.ask);
    const p2 = isFuel ? (r.price_zone2 ?? r.bid) : isOil ? '' : r.ask;
    return [
      r.symbol ?? '',
      r.name ?? '',
      CATEGORY_LABELS[r.category] ?? r.category ?? '',
      p1 != null ? p1 : '',
      p2 != null ? p2 : '',
      r.unit ?? '',
      (r.change_pct ?? 0).toFixed(2),
      r.source ?? '',
      r.fetched_at ?? '',
    ].map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',');
  });

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

// ── PriceCell với hiệu ứng nhấp nháy khi giá đổi và nhãn phân loại (Mua, Bán, Vùng 1, Vùng 2) ─────
function PriceCell({
  value,
  unit,
  className,
  reduced,
  subLabel,
  subLabelType,
}: {
  value: number | null;
  unit?: string | null;
  className: string;
  reduced: boolean;
  subLabel?: string;
  subLabelType?: 'buy' | 'sell' | 'zone1' | 'zone2' | 'spot' | 'neutral';
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

  if (value == null || isNaN(value)) {
    return (
      <td className={`text-right mono-cell ${className}`}>
        <span className="cell-dash" title="Không áp dụng giá 2 chiều">—</span>
      </td>
    );
  }

  return (
    <td className={`text-right mono-cell ${className} ${flash}`}>
      <div className="price-cell-content">
        <span className="price-num">{formatPriceNumber(value, unit)}</span>
        {subLabel && (
          <span className={`price-type-pill pill-${subLabelType || 'neutral'}`}>
            {subLabel}
          </span>
        )}
      </div>
    </td>
  );
}

function formatEffectiveAt(val?: string | null): string | null {
  if (!val) return null;
  const cleaned = val.replace('T', ' ');
  const m = cleaned.match(/(\d{4})-(\d{2})-(\d{2})(?:\s+(\d{2}):(\d{2}))?/);
  if (m) {
    const [, _y, mm, dd, hh, min] = m;
    if (hh !== undefined && min !== undefined) {
      return `${dd}/${mm} ${hh}:${min}`;
    }
    return `${dd}/${mm}`;
  }
  return val;
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

  const isStale = record.stale === 1 || record.stale === true;
  const isOlder10Days = useMemo(() => {
    if (!record.effective_at || record.category !== 'fuel') return false;
    const t = new Date(record.effective_at.replace(' ', 'T')).getTime();
    return !isNaN(t) && Date.now() - t > 10 * 86400 * 1000;
  }, [record.effective_at, record.category]);

  const effectiveFormatted = formatEffectiveAt(record.effective_at);

  const isFuel = record.category === 'fuel';
  const isGoldOrFx =
    record.category === 'gold' || record.category === 'silver' || record.category === 'forex';
  const isOil = record.category === 'oil';

  // Với xăng dầu:
  // Cột 1 là Giá Vùng 1 (giá chuẩn Petrolimex)
  // Cột 2 là Giá Vùng 2 (vùng sâu, xa)
  // Với vàng & ngoại tệ:
  // Cột 1 là Mua vào, Cột 2 là Bán ra
  // Với dầu thô/hàng hóa 1 giá:
  // Cột 1 là Giá thị trường, Cột 2 là null ('—')
  const val1 = isFuel ? (record.price_zone1 ?? record.ask) : (record.bid ?? record.ask);
  const val2 = isFuel ? (record.price_zone2 ?? record.bid) : isOil ? null : record.ask;

  const label1 = isFuel ? 'Vùng 1' : isGoldOrFx ? 'Mua vào' : 'Giá chuẩn';
  const label2 = isFuel ? 'Vùng 2' : isGoldOrFx && val2 != null ? 'Bán ra' : undefined;

  const type1: 'zone1' | 'buy' | 'spot' = isFuel ? 'zone1' : isGoldOrFx ? 'buy' : 'spot';
  const type2: 'zone2' | 'sell' = isFuel ? 'zone2' : 'sell';

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
              <span className="cell-source-tag" title={record.source}>{getCleanSource(record.source)}</span>
              {isOlder10Days ? (
                <span className="stale-badge stale-badge--warning" title="Đã quá 10 ngày chưa có bản ghi giá mới">
                  Nhắc cập nhật (&gt;10 ngày)
                </span>
              ) : isStale ? (
                <span className="stale-badge" title="Dữ liệu từ nguồn có thể chưa cập nhật kỳ mới">
                  Chưa cập nhật
                </span>
              ) : null}
            </div>
            <span className="cell-name">{record.name}</span>
            {effectiveFormatted && (
              <span className="cell-effective-at">
                Giá có hiệu lực từ {effectiveFormatted}
              </span>
            )}
          </div>
        </div>
      </td>

      {/* Cột 1: Mua vào / Vùng 1 / Giá chuẩn */}
      <PriceCell
        value={val1}
        unit={record.unit}
        className="cell-bid"
        reduced={reduced}
        subLabel={label1}
        subLabelType={type1}
      />

      {/* Cột 2: Bán ra / Vùng 2 / Biên độ */}
      <PriceCell
        value={val2}
        unit={record.unit}
        className="cell-ask"
        reduced={reduced}
        subLabel={label2}
        subLabelType={type2}
      />

      {/* Đơn vị */}
      <td className="text-center cell-unit">
        {record.unit ?? ''}
      </td>

      {/* Thay đổi */}
      <td className={`text-right mono-cell ${changeClass}`}>
        <div>{changeSign}{(record.change_pct ?? 0).toFixed(2)}%</div>
        {isFuel && record.diff_amount != null && record.diff_amount !== 0 && (
          <div className="sub-diff-amount">
            {record.diff_amount > 0 ? `+${record.diff_amount.toLocaleString('vi-VN')} đ` : `${record.diff_amount.toLocaleString('vi-VN')} đ`}
          </div>
        )}
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
  selectedCategory,
  onSelectCategory,
}: QuoteTableProps) {
  const [localQuery, setLocalQuery] = useState('');
  const [localCat, setLocalCat] = useState<string>('all');
  const reduced = useReducedMotion();

  const currentCat = selectedCategory !== undefined ? selectedCategory : localCat;

  const handleCatChange = (cat: string) => {
    setLocalCat(cat);
    onSelectCategory?.(cat);
  };

  const safeRecords = Array.isArray(records) ? records : [];
  const effectiveQuery = searchTerm || localQuery;

  const handleQueryChange = (val: string) => {
    setLocalQuery(val);
    onSearchChange?.(val);
  };

  // Xác định tiêu đề cột theo danh mục
  const { col1Title, col2Title, col1Desc, col2Desc } = useMemo(() => {
    switch (currentCat) {
      case 'fuel':
        return {
          col1Title: 'Giá Vùng 1',
          col2Title: 'Giá Vùng 2',
          col1Desc: 'Giá niêm yết tại các tỉnh, TP gần cảng biển/kho đầu mối (Hà Nội, TP.HCM, Hải Phòng...)',
          col2Desc: 'Giá niêm yết tại các địa bàn xa cảng kho, hải đảo (tối đa cao hơn 2% so với Vùng 1)',
        };
      case 'gold':
      case 'forex':
        return {
          col1Title: 'Giá mua vào',
          col2Title: 'Giá bán ra',
          col1Desc: 'Giá tiệm vàng hoặc ngân hàng mua vào từ khách',
          col2Desc: 'Giá tiệm vàng hoặc ngân hàng bán ra cho khách',
        };
      case 'oil':
        return {
          col1Title: 'Giá thị trường',
          col2Title: 'Biên độ 2 chiều',
          col1Desc: 'Giá giao ngay / hợp đồng tương lai quốc tế',
          col2Desc: 'Hàng hóa giao dịch theo giá chuẩn, không có giá bán lẻ 2 chiều',
        };
      default: // 'all'
        return {
          col1Title: 'Giá mua / Vùng 1',
          col2Title: 'Giá bán / Vùng 2',
          col1Desc: 'Giá mua vào (vàng, ngoại tệ) hoặc Giá Vùng 1 (xăng dầu)',
          col2Desc: 'Giá bán ra (vàng, ngoại tệ) hoặc Giá Vùng 2 (xăng dầu)',
        };
    }
  }, [currentCat]);

  const filtered = useMemo(() => {
    let result = safeRecords;

    if (currentCat !== 'all') {
      if (currentCat === 'gold') {
        result = result.filter((r) => r && (r.category === 'gold' || r.category === 'silver'));
      } else {
        result = result.filter((r) => r && r.category === currentCat);
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
  }, [safeRecords, currentCat, effectiveQuery]);

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
          <p className="card-subtitle">
            Giá mua – bán (vàng, ngoại tệ) và Giá Vùng 1 – Vùng 2 (xăng dầu Petrolimex) theo thời gian thực
          </p>
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
            aria-selected={currentCat === key}
            className={`cat-filter-btn ${currentCat === key ? 'cat-filter-btn--active' : ''}`}
            onClick={() => handleCatChange(key)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Banner giải thích quy chuẩn giá theo danh mục */}
      {currentCat === 'fuel' ? (
        <div className="category-hint-banner category-hint-banner--fuel">
          <span className="hint-icon" aria-hidden="true">ℹ️</span>
          <span>
            <strong>Giá xăng dầu Petrolimex:</strong> <strong>Vùng 1</strong> áp dụng tại các đô thị gần kho cảng (Hà Nội, TP.HCM, Hải Phòng...). <strong>Vùng 2</strong> áp dụng tại các địa bàn xa cảng kho, miền núi, hải đảo (cao hơn tối đa 2%). Mặt hàng bán lẻ không có cơ chế mua vào/bán ra.
          </span>
        </div>
      ) : null}

      {/* Table */}
      <div className="table-scroll-wrap" role="region" aria-label="Bảng dữ liệu niêm yết" tabIndex={0}>
        <table className="quote-table" aria-live="polite" aria-label={`${filtered.length} hàng hóa`}>
          <thead>
            <tr>
              <th scope="col">Mã / Mặt hàng</th>
              <th scope="col" className="text-right" title={col1Desc}>
                {col1Title}
              </th>
              <th scope="col" className="text-right" title={col2Desc}>
                {col2Title}
              </th>
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
                        handleCatChange('all');
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
