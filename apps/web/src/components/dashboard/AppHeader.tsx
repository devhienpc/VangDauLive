// src/components/dashboard/AppHeader.tsx
// Header responsive mobile-first: logo, expandable search, nav drawer, ticker, safe-area support

import { useState, useMemo, useRef, useEffect } from 'react';
import { PriceTicker } from './PriceTicker';
import type { PriceRecord } from '../../types';

interface AppHeaderProps {
  updatedAt?: string | null;
  records?: PriceRecord[];
  searchTerm?: string;
  onSearchChange?: (val: string) => void;
  selectedCategory?: string;
  onSelectCategory?: (cat: string) => void;
  onRefresh?: () => void;
}

const NAV_ITEMS = [
  { id: 'nav-overview', label: 'Tổng quan', href: '#overview', cat: 'all', target: 'overview' },
  { id: 'nav-metals',   label: 'Vàng & Bạc', href: '#metals',   cat: 'gold', target: 'quote-table' },
  { id: 'nav-fuel',     label: 'Xăng Dầu',   href: '#fuel',     cat: 'fuel', target: 'quote-table' },
  { id: 'nav-forex',    label: 'Ngoại Tệ',   href: '#forex',    cat: 'forex', target: 'quote-table' },
  { id: 'nav-chart',    label: 'Biểu Đồ',    href: '#chart',    cat: null,   target: 'chart' },
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
  records = [],
  searchTerm = '',
  onSearchChange,
  selectedCategory = 'all',
  onSelectCategory,
  onRefresh,
}: AppHeaderProps) {
  const [activeNav, setActiveNav] = useState('nav-overview');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [mobileSearchActive, setMobileSearchActive] = useState(false);

  const searchWrapRef = useRef<HTMLDivElement>(null);
  const mobileSearchInputRef = useRef<HTMLInputElement>(null);

  // Đóng dropdown tìm kiếm khi click ra ngoài
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchWrapRef.current && !searchWrapRef.current.contains(e.target as Node)) {
        setIsSearchOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Lắng nghe phím Escape để đóng Drawer và Search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
        setIsSearchOpen(false);
        setMobileSearchActive(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Khóa cuộn trang khi drawer hoặc mobile search mở
  useEffect(() => {
    if (drawerOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [drawerOpen]);

  // Focus ô tìm kiếm khi mở mobile search
  useEffect(() => {
    if (mobileSearchActive) {
      setTimeout(() => {
        mobileSearchInputRef.current?.focus();
      }, 100);
    }
  }, [mobileSearchActive]);

  // Kiểm tra nếu dữ liệu cũ hơn 36 giờ
  const isStale = Boolean(
    updatedAt &&
    !isNaN(new Date(updatedAt).getTime()) &&
    Date.now() - new Date(updatedAt).getTime() > 36 * 3600 * 1000,
  );

  // Đồng bộ activeNav theo selectedCategory
  const currentActiveNav = useMemo(() => {
    if (selectedCategory === 'gold') return 'nav-metals';
    if (selectedCategory === 'fuel') return 'nav-fuel';
    if (selectedCategory === 'forex') return 'nav-forex';
    return activeNav || 'nav-overview';
  }, [selectedCategory, activeNav]);

  // Tìm kiếm tức thì trong header
  const searchResults = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q || !records || records.length === 0) return [];
    return records
      .filter((r) => {
        const sym = String(r.symbol || '').toLowerCase();
        const nm = String(r.name || '').toLowerCase();
        const cat = String(r.category || '').toLowerCase();
        return sym.includes(q) || nm.includes(q) || cat.includes(q);
      })
      .slice(0, 6);
  }, [records, searchTerm]);

  const handleNavClick = (
    item: (typeof NAV_ITEMS)[number],
    e: React.MouseEvent<HTMLAnchorElement>
  ) => {
    e.preventDefault();
    setActiveNav(item.id);
    if (item.cat !== null && onSelectCategory) {
      onSelectCategory(item.cat);
    }
    if (item.target === 'overview') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      const el = document.getElementById(item.target);
      if (el) {
        const yOffset = -72;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    }
    setDrawerOpen(false);
  };

  const handleSelectSearchResult = (record: PriceRecord) => {
    setIsSearchOpen(false);
    setMobileSearchActive(false);
    if (record.category && onSelectCategory) {
      if (record.category === 'silver') {
        onSelectCategory('gold');
      } else {
        onSelectCategory(record.category);
      }
    }
    const el = document.getElementById('quote-table');
    if (el) {
      const yOffset = -72;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      setIsSearchOpen(false);
      setMobileSearchActive(false);
      const el = document.getElementById('quote-table');
      if (el) {
        const yOffset = -72;
        const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
        window.scrollTo({ top: y, behavior: 'smooth' });
      }
    } else if (e.key === 'Escape') {
      setIsSearchOpen(false);
      setMobileSearchActive(false);
    }
  };

  return (
    <header className="app-header">
      <div className="header-inner">
        {/* ── Logo ───────────────────────────────────────── */}
        <a href="/" className="logo-group" aria-label="VàngDầu Live – trang chủ">
          <img
            src="/logo.png"
            alt="VàngDầu Live"
            className="brand-logo-img"
            style={{ height: '36px', width: 'auto', objectFit: 'contain' }}
          />
        </a>

        {/* ── Search Desktop with Dropdown ───────────────── */}
        <div className="header-search-wrap" ref={searchWrapRef}>
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
              onFocus={() => setIsSearchOpen(true)}
              onChange={(e) => {
                onSearchChange?.(e.target.value);
                setIsSearchOpen(true);
              }}
              onKeyDown={handleSearchKeyDown}
              aria-label="Tìm kiếm mã"
              autoComplete="off"
            />
            {searchTerm && (
              <button
                type="button"
                className="search-clear-inline"
                onClick={() => {
                  onSearchChange?.('');
                  setIsSearchOpen(false);
                }}
                aria-label="Xóa tìm kiếm"
              >
                ✕
              </button>
            )}
          </div>

          {/* Quick search dropdown */}
          {isSearchOpen && searchTerm.trim().length > 0 && (
            <div className="search-dropdown-popup" role="listbox" aria-label="Kết quả tìm kiếm">
              <div className="search-dropdown-header">
                <span>Kết quả ({searchResults.length})</span>
                <span className="search-dropdown-hint">Nhấn Enter để đến bảng ↵</span>
              </div>
              <div className="search-dropdown-list">
                {searchResults.length === 0 ? (
                  <div className="search-dropdown-empty">
                    <span>Không tìm thấy mặt hàng khớp với "<strong>{searchTerm}</strong>"</span>
                  </div>
                ) : (
                  searchResults.map((item) => {
                    const p = item.ask ?? item.bid ?? 0;
                    const catColor =
                      item.category === 'gold' ? '#F5A623' :
                      item.category === 'silver' ? '#94a3b8' :
                      item.category === 'fuel' ? '#60a5fa' :
                      item.category === 'oil' ? '#2dd4bf' : '#a78bfa';
                    const changePct = item.change_pct ?? 0;
                    return (
                      <div
                        key={item.symbol}
                        className="search-dropdown-item"
                        role="option"
                        onClick={() => handleSelectSearchResult(item)}
                      >
                        <div className="search-item-left">
                          <span className="search-item-dot" style={{ background: catColor }} aria-hidden="true" />
                          <div>
                            <div className="search-item-symbol">{item.symbol}</div>
                            <div className="search-item-name">{item.name}</div>
                          </div>
                        </div>
                        <div className="search-item-right">
                          <div className="search-item-price">
                            {p.toLocaleString('vi-VN')} {item.unit}
                          </div>
                          <div className={`search-item-pct ${changePct >= 0 ? 'pct-up' : 'pct-down'}`}>
                            {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          )}
        </div>

        {/* ── Nav Desktop ────────────────────────────────── */}
        <nav className="header-nav" aria-label="Navigation chính">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              id={item.id}
              href={item.href}
              className={`nav-link${currentActiveNav === item.id ? ' nav-link--active' : ''}`}
              onClick={(e) => handleNavClick(item, e)}
            >
              {item.label}
            </a>
          ))}
        </nav>

        {/* ── Right side ─────────────────────────────────── */}
        <div className="header-right">
          {/* Badge cập nhật (Desktop) */}
          <div
            className={`updated-badge ${isStale ? 'updated-badge--stale' : ''}`}
            aria-live="polite"
            aria-label={`Cập nhật lúc ${formatTimeString(updatedAt)}`}
            onClick={onRefresh}
            style={{ cursor: onRefresh ? 'pointer' : undefined }}
            title={onRefresh ? 'Nhấp để làm mới dữ liệu từ máy chủ' : undefined}
          >
            <span className={`updated-dot ${isStale ? 'updated-dot--stale' : ''}`} aria-hidden="true" />
            <span>Cập nhật lúc {formatTimeString(updatedAt)}</span>
            {isStale && (
              <span
                className="stale-warning-tag"
                title="Dữ liệu chưa cập nhật trong hơn 36 giờ qua"
              >
                ⚠️ Dữ liệu cũ &gt;36h
              </span>
            )}
          </div>

          {/* Nút tìm kiếm (Mobile icon trigger) */}
          <button
            type="button"
            className="icon-btn mobile-search-btn"
            aria-label="Mở tìm kiếm"
            onClick={() => setMobileSearchActive(true)}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
          </button>

          {/* Chuông thông báo */}
          <button
            id="btn-notifications"
            className="icon-btn"
            aria-label="Thông báo thị trường"
            title="Thông báo thị trường"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
          </button>

          {/* Nút hamburger mở menu Drawer (Mobile) */}
          <button
            id="btn-menu-mobile"
            className="icon-btn mobile-menu-btn"
            aria-label={drawerOpen ? 'Đóng menu' : 'Mở menu'}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((v) => !v)}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Mobile Search Overlay (Khi chạm vào icon tìm kiếm) ── */}
      {mobileSearchActive && (
        <div className="mobile-search-overlay" role="dialog" aria-modal="true" aria-label="Tìm kiếm hàng hóa">
          <div className="mobile-search-bar">
            <svg className="search-icon" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
            </svg>
            <input
              ref={mobileSearchInputRef}
              type="search"
              placeholder="Tìm mã hoặc tên (vàng, dầu, xăng, ngoại tệ)…"
              className="mobile-search-input"
              value={searchTerm}
              onChange={(e) => onSearchChange?.(e.target.value)}
              onKeyDown={handleSearchKeyDown}
              autoComplete="off"
            />
            {searchTerm && (
              <button
                type="button"
                className="mobile-search-clear"
                onClick={() => onSearchChange?.('')}
                aria-label="Xóa nội dung tìm kiếm"
              >
                ✕
              </button>
            )}
            <button
              type="button"
              className="mobile-search-close-btn"
              onClick={() => setMobileSearchActive(false)}
              aria-label="Đóng tìm kiếm"
            >
              Hủy
            </button>
          </div>

          {/* Kết quả tìm kiếm mobile */}
          {searchTerm.trim().length > 0 && (
            <div className="mobile-search-results">
              {searchResults.length === 0 ? (
                <div className="search-dropdown-empty">
                  <span>Không tìm thấy mặt hàng khớp với "<strong>{searchTerm}</strong>"</span>
                </div>
              ) : (
                searchResults.map((item) => {
                  const p = item.ask ?? item.bid ?? 0;
                  const catColor =
                    item.category === 'gold' ? '#F5A623' :
                    item.category === 'silver' ? '#94a3b8' :
                    item.category === 'fuel' ? '#60a5fa' :
                    item.category === 'oil' ? '#2dd4bf' : '#a78bfa';
                  const changePct = item.change_pct ?? 0;
                  return (
                    <div
                      key={item.symbol}
                      className="search-dropdown-item"
                      role="button"
                      tabIndex={0}
                      onClick={() => handleSelectSearchResult(item)}
                    >
                      <div className="search-item-left">
                        <span className="search-item-dot" style={{ background: catColor }} aria-hidden="true" />
                        <div>
                          <div className="search-item-symbol">{item.symbol}</div>
                          <div className="search-item-name">{item.name}</div>
                        </div>
                      </div>
                      <div className="search-item-right">
                        <div className="search-item-price">
                          {p.toLocaleString('vi-VN')} {item.unit}
                        </div>
                        <div className={`search-item-pct ${changePct >= 0 ? 'pct-up' : 'pct-down'}`}>
                          {changePct >= 0 ? '+' : ''}{changePct.toFixed(2)}%
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Mobile Nav Drawer / Sheet (Trượt từ cạnh phải) ──── */}
      {drawerOpen && (
        <div
          className="drawer-backdrop"
          onClick={() => setDrawerOpen(false)}
          aria-hidden="true"
        />
      )}
      <div
        className={`mobile-drawer ${drawerOpen ? 'mobile-drawer--open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Menu điều hướng"
      >
        <div className="mobile-drawer-header">
          <div className="drawer-brand">
            <img
              src="/logo.png"
              alt="VàngDầu Live"
              style={{ height: '32px', width: 'auto', objectFit: 'contain' }}
            />
          </div>
          <button
            type="button"
            className="icon-btn drawer-close-btn"
            onClick={() => setDrawerOpen(false)}
            aria-label="Đóng menu"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        <nav className="mobile-drawer-nav" aria-label="Danh mục điều hướng mobile">
          {NAV_ITEMS.map((item) => (
            <a
              key={item.id}
              href={item.href}
              className={`drawer-nav-link${currentActiveNav === item.id ? ' drawer-nav-link--active' : ''}`}
              onClick={(e) => handleNavClick(item, e)}
            >
              <span>{item.label}</span>
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </a>
          ))}

          <a
            href="/admin"
            className="drawer-nav-link drawer-nav-link--admin"
            onClick={() => setDrawerOpen(false)}
          >
            <span>Trang quản trị (Admin)</span>
            <span className="drawer-admin-pill">Admin</span>
          </a>
        </nav>

        {/* Drawer footer info */}
        <div className="mobile-drawer-footer">
          <div className="drawer-time-badge">
            <span className="updated-dot" aria-hidden="true" />
            <span>Cập nhật: {formatTimeString(updatedAt)}</span>
          </div>
          {onRefresh && (
            <button
              type="button"
              className="drawer-refresh-btn"
              onClick={() => {
                onRefresh();
                setDrawerOpen(false);
              }}
            >
              Làm mới dữ liệu ↻
            </button>
          )}
        </div>
      </div>

      {/* ── Price Ticker ────────────────────────────────── */}
      <PriceTicker records={records} />
    </header>
  );
}
