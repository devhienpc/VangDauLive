-- seed.sql – Dữ liệu mẫu cho VàngDầu Live API
-- Dùng để chạy thử khi chưa có cron fetch thật
--
-- Áp dụng local:
--   wrangler d1 execute vangdau-db --local --file=seed.sql
--
-- Hoặc dùng npm script:
--   npm run db:seed

-- ─── Xoá dữ liệu cũ (chỉ chạy khi seed lại) ──────────────────────────────
DELETE FROM prices;
DELETE FROM news;
DELETE FROM ingest_log;

-- ─── PRICES: Giá mới nhất ────────────────────────────────────────────────────
-- Vàng
INSERT INTO prices (symbol, name, category, bid, ask, unit, change_pct, source, fetched_at) VALUES
  ('SJC-01',   'Vàng SJC 1 lượng',      'gold',   91800000, 92300000, 'VND/lượng', 0.84,  'sjc.com.vn',      datetime('now', '-10 minutes')),
  ('SJC-05',   'Vàng SJC 0.5 lượng',    'gold',   45900000, 46150000, 'VND/lượng', 0.82,  'sjc.com.vn',      datetime('now', '-10 minutes')),
  ('BTMC-9999','Vàng 9999 BTMC',         'gold',   87000000, 87500000, 'VND/lượng', 0.71,  'btmc.com.vn',     datetime('now', '-10 minutes')),
  ('XAU_USD',  'Vàng thế giới XAU/USD', 'gold',   3314.00,  3318.40,  'USD/oz',    0.52,  'metals-api',      datetime('now', '-10 minutes'));

-- Bạc
INSERT INTO prices (symbol, name, category, bid, ask, unit, change_pct, source, fetched_at) VALUES
  ('XAG_USD',  'Bạc thế giới XAG/USD',  'silver', 31.20,    31.40,    'USD/oz',    -0.19, 'metals-api',      datetime('now', '-10 minutes')),
  ('BAC_VN',   'Bạc SJC',               'silver', 790000,   810000,   'VND/lượng', -0.21, 'sjc.com.vn',      datetime('now', '-10 minutes'));

-- Xăng dầu nội địa
INSERT INTO prices (symbol, name, category, bid, ask, unit, change_pct, source, fetched_at) VALUES
  ('RON92_E5', 'Xăng E5 RON92',          'fuel',   NULL,     20900,    'VND/lít',   0.00,  'moit.gov.vn',     datetime('now', '-10 minutes')),
  ('RON95_E5', 'Xăng E5 RON95',          'fuel',   NULL,     22700,    'VND/lít',   0.00,  'moit.gov.vn',     datetime('now', '-10 minutes')),
  ('DO0005',   'Dầu diesel DO 0,05S',    'fuel',   NULL,     19640,    'VND/lít',   -0.30, 'moit.gov.vn',     datetime('now', '-10 minutes')),
  ('DO001',    'Dầu diesel DO 0,001S',   'fuel',   NULL,     20020,    'VND/lít',   -0.25, 'moit.gov.vn',     datetime('now', '-10 minutes')),
  ('MO_FO',    'Mazut 180cSt 3,5S',      'fuel',   NULL,     15560,    'VND/kg',    -0.10, 'moit.gov.vn',     datetime('now', '-10 minutes'));

-- Dầu thô thế giới
INSERT INTO prices (symbol, name, category, bid, ask, unit, change_pct, source, fetched_at) VALUES
  ('BRENT',    'Dầu Brent',              'oil',    74.10,    74.22,    'USD/thùng', 1.05,  'eia.gov',         datetime('now', '-10 minutes')),
  ('WTI',      'Dầu WTI',               'oil',    71.05,    71.15,    'USD/thùng', 0.88,  'eia.gov',         datetime('now', '-10 minutes'));

