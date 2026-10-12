-- Migration 0001: Khởi tạo schema D1 cho VàngDầu Live
-- Áp dụng local:  wrangler d1 migrations apply vangdau-db --local
-- Áp dụng remote: wrangler d1 migrations apply vangdau-db --remote

-- 1. Bảng prices: Lưu giá vàng, bạc, xăng dầu, ngoại tệ, v.v.
CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  symbol TEXT,
  name TEXT,
  category TEXT,
  bid REAL,
  ask REAL,
  unit TEXT,
  change_pct REAL,
  source TEXT,
  fetched_at TEXT
);

-- Index trên prices(symbol, fetched_at)
CREATE INDEX IF NOT EXISTS idx_prices_symbol_fetched_at ON prices(symbol, fetched_at);

-- 2. Bảng news: Lưu tin tức thị trường
CREATE TABLE IF NOT EXISTS news (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT,
  summary TEXT,
  category TEXT,
  url TEXT UNIQUE,
  source TEXT,
  published_at TEXT
);

-- Index trên news(published_at)
CREATE INDEX IF NOT EXISTS idx_news_published_at ON news(published_at);

-- 3. Bảng ingest_log: Lưu log quá trình ingest / fetch dữ liệu
CREATE TABLE IF NOT EXISTS ingest_log (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source TEXT,
  status TEXT,
  message TEXT,
  created_at TEXT
);
