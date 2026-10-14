-- Migration 0009: Tạo bảng fuel_adjustments và mở rộng mã tham chiếu daily_candles
-- Áp dụng local:  wrangler d1 migrations apply vangdau-db --local
-- Áp dụng remote: wrangler d1 migrations apply vangdau-db --remote

-- 1. Bảng fuel_adjustments: Lưu lịch sử các kỳ điều hành giá xăng dầu chính thức tại Việt Nam
CREATE TABLE IF NOT EXISTS fuel_adjustments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  effective_at TEXT NOT NULL,
  product TEXT NOT NULL,
  price_zone1 INTEGER NOT NULL,
  delta INTEGER,
  source_url TEXT,
  note TEXT,
  UNIQUE(effective_at, product)
);

CREATE INDEX IF NOT EXISTS idx_fuel_adjustments_effective ON fuel_adjustments(effective_at DESC);
CREATE INDEX IF NOT EXISTS idx_fuel_adjustments_product ON fuel_adjustments(product, effective_at DESC);

-- 2. Bảng daily_candles sẵn sàng lưu trữ các mã tham chiếu chuẩn quốc tế & nội địa:
-- - RB=F: Xăng RBOB Gasoline Futures (NYMEX)
-- - HO=F: Dầu sưởi / Diesel Heating Oil Futures (NYMEX)
-- - BZ=F: Dầu thô Brent (ICE)
-- - CL=F: Dầu thô WTI (NYMEX)
-- - USD/VND (USD_VND): Tỷ giá hối đoái Vietcombank
