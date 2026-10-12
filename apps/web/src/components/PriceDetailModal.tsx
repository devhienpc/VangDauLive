// src/components/PriceDetailModal.tsx – Modal chi tiết + biểu đồ lịch sử

import { motion, AnimatePresence } from 'framer-motion';
import { useEffect } from 'react';
import type { PriceItem } from '../types';
import { formatPrice, formatUpdatedAt } from '../utils/format';
import { getCategoryMeta } from '../utils/categories';
import { useHistory } from '../hooks/useHistory';
import { PriceChart } from './PriceChart';

interface PriceDetailModalProps {
  item: PriceItem | null;
  onClose: () => void;
}

export function PriceDetailModal({ item, onClose }: PriceDetailModalProps) {
  const { data: history, isLoading: histLoading } = useHistory(
    item?.symbol ?? '',
    30,
  );

  // Đóng khi bấm Escape
  useEffect(() => {
    if (!item) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [item, onClose]);

  const meta = item ? getCategoryMeta(item.category) : null;
  const decimals = item?.unit.includes('USD') ? 2 : 0;

  return (
    <AnimatePresence>
      {item && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)' }}
            onClick={onClose}
            aria-hidden="true"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, y: 40, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.97 }}
            transition={{ type: 'spring', bounce: 0.2, duration: 0.4 }}
            className="fixed inset-x-4 bottom-4 sm:inset-auto sm:left-1/2 sm:top-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:w-full sm:max-w-lg z-50"
            role="dialog"
            aria-modal="true"
            aria-label={`Chi tiết giá ${item.name}`}
          >
            <div className="glass-card overflow-hidden" style={{ border: '1px solid var(--border-dim)' }}>
              {/* Header */}
              <div
                className="px-6 py-4 flex items-start justify-between"
                style={{ borderBottom: '1px solid var(--border-subtle)' }}
              >
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span>{meta?.icon}</span>
                    <span className={`badge ${meta?.badgeClass}`}>{meta?.label}</span>
                  </div>
                  <h2 className="font-bold text-lg" style={{ color: 'var(--text-primary)' }}>
                    {item.name}
                  </h2>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
                    {item.symbol}
                  </p>
                </div>
                <button
                  id="modal-close-btn"
                  onClick={onClose}
                  className="w-8 h-8 rounded-lg flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors"
                  style={{ background: 'var(--bg-elevated)' }}
                  aria-label="Đóng"
                >
                  ✕
                </button>
              </div>

              {/* Price display */}
              <div className="px-6 py-4" style={{ borderBottom: '1px solid var(--border-subtle)' }}>
                <div className="grid grid-cols-2 gap-4">
                  {item.buy_price != null && (
                    <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                        style={{ color: 'var(--text-muted)' }}>
                        Giá mua
                      </p>
                      <p className="mono font-bold text-xl" style={{ color: 'var(--up)' }}>
                        {formatPrice(item.buy_price, decimals)}
                      </p>
                    </div>
                  )}
                  {item.sell_price != null && (
                    <div className="rounded-xl p-4" style={{ background: 'var(--bg-surface)' }}>
                      <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                        style={{ color: 'var(--text-muted)' }}>
                        Giá bán
                      </p>
                      <p className="mono font-bold text-xl" style={{ color: meta?.color }}>
                        {formatPrice(item.sell_price, decimals)}
                      </p>
                    </div>
                  )}
                </div>
                <p className="text-xs mt-2 text-center" style={{ color: 'var(--text-muted)' }}>
                  Đơn vị: {item.unit} · Nguồn: {item.source}
                </p>
              </div>

              {/* Chart */}
              <div className="px-6 py-4">
                <PriceChart
                  data={history}
                  symbol={item.symbol}
                  name="Biến động 30 ngày"
                  category={item.category}
                  unit={item.unit}
                  isLoading={histLoading}
                />
              </div>

              {/* Footer */}
              <div
                className="px-6 py-3 text-center text-xs"
                style={{ background: 'var(--bg-surface)', color: 'var(--text-muted)', borderTop: '1px solid var(--border-subtle)' }}
              >
                Cập nhật lúc {formatUpdatedAt(item.fetched_at)} · Giá mang tính tham khảo
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
