// src/components/dashboard/AppHeader.tsx
// Header: logo, search, nav, avatar, badge "Cập nhật lúc ...", cảnh báo > 36h, + PriceTicker

import { useState } from 'react';
import { PriceTicker } from './PriceTicker';
import type { PriceRecord } from '../../types';

interface AppHeaderProps {
  updatedAt?: string | null;
  records?: PriceRecord[];
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
}

const NAV_ITEMS = [
  { id: 'nav-overview', label: 'Tổng quan',  href: '#overview' },
  { id: 'nav-metals',   label: 'Vàng & Bạc', href: '#metals'   },
  { id: 'nav-fuel',     label: 'Xăng Dầu',   href: '#fuel'     },
  { id: 'nav-forex',    label: 'Ngoại Tệ',   href: '#forex'    },
  { id: 'nav-chart',    label: 'Biểu Đồ',    href: '#chart'    },
];

function formatTimeString(dtStr?: string | null): string {
  if (!dtStr) return 'Đang cập nhật';
  try {
    const d = new Date(dtStr);
    if (isNaN(d.getTime())) return dtStr;
    return d.toLocaleTimeString('vi-VN', {
      hour: '2-digit',
      minute: '2-digit',
      day: '2-digit',
      month: '2-digit',
      timeZone: 'Asia/Ho_Chi_Minh',
    });
  } catch {
    return dtStr;
  }
}

export function AppHeader({
  updatedAt,
  records,
  searchTerm = '',
  onSearchChange,
}: AppHeaderProps) {
  const [activeNav, setActiveNav] = useState('nav-overview');
  const [menuOpen, setMenuOpen]   = useState(false);

  // Kiểm tra nếu dữ liệu cũ hơn 36 giờ
  const isStale = Boolean(
    updatedAt &&
    !isNaN(new Date(updatedAt).getTime()) &&
    Date.now() - new Date(updatedAt).getTime() > 36 * 3600 * 1000,
  );

  return (
    <header className="app-header">
      <div className="header-inner">
        {/* ── Logo ───────────────────────────────────────── */}
        <a href="#overview" className="logo-group" aria-label="VàngDầu Live – trang chủ">
          <div className="logo-icon" aria-hidden="true">
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path d="M12 2L2 7l10 5 10-5-10-5Z" fill="#F5A623" />
              <path d="M2 17l10 5 10-5" stroke="#F5A623" strokeWidth="1.5" strokeLinecap="round" />
              <path d="M2 12l10 5 10-5" stroke="#F5A623" strokeWidth="1.5" strokeLinecap="round" opacity=".6" />
            </svg>
          </div>
          <span className="logo-text">VàngDầu<span className="logo-live">Live</span></span>
        </a>

        {/* ── Search ─────────────────────────────────────── */}
        <div className="header-search-wrap">
          <label htmlFor="hdr-search" className="sr-only">Tìm kiếm mã hàng hóa</label>
          <div className="header-search">
            <svg className="search-icon" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              id="hdr-search"
              type="search"
              placeholder="Tìm mã hoặc tên hàng hóa…"
              className="search-input"
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              aria-label="Tìm kiếm mã"
            />
          </div>
        </div>

        {/* ── Nav Desktop ────────────────────────────────── */}
        <nav className="header-nav" aria-label="Navigation chính">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              id={item.id}
              href={item.href}
              className={`nav-link${activeNav === item.id ? ' nav-link--active' : ''}`}
              onClick={() => setActiveNav(item.id)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* ── Right side ─────────────────────────────────── */}
        <div className="header-right">
          <div
            className={`updated-badge ${isStale ? 'updated-badge--stale' : ''}`}
            aria-live="polite"
            aria-label={`Cập nhật lúc ${formatTimeString(updatedAt)}`}
          >
            <span className={`updated-dot ${isStale ? 'updated-dot--stale' : ''}`} aria-hidden="true" />
            <span>Cập nhật lúc {formatTimeString(updatedAt)}</span>
            {isStale && (
              <span
                className="stale-warning-tag"
                title="Dữ liệu chưa cập nhật trong hơn 36 giờ qua (có thể do thị trường nghỉ cuối tuần hoặc nguồn bảo trì)"
              >
                ⚠️ Dữ liệu cũ &gt;36h
              </span>
            )}
          </div>

          <button id="btn-notifications" className="icon-btn" aria-label="Thông báo thị trường">
            <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          <button id="btn-avatar" className="avatar-btn" aria-label="Tài khoản">
            <span aria-hidden="true">VD</span>
          </button>

          <button
            id="btn-menu-mobile"
            className="icon-btn mobile-menu-btn"
            aria-label={menuOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen((v) => !v)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              {menuOpen
                ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>
                : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>
              }
            </svg>
          </button>
        </div>
      </div>

      {/* Mobile nav drawer */}
      {menuOpen && (
        <nav className="mobile-nav" aria-label="Menu mobile">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={`mobile-nav-link${activeNav === item.id ? ' mobile-nav-link--active' : ''}`}
              onClick={() => { setActiveNav(item.id); setMenuOpen(false); }}
            >
              {item.label}
            </a>
          ))}
        </nav>
      )}

      {/* ── Price Ticker ────────────────────────────────── */}
      <PriceTicker records={records} />
    </header>
  );
}
