-- Migration 0012: Tạo bảng forecast_results lưu kết quả đối chiếu độ chính xác của nhận định
CREATE TABLE IF NOT EXISTS forecast_results (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  forecast_id INTEGER NOT NULL UNIQUE,
  actual_delta INTEGER NOT NULL,
  actual_direction TEXT NOT NULL,
  hit INTEGER NOT NULL,
  evaluated_at TEXT NOT NULL DEFAULT (datetime('now')),
  FOREIGN KEY (forecast_id) REFERENCES forecasts(id)
);

CREATE INDEX IF NOT EXISTS idx_forecast_results_forecast_id ON forecast_results(forecast_id);
CREATE INDEX IF NOT EXISTS idx_forecast_results_evaluated_at ON forecast_results(evaluated_at DESC);
