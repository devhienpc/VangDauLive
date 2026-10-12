// src/components/PriceTable.tsx – Bảng hiển thị giá

import { motion, AnimatePresence } from 'framer-motion';
import type { PriceItem, Category } from '../types';
import { formatPrice } from '../utils/format';
import { getCategoryMeta } from '../utils/categories';

interface PriceTableProps {
  items: PriceItem[];
  category: Category;
  onRowClick?: (item: PriceItem) => void;
}

function getDecimalsByUnit(unit: string): number {
  if (unit.includes('JPY') || unit.includes('KRW')) return 1;
  if (unit.includes('USD') && !unit.includes('thùng')) return 2;
  if (unit.includes('USD')) return 2;
  return 0;
}

const ROW_VARIANTS = {
  hidden: { opacity: 0, y: 8 },
  visible: (i: number) => ({
    opacity: 1, y: 0,
    transition: { delay: i * 0.04, duration: 0.3 },
  }),
};

export function PriceTable({ items, category, onRowClick }: PriceTableProps) {
  const meta = getCategoryMeta(category);
  const hasBuySell = items.some((i) => i.buy_price != null);

  if (items.length === 0) {
    return (
      <div className="py-16 text-center text-[var(--text-muted)]">
        <div className="text-4xl mb-3">{meta.icon}</div>
        <p className="font-medium">Chưa có dữ liệu</p>
        <p className="text-sm mt-1">Dữ liệu sẽ được tải về khi cron chạy lần đầu</p>
      </div>
    );
  }

  return (
    <div className="table-wrap rounded-2xl overflow-hidden" style={{ border: '1px solid var(--border-subtle)' }}>
      {/* Table header */}
      <div
        className="grid text-xs font-semibold uppercase tracking-wider px-4 py-3"
        style={{
          background: 'var(--bg-surface)',
          color: 'var(--text-muted)',
          borderBottom: '1px solid var(--border-subtle)',
          gridTemplateColumns: hasBuySell ? '1fr auto auto auto' : '1fr auto auto',
        }}
      >
        <span>Loại hàng hóa</span>
        {hasBuySell && <span className="text-right">Giá mua</span>}
        <span className="text-right">Giá bán</span>
        <span className="text-right">Đơn vị</span>
      </div>

      {/* Rows */}
      <AnimatePresence mode="wait">
        <div style={{ background: 'var(--bg-glass)' }}>
          {items.map((item, i) => {
            const decimals = getDecimalsByUnit(item.unit);
            return (
              <motion.div
                key={item.symbol}
                custom={i}
                variants={ROW_VARIANTS}
                initial="hidden"
                animate="visible"
                className="price-row cursor-pointer"
                style={{
                  gridTemplateColumns: hasBuySell ? '1fr auto auto auto' : '1fr auto auto',
                  display: 'grid',
                }}
                onClick={() => onRowClick?.(item)}
                role="button"
                tabIndex={0}
                aria-label={`Xem lịch sử giá ${item.name}`}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') onRowClick?.(item);
                }}
              >
                {/* Name */}
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
                    {item.name}
                  </p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {item.symbol}
                  </p>
                </div>

                {/* Mua */}
                {hasBuySell && (
                  <div className="text-right">
                    <span
                      className="mono text-sm font-medium"
                      style={{ color: item.buy_price ? 'var(--up)' : 'var(--text-muted)' }}
                    >
                      {formatPrice(item.buy_price, decimals)}
                    </span>
                  </div>
                )}

                {/* Bán */}
                <div className="text-right">
                  <span
                    className="mono text-sm font-semibold"
                    style={{ color: meta.color }}
                  >
                    {formatPrice(item.sell_price, decimals)}
                  </span>
                </div>

                {/* Unit */}
                <div className="text-right">
                  <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {item.unit}
                  </span>
                </div>
              </motion.div>
            );
          })}
        </div>
      </AnimatePresence>
    </div>
  );
}
