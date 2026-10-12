-- Migration 0003: Tạo bảng daily_candles lưu dữ liệu nến ngày
-- symbol: mã hàng hóa (XAU_USD, BRENT, WTI, XAG_USD, SJC-01, USD_VND, v.v.)
-- date: ngày theo chuẩn YYYY-MM-DD
-- open, high, low, close: giá theo OHLC
-- source: nguồn dữ liệu duy nhất (Yahoo Finance, EIA, Vietcombank, webgia...)

CREATE TABLE IF NOT EXISTS daily_candles (
  symbol TEXT NOT NULL,
  date TEXT NOT NULL,
  open REAL NOT NULL,
  high REAL NOT NULL,
  low REAL NOT NULL,
  close REAL NOT NULL,
  source TEXT NOT NULL,
  PRIMARY KEY (symbol, date)
);

CREATE INDEX IF NOT EXISTS idx_daily_candles_symbol_date ON daily_candles(symbol, date ASC);
CREATE INDEX IF NOT EXISTS idx_daily_candles_date ON daily_candles(date ASC);
