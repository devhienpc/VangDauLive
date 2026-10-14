-- Migration 0010: Tạo bảng forecasts lưu trữ nhận định giá xăng dầu
CREATE TABLE IF NOT EXISTS forecasts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  target_period_start TEXT NOT NULL,
  product TEXT NOT NULL,
  direction TEXT,
  magnitude TEXT,
  range_low INTEGER,
  range_high INTEGER,
  confidence TEXT NOT NULL,
  status TEXT NOT NULL,
  reasons_json TEXT,
  model_version TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_forecasts_target_product ON forecasts(target_period_start, product);
CREATE INDEX IF NOT EXISTS idx_forecasts_created_at ON forecasts(created_at);