-- Ngoại tệ
INSERT INTO prices (symbol, name, category, bid, ask, unit, change_pct, source, fetched_at) VALUES
  ('USD_VND',  'Đô la Mỹ USD/VND',       'forex',  25440,    25480,    'VND',       0.08,  'exchangerate-api', datetime('now', '-10 minutes')),
  ('EUR_VND',  'Euro EUR/VND',            'forex',  27620,    27700,    'VND',       -0.12, 'exchangerate-api', datetime('now', '-10 minutes')),
  ('JPY_VND',  'Yên Nhật JPY/VND',       'forex',  168.5,    169.4,    'VND',       -0.21, 'exchangerate-api', datetime('now', '-10 minutes')),
  ('GBP_VND',  'Bảng Anh GBP/VND',       'forex',  33100,    33250,    'VND',       0.15,  'exchangerate-api', datetime('now', '-10 minutes')),
  ('CNY_VND',  'Nhân dân tệ CNY/VND',    'forex',  3490,     3510,     'VND',       0.04,  'exchangerate-api', datetime('now', '-10 minutes')),
  ('SGD_VND',  'Đô la Singapore SGD/VND','forex',  18750,    18850,    'VND',       -0.03, 'exchangerate-api', datetime('now', '-10 minutes'));

-- ─── LỊCH SỬ GIÁ: 30 ngày cho biểu đồ ──────────────────────────────────────
-- Vàng SJC – 30 điểm (mỗi ngày 1 điểm)
INSERT INTO prices (symbol, name, category, bid, ask, unit, change_pct, source, fetched_at) VALUES
  ('SJC-01','Vàng SJC 1 lượng','gold', 89500000, 90100000, 'VND/lượng', 0.10, 'sjc.com.vn', datetime('now', '-30 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 89700000, 90200000, 'VND/lượng', 0.11, 'sjc.com.vn', datetime('now', '-29 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 89800000, 90300000, 'VND/lượng', 0.11, 'sjc.com.vn', datetime('now', '-28 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 90000000, 90500000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-27 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 90200000, 90700000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-26 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 90100000, 90600000, 'VND/lượng', -0.11,'sjc.com.vn', datetime('now', '-25 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 90300000, 90800000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-24 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 90500000, 91000000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-23 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 90400000, 90900000, 'VND/lượng', -0.11,'sjc.com.vn', datetime('now', '-22 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 90600000, 91100000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-21 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 90800000, 91300000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-20 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91000000, 91500000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-19 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 90900000, 91400000, 'VND/lượng', -0.11,'sjc.com.vn', datetime('now', '-18 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91100000, 91600000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-17 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91200000, 91700000, 'VND/lượng', 0.11, 'sjc.com.vn', datetime('now', '-16 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91000000, 91500000, 'VND/lượng', -0.22,'sjc.com.vn', datetime('now', '-15 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91300000, 91800000, 'VND/lượng', 0.33, 'sjc.com.vn', datetime('now', '-14 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91500000, 92000000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-13 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91400000, 91900000, 'VND/lượng', -0.11,'sjc.com.vn', datetime('now', '-12 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91600000, 92100000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-11 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91700000, 92200000, 'VND/lượng', 0.11, 'sjc.com.vn', datetime('now', '-10 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91500000, 92000000, 'VND/lượng', -0.22,'sjc.com.vn', datetime('now', '-9 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91600000, 92100000, 'VND/lượng', 0.11, 'sjc.com.vn', datetime('now', '-8 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91800000, 92300000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-7 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91900000, 92400000, 'VND/lượng', 0.11, 'sjc.com.vn', datetime('now', '-6 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 92000000, 92500000, 'VND/lượng', 0.11, 'sjc.com.vn', datetime('now', '-5 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91800000, 92300000, 'VND/lượng', -0.22,'sjc.com.vn', datetime('now', '-4 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 92000000, 92500000, 'VND/lượng', 0.22, 'sjc.com.vn', datetime('now', '-3 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 92100000, 92600000, 'VND/lượng', 0.11, 'sjc.com.vn', datetime('now', '-2 days')),
  ('SJC-01','Vàng SJC 1 lượng','gold', 91900000, 92400000, 'VND/lượng', -0.22,'sjc.com.vn', datetime('now', '-1 days'));

-- Dầu Brent – 30 điểm
INSERT INTO prices (symbol, name, category, bid, ask, unit, change_pct, source, fetched_at) VALUES
  ('BRENT','Dầu Brent','oil', 72.40, 72.55, 'USD/thùng', -0.50, 'eia.gov', datetime('now', '-30 days')),
  ('BRENT','Dầu Brent','oil', 72.80, 72.95, 'USD/thùng',  0.55, 'eia.gov', datetime('now', '-29 days')),
  ('BRENT','Dầu Brent','oil', 73.20, 73.35, 'USD/thùng',  0.55, 'eia.gov', datetime('now', '-28 days')),
  ('BRENT','Dầu Brent','oil', 73.10, 73.25, 'USD/thùng', -0.14, 'eia.gov', datetime('now', '-27 days')),
  ('BRENT','Dầu Brent','oil', 73.50, 73.65, 'USD/thùng',  0.55, 'eia.gov', datetime('now', '-26 days')),
  ('BRENT','Dầu Brent','oil', 73.80, 73.95, 'USD/thùng',  0.41, 'eia.gov', datetime('now', '-25 days')),
  ('BRENT','Dầu Brent','oil', 73.60, 73.75, 'USD/thùng', -0.27, 'eia.gov', datetime('now', '-24 days')),
  ('BRENT','Dầu Brent','oil', 74.00, 74.15, 'USD/thùng',  0.54, 'eia.gov', datetime('now', '-23 days')),
  ('BRENT','Dầu Brent','oil', 74.20, 74.35, 'USD/thùng',  0.27, 'eia.gov', datetime('now', '-22 days')),
  ('BRENT','Dầu Brent','oil', 73.90, 74.05, 'USD/thùng', -0.40, 'eia.gov', datetime('now', '-21 days')),
  ('BRENT','Dầu Brent','oil', 74.10, 74.25, 'USD/thùng',  0.27, 'eia.gov', datetime('now', '-20 days')),
  ('BRENT','Dầu Brent','oil', 73.70, 73.85, 'USD/thùng', -0.54, 'eia.gov', datetime('now', '-19 days')),
  ('BRENT','Dầu Brent','oil', 73.50, 73.65, 'USD/thùng', -0.27, 'eia.gov', datetime('now', '-18 days')),
  ('BRENT','Dầu Brent','oil', 73.80, 73.95, 'USD/thùng',  0.41, 'eia.gov', datetime('now', '-17 days')),
  ('BRENT','Dầu Brent','oil', 74.00, 74.15, 'USD/thùng',  0.27, 'eia.gov', datetime('now', '-16 days')),
  ('BRENT','Dầu Brent','oil', 73.60, 73.75, 'USD/thùng', -0.54, 'eia.gov', datetime('now', '-15 days')),
  ('BRENT','Dầu Brent','oil', 73.90, 74.05, 'USD/thùng',  0.41, 'eia.gov', datetime('now', '-14 days')),
  ('BRENT','Dầu Brent','oil', 74.20, 74.35, 'USD/thùng',  0.40, 'eia.gov', datetime('now', '-13 days')),
  ('BRENT','Dầu Brent','oil', 74.10, 74.25, 'USD/thùng', -0.13, 'eia.gov', datetime('now', '-12 days')),
  ('BRENT','Dầu Brent','oil', 73.80, 73.95, 'USD/thùng', -0.40, 'eia.gov', datetime('now', '-11 days')),
  ('BRENT','Dầu Brent','oil', 73.50, 73.65, 'USD/thùng', -0.41, 'eia.gov', datetime('now', '-10 days')),
  ('BRENT','Dầu Brent','oil', 73.70, 73.85, 'USD/thùng',  0.27, 'eia.gov', datetime('now', '-9 days')),
  ('BRENT','Dầu Brent','oil', 73.40, 73.55, 'USD/thùng', -0.41, 'eia.gov', datetime('now', '-8 days')),
  ('BRENT','Dầu Brent','oil', 73.60, 73.75, 'USD/thùng',  0.27, 'eia.gov', datetime('now', '-7 days')),
  ('BRENT','Dầu Brent','oil', 73.80, 73.95, 'USD/thùng',  0.27, 'eia.gov', datetime('now', '-6 days')),
  ('BRENT','Dầu Brent','oil', 74.00, 74.15, 'USD/thùng',  0.27, 'eia.gov', datetime('now', '-5 days')),
  ('BRENT','Dầu Brent','oil', 73.80, 73.95, 'USD/thùng', -0.27, 'eia.gov', datetime('now', '-4 days')),
  ('BRENT','Dầu Brent','oil', 74.00, 74.15, 'USD/thùng',  0.27, 'eia.gov', datetime('now', '-3 days')),
  ('BRENT','Dầu Brent','oil', 74.10, 74.25, 'USD/thùng',  0.13, 'eia.gov', datetime('now', '-2 days')),
  ('BRENT','Dầu Brent','oil', 74.10, 74.22, 'USD/thùng',  0.00, 'eia.gov', datetime('now', '-1 days'));

-- XAU/USD – 30 điểm
INSERT INTO prices (symbol, name, category, bid, ask, unit, change_pct, source, fetched_at) VALUES
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3205.0, 3210.0, 'USD/oz', -0.20, 'metals-api', datetime('now', '-30 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3215.0, 3220.0, 'USD/oz',  0.31, 'metals-api', datetime('now', '-29 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3225.0, 3230.0, 'USD/oz',  0.31, 'metals-api', datetime('now', '-28 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3220.0, 3225.0, 'USD/oz', -0.15, 'metals-api', datetime('now', '-27 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3230.0, 3235.0, 'USD/oz',  0.31, 'metals-api', datetime('now', '-26 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3240.0, 3245.0, 'USD/oz',  0.31, 'metals-api', datetime('now', '-25 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3235.0, 3240.0, 'USD/oz', -0.15, 'metals-api', datetime('now', '-24 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3245.0, 3250.0, 'USD/oz',  0.31, 'metals-api', datetime('now', '-23 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3255.0, 3260.0, 'USD/oz',  0.31, 'metals-api', datetime('now', '-22 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3250.0, 3255.0, 'USD/oz', -0.15, 'metals-api', datetime('now', '-21 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3260.0, 3265.0, 'USD/oz',  0.31, 'metals-api', datetime('now', '-20 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3255.0, 3260.0, 'USD/oz', -0.15, 'metals-api', datetime('now', '-19 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3265.0, 3270.0, 'USD/oz',  0.31, 'metals-api', datetime('now', '-18 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3270.0, 3275.0, 'USD/oz',  0.15, 'metals-api', datetime('now', '-17 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3275.0, 3280.0, 'USD/oz',  0.15, 'metals-api', datetime('now', '-16 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3268.0, 3273.0, 'USD/oz', -0.21, 'metals-api', datetime('now', '-15 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3280.0, 3285.0, 'USD/oz',  0.37, 'metals-api', datetime('now', '-14 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3290.0, 3295.0, 'USD/oz',  0.30, 'metals-api', datetime('now', '-13 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3285.0, 3290.0, 'USD/oz', -0.15, 'metals-api', datetime('now', '-12 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3295.0, 3300.0, 'USD/oz',  0.30, 'metals-api', datetime('now', '-11 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3300.0, 3305.0, 'USD/oz',  0.15, 'metals-api', datetime('now', '-10 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3305.0, 3310.0, 'USD/oz',  0.15, 'metals-api', datetime('now', '-9 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3298.0, 3303.0, 'USD/oz', -0.21, 'metals-api', datetime('now', '-8 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3305.0, 3310.0, 'USD/oz',  0.21, 'metals-api', datetime('now', '-7 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3308.0, 3313.0, 'USD/oz',  0.09, 'metals-api', datetime('now', '-6 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3310.0, 3315.0, 'USD/oz',  0.06, 'metals-api', datetime('now', '-5 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3305.0, 3310.0, 'USD/oz', -0.15, 'metals-api', datetime('now', '-4 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3310.0, 3315.0, 'USD/oz',  0.15, 'metals-api', datetime('now', '-3 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3312.0, 3317.0, 'USD/oz',  0.06, 'metals-api', datetime('now', '-2 days')),
  ('XAU_USD','Vàng thế giới XAU/USD','gold', 3314.0, 3318.4, 'USD/oz',  0.06, 'metals-api', datetime('now', '-1 days'));

-- ─── NEWS: Tin tức thị trường ────────────────────────────────────────────────
INSERT INTO news (title, summary, category, url, source, published_at) VALUES
  (
    'Vàng thế giới vượt 3.318 USD/oz, cao nhất trong 2 tháng',
    'Căng thẳng địa chính trị leo thang tại Trung Đông và đồng đô la suy yếu đẩy giá vàng tăng mạnh trong phiên giao dịch New York, thu hút dòng vốn trú ẩn an toàn đổ vào vàng vật chất.',
    'gold',
    'https://example.com/news/gold-all-time-high-oct2026',
    'Reuters',
    datetime('now', '-1 hours')
  ),
  (
    'Dầu Brent giảm nhẹ sau quyết định duy trì sản lượng của OPEC+',
    'Liên minh OPEC+ họp khẩn quyết định giữ nguyên mức cắt giảm sản xuất 2,2 triệu thùng/ngày đến hết quý IV/2026. Giá dầu dao động quanh mức 74 USD/thùng.',
    'oil',
    'https://example.com/news/opec-production-oct2026',
    'Bloomberg',
    datetime('now', '-4 hours')
  ),
  (
    'Tỷ giá USD/VND ổn định, NHNN tiếp tục can thiệp thị trường',
    'Ngân hàng Nhà nước bơm thêm thanh khoản để giữ tỷ giá USD/VND trong biên độ kiểm soát. Giá mua vào hiện ở mức 25.440 VND, bán ra 25.480 VND tại các ngân hàng thương mại lớn.',
    'forex',
    'https://example.com/news/usdvnd-nhnn-oct2026',
    'VnEconomy',
    datetime('now', '-6 hours')
  ),
  (
    'Giá xăng dầu trong nước giữ nguyên trong kỳ điều chỉnh mới nhất',
    'Liên bộ Công Thương – Tài chính quyết định giữ nguyên giá bán lẻ xăng E5 RON92 ở mức 20.900 đồng/lít và dầu diesel ở mức 19.640 đồng/lít trong kỳ điều hành ngày 10/10/2026.',
    'fuel',
    'https://example.com/news/petrol-price-oct2026',
    'Bộ Công Thương',
    datetime('now', '-12 hours')
  ),
  (
    'Bạc giảm nhẹ theo đà điều chỉnh sau chuỗi tăng dài',
    'Giá bạc XAG/USD rời khỏi vùng đỉnh 32 USD/oz sau khi các quỹ ETF ghi nhận dòng vốn rút ròng trong 3 phiên liên tiếp. Nhu cầu công nghiệp vẫn ở mức cao.',
    'silver',
    'https://example.com/news/silver-pullback-oct2026',
    'Kitco',
    datetime('now', '-3 hours')
  ),
  (
    'Dầu WTI tiến gần mức 72 USD sau báo cáo tồn kho Mỹ giảm mạnh',
    'Cục Thông tin Năng lượng Mỹ (EIA) công bố tồn kho dầu thô giảm 4,2 triệu thùng trong tuần qua, vượt dự báo thị trường và hỗ trợ giá dầu WTI tăng hơn 1%.',
    'oil',
    'https://example.com/news/wti-eia-inventory-oct2026',
    'EIA',
    datetime('now', '-8 hours')
  ),
  (
    'Fed giữ lãi suất, thị trường chờ dữ liệu việc làm tháng 10',
    'Cục Dự trữ Liên bang Mỹ quyết định giữ nguyên lãi suất tham chiếu ở 4,25–4,50% trong cuộc họp tháng 10. Thị trường hiện tập trung vào báo cáo phi nông nghiệp (NFP) sắp công bố.',
    'forex',
    'https://example.com/news/fed-hold-oct2026',
    'Reuters',
    datetime('now', '-2 hours')
  ),
  (
    'Vàng SJC: Khoảng cách mua vào – bán ra thu hẹp còn 500.000 đồng',
    'Sau một thời gian dài duy trì cách biệt lớn, chênh lệch giá mua – bán vàng SJC 1 lượng đã thu hẹp đáng kể về mức 500.000 đồng nhờ nguồn cung cải thiện và lực cầu hạ nhiệt.',
    'gold',
    'https://example.com/news/sjc-spread-oct2026',
    'Thanh Niên',
    datetime('now', '-5 hours')
  );

-- ─── INGEST LOG: Trạng thái từng nguồn ────────────────────────────────────────
INSERT INTO ingest_log (source, status, message, created_at) VALUES
  ('metals-api',      'ok',    'Đã lấy 4 bản ghi (XAU, XAG, XPT, XPD)',   datetime('now', '-12 minutes')),
  ('eia.gov',         'ok',    'Đã lấy 2 bản ghi (BRENT, WTI)',            datetime('now', '-12 minutes')),
  ('moit.gov.vn',     'ok',    'Đã lấy 5 bản ghi giá xăng dầu nội địa',   datetime('now', '-11 minutes')),
  ('exchangerate-api','ok',    'Đã lấy 6 tỷ giá ngoại tệ',                datetime('now', '-11 minutes')),
  ('sjc.com.vn',      'ok',    'Đã lấy 2 bản ghi giá vàng SJC',           datetime('now', '-10 minutes')),
  ('btmc.com.vn',     'ok',    'Đã lấy 1 bản ghi giá vàng BTMC 9999',     datetime('now', '-10 minutes'));
