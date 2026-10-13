import type { PriceRecord, DailyCandle, FuelManualRecord, FuelSuggestionRecord } from './types.js';

// ─────────────────────────────────────────────────────────────────────────────
// WRITE
// ─────────────────────────────────────────────────────────────────────────────

/** Upsert giá mới vào bảng prices (batch insert) */
export async function upsertPrices(db: D1Database, records: PriceRecord[]): Promise<void> {
  if (records.length === 0) return;

  const stmts = records.map((r) =>
    db
      .prepare(
        `INSERT INTO prices (symbol, name, category, bid, ask, unit, change_pct, source, fetched_at, effective_at, stale)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        r.symbol,
        r.name,
        r.category,
        r.bid ?? r.buyPrice ?? null,
        r.ask ?? r.sellPrice ?? null,
        r.unit,
        r.change_pct ?? null,
        r.source,
        r.fetched_at ?? r.fetchedAt ?? new Date().toISOString(),
        r.effective_at ?? null,
        r.stale ?? 0,
      ),
  );

  await db.batch(stmts);
}

/** Ghi ingest_log sau mỗi lần fetch (hỗ trợ ok, error, warning) */
export async function logIngest(
  db: D1Database,
  source: string,
  status: 'ok' | 'error' | 'warning',
  message?: string,
): Promise<void> {
  const createdAt = new Date().toISOString().replace('T', ' ').slice(0, 19);
  await db
    .prepare(
      `INSERT INTO ingest_log (source, status, message, created_at)
       VALUES (?, ?, ?, ?)`,
    )
    .bind(source, status, message ?? null, createdAt)
    .run();
}

/** Lưu bản ghi giá xăng dầu nhập tay vào bảng fuel_manual */
export async function insertFuelManual(
  db: D1Database,
  item: FuelManualRecord,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fuel_manual (symbol, price_zone1, price_zone2, effective_at, note)
       VALUES (?, ?, ?, ?, ?)`,
    )
    .bind(
      item.symbol,
      item.price_zone1,
      item.price_zone2 ?? null,
      item.effective_at,
      item.note ?? null,
    )
    .run();
}

/** Lưu bản ghi gợi ý giá vào bảng fuel_suggestions */
export async function insertFuelSuggestion(
  db: D1Database,
  item: FuelSuggestionRecord,
): Promise<void> {
  await db
    .prepare(
      `INSERT INTO fuel_suggestions (source, symbol, name, price_zone1, price_zone2, effective_at, raw_text, status, image_url, needs_review, flags)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      item.source,
      item.symbol,
      item.name ?? null,
      item.price_zone1,
      item.price_zone2 ?? null,
      item.effective_at ?? null,
      item.raw_text ?? null,
      item.status ?? 'pending',
      item.image_url ?? null,
      item.needs_review ?? 0,
      item.flags ?? null,
    )
    .run();
}

/** Lấy danh sách gợi ý đang chờ duyệt */
export async function getPendingFuelSuggestions(
  db: D1Database,
): Promise<FuelSuggestionRecord[]> {
  const { results } = await db
    .prepare(
      `SELECT id, source, symbol, name, price_zone1, price_zone2, effective_at, raw_text, status, image_url, needs_review, flags, created_at
       FROM fuel_suggestions
       WHERE status = 'pending'
       ORDER BY created_at DESC, id DESC
       LIMIT 30`,
    )
    .all<FuelSuggestionRecord>();
  return results || [];
}

/** Cập nhật trạng thái gợi ý (approved, dismissed) */
export async function updateFuelSuggestionStatus(
  db: D1Database,
  id: number,
  status: 'approved' | 'dismissed',
): Promise<void> {
  await db
    .prepare(`UPDATE fuel_suggestions SET status = ? WHERE id = ?`)
    .bind(status, id)
    .run();
}

/** Lấy một gợi ý theo ID */
export async function getFuelSuggestionById(
  db: D1Database,
  id: number,
): Promise<FuelSuggestionRecord | null> {
  const row = await db
    .prepare(
      `SELECT id, source, symbol, name, price_zone1, price_zone2, effective_at, raw_text, status, image_url, needs_review, flags, created_at
       FROM fuel_suggestions
       WHERE id = ?`,
    )
    .bind(id)
    .first<FuelSuggestionRecord>();
  return row ?? null;
}

/** Lấy bản ghi giá xăng dầu thủ công mới nhất */
export async function getLatestFuelManual(
  db: D1Database,
  symbol?: string,
): Promise<FuelManualRecord[]> {
  if (symbol) {
    const { results } = await db
      .prepare(
        `SELECT id, symbol, price_zone1, price_zone2, effective_at, note, created_at
         FROM fuel_manual
         WHERE symbol = ?
         ORDER BY effective_at DESC, id DESC
         LIMIT 1`,
      )
      .bind(symbol)
      .all<FuelManualRecord>();
    return results || [];
  }

  const { results } = await db
    .prepare(
      `SELECT m.id, m.symbol, m.price_zone1, m.price_zone2, m.effective_at, m.note, m.created_at
       FROM fuel_manual m
       INNER JOIN (
         SELECT symbol, MAX(effective_at) AS max_effective
         FROM fuel_manual
         GROUP BY symbol
       ) latest ON m.symbol = latest.symbol AND m.effective_at = latest.max_effective
       ORDER BY m.symbol`,
    )
    .all<FuelManualRecord>();
  return results || [];
}

/** Lấy bản ghi mới nhất của một symbol cụ thể */
export async function getLatestSinglePrice(
  db: D1Database,
  symbol: string,
): Promise<{
  id: number;
  symbol: string;
  bid: number | null;
  ask: number | null;
  fetched_at: string;
  source: string;
  effective_at?: string | null;
  stale?: number | null;
} | null> {
  const row = await db
    .prepare(
      `SELECT id, symbol, bid, ask, fetched_at, source, effective_at, stale
       FROM prices
       WHERE symbol = ?
       ORDER BY fetched_at DESC, id DESC
       LIMIT 1`,
    )
    .bind(symbol)
    .first<{
      id: number;
      symbol: string;
      bid: number | null;
      ask: number | null;
      fetched_at: string;
      source: string;
      effective_at?: string | null;
      stale?: number | null;
    }>();

  return row ?? null;
}

/** Stub – lịch sử được lưu trực tiếp qua fetched_at trong prices */
export async function insertHistory(_db: D1Database, _records: PriceRecord[]): Promise<void> {}


// ─────────────────────────────────────────────────────────────────────────────
// READ – PRICES
// ─────────────────────────────────────────────────────────────────────────────

const FUEL_NAMES: Record<string, string> = {
  RON95_V: 'Xăng E10 RON 95-V',
  RON95_III: 'Xăng E10 RON 95-III',
  RON92_E5: 'Xăng E5 RON 92-II',
  DO0005: 'Dầu DO 0,05S-II',
  DO001: 'Dầu DO 0,001S-V',
};

/**
 * Trộn dữ liệu giá nhập tay: Giá hiển thị trên web LUÔN lấy từ bản ghi fuel_manual mới nhất (Yêu cầu 2)
 * Hiển thị mốc effective_at; nếu quá 10 ngày chưa có bản ghi mới, đánh dấu stale=1.
 */
async function mergeManualFuelPrices(
  db: D1Database,
  items: Record<string, unknown>[],
): Promise<Record<string, unknown>[]> {
  try {
    const manualList = await getLatestFuelManual(db);
    if (!manualList || manualList.length === 0) return items;

    const manualMap = new Map(manualList.map((m) => [m.symbol, m]));

    for (const item of items) {
      const sym = String(item.symbol || '');
      const manual = manualMap.get(sym);
      if (!manual) continue;

      const effectiveTime = new Date(manual.effective_at.replace(' ', 'T')).getTime();
      const isOver10Days = !isNaN(effectiveTime) && (Date.now() - effectiveTime > 10 * 86400 * 1000);

      item.price_zone1 = manual.price_zone1;
      item.price_zone2 = manual.price_zone2 ?? null;
      item.ask = manual.price_zone1;
      item.bid = manual.price_zone2 ?? null;
      item.source = manual.note
        ? `Petrolimex (thông cáo điều hành giá), cập nhật thủ công (${manual.note})`
        : 'Petrolimex (thông cáo điều hành giá), cập nhật thủ công';
      item.effective_at = manual.effective_at;
      item.stale = isOver10Days ? 1 : 0;
    }

    // Nếu có mã trong fuel_manual mà chưa có trong bảng prices
    for (const [sym, manual] of manualMap.entries()) {
      const exists = items.some((it) => it.symbol === sym);
      if (!exists) {
        const effectiveTime = new Date(manual.effective_at.replace(' ', 'T')).getTime();
        const isOver10Days = !isNaN(effectiveTime) && (Date.now() - effectiveTime > 10 * 86400 * 1000);

        items.push({
          id: manual.id ?? 0,
          symbol: sym,
          name: FUEL_NAMES[sym] ?? sym,
          category: 'fuel',
          price_zone1: manual.price_zone1,
          price_zone2: manual.price_zone2 ?? null,
          bid: manual.price_zone2 ?? null,
          ask: manual.price_zone1,
          unit: 'VND/lít',
          change_pct: 0,
          source: manual.note
            ? `Petrolimex (thông cáo điều hành giá), cập nhật thủ công (${manual.note})`
            : 'Petrolimex (thông cáo điều hành giá), cập nhật thủ công',
          fetched_at: manual.created_at ?? manual.effective_at,
          effective_at: manual.effective_at,
          stale: isOver10Days ? 1 : 0,
        });
      }
    }
  } catch (err) {
    console.warn('[mergeManualFuelPrices] Warning:', err);
  }
  return items;
}

/**
 * GET /api/prices
 * Giá mới nhất của mỗi symbol: lấy 1 bản ghi có fetched_at lớn nhất.
 * Trả về change_pct, fetched_at, effective_at, stale theo yêu cầu.
 */
export async function getLatestPrices(
  db: D1Database,
): Promise<Record<string, unknown>[]> {
  const { results } = await db
    .prepare(
      `SELECT
         p.id,
         p.symbol,
         p.name,
         p.category,
         p.bid,
         p.ask,
         p.unit,
         p.change_pct,
         p.source,
         p.fetched_at,
         p.effective_at,
         p.stale
       FROM prices p
       INNER JOIN (
         SELECT symbol, MAX(fetched_at) AS max_fetched
         FROM prices
         GROUP BY symbol
       ) latest
         ON p.symbol = latest.symbol
        AND p.fetched_at = latest.max_fetched
       ORDER BY p.category, p.symbol`,
    )
    .all();

  return mergeManualFuelPrices(db, results);
}

/** Lấy giá mới nhất theo category */
export async function getPricesByCategory(
  db: D1Database,
  category: string,
): Promise<Record<string, unknown>[]> {
  const { results } = await db
    .prepare(
      `SELECT
         p.id, p.symbol, p.name, p.category,
         p.bid, p.ask, p.unit, p.change_pct, p.source, p.fetched_at,
         p.effective_at, p.stale
       FROM prices p
       INNER JOIN (
         SELECT symbol, MAX(fetched_at) AS max_fetched
         FROM prices
         WHERE category = ?
         GROUP BY symbol
       ) latest
         ON p.symbol = latest.symbol
        AND p.fetched_at = latest.max_fetched
       WHERE p.category = ?
       ORDER BY p.symbol`,
    )
    .bind(category, category)
    .all();

  if (category === 'fuel') {
    return mergeManualFuelPrices(db, results);
  }

  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// READ – HISTORY
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/history?symbols=SJC-01,BRENT&range=30d
 * Lấy 1 điểm/ngày (giá gần nhất trong ngày) cho biểu đồ.
 * Hỗ trợ nhiều symbols trong một query.
 */
export async function getPriceHistoryMulti(
  db: D1Database,
  symbols: string[],
  days: number,
): Promise<Record<string, unknown>[]> {
  if (symbols.length === 0) return [];

  // Tạo placeholders: ?,?,?
  const placeholders = symbols.map(() => '?').join(',');

  // Lấy 1 điểm/ngày: MAX(fetched_at) nhóm theo (symbol, date)
  const { results } = await db
    .prepare(
      `SELECT
         p.symbol,
         COALESCE(p.ask, p.bid) AS price,
         DATE(p.fetched_at)     AS date,
         p.unit,
         p.source
       FROM prices p
       INNER JOIN (
         SELECT
           symbol,
           DATE(fetched_at)       AS day,
           MAX(fetched_at)        AS max_fetched
         FROM prices
         WHERE symbol IN (${placeholders})
           AND fetched_at >= datetime('now', ? || ' days')
         GROUP BY symbol, DATE(fetched_at)
       ) daily
         ON p.symbol = daily.symbol
        AND p.fetched_at = daily.max_fetched
       ORDER BY p.symbol, date ASC`,
    )
    .bind(...symbols, `-${days}`)
    .all();
  return results;
}

// ─────────────────────────────────────────────────────────────────────────────
// READ – NEWS
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/news?category=gold&limit=10
 * Tin tức mới nhất, lọc theo category nếu có.
 */
export async function getNews(
  db: D1Database,
  opts: { category?: string | null; limit: number },
): Promise<Record<string, unknown>[]> {
  if (opts.category) {
    const { results } = await db
      .prepare(
        `SELECT id, title, summary, category, url, source, published_at
         FROM news
         WHERE category = ?
         ORDER BY published_at DESC
         LIMIT ?`,
      )
      .bind(opts.category, opts.limit)
      .all();
    return results;
  }

  const { results } = await db
    .prepare(
      `SELECT id, title, summary, category, url, source, published_at
       FROM news
       ORDER BY published_at DESC
       LIMIT ?`,
    )
    .bind(opts.limit)
    .all();
  return results;
}

/**
 * Thêm các bài tin mới vào database (chống trùng bằng url UNIQUE với INSERT OR IGNORE)
 */
export async function insertNewsItems(
  db: D1Database,
  items: Array<{
    title: string;
    summary: string;
    category: string;
    url: string;
    source: string;
    published_at: string;
  }>,
): Promise<number> {
  if (items.length === 0) return 0;

  const stmts = items.map((item) =>
    db
      .prepare(
        `INSERT OR IGNORE INTO news (title, summary, category, url, source, published_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        item.title,
        item.summary,
        item.category,
        item.url,
        item.source,
        item.published_at,
      ),
  );

  const results = await db.batch(stmts);
  // Đếm số dòng thực sự được insert
  let inserted = 0;
  for (const r of results) {
    if (r.meta && r.meta.changes) {
      inserted += r.meta.changes;
    }
  }
  return inserted;
}

/**
 * Xóa tin tức cũ hơn số ngày quy định (mặc định 60 ngày)
 */
export async function cleanupOldNews(db: D1Database, olderThanDays: number = 60): Promise<number> {
  const result = await db
    .prepare(`DELETE FROM news WHERE published_at < datetime('now', ? || ' days')`)
    .bind(`-${olderThanDays}`)
    .run();
  return result.meta?.changes ?? 0;
}


// ─────────────────────────────────────────────────────────────────────────────
// READ – HEALTH
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Thời điểm cập nhật gần nhất (MAX fetched_at trong prices)
 */
export async function getLastUpdated(db: D1Database): Promise<string | null> {
  const row = await db
    .prepare(`SELECT MAX(fetched_at) AS last FROM prices`)
    .first<{ last: string | null }>();
  return row?.last ?? null;
}

/**
 * GET /api/health
 * Trạng thái từng source từ ingest_log (bản ghi mới nhất mỗi source).
 */
export async function getIngestStatus(
  db: D1Database,
): Promise<Record<string, unknown>[]> {
  const { results } = await db
    .prepare(
      `SELECT
         l.source,
         l.status,
         l.message,
         l.created_at
       FROM ingest_log l
       INNER JOIN (
         SELECT source, MAX(created_at) AS max_at
         FROM ingest_log
         GROUP BY source
       ) latest
         ON l.source = latest.source
        AND l.created_at = latest.max_at
       ORDER BY l.source`,
    )
    .all();
  return results;
}

/** Đếm tổng số bản ghi trong prices (để kiểm tra DB có dữ liệu chưa) */
export async function countPrices(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM prices`)
    .first<{ n: number }>();
  return row?.n ?? 0;
}



// ─────────────────────────────────────────────────────────────────────────────
// LEGACY – giữ lại để không break import cũ
// ─────────────────────────────────────────────────────────────────────────────
export async function getAllPrices(db: D1Database): Promise<Record<string, unknown>[]> {
  return getLatestPrices(db);
}

export async function getPriceHistory(
  db: D1Database,
  symbol: string,
  days: number = 30,
): Promise<Record<string, unknown>[]> {
  return getPriceHistoryMulti(db, [symbol], days);
}

// ─────────────────────────────────────────────────────────────────────────────
// DAILY CANDLES (OHLC)
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Upsert mảng nến ngày vào bảng daily_candles (chia batch tối đa 50)
 */
export async function upsertDailyCandles(
  db: D1Database,
  candles: DailyCandle[],
): Promise<number> {
  if (candles.length === 0) return 0;

  const BATCH_SIZE = 50;
  let totalInserted = 0;

  for (let i = 0; i < candles.length; i += BATCH_SIZE) {
    const chunk = candles.slice(i, i + BATCH_SIZE);
    const stmts = chunk.map((c) =>
      db
        .prepare(
          `INSERT INTO daily_candles (symbol, date, open, high, low, close, source)
           VALUES (?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(symbol, date) DO UPDATE SET
             open = excluded.open,
             high = excluded.high,
             low = excluded.low,
             close = excluded.close,
             source = excluded.source`,
        )
        .bind(c.symbol, c.date, c.open, c.high, c.low, c.close, c.source),
    );
    await db.batch(stmts);
    totalInserted += chunk.length;
  }

  return totalInserted;
}

/**
 * Cập nhật nến ngày hiện tại:
 * - Nếu chưa có: open = price, high = price, low = price, close = price
 * - Nếu đã có: open giữ nguyên, high = MAX(high, price), low = MIN(low, price), close = price
 */
export async function updateTodayCandle(
  db: D1Database,
  symbol: string,
  date: string,
  price: number,
  source: string,
): Promise<void> {
  if (price <= 0) return;

  await db
    .prepare(
      `INSERT INTO daily_candles (symbol, date, open, high, low, close, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(symbol, date) DO UPDATE SET
         high = MAX(daily_candles.high, excluded.close),
         low  = MIN(daily_candles.low, excluded.close),
         close = excluded.close,
         source = excluded.source`,
    )
    .bind(symbol, date, price, price, price, price, source)
    .run();
}

/**
 * Lấy danh sách nến theo symbol và ngày bắt đầu (sắp xếp tăng dần theo thời gian)
 */
export async function getDailyCandles(
  db: D1Database,
  symbol: string,
  startDate?: string,
): Promise<DailyCandle[]> {
  let query = `SELECT symbol, date, open, high, low, close, source FROM daily_candles WHERE symbol = ?`;
  const params: any[] = [symbol];

  if (startDate) {
    query += ` AND date >= ?`;
    params.push(startDate);
  }

  query += ` ORDER BY date ASC`;

  const { results } = await db.prepare(query).bind(...params).all<DailyCandle>();
  return results || [];
}

/**
 * Đếm số lượng nến trong daily_candles
 */
export async function countDailyCandles(db: D1Database): Promise<number> {
  const row = await db
    .prepare(`SELECT COUNT(*) AS n FROM daily_candles`)
    .first<{ n: number }>();
  return row?.n ?? 0;
}

