-- Migration 0011: Tạo bảng news_factor_cache lưu trữ phân loại tin tức cho nhận định giá xăng
CREATE TABLE IF NOT EXISTS news_factor_cache (
  news_id INTEGER PRIMARY KEY,
  factor TEXT NOT NULL,
  impact TEXT NOT NULL,
  certainty TEXT NOT NULL,
  one_line TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_news_factor_cache_created ON news_factor_cache(created_at);
