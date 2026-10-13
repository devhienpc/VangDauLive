-- Migration 0004: Thêm bảng fuel_manual và hỗ trợ mốc effective_at, stale cho prices
-- Áp dụng local:  wrangler d1 migrations apply vangdau-db --local
-- Áp dụng remote: wrangler d1 migrations apply vangdau-db --remote

-- 1. Bảng fuel_manual: Lưu lịch sử và giá xăng dầu nhập tay có kiểm chứng
CREATE TABLE IF NOT EXISTS fuel_manual (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT NOT NULL,
  price_zone1 REAL NOT NULL,
  price_zone2 REAL,
  effective_at TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_manual_symbol_effective ON fuel_manual(symbol, effective_at DESC);

-- 2. Thêm cột effective_at và stale vào bảng prices
ALTER TABLE prices ADD COLUMN effective_at TEXT;
ALTER TABLE prices ADD COLUMN stale INTEGER DEFAULT 0;
