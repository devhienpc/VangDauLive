// src/components/Header.tsx

import { motion } from 'framer-motion';
import { formatTime } from '../utils/format';

interface HeaderProps {
  updatedAt: string | null;
  onRefresh: () => void;
  isLoading: boolean;
}

export function Header({ updatedAt, onRefresh, isLoading }: HeaderProps) {
  return (
    <header className="relative z-10 border-b border-[var(--border-subtle)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between gap-4">
        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          <div className="relative">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}
            >
              💰
            </div>
            <div
              className="absolute -inset-1 rounded-xl opacity-40 blur-md"
              style={{ background: 'linear-gradient(135deg, #fbbf24, #d97706)' }}
            />
          </div>
          <div>
            <h1 className="text-gradient-gold font-bold text-xl leading-tight tracking-tight">
              VàngDầu Live
            </h1>
            <p className="text-[var(--text-muted)] text-xs">
              Theo dõi giá tham khảo
            </p>
          </div>
        </motion.div>

        {/* Right side */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          className="flex items-center gap-3"
        >
          {updatedAt && (
            <div className="hidden sm:flex items-center gap-2 text-xs text-[var(--text-secondary)]">
              <span className="pulse-dot" />
              <span>Cập nhật lúc {formatTime(updatedAt)}</span>
            </div>
          )}
          <button
            id="btn-refresh"
            onClick={onRefresh}
            disabled={isLoading}
            className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold transition-all duration-200"
            style={{
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-dim)',
              color: isLoading ? 'var(--text-muted)' : 'var(--text-primary)',
            }}
            aria-label="Làm mới dữ liệu"
          >
            <span
              className="text-sm"
              style={{
                display: 'inline-block',
                animation: isLoading ? 'spin 1s linear infinite' : 'none',
              }}
            >
              🔄
            </span>
            <span className="hidden sm:inline">Làm mới</span>
          </button>
        </motion.div>
      </div>

      {/* Disclaimer */}
      <div
        className="text-center py-1.5 text-xs"
        style={{ background: 'rgba(251,191,36,0.06)', color: 'var(--text-muted)' }}
      >
        ⚠️ Giá mang tính tham khảo, không dùng cho mục đích đầu tư.
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </header>
  );
}
