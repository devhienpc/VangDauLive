-- Migration 0005: Tạo bảng fuel_suggestions cho scraper gợi ý giá xăng dầu
-- Áp dụng local:  wrangler d1 migrations apply vangdau-db --local
-- Áp dụng remote: wrangler d1 migrations apply vangdau-db --remote

CREATE TABLE IF NOT EXISTS fuel_suggestions (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT NOT NULL,
  symbol TEXT NOT NULL,
  name TEXT,
  price_zone1 REAL NOT NULL,
  price_zone2 REAL,
  effective_at TEXT,
  raw_text TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_fuel_suggestions_status ON fuel_suggestions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_suggestions_symbol ON fuel_suggestions(symbol, effective_at DESC);
