-- Migration 0007: Thêm dữ liệu lịch sử các kỳ điều hành xăng dầu Petrolimex (năm 2026)

-- ─── Kỳ 01/10/2026 15:00 ────────────────────────────────────────────────────────
INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON95_V', 28810, 29380, '2026-10-01 15:00:00', 'Kỳ điều hành 15h 01/10/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON95_V' AND effective_at = '2026-10-01 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON95_III', 28020, 28580, '2026-10-01 15:00:00', 'Kỳ điều hành 15h 01/10/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON95_III' AND effective_at = '2026-10-01 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON92_E5', 27510, 28060, '2026-10-01 15:00:00', 'Kỳ điều hành 15h 01/10/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON92_E5' AND effective_at = '2026-10-01 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'DO0005', 29350, 29930, '2026-10-01 15:00:00', 'Kỳ điều hành 15h 01/10/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'DO0005' AND effective_at = '2026-10-01 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'DO001', 30760, 31370, '2026-10-01 15:00:00', 'Kỳ điều hành 15h 01/10/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'DO001' AND effective_at = '2026-10-01 15:00:00');

-- ─── Kỳ 24/09/2026 15:00 ────────────────────────────────────────────────────────
INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON95_V', 28460, 29020, '2026-09-24 15:00:00', 'Kỳ điều hành 15h 24/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON95_V' AND effective_at = '2026-09-24 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON95_III', 27680, 28230, '2026-09-24 15:00:00', 'Kỳ điều hành 15h 24/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON95_III' AND effective_at = '2026-09-24 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON92_E5', 27200, 27740, '2026-09-24 15:00:00', 'Kỳ điều hành 15h 24/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON92_E5' AND effective_at = '2026-09-24 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'DO0005', 28980, 29550, '2026-09-24 15:00:00', 'Kỳ điều hành 15h 24/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'DO0005' AND effective_at = '2026-09-24 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'DO001', 30380, 30980, '2026-09-24 15:00:00', 'Kỳ điều hành 15h 24/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'DO001' AND effective_at = '2026-09-24 15:00:00');

-- ─── Kỳ 17/09/2026 15:00 ────────────────────────────────────────────────────────
INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON95_V', 28180, 28740, '2026-09-17 15:00:00', 'Kỳ điều hành 15h 17/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON95_V' AND effective_at = '2026-09-17 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON95_III', 27410, 27950, '2026-09-17 15:00:00', 'Kỳ điều hành 15h 17/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON95_III' AND effective_at = '2026-09-17 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON92_E5', 26950, 27480, '2026-09-17 15:00:00', 'Kỳ điều hành 15h 17/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON92_E5' AND effective_at = '2026-09-17 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'DO0005', 28620, 29190, '2026-09-17 15:00:00', 'Kỳ điều hành 15h 17/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'DO0005' AND effective_at = '2026-09-17 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'DO001', 30010, 30610, '2026-09-17 15:00:00', 'Kỳ điều hành 15h 17/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'DO001' AND effective_at = '2026-09-17 15:00:00');

-- ─── Kỳ 10/09/2026 15:00 ────────────────────────────────────────────────────────
INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON95_V', 28550, 29120, '2026-09-10 15:00:00', 'Kỳ điều hành 15h 10/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON95_V' AND effective_at = '2026-09-10 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON95_III', 27760, 28310, '2026-09-10 15:00:00', 'Kỳ điều hành 15h 10/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON95_III' AND effective_at = '2026-09-10 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON92_E5', 27310, 27850, '2026-09-10 15:00:00', 'Kỳ điều hành 15h 10/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON92_E5' AND effective_at = '2026-09-10 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'DO0005', 29050, 29630, '2026-09-10 15:00:00', 'Kỳ điều hành 15h 10/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'DO0005' AND effective_at = '2026-09-10 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'DO001', 30450, 31050, '2026-09-10 15:00:00', 'Kỳ điều hành 15h 10/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'DO001' AND effective_at = '2026-09-10 15:00:00');

-- ─── Kỳ 03/09/2026 15:00 ────────────────────────────────────────────────────────
INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON95_V', 28800, 29370, '2026-09-03 15:00:00', 'Kỳ điều hành 15h 03/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON95_V' AND effective_at = '2026-09-03 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON95_III', 28000, 28560, '2026-09-03 15:00:00', 'Kỳ điều hành 15h 03/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON95_III' AND effective_at = '2026-09-03 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'RON92_E5', 27530, 28080, '2026-09-03 15:00:00', 'Kỳ điều hành 15h 03/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'RON92_E5' AND effective_at = '2026-09-03 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'DO0005', 28900, 29470, '2026-09-03 15:00:00', 'Kỳ điều hành 15h 03/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'DO0005' AND effective_at = '2026-09-03 15:00:00');

INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
SELECT 'DO001', 30290, 30890, '2026-09-03 15:00:00', 'Kỳ điều hành 15h 03/09/2026'
WHERE NOT EXISTS (SELECT 1 FROM fuel_manual WHERE symbol = 'DO001' AND effective_at = '2026-09-03 15:00:00');
